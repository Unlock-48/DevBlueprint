import { db } from "@/server/db";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; documentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนลบเอกสาร", 401);
  const { projectId, documentId } = await params;
  const document = await db.document.findFirst({
    where: {
      id: documentId,
      projectId,
      project: { deletedAt: null, workspace: { memberships: { some: { userId: user.id } } } },
    },
    select: { id: true, project: { select: { workspaceId: true } } },
  });
  if (!document) return errorResponse("ไม่พบเอกสาร", 404);
  const membership = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: document.project.workspaceId, userId: user.id } } });
  if (!membership || !canEdit(membership.role)) return errorResponse("คุณไม่มีสิทธิ์ลบเอกสาร", 403);
  await db.document.delete({ where: { id: documentId } });
  return new Response(null, { status: 204 });
}
