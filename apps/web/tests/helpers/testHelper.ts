import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaMssql } from '@prisma/adapter-mssql'
import bcrypt from 'bcryptjs'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:6060'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables')
}
const adapter = new PrismaMssql(connectionString)
export const testPrisma = new PrismaClient({ adapter })

export interface ApiResponse<T = any> {
  status: number
  body: T
  headers: Headers
}

export async function requestApi<T = any>(
  path: string,
  options?: RequestInit,
  sessionCookie?: string | null
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  let body: any = null
  try {
    body = await res.json()
  } catch {}

  return { status: res.status, body, headers: res.headers }
}

export async function ensureAdminUser(): Promise<{ username: string; rawPassword: string }> {
  const username = 'admin'
  const rawPassword = 'password123'
  const hashedPassword = await bcrypt.hash(rawPassword, 10)

  try {
    const existing = await testPrisma.users.findUnique({
      where: { Username: username },
    })

    if (!existing) {
      await testPrisma.users.create({
        data: { Username: username, Password: hashedPassword, Role: 'admin', TwoFactorEnabled: false },
      })
    } else {
      await testPrisma.users.update({
        where: { Username: username },
        data: { Password: hashedPassword, Role: 'admin', TwoFactorEnabled: false },
      })
    }
  } catch {
    try {
      const existing = await testPrisma.users.findUnique({ where: { Username: username } })
      if (existing) {
        await testPrisma.users.update({
          where: { Username: username },
          data: { Password: hashedPassword, Role: 'admin', TwoFactorEnabled: false },
        })
      }
    } catch {}
  }

  return { username, rawPassword }
}

export async function loginAndGetCookie(): Promise<string> {
  const { username, rawPassword } = await ensureAdminUser()
  const res = await requestApi('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password: rawPassword }),
  })

  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) {
    throw new Error('Failed to get session cookie during test login')
  }
  return setCookie.split(';')[0]
}
