import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi, loginAndGetCookie, testPrisma } from '../../helpers/testHelper'

describe('Integration: Production Logs & Inventory IN Flow (tests/integration/productionLogs/productionLogs.integration.spec.ts)', () => {
  let sessionCookie: string
  let testProductId: number

  before(async () => {
    sessionCookie = await loginAndGetCookie()

    const product = await testPrisma.products.create({
      data: {
        ProductName: 'Integration Test Motor Servo 750W',
        Unit: 'unit',
        MinStock: 15,
      },
    })
    testProductId = product.ProductID
  })

  after(async () => {
    if (testProductId) {
      await testPrisma.inventoryMovements.deleteMany({ where: { ProductID: testProductId } })
      await testPrisma.productionLogs.deleteMany({ where: { ProductID: testProductId } })
      await testPrisma.products.deleteMany({ where: { ProductID: testProductId } })
    }
  })

  it('🔴 Flow: POST /api/production-logs -> verify atomic movement in GET /api/inventory/movements?type=IN', async () => {
    const res = await requestApi(
      '/api/production-logs',
      {
        method: 'POST',
        body: JSON.stringify({
          product_id: testProductId,
          quantity: 300,
          operator_name: 'Shift 1 Lead',
        }),
      },
      sessionCookie
    )

    assert.equal(res.status, 201)
    assert.ok(res.body.LogID)
    assert.equal(res.body.Quantity, 300)

    const movementsRes = await requestApi('/api/inventory/movements?type=IN', {}, sessionCookie)
    assert.equal(movementsRes.status, 200)
    const movement = movementsRes.body.find((m: any) => m.ProductID === testProductId)
    assert.ok(movement)
    assert.equal(movement.Quantity, 300)
    assert.equal(movement.MovementType, 'IN')
  })
})
