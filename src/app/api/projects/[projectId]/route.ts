import { z } from "zod";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";
import { db } from "@/server/db";

const projectInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  starred: z.boolean().optional(),
}).refine((value) => value.name !== undefined || value.description !== undefined || value.starred !== undefined, "ต้องมีข้อมูลที่ต้องการแก้ไข");

async function getAuthorizedProject(projectId: string, userId: string, write = false) {
  const project = await db.project.findFirst({
    where: { id: projectId, deletedAt: null, workspace: { memberships: { some: { userId } } } },
  });
  if (!project) return { error: errorResponse("ไม่พบโปรเจกต์", 404) } as const;
  if (write) {
    const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } } });
    if (!membership || !canEdit(membership.role)) return { error: errorResponse("คุณไม่มีสิทธิ์แก้ไขโปรเจกต์นี้", 403) } as const;
  }
  return { project } as const;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนแก้ไขโปรเจกต์", 401);
  const { projectId } = await params;
  const access = await getAuthorizedProject(projectId, user.id, true);
  if ("error" in access) return access.error;
  const parsed = projectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });
  const project = await db.project.update({ where: { id: projectId }, data: parsed.data, select: { id: true, name: true, description: true, starred: true, createdAt: true, updatedAt: true } });
  return Response.json({ project });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนลบโปรเจกต์", 401);
  const { projectId } = await params;
  const access = await getAuthorizedProject(projectId, user.id, true);
  if ("error" in access) return access.error;
  await db.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } });
  return new Response(null, { status: 204 });
}
