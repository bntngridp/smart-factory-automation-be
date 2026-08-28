import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { loginUser, changeUserPassword } from '../../../src/services/authService'
import { hashPassword, comparePassword } from '../../../src/lib/auth'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: AuthService (tests/unit/auth/auth.service.spec.ts)', () => {
  const testUsername = `unit_auth_user_${Date.now()}`
  let testUserId: number

  before(async () => {
    const hashed = await hashPassword('password123')
    const user = await testPrisma.users.create({
      data: {
        Username: testUsername,
        Password: hashed,
        Role: 'operator',
        TwoFactorEnabled: false,
      },
    })
    testUserId = user.UserID
  })

  after(async () => {
    if (testUserId) {
      await testPrisma.users.deleteMany({ where: { UserID: testUserId } })
    }
  })

  describe('password hashing & comparison', () => {
    it('should hash a password and verify successfully', async () => {
      const plain = 'secret123'
      const hashed = await hashPassword(plain)
      assert.notEqual(plain, hashed)
      const isValid = await comparePassword(plain, hashed)
      assert.equal(isValid, true)
    })

    it('should fail comparison for wrong password', async () => {
      const hashed = await hashPassword('secret123')
      const isValid = await comparePassword('wrongpass', hashed)
      assert.equal(isValid, false)
    })
  })

  describe('loginUser', () => {
    it('should return user object for valid credentials', async () => {
      const user = await loginUser(testUsername, 'password123')
      assert.ok(user)
      assert.equal(user.Username, testUsername)
      assert.equal(user.Role, 'operator')
    })

    it('should throw error for wrong password', async () => {
      await assert.rejects(
        async () => loginUser(testUsername, 'wrong_pass'),
        /Username atau password salah/
      )
    })

    it('should throw error for non-existent user', async () => {
      await assert.rejects(
        async () => loginUser('non_existent_user_99', 'password123'),
        /Username atau password salah/
      )
    })

    it('should throw error for empty username or password', async () => {
      await assert.rejects(
        async () => loginUser('', 'password123'),
        /Username tidak boleh kosong/
      )
      await assert.rejects(
        async () => loginUser(testUsername, ''),
        /Password tidak boleh kosong/
      )
    })
  })

  describe('changeUserPassword', () => {
    it('should successfully change password when current password matches', async () => {
      await changeUserPassword(testUserId, 'password123', 'newPassword456')
      const user = await loginUser(testUsername, 'newPassword456')
      assert.ok(user)
    })

    it('should throw error when current password is wrong', async () => {
      await assert.rejects(
        async () => changeUserPassword(testUserId, 'wrongCurrent', 'validNewPassword'),
        /Kata sandi saat ini tidak valid/
      )
    })

    it('should throw error when new password is too short (< 6 chars)', async () => {
      await assert.rejects(
        async () => changeUserPassword(testUserId, 'newPassword456', '123'),
        /Kata sandi baru minimal 6 karakter/
      )
    })
  })
})
