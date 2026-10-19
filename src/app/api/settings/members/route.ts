import { z } from "zod";
import { Role } from "@prisma/client";
import { db } from "@/server/db";
import { canManageWorkspace, errorResponse, getCurrentUser } from "@/server/project-auth";

const memberSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).default("VIEWER"),
});

async function getManagerContext() {
  const user = await getCurrentUser();
  if (!user) return { error: errorResponse("กรุณาเข้าสู่ระบบก่อนจัดการสมาชิก", 401) } as const;
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) return { error: errorResponse("ไม่พบ workspace ของผู้ใช้", 404) } as const;
  if (!canManageWorkspace(membership.role)) return { error: errorResponse("เฉพาะ OWNER หรือ ADMIN เท่านั้นที่จัดการสมาชิกได้", 403) } as const;
  return { user, membership } as const;
}

export async function GET() {
  const context = await getManagerContext();
  if ("error" in context) return context.error;
  const members = await db.membership.findMany({
    where: { workspaceId: context.membership.workspaceId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  return Response.json({ members });
}

export async function POST(request: Request) {
  const context = await getManagerContext();
  if ("error" in context) return context.error;
  const parsed = memberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const target = await db.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!target) return Response.json({ error: { code: "USER_NOT_FOUND", message: "ยังไม่พบผู้ใช้นี้ กรุณาให้ผู้ใช้สมัครสมาชิกก่อน" } }, { status: 404 });
  if (target.id === context.user.id) return Response.json({ error: { code: "INVALID_MEMBER", message: "ไม่สามารถเพิ่มตัวเองซ้ำได้" } }, { status: 400 });
  const existing = await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: context.membership.workspaceId, userId: target.id } } });
  if (existing) return Response.json({ error: { code: "MEMBER_EXISTS", message: "ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว" } }, { status: 409 });
  const member = await db.membership.create({
    data: { workspaceId: context.membership.workspaceId, userId: target.id, role: parsed.data.role as Role },
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  return Response.json({ member }, { status: 201 });
}
