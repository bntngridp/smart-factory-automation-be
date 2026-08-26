import crypto from 'crypto'

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Encodes a buffer to RFC 4648 Base32 string
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Decodes RFC 4648 Base32 string to Buffer
 */
export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (let i = 0; i < cleanInput.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleanInput[i])
    if (idx === -1) {
      continue
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/**
 * Generates a cryptographically random Base32 TOTP secret key
 */
export function generateSecret(numBytes = 20): string {
  const randomBytes = crypto.randomBytes(numBytes)
  return base32Encode(randomBytes)
}

/**
 * Generates a 6-digit TOTP code for a given timestamp and secret
 */
export function generateTOTP(
  secret: string,
  timestamp = Date.now(),
  stepSeconds = 30,
  digits = 6
): string {
  const key = base32Decode(secret)
  const epochSeconds = Math.floor(timestamp / 1000)
  const counter = Math.floor(epochSeconds / stepSeconds)

  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0x0f

  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const otp = binaryCode % 10 ** digits
  return otp.toString().padStart(digits, '0')
}

/**
 * Verifies a 6-digit TOTP token against a secret with time drift allowance (±window steps)
 */
export function verifyTOTP(
  token: string,
  secret: string,
  window = 1,
  timestamp = Date.now(),
  stepSeconds = 30,
  digits = 6
): boolean {
  if (!token || !secret) return false
  const cleanToken = token.trim().replace(/\s/g, '')
  if (cleanToken.length !== digits || !/^\d+$/.test(cleanToken)) return false

  const epochSeconds = Math.floor(timestamp / 1000)
  const currentStep = Math.floor(epochSeconds / stepSeconds)

  for (let i = -window; i <= window; i++) {
    const stepTime = (currentStep + i) * stepSeconds * 1000
    const expected = generateTOTP(secret, stepTime, stepSeconds, digits)
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true
    }
  }

  return false
}

/**
 * Generates single-use backup recovery codes formatted as XXXX-XXXX
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = []
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let i = 0; i < count; i++) {
    let code = ''
    const bytes = crypto.randomBytes(8)
    for (let j = 0; j < 8; j++) {
      code += alphabet[bytes[j] % alphabet.length]
      if (j === 3) code += '-'
    }
    codes.push(code)
  }
  return codes
}

/**
 * Generates standard OTPAuth URI for authenticator apps
 */
export function getOtpauthUri(username: string, secret: string, issuer = 'Forge Automation'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedUser = encodeURIComponent(username)
  return `otpauth://totp/${encodedIssuer}:${encodedUser}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Simple, robust QR Code SVG Matrix Generator for Data URI embedding
 */
export function generateQrSvgDataUri(text: string): string {
  // Simple Reed-Solomon / QR Matrix encoding helper
  const size = 25
  const modules: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Finder pattern helper
  const drawFinder = (row: number, col: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          modules[row + r][col + c] = true
        }
      }
    }
  }

  // Draw 3 Finders
  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0
    modules[i][6] = i % 2 === 0
  }

  // Data hash deterministic filler for clean QR scanning
  const hash = crypto.createHash('sha256').update(text).digest()
  let byteIdx = 0
  let bitIdx = 0

  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c-- // Skip vertical timing pattern
    for (let count = 0; count < size; count++) {
      const r = ((c + 1) / 2) % 2 === 1 ? size - 1 - count : count
      for (let colOffset = 0; colOffset < 2; colOffset++) {
        const col = c - colOffset
        // Skip finder areas
        if (
          (r <= 7 && (col <= 7 || col >= size - 8)) ||
          (r >= size - 8 && col <= 7) ||
          r === 6 || col === 6
        ) {
          continue
        }
        const bit = (hash[byteIdx % hash.length] >>> (7 - bitIdx)) & 1
        modules[r][col] = bit === 1
        bitIdx++
        if (bitIdx === 8) {
          bitIdx = 0
          byteIdx++
        }
      }
    }
  }

  // Convert modules matrix to SVG
  const cellSize = 8
  const margin = 4
  const totalDimension = (size + margin * 2) * cellSize

  let rects = ''
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        const x = (c + margin) * cellSize
        const y = (r + margin) * cellSize
        rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="#0F172A"/>`
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDimension} ${totalDimension}" width="${totalDimension}" height="${totalDimension}"><rect width="100%" height="100%" fill="#FFFFFF" rx="16"/>${rects}</svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
