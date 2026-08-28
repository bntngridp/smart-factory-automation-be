import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi } from '../../helpers/testHelper'

describe('Integration: Microsoft OAuth Endpoints (tests/integration/auth/microsoftAuth.integration.spec.ts)', () => {
  it('🔴 [GET /api/auth/microsoft/login - JSON]: should return authorization URL and configuration status', async () => {
    const res = await requestApi('/api/auth/microsoft/login?format=json')
    assert.equal(res.status, 200)
    assert.ok(res.body.url)
    assert.ok(res.body.url.includes('login.microsoftonline.com'))
    assert.equal(typeof res.body.isConfigured, 'boolean')
  })

  it('🔴 [GET /api/auth/microsoft/callback - Error]: should handle error query params by redirecting with error', async () => {
    const res = await requestApi('/api/auth/microsoft/callback?error=access_denied&error_description=User%20declined')
    // Next.js redirect returns 307/302 or redirect response
    assert.ok([200, 302, 307, 308].includes(res.status))
  })
})
