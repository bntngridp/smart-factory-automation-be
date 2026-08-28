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

export async function updateUser(userId: number, data: { Role?: string; Password?: string }) {
  const existing = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!existing) {
    throw new Error('Pengguna tidak ditemukan')
  }

  const updateData: { Role?: string; Password?: string } = {}
  if (data.Role) {
    const validRoles = ['admin', 'supervisor', 'operator']
    const roleLower = data.Role.toLowerCase()
    if (!validRoles.includes(roleLower)) {
      throw new Error('Peran pengguna harus salah satu dari: admin, supervisor, operator')
    }
    updateData.Role = roleLower
  }

  if (data.Password) {
    if (data.Password.length < 6) {
      throw new Error('Kata sandi minimal 6 karakter')
    }
    updateData.Password = data.Password
  }

  const updated = await prisma.users.update({
    where: { UserID: userId },
    data: updateData,
    select: {
      UserID: true,
      Username: true,
      Role: true,
    },
  })

  return updated
}

export async function deleteUser(userId: number) {
  const existing = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!existing) {
    throw new Error('Pengguna tidak ditemukan')
  }

  if (existing.Username.toLowerCase() === 'admin' || existing.UserID === 1006) {
    throw new Error('Akun Administrator utama sistem tidak dapat dihapus')
  }

  // Count total admins to ensure at least 1 remains
  if (existing.Role.toLowerCase() === 'admin') {
    const adminCount = await prisma.users.count({
      where: { Role: 'admin' },
    })
    if (adminCount <= 1) {
      throw new Error('Tidak dapat menghapus satu-satunya Administrator yang tersisa')
    }
  }

  await prisma.users.delete({
    where: { UserID: userId },
  })

  return { success: true, message: `Akun pengguna ${existing.Username} berhasil dihapus` }
}

