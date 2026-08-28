import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  getMicrosoftConfig,
  getMicrosoftAuthUrl,
  isMicrosoftConfigured,
  handleMicrosoftSSOLogin,
} from '../../../src/services/microsoftAuthService'
import { verifyToken } from '../../../src/lib/auth'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: Microsoft OAuth Service (tests/unit/auth/microsoftAuth.service.spec.ts)', () => {
  const testMsEmail = `ms_test_${Date.now()}@forge.inc`
  const testUsername = testMsEmail.split('@')[0]

  after(async () => {
    await testPrisma.users.deleteMany({ where: { Username: testUsername } })
  })

  it('🔴 [getMicrosoftConfig]: should return complete Microsoft OAuth configuration object', () => {
    const config = getMicrosoftConfig()
    assert.ok(config.clientId)
    assert.ok(config.clientSecret)
    assert.ok(config.tenantId)
    assert.ok(config.redirectUri)
  })

  it('🔴 [getMicrosoftAuthUrl]: should generate valid Microsoft Entra authorization URL with required OIDC scopes', () => {
    const { url, isConfigured } = getMicrosoftAuthUrl('test_state_123')
    assert.ok(url.includes('login.microsoftonline.com'))
    assert.ok(url.includes('response_type=code'))
    assert.ok(url.includes('scope=openid'))
    assert.ok(url.includes('state=test_state_123'))
    assert.equal(typeof isConfigured, 'boolean')
  })

  it('🔴 [handleMicrosoftSSOLogin]: should automatically provision new user from Microsoft Graph profile', async () => {
    const profile = {
      id: 'ms-unique-guid-12345',
      displayName: 'Bintang Microsoft User',
      mail: testMsEmail,
      userPrincipalName: testMsEmail,
    }

    const res = await handleMicrosoftSSOLogin(profile)
    assert.ok(res.token)
    assert.equal(res.user.Username, testUsername)
    assert.equal(res.user.Role, 'operator')
    assert.equal(res.isNewUser, true)

    // Verify token validity
    const verified = await verifyToken(res.token)
    assert.ok(verified)
    assert.equal(verified?.Username, testUsername)
  })

  it('🔴 [handleMicrosoftSSOLogin - Existing]: should sign in existing user seamlessly', async () => {
    const profile = {
      id: 'ms-unique-guid-12345',
      displayName: 'Bintang Microsoft User',
      mail: testMsEmail,
      userPrincipalName: testMsEmail,
    }

    const res = await handleMicrosoftSSOLogin(profile)
    assert.ok(res.token)
    assert.equal(res.user.Username, testUsername)
    assert.equal(res.isNewUser, false)
  })

  it('🔴 [handleMicrosoftSSOLogin - Validation]: should throw error if profile has no email or userPrincipalName', async () => {
    await assert.rejects(
      async () => handleMicrosoftSSOLogin({ id: 'empty-email-profile' }),
      /Akun Microsoft tidak memiliki email/
    )
  })
})
