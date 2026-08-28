import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { signToken, verifyToken, UserSession } from '../../../src/lib/auth'

describe('Unit: AuthMiddleware & Token Security (tests/unit/auth/auth.middleware.spec.ts)', () => {
  const sampleUser: UserSession = {
    UserID: 1,
    Username: 'admin',
    Role: 'admin',
  }

  describe('signToken & verifyToken', () => {
    it('🔴 [verifyToken]: should verify a valid signed token and return payload', async () => {
      const token = await signToken(sampleUser)
      assert.ok(token, 'Token harus berhasil digenerate')
      assert.equal(typeof token, 'string')

      const verified = await verifyToken(token)
      assert.ok(verified)
      assert.equal(verified.UserID, 1)
      assert.equal(verified.Username, 'admin')
      assert.equal(verified.Role, 'admin')
    })

    it('🔴 [verifyToken]: should return null for invalid token string', async () => {
      const result = await verifyToken('invalid.jwt.token.here')
      assert.equal(result, null)
    })

    it('🔴 [verifyToken]: should return null for empty or missing token', async () => {
      const result = await verifyToken('')
      assert.equal(result, null)
    })
  })
})
