import 'server-only'
import { prisma } from '@/lib/db'
import {
  generateSecret,
  generateRecoveryCodes,
  getOtpauthUri,
  generateQrSvgDataUri,
  verifyTOTP,
} from '@/lib/totp'
import { comparePassword, signToken, verifyToken } from '@/lib/auth'
import { SignJWT, jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'smart-factory-secret-key-change-in-prod'
)

/**
 * Sign a short-lived temporary token for 2FA login challenge (valid 5 minutes)
 */
export async function signTemp2FAToken(user: { UserID: number; Username: string; Role: string }): Promise<string> {
  return new SignJWT({
    sub: String(user.UserID),
    username: user.Username,
    role: user.Role,
    type: '2fa_challenge',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(JWT_SECRET)
}

/**
 * Verify temporary 2FA token
 */
export async function verifyTemp2FAToken(token: string) {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  if (payload.type !== '2fa_challenge' || !payload.sub) {
    throw new Error('Token tantangan 2FA tidak valid atau telah kedaluwarsa')
  }
  return {
    userId: Number(payload.sub),
    username: payload.username as string,
    role: payload.role as string,
  }
}

/**
 * Initiates 2FA setup by generating a secret, recovery codes, and QR Code
 */
export async function initiate2FASetup(userId: number) {
  const user = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!user) {
    throw new Error('Pengguna tidak ditemukan')
  }

  const secret = generateSecret(20)
  const recoveryCodes = generateRecoveryCodes(8)
  const otpauthUri = getOtpauthUri(user.Username, secret, 'Forge Automation')
  const qrCodeUri = generateQrSvgDataUri(otpauthUri)

  return {
    secret,
    otpauthUri,
    qrCodeUri,
    recoveryCodes,
  }
}

/**
 * Validates the initial 6-digit TOTP code and activates 2FA on the user account
 */
export async function enable2FA(
  userId: number,
  secret: string,
  code: string,
  recoveryCodes: string[]
) {
  if (!secret || !code) {
    throw new Error('Kunci rahasia dan kode verifikasi 6-digit harus diisi')
  }

  const isValid = verifyTOTP(code, secret, 1)
  if (!isValid) {
    throw new Error('Kode verifikasi 6-digit salah atau telah kedaluwarsa. Pastikan waktu jam pada perangkat Anda akurat.')
  }

  const user = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!user) {
    throw new Error('Pengguna tidak ditemukan')
  }

  await prisma.users.update({
    where: { UserID: userId },
    data: {
      TwoFactorEnabled: true,
      TwoFactorSecret: secret,
      TwoFactorRecovery: JSON.stringify(recoveryCodes),
    },
  })

  return {
    success: true,
    message: 'Autentikasi Dua Faktor (2FA) berhasil diaktifkan.',
  }
}

/**
 * Disables 2FA on the user account
 */
export async function disable2FA(
  userId: number,
  confirmation?: { password?: string; code?: string }
) {
  const user = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!user) {
    throw new Error('Pengguna tidak ditemukan')
  }

  if (confirmation?.password) {
    const isPassValid = await comparePassword(confirmation.password, user.Password)
    if (!isPassValid) {
      throw new Error('Kata sandi yang Anda masukkan salah')
    }
  } else if (confirmation?.code && user.TwoFactorSecret) {
    const isCodeValid = verifyTOTP(confirmation.code, user.TwoFactorSecret, 1)
    if (!isCodeValid) {
      throw new Error('Kode 2FA tidak valid')
    }
  }

  await prisma.users.update({
    where: { UserID: userId },
    data: {
      TwoFactorEnabled: false,
      TwoFactorSecret: null,
      TwoFactorRecovery: null,
    },
  })

  return {
    success: true,
    message: 'Autentikasi Dua Faktor (2FA) telah dinonaktifkan.',
  }
}

/**
 * Verifies 2FA during login challenge using TOTP or single-use recovery code
 */
export async function verifyLogin2FA(tempToken: string, codeOrRecovery: string) {
  if (!tempToken || !codeOrRecovery) {
    throw new Error('Token sesi 2FA dan kode autentikasi harus diisi')
  }

  const { userId } = await verifyTemp2FAToken(tempToken)

  const user = await prisma.users.findUnique({
    where: { UserID: userId },
  })

  if (!user || !user.TwoFactorEnabled || !user.TwoFactorSecret) {
    throw new Error('Autentikasi Dua Faktor tidak aktif untuk akun ini')
  }

  const cleanInput = codeOrRecovery.trim().toUpperCase()
  let isVerified = false
  let updatedRecoveryCodes: string[] | null = null

  // 1. Check TOTP 6-digit code
  if (/^\d{6}$/.test(cleanInput)) {
    isVerified = verifyTOTP(cleanInput, user.TwoFactorSecret, 1)
  }

  // 2. If not verified yet, check single-use recovery codes
  if (!isVerified && user.TwoFactorRecovery) {
    try {
      const storedCodes: string[] = JSON.parse(user.TwoFactorRecovery)
      const codeIndex = storedCodes.findIndex((c) => c.replace(/[\s-]/g, '') === cleanInput.replace(/[\s-]/g, ''))
      if (codeIndex !== -1) {
        isVerified = true
        // Consume this recovery code
        storedCodes.splice(codeIndex, 1)
        updatedRecoveryCodes = storedCodes
      }
    } catch {
      // JSON parse error handled safely
    }
  }

  if (!isVerified) {
    throw new Error('Kode autentikasi 2FA atau kode pemulihan salah/kedaluwarsa')
  }

  // Update remaining recovery codes if a recovery code was consumed
  if (updatedRecoveryCodes !== null) {
    await prisma.users.update({
      where: { UserID: userId },
      data: {
        TwoFactorRecovery: JSON.stringify(updatedRecoveryCodes),
      },
    })
  }

  const token = await signToken({
    UserID: user.UserID,
    Username: user.Username,
    Role: user.Role,
  })

  return {
    user: {
      UserID: user.UserID,
      Username: user.Username,
      Role: user.Role,
      TwoFactorEnabled: user.TwoFactorEnabled,
    },
    token,
  }
}
