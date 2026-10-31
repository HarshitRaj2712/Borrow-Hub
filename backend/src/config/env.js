import { z } from 'zod'

const environmentSchema = z.object({
  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().trim().min(64, 'JWT_SECRET must be at least 64 characters'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  FRONTEND_BASE_URL: z.string().url().default('http://localhost:5173')
}).passthrough()

export function validateEnvironment(environment = process.env) {
  const result = environmentSchema.safeParse(environment)
  if (!result.success) {
    const details = result.error.issues.map(issue => `${issue.path.join('.') || 'environment'}: ${issue.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }
  return result.data
}
