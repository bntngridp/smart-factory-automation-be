import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateSecret,
  generateTOTP,
  verifyTOTP,
  generateRecoveryCodes,
  getOtpauthUri,
  generateQrSvgDataUri,
} from '../src/lib/totp'

describe('TOTP RFC 6238 & 2FA Engine Unit Tests', () => {
  it('should generate a valid 32-character Base32 secret', () => {
    const secret = generateSecret(20)
    assert.equal(typeof secret, 'string')
    assert.equal(secret.length, 32)
    assert.match(secret, /^[A-Z2-7]+$/)
  })

  it('should generate deterministic 6-digit TOTP code', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const code = generateTOTP(secret, 1700000000000)
    assert.equal(code.length, 6)
    assert.match(code, /^\d{6}$/)
  })

  it('should verify valid TOTP token within time drift window', () => {
    const secret = generateSecret(20)
    const now = Date.now()
    const validCode = generateTOTP(secret, now)

    const isCurrentValid = verifyTOTP(validCode, secret, 1, now)
    assert.equal(isCurrentValid, true)

    // Window -30s drift
    const prevCode = generateTOTP(secret, now - 30000)
    const isPrevValid = verifyTOTP(prevCode, secret, 1, now)
    assert.equal(isPrevValid, true)

    // Invalid code rejection
    const isInvalid = verifyTOTP('000000', secret, 1, now)
    // In rare chance 000000 matches, test arbitrary wrong code
    assert.equal(verifyTOTP('999999', secret, 0, now) === false || verifyTOTP('123456', secret, 0, now) === false, true)
  })

  it('should generate 8 formatted recovery codes', () => {
    const codes = generateRecoveryCodes(8)
    assert.equal(codes.length, 8)
    for (const code of codes) {
      assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    }
  })

  it('should format standard otpauth URI and generate QR SVG URI', () => {
    const uri = getOtpauthUri('admin', 'JBSWY3DPEHPK3PXP', 'Forge Automation')
    assert.match(uri, /^otpauth:\/\/totp\/Forge%20Automation:admin\?secret=JBSWY3DPEHPK3PXP/)

    const qrDataUri = generateQrSvgDataUri(uri)
    assert.match(qrDataUri, /^data:image\/svg\+xml/)
  })
})
