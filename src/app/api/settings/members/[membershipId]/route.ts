import { z } from "zod";
import { db } from "@/server/db";
import { canManageWorkspace, errorResponse, getCurrentUser } from "@/server/project-auth";

const roleSchema = z.object({ role: z.enum(["ADMIN", "EDITOR", "VIEWER"]) });

async function getContext(membershipId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: errorResponse("กรุณาเข้าสู่ระบบก่อนจัดการสมาชิก", 401) } as const;
  const actor = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (!actor) return { error: errorResponse("ไม่พบ workspace ของผู้ใช้", 404) } as const;
  if (!canManageWorkspace(actor.role)) return { error: errorResponse("คุณไม่มีสิทธิ์จัดการสมาชิก", 403) } as const;
  const target = await db.membership.findFirst({ where: { id: membershipId, workspaceId: actor.workspaceId }, include: { user: { select: { email: true, name: true } } } });
  if (!target) return { error: errorResponse("ไม่พบสมาชิก", 404) } as const;
  return { actor, target } as const;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await getContext((await params).membershipId);
  if ("error" in context) return context.error;
  if (context.target.role === "OWNER") return Response.json({ error: { code: "OWNER_PROTECTED", message: "ไม่สามารถเปลี่ยน role ของ OWNER ได้" } }, { status: 400 });
  const parsed = roleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });
  const member = await db.membership.update({ where: { id: context.target.id }, data: { role: parsed.data.role }, select: { id: true, role: true, user: { select: { id: true, name: true, email: true } } } });
  return Response.json({ member });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ membershipId: string }> }) {
  const context = await getContext((await params).membershipId);
  if ("error" in context) return context.error;
  if (context.target.role === "OWNER") return Response.json({ error: { code: "OWNER_PROTECTED", message: "ไม่สามารถลบ OWNER ได้" } }, { status: 400 });
  await db.membership.delete({ where: { id: context.target.id } });
  return new Response(null, { status: 204 });
}
