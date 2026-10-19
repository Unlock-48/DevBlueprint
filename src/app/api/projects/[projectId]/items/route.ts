import { z } from "zod";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";
import { db } from "@/server/db";

const itemInput = z.object({
  title: z.string().trim().min(1).max(300),
  area: z.string().trim().min(1).max(80).default("New requirement"),
  phase: z.string().trim().min(1).max(120).default("ทั่วไป"),
  details: z.string().trim().max(1000).default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).default("TODO"),
  origin: z.enum(["EXPLICIT", "INFERRED", "PROPOSED"]).default("PROPOSED"),
});

async function getProject(projectId: string, userId: string) {
  const project = await db.project.findFirst({ where: { id: projectId, deletedAt: null, workspace: { memberships: { some: { userId } } } } });
  if (!project) return { error: errorResponse("ไม่พบโปรเจกต์", 404) } as const;
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } } });
  if (!membership || !canEdit(membership.role)) return { error: errorResponse("คุณไม่มีสิทธิ์แก้ไข checklist นี้", 403) } as const;
  return { project } as const;
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนเพิ่ม checklist", 401);
  const { projectId } = await params;
  const access = await getProject(projectId, user.id);
  if ("error" in access) return access.error;
  const parsed = itemInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });
  const last = await db.checklistItem.findFirst({ where: { projectId }, orderBy: { position: "desc" }, select: { position: true } });
  const item = await db.checklistItem.create({ data: { projectId, ...parsed.data, position: (last?.position ?? -1) + 1 } });
  return Response.json({ item }, { status: 201 });
}
