import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { generateTOTP } from '../src/lib/totp'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:6060'
let sessionCookie: string | null = null

async function api(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null
  try {
    body = await res.json()
  } catch {}

  return { status: res.status, body, headers: res.headers }
}

describe('2FA Full Workflow Integration Test', () => {
  before(async () => {
    // Initial login
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    assert.equal(res.status, 200)
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0]
    }
  })

  it('should complete the entire 2FA setup, enable, login challenge, recovery code, and disable lifecycle', async () => {
    // 1. Setup 2FA
    const setupRes = await api('/api/auth/2fa/setup', { method: 'POST' })
    assert.equal(setupRes.status, 200)
    assert.ok(setupRes.body.secret)
    assert.ok(setupRes.body.qrCodeUri)
    assert.equal(setupRes.body.recoveryCodes.length, 8)

    const secret = setupRes.body.secret
    const recoveryCodes = setupRes.body.recoveryCodes

    // 2. Try enabling with invalid code (should fail 400)
    const invalidEnable = await api('/api/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret, code: '000000', recoveryCodes }),
    })
    assert.equal(invalidEnable.status, 400)

    // 3. Enable with valid generated TOTP code
    const validCode = generateTOTP(secret)
    const enableRes = await api('/api/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ secret, code: validCode, recoveryCodes }),
    })
    assert.equal(enableRes.status, 200)
    assert.ok(enableRes.body.success)

    // 4. Verify me endpoint returns TwoFactorEnabled: true
    const meRes = await api('/api/auth/me')
    assert.equal(meRes.status, 200)
    assert.equal(meRes.body.user.TwoFactorEnabled, true)

    // 5. Login attempt now triggers requires2FA
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    assert.equal(loginRes.status, 200)
    assert.equal(loginRes.body.requires2FA, true)
    assert.ok(loginRes.body.tempToken)

    const tempToken = loginRes.body.tempToken

    // 6. Complete 2FA login with TOTP code
    const loginTOTPCode = generateTOTP(secret)
    const verifyLoginRes = await api('/api/auth/2fa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code: loginTOTPCode }),
    })
    assert.equal(verifyLoginRes.status, 200)
    assert.ok(verifyLoginRes.body.token)
    assert.equal(verifyLoginRes.body.user.Username, 'admin')

    // 7. Test login with single-use recovery code
    const login2Res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    })
    const tempToken2 = login2Res.body.tempToken

    const verifyRecoveryRes = await api('/api/auth/2fa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ tempToken: tempToken2, code: recoveryCodes[0] }),
    })
    assert.equal(verifyRecoveryRes.status, 200)
    assert.ok(verifyRecoveryRes.body.token)

    // 8. Disable 2FA
    const disableRes = await api('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ password: 'admin123' }),
    })
    assert.equal(disableRes.status, 200)
    assert.ok(disableRes.body.success)

    // 9. Verify 2FA is disabled
    const meAfterDisable = await api('/api/auth/me')
    assert.equal(meAfterDisable.body.user.TwoFactorEnabled, false)
  })
})
