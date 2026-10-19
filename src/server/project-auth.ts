import { auth } from "@/auth";
import { db } from "@/server/db";
import { Role } from "@prisma/client";

const editorRoles: Role[] = [Role.OWNER, Role.ADMIN, Role.EDITOR];
const managerRoles: Role[] = [Role.OWNER, Role.ADMIN];

export async function getCurrentUser() {
  const session = await auth();
  const userId = session?.user?.id;
  return userId ? db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, locale: true, theme: true } }) : null;
}

export async function getMembership(userId: string, workspaceId: string) {
  return db.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
}

export function canEdit(role: Role) {
  return editorRoles.includes(role);
}

export function canManageWorkspace(role: Role) {
  return managerRoles.includes(role);
}

export function errorResponse(message: string, status: number) {
  return Response.json({ error: { code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN", message } }, { status });
}
