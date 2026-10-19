import { Prisma } from "@prisma/client";
import { analyzeWithGemini } from "@/server/ai/gemini";
import { db } from "@/server/db";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";

async function authorizedProject(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null, workspace: { memberships: { some: { userId } } } },
    include: { documents: { where: { status: "PARSED" }, orderBy: { createdAt: "asc" }, select: { fileName: true, contentText: true } } },
  });
  if (!project) return { error: errorResponse("ไม่พบโปรเจกต์", 404) } as const;
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } } });
  if (!membership) return { error: errorResponse("คุณไม่มีสิทธิ์เข้าถึงโปรเจกต์นี้", 403) } as const;
  return { project, membership } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนดูผลวิเคราะห์", 401);
  const { projectId } = await params;
  const access = await authorizedProject(projectId, user.id);
  if ("error" in access) return access.error;
  const run = await db.analysisRun.findFirst({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    select: { id: true, provider: true, model: true, status: true, resultJson: true, errorMessage: true, startedAt: true, completedAt: true },
  });
  return Response.json({ run });
}

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนเริ่มวิเคราะห์", 401);
  const { projectId } = await params;
  const access = await authorizedProject(projectId, user.id);
  if ("error" in access) return access.error;
  if (!canEdit(access.membership.role)) return errorResponse("คุณไม่มีสิทธิ์เริ่มการวิเคราะห์", 403);
  if (!access.project.documents.length) {
    return Response.json({ error: { code: "NO_DOCUMENTS", message: "ต้องอัปโหลดเอกสารที่วิเคราะห์สำเร็จก่อน" } }, { status: 422 });
  }

  const provider = process.env.AI_DEFAULT_PROVIDER?.trim() || "gemini";
  if (provider !== "gemini") {
    return Response.json({ error: { code: "UNSUPPORTED_PROVIDER", message: `ยังไม่รองรับ provider ${provider} ในขั้นนี้` } }, { status: 501 });
  }
  const model = "gemini-3.8-flash";
  const run = await db.analysisRun.create({
    data: { projectId, createdById: user.id, provider, model, status: "PROCESSING" },
    select: { id: true, status: true, provider: true, model: true, startedAt: true },
  });

  try {
    const analysis = await analyzeWithGemini({
      projectName: access.project.name,
      projectDescription: access.project.description,
      documents: access.project.documents,
    });
    const completed = await db.$transaction(async (transaction) => {
      const existingTitles = await transaction.checklistItem.findMany({
        where: { projectId, origin: "PROPOSED", title: { in: analysis.result.checklist.map((item) => item.title) } },
        select: { title: true, phase: true },
      });
      const existingKeys = new Set(existingTitles.map((item) => `${item.phase}:${item.title}`));
      const generatedItems = analysis.result.checklist
        .filter((item) => !existingKeys.has(`${item.phase}:${item.title}`))
        .map((item, index) => ({
          projectId,
          title: item.title,
          area: item.area,
          phase: item.phase,
          details: item.details,
          priority: item.priority,
          origin: "PROPOSED" as const,
          position: index,
        }));
      if (generatedItems.length) await transaction.checklistItem.createMany({ data: generatedItems });
      return transaction.analysisRun.update({
        where: { id: run.id },
        data: { status: "COMPLETED", model: analysis.model, resultJson: analysis.result as Prisma.InputJsonValue, completedAt: new Date(), errorMessage: null },
        select: { id: true, status: true, provider: true, model: true, resultJson: true, startedAt: true, completedAt: true },
      });
    });
    return Response.json({ run: completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "การวิเคราะห์ล้มเหลว";
    await db.analysisRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: message, completedAt: new Date() } });
    return Response.json({ error: { code: "ANALYSIS_FAILED", message }, run: { ...run, status: "FAILED" } }, { status: 502 });
  }
}
