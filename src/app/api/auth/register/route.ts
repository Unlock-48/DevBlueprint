import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120).optional(),
});

function toSlug(input: string) {
  const cleaned = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "workspace";
}

function createWorkspaceSlug(base: string, attempt: number) {
  if (attempt === 0) {
    return base;
  }
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "ข้อมูลไม่ถูกต้อง",
          details: parsed.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return Response.json(
      {
        error: {
          code: "REGISTER_FAILED",
          message: "ไม่สามารถสมัครสมาชิกได้",
        },
      },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const workspaceBase = toSlug(parsed.data.name ?? email.split("@")[0]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slug = createWorkspaceSlug(workspaceBase, attempt);

    try {
      const user = await db.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email,
            passwordHash,
            name: parsed.data.name,
          },
        });

        const workspace = await tx.workspace.create({
          data: {
            slug,
            name: parsed.data.name ? `${parsed.data.name} Workspace` : "My Workspace",
          },
        });

        await tx.membership.create({
          data: {
            workspaceId: workspace.id,
            userId: createdUser.id,
            role: Role.OWNER,
          },
        });

        return createdUser;
      });

      return Response.json(
        {
          user: {
            id: user.id,
            email: user.email,
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(",")
          : String(error.meta?.target ?? "");

        if (target.includes("email")) {
          return Response.json(
            {
              error: {
                code: "REGISTER_FAILED",
                message: "ไม่สามารถสมัครสมาชิกได้",
              },
            },
            { status: 400 },
          );
        }

        continue;
      }

      throw error;
    }
  }

  return Response.json(
    {
      error: {
        code: "REGISTER_FAILED",
        message: "ไม่สามารถสมัครสมาชิกได้ในขณะนี้",
      },
    },
    { status: 500 },
  );
}
