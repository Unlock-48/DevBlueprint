import { db } from "@/server/db";
import { canEdit, errorResponse, getCurrentUser } from "@/server/project-auth";
import { parseDocument } from "@/server/document-parser";

const maxUploadBytes = 20 * 1024 * 1024;
const allowedExtensions = new Set(["md", "txt", "json", "yaml", "yml"]);

function extensionOf(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

async function getProjectAccess(projectId: string, userId: string, write = false) {
  const project = await db.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      workspace: { memberships: { some: { userId } } },
    },
  });
  if (!project) return { error: errorResponse("ไม่พบโปรเจกต์", 404) } as const;

  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: project.workspaceId, userId } },
  });
  if (!membership || (write && !canEdit(membership.role))) {
    return { error: errorResponse(write ? "คุณไม่มีสิทธิ์แก้ไขเอกสาร" : "คุณไม่มีสิทธิ์ดูเอกสาร", 403) } as const;
  }
  return { project } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนดูเอกสาร", 401);
  const { projectId } = await params;
  const access = await getProjectAccess(projectId, user.id);
  if ("error" in access) return access.error;

  const documents = await db.document.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, status: true, createdAt: true, _count: { select: { chunks: true } } },
  });
  return Response.json({ documents: documents.map(({ _count, ...document }) => ({ ...document, chunkCount: _count.chunks })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return errorResponse("กรุณาเข้าสู่ระบบก่อนอัปโหลดเอกสาร", 401);
  const { projectId } = await params;
  const access = await getProjectAccess(projectId, user.id, true);
  if ("error" in access) return access.error;

  const formData = await request.formData();
  const value = formData.get("file");
  if (!(value instanceof File)) {
    return Response.json({ error: { code: "VALIDATION_FAILED", message: "กรุณาเลือกไฟล์" } }, { status: 400 });
  }
  const extension = extensionOf(value.name);
  if (!allowedExtensions.has(extension)) {
    return Response.json({ error: { code: "UNSUPPORTED_FILE", message: "รองรับเฉพาะ .md, .txt, .json, .yaml และ .yml ในขั้นนี้" } }, { status: 415 });
  }
  if (value.size === 0 || value.size > maxUploadBytes) {
    return Response.json({ error: { code: "FILE_SIZE_INVALID", message: "ไฟล์ต้องมีขนาดมากกว่า 0 และไม่เกิน 20 MB" } }, { status: 413 });
  }

  const contentText = await value.text();
  let chunks;
  try {
    chunks = parseDocument(contentText, extension);
  } catch (error) {
    return Response.json({ error: { code: "PARSE_FAILED", message: error instanceof Error ? error.message : "ไม่สามารถวิเคราะห์เอกสารได้" } }, { status: 422 });
  }
  const document = await db.document.create({
    data: {
      projectId,
      fileName: value.name.slice(0, 255),
      mimeType: value.type || "text/plain",
      sizeBytes: value.size,
      contentText,
      status: "PARSED",
      chunks: { create: chunks },
    },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, status: true, createdAt: true, _count: { select: { chunks: true } } },
  });
  const { _count, ...documentMetadata } = document;
  return Response.json({ document: { ...documentMetadata, chunkCount: _count.chunks } }, { status: 201 });
}
