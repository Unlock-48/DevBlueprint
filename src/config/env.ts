import { z } from "zod";

const schema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().url(),
    AUTH_SECRET: z.string().min(32),
    S3_ENDPOINT: z.string().url(),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    MAX_UPLOAD_MB: z.coerce.number().int().positive().max(100).default(20),
    AI_DEFAULT_PROVIDER: z.enum(["anthropic", "openai", "gemini", "ollama"]),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error("❌ Invalid environment:", parsed.error.flatten().fieldErrors);
    process.exit(1);
}

export const env = parsed.data;
