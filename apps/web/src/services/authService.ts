import 'server-only'
import { prisma } from '@/lib/db'
import { comparePassword } from '@/lib/auth'

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
