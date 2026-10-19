import { PrismaClient } from "@prisma/client";

// ป้องกันปัญหาการสร้าง Connection ใหม่ซ้ำๆ เวลารันโหมด Development (Hot-Reload)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const db = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;