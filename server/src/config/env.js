import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').refine(
    (secret) => !/(replace-with|change-me|your-secret|<|>)/i.test(secret),
    'JWT_SECRET must be a private random value, not the example placeholder',
  ),
  JWT_EXPIRES_IN: z.string().default('1d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  const details = parsed.error.issues.map(({ path, message }) => `${path.join('.')}: ${message}`).join('; ')
  throw new Error(`Invalid environment configuration: ${details}`)
}

export const env = parsed.data
