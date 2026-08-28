import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../../src/services/productService'
import { testPrisma } from '../../helpers/testHelper'

describe('Unit: ProductService (tests/unit/products/products.service.spec.ts)', () => {
  let createdProductId: number

  before(async () => {
    // Clean products with unit test tag if any
    await testPrisma.products.deleteMany({
      where: { ProductName: { contains: 'Unit Test Product' } },
    })
  })

  after(async () => {
    if (createdProductId) {
      await testPrisma.inventoryMovements.deleteMany({ where: { ProductID: createdProductId } })
      await testPrisma.productionLogs.deleteMany({ where: { ProductID: createdProductId } })
      await testPrisma.products.deleteMany({ where: { ProductID: createdProductId } })
    }
  })

  it('🔴 [createProduct]: should create product with valid data', async () => {
    const product = await createProduct({
      ProductName: 'Unit Test Product Relay 24V',
      Unit: 'pcs',
      MinStock: 25,
    })

    assert.ok(product.ProductID)
    assert.equal(product.ProductName, 'Unit Test Product Relay 24V')
    assert.equal(product.Unit, 'pcs')
    assert.equal(product.MinStock, 25)
    createdProductId = product.ProductID
  })

  it('🔴 [createProduct - Validation]: should throw error for empty ProductName', async () => {
    await assert.rejects(
      async () => createProduct({ ProductName: '', Unit: 'pcs' }),
      /Nama produk wajib diisi/
    )
  })

  it('🔴 [createProduct - Validation]: should throw error for negative MinStock', async () => {
    await assert.rejects(
      async () => createProduct({ ProductName: 'Invalid Stock Prod', MinStock: -5 }),
      /Batas stok minimum tidak boleh bernilai negatif/
    )
  })

  it('🔴 [getProductById]: should retrieve product by ID', async () => {
    assert.ok(createdProductId)
    const product = await getProductById(createdProductId)
    assert.equal(product.ProductID, createdProductId)
    assert.equal(product.ProductName, 'Unit Test Product Relay 24V')
  })

  it('🔴 [getProductById - Error]: should throw 404 error if product not found', async () => {
    await assert.rejects(
      async () => getProductById(99999999),
      /tidak ditemukan/
    )
  })

  it('🟡 [getProducts - Search]: should filter products list by search term', async () => {
    const list = await getProducts('Relay 24V')
    assert.ok(Array.isArray(list))
    const found = list.find((p) => p.ProductID === createdProductId)
    assert.ok(found, 'Produk harus ditemukan dalam filter search')
  })

  it('🔴 [updateProduct]: should update product fields', async () => {
    const updated = await updateProduct(createdProductId, {
      ProductName: 'Unit Test Product Relay 24V Updated',
      MinStock: 50,
    })
    assert.equal(updated.ProductName, 'Unit Test Product Relay 24V Updated')
    assert.equal(updated.MinStock, 50)
  })

  it('🔴 [deleteProduct]: should delete product successfully', async () => {
    const result = await deleteProduct(createdProductId)
    assert.equal(result.success, true)

    await assert.rejects(
      async () => getProductById(createdProductId),
      /tidak ditemukan/
    )
    createdProductId = 0
  })
})
