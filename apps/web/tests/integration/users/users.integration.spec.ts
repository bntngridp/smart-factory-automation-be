import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi, loginAndGetCookie, testPrisma } from '../../helpers/testHelper'

describe('Integration: User Management & RBAC API (tests/integration/users/users.integration.spec.ts)', () => {
  let sessionCookie: string
  let createdUserId: number
  const testUsername = `integ_user_${Date.now()}`

  before(async () => {
    sessionCookie = await loginAndGetCookie()
  })

  after(async () => {
    if (createdUserId) {
      await testPrisma.users.deleteMany({ where: { UserID: createdUserId } })
    }
  })

  it('🔴 Flow: POST /api/users -> GET /api/users -> PATCH /api/users/[id] -> DELETE /api/users/[id]', async () => {
    // 1. Create User
    const createRes = await requestApi(
      '/api/users',
      {
        method: 'POST',
        body: JSON.stringify({
          username: testUsername,
          password: 'password123',
          role: 'operator',
        }),
      },
      sessionCookie
    )

    assert.equal(createRes.status, 201)
    assert.ok(createRes.body.UserID)
    assert.equal(createRes.body.Role, 'operator')
    createdUserId = createRes.body.UserID

    // 2. List Users
    const listRes = await requestApi('/api/users', {}, sessionCookie)
    assert.equal(listRes.status, 200)
    const found = listRes.body.find((u: any) => u.UserID === createdUserId)
    assert.ok(found)

    // 3. Update Role
    const patchRes = await requestApi(
      `/api/users/${createdUserId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role: 'supervisor' }),
      },
      sessionCookie
    )
    assert.equal(patchRes.status, 200)
    assert.equal(patchRes.body.Role, 'supervisor')

    // 4. Delete User
    const deleteRes = await requestApi(`/api/users/${createdUserId}`, { method: 'DELETE' }, sessionCookie)
    assert.equal(deleteRes.status, 200)
    createdUserId = 0
  })
})
