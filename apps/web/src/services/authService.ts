import { prisma } from '@/lib/db'
import { comparePassword, hashPassword } from '@/lib/auth'
import { verifyTOTP } from '@/lib/totp'
import { SignJWT, jwtVerify } from 'jose'

const SECRET_KEY = process.env.JWT_SECRET || 'dubu-secret-eagle-eye-key-shh'
const key = new TextEncoder().encode(SECRET_KEY)

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

/**
 * Step 1: Verify OTP from Microsoft Authenticator / Recovery Code and issue a short-lived reset token (5m)
 */
export async function verifyResetPasswordOTP(identifier: string, token: string) {
  if (!identifier || identifier.trim() === '') {
    throw new Error('Email kerja atau username wajib diisi')
  }
  if (!token || token.trim() === '') {
    throw new Error('Kode Microsoft Authenticator atau Recovery Code wajib diisi')
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

  // Sign a short-lived reset token (valid 5 minutes)
  const resetToken = await new SignJWT({
    sub: String(user.UserID),
    username: user.Username,
    type: 'password_reset_authorized',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key)

  return {
    valid: true,
    resetToken,
    username: user.Username,
    message: 'Identitas berhasil diverifikasi. Silakan masukkan kata sandi baru Anda.',
  }
}

/**
 * Step 2: Complete password reset using verified resetToken
 */
export async function completePasswordResetWithToken(resetToken: string, newPassword: string) {
  if (!resetToken || resetToken.trim() === '') {
    throw new Error('Token verifikasi reset tidak valid atau telah kedaluwarsa. Silakan ulangi langkah verifikasi.')
  }
  if (!newPassword || newPassword.length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter')
  }

  let payload
  try {
    const verified = await jwtVerify(resetToken, key)
    payload = verified.payload
  } catch {
    throw new Error('Sesi verifikasi reset telah kedaluwarsa (maks 5 menit). Silakan masukkan kembali kode OTP.')
  }

  if (payload.type !== 'password_reset_authorized' || !payload.sub) {
    throw new Error('Token verifikasi tidak valid.')
  }

  const userId = Number(payload.sub)
  const user = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!user) {
    throw new Error('Akun pengguna tidak ditemukan.')
  }

  const hashedPassword = await hashPassword(newPassword)
  await prisma.users.update({
    where: { UserID: userId },
    data: { Password: hashedPassword },
  })

  return {
    success: true,
    message: `Kata sandi untuk akun ${user.Username} berhasil diperbarui. Silakan login kembali.`,
  }
}

export type ResetPasswordInput = {
  identifier?: string
  token?: string
  resetToken?: string
  newPassword: string
}

export async function resetPasswordWithTOTP({
  identifier,
  token,
  resetToken,
  newPassword,
}: ResetPasswordInput) {
  // If resetToken is provided (Step 2 of 2-step wizard)
  if (resetToken) {
    return await completePasswordResetWithToken(resetToken, newPassword)
  }

  // Direct 1-step reset compatibility
  if (!identifier || !token) {
    throw new Error('Email dan kode OTP atau resetToken wajib diisi')
  }

  const verification = await verifyResetPasswordOTP(identifier, token)
  return await completePasswordResetWithToken(verification.resetToken, newPassword)
}
