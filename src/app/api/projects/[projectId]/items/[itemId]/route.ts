import { z } from "zod";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";
import { db } from "@/server/db";

const itemInput = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  area: z.string().trim().min(1).max(80).optional(),
  phase: z.string().trim().min(1).max(120).optional(),
  details: z.string().trim().max(1000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  origin: z.enum(["EXPLICIT", "INFERRED", "PROPOSED"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "ต้องมีข้อมูลที่ต้องการแก้ไข");

export async function PATCH(request: Request, { params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนแก้ไข checklist", 401);
  const { projectId, itemId } = await params;
  const item = await db.checklistItem.findFirst({ where: { id: itemId, projectId, project: { deletedAt: null, workspace: { memberships: { some: { userId: user.id } } } } }, include: { project: true } });
  if (!item) return errorResponse("ไม่พบ checklist", 404);
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: item.project.workspaceId, userId: user.id } } });
  if (!membership || !canEdit(membership.role)) return errorResponse("คุณไม่มีสิทธิ์แก้ไข checklist นี้", 403);
  const parsed = itemInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });
  const updated = await db.checklistItem.update({ where: { id: itemId }, data: parsed.data });
  return Response.json({ item: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; itemId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนลบ checklist", 401);
  const { projectId, itemId } = await params;
  const item = await db.checklistItem.findFirst({
    where: { id: itemId, projectId, project: { deletedAt: null, workspace: { memberships: { some: { userId: user.id } } } } },
    include: { project: true },
  });
  if (!item) return errorResponse("ไม่พบ checklist", 404);
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: item.project.workspaceId, userId: user.id } } });
  if (!membership || !canEdit(membership.role)) return errorResponse("คุณไม่มีสิทธิ์ลบ checklist นี้", 403);
  await db.checklistItem.delete({ where: { id: itemId } });
  return new Response(null, { status: 204 });
}
