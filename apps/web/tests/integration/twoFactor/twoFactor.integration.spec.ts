import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { generateTOTP } from '../../../src/lib/totp'
import { requestApi, ensureAdminUser } from '../../helpers/testHelper'

describe('Integration: 2FA Full Security Lifecycle (tests/integration/twoFactor/twoFactor.integration.spec.ts)', () => {
  let sessionCookie: string | null = null
  let adminCredentials: { username: string; rawPassword: string }

  before(async () => {
    adminCredentials = await ensureAdminUser()

    const res = await requestApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: adminCredentials.username,
        password: adminCredentials.rawPassword,
      }),
    })
    assert.equal(res.status, 200)
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0]
    }
  })

  it('🔴 Flow: 2FA Setup -> Enable -> Login Challenge -> TOTP verify -> Recovery Code verify -> Disable', async () => {
    // 1. Setup 2FA
    const setupRes = await requestApi('/api/auth/2fa/setup', { method: 'POST' }, sessionCookie)
    assert.equal(setupRes.status, 200)
    assert.ok(setupRes.body.secret)
    assert.ok(setupRes.body.qrCodeUri)
    assert.equal(setupRes.body.recoveryCodes.length, 8)

    const secret = setupRes.body.secret
    const recoveryCodes = setupRes.body.recoveryCodes

    // 2. Enable 2FA with valid TOTP code
    const validCode = generateTOTP(secret)
    const enableRes = await requestApi(
      '/api/auth/2fa/enable',
      {
        method: 'POST',
        body: JSON.stringify({ secret, code: validCode, recoveryCodes }),
      },
      sessionCookie
    )
    assert.equal(enableRes.status, 200)
    assert.ok(enableRes.body.success)

    // 3. Verify status in me endpoint
    const meRes = await requestApi('/api/auth/me', {}, sessionCookie)
    assert.equal(meRes.status, 200)
    assert.equal(meRes.body.user.TwoFactorEnabled, true)

    // 4. Intercept login with requires2FA
    const loginRes = await requestApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: adminCredentials.username,
        password: adminCredentials.rawPassword,
      }),
    })
    assert.equal(loginRes.status, 200)
    assert.equal(loginRes.body.requires2FA, true)
    assert.ok(loginRes.body.tempToken)

    const tempToken = loginRes.body.tempToken

    // 5. Complete login with TOTP code
    const loginTOTPCode = generateTOTP(secret)
    const verifyLoginRes = await requestApi('/api/auth/2fa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code: loginTOTPCode }),
    })
    assert.equal(verifyLoginRes.status, 200)
    assert.ok(verifyLoginRes.body.token)
    assert.equal(verifyLoginRes.body.user.Username, 'admin')

    // 6. Disable 2FA
    const disableRes = await requestApi(
      '/api/auth/2fa/disable',
      {
        method: 'POST',
        body: JSON.stringify({ password: adminCredentials.rawPassword }),
      },
      sessionCookie
    )
    assert.equal(disableRes.status, 200)
    assert.ok(disableRes.body.success)

    // 7. Verify 2FA is now disabled
    const meAfterDisable = await requestApi('/api/auth/me', {}, sessionCookie)
    assert.equal(meAfterDisable.body.user.TwoFactorEnabled, false)
  })
})
