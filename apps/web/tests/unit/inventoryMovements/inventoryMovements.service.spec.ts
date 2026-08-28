import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  getInventoryMovements,
  createStockOutMovement,
  calculateProductStock,
} from '../../../src/services/inventoryService'
import { createProductionLog } from '../../../src/services/productionService'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: InventoryService & Stock Calculation (tests/unit/inventoryMovements/inventoryMovements.service.spec.ts)', () => {
  let testProductId: number

  before(async () => {
    const product = await testPrisma.products.create({
      data: {
        ProductName: 'Unit Test Inverter Danfoss FC-51',
        Unit: 'unit',
        MinStock: 20,
      },
    })
    testProductId = product.ProductID

    // Seed 100 stock via production log
    await createProductionLog({
      ProductID: testProductId,
      Quantity: 100,
      OperatorName: 'Initial Stocker',
    })
  })

  after(async () => {
    if (testProductId) {
      await testPrisma.inventoryMovements.deleteMany({ where: { ProductID: testProductId } })
      await testPrisma.productionLogs.deleteMany({ where: { ProductID: testProductId } })
      await testPrisma.products.deleteMany({ where: { ProductID: testProductId } })
    }
  })

  it('🔴 [calculateProductStock]: should calculate correct stock: Sum(IN) - Sum(OUT)', async () => {
    const stockInitial = await calculateProductStock(testProductId)
    assert.equal(stockInitial, 100)

    // Deduct 30 units
    await createStockOutMovement(testProductId, 30)

    const stockAfter = await calculateProductStock(testProductId)
    assert.equal(stockAfter, 70)
  })

  it('🔴 [createStockOutMovement - Rejection]: should throw error when requested quantity exceeds available stock', async () => {
    // Current stock is 70, requesting 500 must fail
    await assert.rejects(
      async () => createStockOutMovement(testProductId, 500),
      /Stok tidak mencukupi/
    )
  })

  it('🔴 [createStockOutMovement - Validation]: should throw error for non-positive quantity', async () => {
    await assert.rejects(
      async () => createStockOutMovement(testProductId, 0),
      /Jumlah stok keluar harus lebih besar dari 0/
    )
  })

  it('🟡 [getInventoryMovements - Filter]: should filter movements by IN and OUT', async () => {
    const inMovements = await getInventoryMovements('IN')
    for (const m of inMovements) {
      assert.equal(m.MovementType, 'IN')
    }

    const outMovements = await getInventoryMovements('OUT')
    for (const m of outMovements) {
      assert.equal(m.MovementType, 'OUT')
    }
  })
})
