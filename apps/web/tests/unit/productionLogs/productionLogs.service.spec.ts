import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  getProductionLogs,
  createProductionLog,
} from '../../../src/services/productionService'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: ProductionService & Atomic Transactions (tests/unit/productionLogs/productionLogs.service.spec.ts)', () => {
  let testProductId: number
  let createdLogId: number

  before(async () => {
    const product = await testPrisma.products.create({
      data: {
        ProductName: 'Unit Test Production Gearbox GB-50',
        Unit: 'unit',
        MinStock: 10,
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

  it('🔴 [createProductionLog - Atomic Side-Effect]: should create production log and automatically record InventoryMovement IN', async () => {
    const log = await createProductionLog({
      ProductID: testProductId,
      Quantity: 150,
      OperatorName: 'Operator Unit Tester',
    })

    assert.ok(log.LogID)
    assert.equal(log.ProductID, testProductId)
    assert.equal(log.Quantity, 150)
    assert.equal(log.OperatorName, 'Operator Unit Tester')
    createdLogId = log.LogID

    // Verify atomic movement creation
    const movement = await testPrisma.inventoryMovements.findFirst({
      where: { ProductID: testProductId, MovementType: 'IN' },
    })
    assert.ok(movement, 'Mutasi IN harus dibuat secara atomik')
    assert.equal(movement.Quantity, 150)
  })

  it('🔴 [createProductionLog - Rollback]: should throw error and rollback when ProductID does not exist', async () => {
    await assert.rejects(
      async () =>
        createProductionLog({
          ProductID: 99999999,
          Quantity: 100,
          OperatorName: 'Ghost Operator',
        }),
      /tidak ditemukan/
    )
  })

  it('🔴 [createProductionLog - Validation]: should throw error for non-positive quantity', async () => {
    await assert.rejects(
      async () =>
        createProductionLog({
          ProductID: testProductId,
          Quantity: -10,
          OperatorName: 'Operator',
        }),
      /Jumlah produksi harus lebih besar dari 0/
    )
  })

  it('🟡 [getProductionLogs]: should list all recorded logs', async () => {
    const logs = await getProductionLogs()
    assert.ok(Array.isArray(logs))
    const found = logs.find((l) => l.LogID === createdLogId)
    assert.ok(found, 'Log yang baru dibuat harus ada dalam daftar')
  })
})
