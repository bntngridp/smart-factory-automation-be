import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../../../src/services/userService'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: UserService & RBAC (tests/unit/users/users.service.spec.ts)', () => {
  let createdUserId: number
  const uniqueUsername = `unit_user_${Date.now()}`

  before(async () => {
    await testPrisma.users.deleteMany({
      where: { Username: { contains: 'unit_user_' } },
    })
  })

  after(async () => {
    if (createdUserId) {
      await testPrisma.users.deleteMany({ where: { UserID: createdUserId } })
    }
  })

  it('🔴 [createUser]: should create a user and hash password', async () => {
    const user = await createUser({
      Username: uniqueUsername,
      Password: 'password123',
      Role: 'operator',
    })

    assert.ok(user.UserID)
    assert.equal(user.Username, uniqueUsername)
    assert.equal(user.Role, 'operator')
    assert.equal((user as any).Password, undefined, 'Password hash tidak boleh terekspos')
    createdUserId = user.UserID
  })

  it('🔴 [createUser - Duplicate]: should throw error when username is already taken', async () => {
    await assert.rejects(
      async () =>
        createUser({
          Username: uniqueUsername,
          Password: 'password123',
          Role: 'operator',
        }),
      /sudah terdaftar/
    )
  })

  it('🔴 [updateUser]: should update role of existing user', async () => {
    const updated = await updateUser(createdUserId, { Role: 'supervisor' })
    assert.equal(updated.Role, 'supervisor')
  })

  it('🔴 [getUsers]: should return list of users without password hashes', async () => {
    const list = await getUsers()
    assert.ok(Array.isArray(list))
    for (const u of list) {
      assert.equal((u as any).Password, undefined)
    }
  })

  it('🔴 [deleteUser]: should delete user successfully', async () => {
    const res = await deleteUser(createdUserId)
    assert.equal(res.success, true)

    await assert.rejects(
      async () => updateUser(createdUserId, { Role: 'admin' }),
      /tidak ditemukan/
    )
    createdUserId = 0
  })
})
