import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { requestApi, loginAndGetCookie, testPrisma } from '../../helpers/testHelper'

describe('Integration: Inventory Movements & Stock-Out Validation (tests/integration/inventoryMovements/inventoryMovements.integration.spec.ts)', () => {
  let sessionCookie: string
  let testProductId: number

  before(async () => {
    sessionCookie = await loginAndGetCookie()

    const product = await testPrisma.products.create({
      data: {
        ProductName: 'Integration Test Bearing SKF 6000',
        Unit: 'pcs',
        MinStock: 50,
      },
    })
    testProductId = product.ProductID

    // Deposit 120 stock
    await requestApi(
      '/api/production-logs',
      {
        method: 'POST',
        body: JSON.stringify({
          product_id: testProductId,
          quantity: 120,
          operator_name: 'Warehouse Inflow',
        }),
      },
      sessionCookie
    )
  })

  after(async () => {
    if (testProductId) {
      await testPrisma.inventoryMovements.deleteMany({ where: { ProductID: testProductId } })
      await testPrisma.productionLogs.deleteMany({ where: { ProductID: testProductId } })
      await testPrisma.products.deleteMany({ where: { ProductID: testProductId } })
    }
  })

  it('🔴 Flow: POST OUT movement within stock -> verify updated status', async () => {
    const res = await requestApi(
      '/api/inventory/movements',
      {
        method: 'POST',
        body: JSON.stringify({
          product_id: testProductId,
          quantity: 50,
          movement_type: 'OUT',
        }),
      },
      sessionCookie
    )

    assert.equal(res.status, 201)
    assert.equal(res.body.Quantity, 50)
    assert.equal(res.body.MovementType, 'OUT')
  })

  it('🔴 Negative: POST OUT movement exceeding stock returns 422 Unprocessable Entity', async () => {
    // Current stock is 120 - 50 = 70. Requesting 80 must return 422
    const res = await requestApi(
      '/api/inventory/movements',
      {
        method: 'POST',
        body: JSON.stringify({
          product_id: testProductId,
          quantity: 80,
          movement_type: 'OUT',
        }),
      },
      sessionCookie
    )

    assert.equal(res.status, 422)
    assert.ok(res.body.error.includes('Stok tidak mencukupi'))
  })
})
