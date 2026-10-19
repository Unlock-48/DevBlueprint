import { z } from "zod";

const analysisResultSchema = z.object({
  summary: z.string().min(1),
  stack: z.array(z.string()).max(30),
  structure: z.array(z.string()).max(500),
  issues: z.array(z.object({
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    title: z.string().min(1),
    detail: z.string().min(1),
  })).max(50),
  checklist: z.array(z.object({
    phase: z.string().min(1).max(120),
    area: z.string().min(1).max(120),
    title: z.string().min(1).max(300),
    details: z.string().min(1).max(1000),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  })).max(100),
  readinessScore: z.number().int().min(0).max(100),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

const responseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    stack: { type: "ARRAY", items: { type: "STRING" } },
    structure: { type: "ARRAY", items: { type: "STRING" } },
    issues: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          severity: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          title: { type: "STRING" },
          detail: { type: "STRING" },
        },
        required: ["severity", "title", "detail"],
      },
    },
    checklist: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          phase: { type: "STRING" },
          area: { type: "STRING" },
          title: { type: "STRING" },
          details: { type: "STRING" },
          priority: { type: "STRING", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
        },
        required: ["phase", "area", "title", "details", "priority"],
      },
    },
    readinessScore: { type: "INTEGER" },
  },
  required: ["summary", "stack", "structure", "issues", "checklist", "readinessScore"],
};

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`ยังไม่ได้ตั้งค่า ${name} ในไฟล์ .env`);
  return value;
}

function extractExplicitStructure(documents: Array<{ fileName: string; contentText: string }>) {
  for (const document of documents) {
    const fencedBlocks = [...document.contentText.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
    const candidates = [...fencedBlocks, document.contentText];
    for (const candidate of candidates) {
      const lines = candidate.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (!/^\s*[\w.@-]+\/\s*$/.test(lines[index] ?? "")) continue;
        const treeLines = lines.slice(index).filter((line) => line.trim().length > 0);
        if (treeLines.length >= 2 && treeLines.some((line) => /[├└│]/.test(line))) return treeLines.map((line) => line.trimEnd());
      }
    }
  }
  return [];
}

export async function analyzeWithGemini(input: { projectName: string; projectDescription: string; documents: Array<{ fileName: string; contentText: string }> }) {
  const apiKey = env("GEMINI_API_KEY");
  const model = "gemini-3.8-flash";
  const source = input.documents.map((document) => `### ${document.fileName}\n${document.contentText}`).join("\n\n").slice(0, 60000);
  const prompt = [
    "คุณเป็น senior software architect วิเคราะห์เอกสารที่อัปโหลดเพื่ออธิบายว่าเอกสารนี้เกี่ยวกับอะไร",
    "ตอบเป็น JSON ตาม schema เท่านั้น ห้ามใส่ markdown หรือข้อความนอก JSON",
    "summary ต้องเป็นคำอธิบายระดับกลาง ยาวประมาณ 3-5 ประโยค ครอบคลุมวัตถุประสงค์ ขอบเขต ผู้ใช้/ระบบที่เกี่ยวข้อง และสถานะของเอกสาร ห้ามสั้นเป็นประโยคเดียวและห้ามยาวเป็นบทความ",
    "ห้ามเดาข้อมูลที่ไม่มีหลักฐาน หากไม่พบให้ระบุว่าไม่พบหลักฐาน",
    `ชื่อโปรเจกต์: ${input.projectName}`,
    `รายละเอียด: ${input.projectDescription || "ไม่มีรายละเอียด"}`,
    `เอกสาร:\n${source}`,
    "stack: รายการภาษา/framework/database/tool ที่พบพร้อมชื่อสั้นๆ",
    "structure: ถ้าเอกสารมี file tree ให้คัดลอก path ทุกบรรทัดแบบตรงตัวและเรียงลำดับเดิม ห้ามย่อ ห้ามเติม path และห้ามอนุมาน; ถ้าไม่มีจริงๆ จึงค่อยใส่โครงสร้างที่มีหลักฐาน",
    "issues: ความเสี่ยงหรือข้อมูลที่ขาด โดย severity ต้องเป็น LOW, MEDIUM, HIGH หรือ CRITICAL",
    "checklist: แบ่งงานอย่างละเอียดเป็น phase, area, title, details และ priority โดย details ต้องบอกเป้าหมาย/ขอบเขต/ผลลัพธ์ที่ตรวจสอบได้ ไม่รวมหลายงานใหญ่ไว้ในรายการเดียว",
    "readinessScore: คะแนนความพร้อม 0-100 จากหลักฐานในเอกสาร",
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", responseSchema },
      }),
      signal: controller.signal,
    });
    const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!response.ok) {
      const providerMessage = payload.error?.message || `Gemini ตอบกลับด้วยสถานะ ${response.status}`;
      throw new Error(`Gemini (${model}) ไม่สามารถวิเคราะห์ได้: ${providerMessage}`);
    }
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini ไม่ส่งผลวิเคราะห์กลับมา");
    const parsed = analysisResultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error("รูปแบบผลวิเคราะห์จาก Gemini ไม่ถูกต้อง");
    const explicitStructure = extractExplicitStructure(input.documents);
    return { model, result: { ...parsed.data, structure: explicitStructure.length ? explicitStructure : parsed.data.structure } };
  } finally {
    clearTimeout(timeout);
  }
}
