import { z } from "zod";
import { db } from "@/server/db";
import { canManageWorkspace, errorResponse, getCurrentUser } from "@/server/project-auth";

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  workspaceName: z.string().trim().min(1).max(120).optional(),
  locale: z.enum(["th", "en"]).optional(),
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
}).refine((value) => Object.keys(value).length > 0, "ไม่มีข้อมูลที่ต้องแก้ไข");

async function getSettingsContext() {
  const user = await getCurrentUser();
  if (!user) return { error: errorResponse("กรุณาเข้าสู่ระบบก่อนใช้งานการตั้งค่า", 401) } as const;
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { workspace: true },
  });
  if (!membership) return { error: errorResponse("ไม่พบ workspace ของผู้ใช้", 404) } as const;
  return { user, membership } as const;
}

export async function GET() {
  const context = await getSettingsContext();
  if ("error" in context) return context.error;
  const { user, membership } = context;
  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, theme: user.theme },
    workspace: { id: membership.workspace.id, name: membership.workspace.name, slug: membership.workspace.slug },
    role: membership.role,
  });
}

export async function PATCH(request: Request) {
  const context = await getSettingsContext();
  if ("error" in context) return context.error;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: "VALIDATION_FAILED", details: parsed.error.flatten() } }, { status: 400 });
  }
  const { user, membership } = context;
  const data = parsed.data;
  if (data.workspaceName !== undefined && !canManageWorkspace(membership.role)) {
    return errorResponse("เฉพาะ OWNER หรือ ADMIN เท่านั้นที่แก้ชื่อ workspace ได้", 403);
  }
  const [updatedUser, updatedWorkspace] = await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { name: data.name, ...(data.theme ? { theme: data.theme } : {}) } }),
    data.workspaceName
      ? db.workspace.update({ where: { id: membership.workspaceId }, data: { name: data.workspaceName } })
      : db.workspace.findUniqueOrThrow({ where: { id: membership.workspaceId } }),
  ]);
  return Response.json({
    user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, theme: updatedUser.theme },
    workspace: { id: updatedWorkspace.id, name: updatedWorkspace.name, slug: updatedWorkspace.slug },
    role: membership.role,
  });
}
