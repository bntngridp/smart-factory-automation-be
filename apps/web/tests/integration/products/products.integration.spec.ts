import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi, loginAndGetCookie, testPrisma } from '../../helpers/testHelper'

describe('Integration: Products API Endpoints (tests/integration/products/products.integration.spec.ts)', () => {
  let sessionCookie: string
  let createdProductId: number

  before(async () => {
    sessionCookie = await loginAndGetCookie()
  })

  after(async () => {
    if (createdProductId) {
      await testPrisma.inventoryMovements.deleteMany({ where: { ProductID: createdProductId } })
      await testPrisma.productionLogs.deleteMany({ where: { ProductID: createdProductId } })
      await testPrisma.products.deleteMany({ where: { ProductID: createdProductId } })
    }
  })

  it('🔴 Flow: GET /api/products -> POST /api/products -> GET ?search=... -> PUT /api/products/[id] -> DELETE /api/products/[id]', async () => {
    // 1. List products
    const listRes = await requestApi('/api/products', {}, sessionCookie)
    assert.equal(listRes.status, 200)
    assert.ok(Array.isArray(listRes.body))

    // 2. Create product
    const createRes = await requestApi(
      '/api/products',
      {
        method: 'POST',
        body: JSON.stringify({
          ProductName: 'Integration Test Sensor OMRON D6F',
          Unit: 'pcs',
          MinStock: 30,
        }),
      },
      sessionCookie
    )

    assert.equal(createRes.status, 201)
    assert.ok(createRes.body.ProductID)
    createdProductId = createRes.body.ProductID

    // 3. Search product
    const searchRes = await requestApi('/api/products?search=OMRON+D6F', {}, sessionCookie)
    assert.equal(searchRes.status, 200)
    const found = searchRes.body.find((p: any) => p.ProductID === createdProductId)
    assert.ok(found)

    // 4. Update product
    const updateRes = await requestApi(
      `/api/products/${createdProductId}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          ProductName: 'Integration Test Sensor OMRON D6F Pro',
          MinStock: 45,
        }),
      },
      sessionCookie
    )
    assert.equal(updateRes.status, 200)
    assert.equal(updateRes.body.ProductName, 'Integration Test Sensor OMRON D6F Pro')

    // 5. Delete product
    const deleteRes = await requestApi(
      `/api/products/${createdProductId}`,
      { method: 'DELETE' },
      sessionCookie
    )
    assert.equal(deleteRes.status, 200)
    createdProductId = 0
  })

  it('🔴 Negative: POST /api/products with invalid body returns 400', async () => {
    const res = await requestApi(
      '/api/products',
      {
        method: 'POST',
        body: JSON.stringify({ ProductName: '', MinStock: -1 }),
      },
      sessionCookie
    )
    assert.equal(res.status, 400)
  })
})
