import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().default("http://127.0.0.1:5500"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-before-prod"),
  DATABASE_URL: z.string().optional(),
  UPLOAD_DIR: z.string().default("uploads")
});

export const env = envSchema.parse(process.env);
