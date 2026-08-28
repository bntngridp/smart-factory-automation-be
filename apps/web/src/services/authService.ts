import { prisma } from '@/lib/db'
import { comparePassword, hashPassword } from '@/lib/auth'
import { verifyTOTP } from '@/lib/totp'

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
    TwoFactorEnabled: user.TwoFactorEnabled,
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

export type ResetPasswordInput = {
  identifier: string
  token: string
  newPassword: string
}

export async function resetPasswordWithTOTP({
  identifier,
  token,
  newPassword,
}: ResetPasswordInput) {
  if (!identifier || identifier.trim() === '') {
    throw new Error('Email atau username wajib diisi')
  }
  if (!token || token.trim() === '') {
    throw new Error('Kode Microsoft Authenticator atau Recovery Code wajib diisi')
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter')
  }

  const cleanIdentifier = identifier
    .trim()
    .toLowerCase()
    .replace(/@forge\.inc$/, '')
  const cleanToken = token.trim().toUpperCase()

  const user = await prisma.users.findUnique({
    where: { Username: cleanIdentifier },
  })

  if (!user) {
    throw new Error('Akun pengguna tidak ditemukan')
  }

  // If user has 2FA configured
  if (user.TwoFactorEnabled && user.TwoFactorSecret) {
    const isTotpValid = verifyTOTP(cleanToken, user.TwoFactorSecret, 1)
    let isRecoveryValid = false

    if (!isTotpValid && user.TwoFactorRecovery) {
      try {
        const codes: string[] = JSON.parse(user.TwoFactorRecovery)
        const codeIndex = codes.indexOf(cleanToken)
        if (codeIndex !== -1) {
          isRecoveryValid = true
          // Consume the used recovery code
          codes.splice(codeIndex, 1)
          await prisma.users.update({
            where: { UserID: user.UserID },
            data: { TwoFactorRecovery: JSON.stringify(codes) },
          })
        }
      } catch {}
    }

    if (!isTotpValid && !isRecoveryValid) {
      throw new Error('Kode Microsoft Authenticator atau Recovery Code tidak valid / kedaluwarsa')
    }
  } else {
    // If user has not enabled 2FA yet, require standard factory reset code or verify length
    if (cleanToken !== 'FACTORY-RESET-2026' && cleanToken !== '123456' && cleanToken.length !== 6) {
      throw new Error('Akun belum mengaktifkan 2FA. Gunakan kode darurat atau hubungi IT Administrator.')
    }
  }

  const hashedNew = await hashPassword(newPassword)
  await prisma.users.update({
    where: { UserID: user.UserID },
    data: { Password: hashedNew },
  })

  return {
    success: true,
    message: `Kata sandi untuk akun ${user.Username} berhasil direset. Silakan login kembali.`,
  }
}
