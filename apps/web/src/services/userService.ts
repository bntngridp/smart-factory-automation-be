import 'server-only'
import { prisma } from '@/lib/db'

export type CreateUserInput = {
  Username: string
  Password?: string
  Role?: string
}

export async function getUsers() {
  const users = await prisma.users.findMany({
    select: {
      UserID: true,
      Username: true,
      Role: true,
    },
    orderBy: { UserID: 'asc' },
  })
  return users
}

export async function createUser(data: CreateUserInput) {
  if (!data.Username || data.Username.trim() === '') {
    throw new Error('Username tidak boleh kosong')
  }

  const existing = await prisma.users.findUnique({
    where: { Username: data.Username.trim() },
  })

  if (existing) {
    throw new Error(`Username "${data.Username.trim()}" sudah terdaftar`)
  }

  const user = await prisma.users.create({
    data: {
      Username: data.Username.trim(),
      Password: data.Password || 'password123',
      Role: data.Role || 'operator',
    },
    select: {
      UserID: true,
      Username: true,
      Role: true,
    },
  })

  return user
}
