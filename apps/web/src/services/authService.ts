import 'server-only'
import { prisma } from '@/lib/db'
import { comparePassword, hashPassword } from '@/lib/auth'

export async function loginUser(Username?: string, Password?: string) {
  if (!Username || Username.trim() === '') {
    throw new Error('Username tidak boleh kosong')
  }
  if (!Password || Password.trim() === '') {
    throw new Error('Password tidak boleh kosong')
  }

  const user = await prisma.users.findUnique({
    where: { Username: Username.trim() },
  })

  if (!user) {
    throw new Error('Username atau password salah')
  }

  const isPasswordValid = await comparePassword(Password, user.Password)
  if (!isPasswordValid) {
    throw new Error('Username atau password salah')
  }

  return {
    UserID: user.UserID,
    Username: user.Username,
    Role: user.Role,
  }
}

export async function changeUserPassword(userId: number, currentPass: string, newPass: string) {
  if (!currentPass || !newPass) {
    throw new Error('Kata sandi saat ini dan kata sandi baru harus diisi')
  }

  if (newPass.length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter')
  }

  const user = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!user) {
    throw new Error('Pengguna tidak ditemukan')
  }

  const isCurrentValid = await comparePassword(currentPass, user.Password)
  if (!isCurrentValid) {
    throw new Error('Kata sandi saat ini tidak valid / salah')
  }

  const hashedNew = await hashPassword(newPass)
  await prisma.users.update({
    where: { UserID: userId },
    data: { Password: hashedNew },
  })

  return { success: true, message: 'Kata sandi berhasil diperbarui' }
}
