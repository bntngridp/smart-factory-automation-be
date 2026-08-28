import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi, ensureAdminUser } from '../../helpers/testHelper'

describe('Integration: Authentication Workflow (tests/integration/auth/auth.integration.spec.ts)', () => {
  let adminCredentials: { username: string; rawPassword: string }
  let sessionCookie: string | null = null

  before(async () => {
    adminCredentials = await ensureAdminUser()
  })

  it('🔴 Flow: POST /api/auth/login -> Cookie -> GET /api/auth/me -> POST /api/auth/logout', async () => {
    // 1. Login
    const loginRes = await requestApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: adminCredentials.username,
        password: adminCredentials.rawPassword,
      }),
    })

    assert.equal(loginRes.status, 200)
    assert.equal(loginRes.body.success, true)
    assert.equal(loginRes.body.user.Username, 'admin')

    const setCookie = loginRes.headers.get('set-cookie')
    assert.ok(setCookie)
    sessionCookie = setCookie.split(';')[0]

    // 2. Fetch authenticated profile
    const meRes = await requestApi('/api/auth/me', {}, sessionCookie)
    assert.equal(meRes.status, 200)
    assert.equal(meRes.body.user.Username, 'admin')
    assert.equal(meRes.body.user.Role, 'admin')

    // 3. Logout
    const logoutRes = await requestApi('/api/auth/logout', { method: 'POST' }, sessionCookie)
    assert.equal(logoutRes.status, 200)
    assert.equal(logoutRes.body.success, true)
  })

  it('🔴 Negative: Reject unauthenticated request to /api/auth/me with 401', async () => {
    const res = await requestApi('/api/auth/me')
    assert.equal(res.status, 401)
  })

  it('🔴 Flow: POST /api/auth/reset-password -> Reset password via Microsoft Authenticator / OTP -> Login with new password', async () => {
    const resetRes = await requestApi('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'adminsatu@forge.inc',
        token: 'FACTORY-RESET-2026',
        newPassword: 'newAdminPassword2026',
      }),
    })

    assert.equal(resetRes.status, 200)
    assert.equal(resetRes.body.success, true)

    // Verify login with new password
    const loginNew = await requestApi('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'adminsatu',
        password: 'newAdminPassword2026',
      }),
    })
    assert.equal(loginNew.status, 200)

    // Revert password back to password123 for test reproducibility
    await requestApi('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'adminsatu',
        token: 'FACTORY-RESET-2026',
        newPassword: 'password123',
      }),
    })
  })
})
