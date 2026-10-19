import { z } from "zod";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";
import { db } from "@/server/db";

const projectInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  workspaceId: z.string().cuid().optional(),
});

const itemSelect = {
  id: true,
  title: true,
  area: true,
  phase: true,
  details: true,
  priority: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  origin: true,
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนใช้งานโปรเจกต์", 401);

  const projects = await db.project.findMany({
    where: { workspace: { memberships: { some: { userId: user.id } } }, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, description: true, starred: true, createdAt: true, updatedAt: true, documents: { select: { createdAt: true } }, items: { orderBy: { position: "asc" }, select: itemSelect } },
  });
  return Response.json({ projects });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนสร้างโปรเจกต์", 401);

  const parsed = projectInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });

  const membership = parsed.data.workspaceId
    ? await db.membership.findUnique({ where: { workspaceId_userId: { workspaceId: parsed.data.workspaceId, userId: user.id } } })
    : await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (!membership) return errorResponse("ไม่พบ workspace ที่คุณเป็นสมาชิก", 403);
  if (!canEdit(membership.role)) return errorResponse("คุณไม่มีสิทธิ์สร้างโปรเจกต์", 403);

  const project = await db.project.create({
    data: { workspaceId: membership.workspaceId, name: parsed.data.name, description: parsed.data.description },
    select: { id: true, name: true, description: true, starred: true, createdAt: true, updatedAt: true, items: { select: itemSelect } },
  });
  return Response.json({ project }, { status: 201 });
}
