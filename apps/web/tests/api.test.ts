import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:6060'

let sessionCookie: string | null = null

async function api(path: string, options?: RequestInit) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options?.headers,
  }

  if (sessionCookie) {
    headers['Cookie'] = sessionCookie
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (path === '/api/auth/login' && res.status === 200) {
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      sessionCookie = setCookie.split(';')[0]
    }
  }

  // Jika response tidak memiliki body (misal logout), jangan parse JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null
  try {
    body = await res.json()
  } catch {}

  return { status: res.status, body }
}

before(async () => {
  // Login secara otomatis sebelum testing route lain dimulai
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123',
    }),
  })
  assert.equal(status, 200)
  assert.ok(body.success)
})

describe('GET /api/products', () => {
  it('should return 200 with array of products', async () => {
    const { status, body } = await api('/api/products')
    assert.equal(status, 200)
    assert.ok(Array.isArray(body), 'Response harus array')
  })
})

describe('POST /api/products', () => {
  it('should return 201 for valid product', async () => {
    const { status, body } = await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({
        ProductName: 'Test Integration Product',
        Unit: 'pcs',
        MinStock: 10,
      }),
    })
    assert.equal(status, 201)
    assert.ok(body.ProductID, 'Harus punya ProductID')
    assert.equal(body.ProductName, 'Test Integration Product')
  })

  it('should return 400 for empty ProductName', async () => {
    const { status, body } = await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({ ProductName: '', Unit: 'pcs' }),
    })
    assert.equal(status, 400)
    assert.ok(body.error, 'Harus ada error message')
  })

  it('should return 400 for negative MinStock', async () => {
    const { status, body } = await api('/api/products', {
      method: 'POST',
      body: JSON.stringify({ ProductName: 'Test', MinStock: -5 }),
    })
    assert.equal(status, 400)
    assert.ok(body.error, 'Harus ada error message')
  })
})

describe('POST /api/production-logs', () => {
  let validProductId: number

  before(async () => {
    const { body } = await api('/api/products')
    assert.ok(body.length > 0, 'Harus ada minimal 1 produk di DB')
    validProductId = body[0].ProductID
  })

  it('should return 201 and create log + inventory movement', async () => {
    const beforeMovements = await api('/api/inventory/movements?type=IN')
    const beforeCount = Array.isArray(beforeMovements.body)
      ? beforeMovements.body.length
      : 0

    const { status, body } = await api('/api/production-logs', {
      method: 'POST',
      body: JSON.stringify({
        product_id: validProductId,
        quantity: 100,
        operator_name: 'Test Integration',
      }),
    })
    assert.equal(status, 201)
    assert.ok(body.LogID, 'Harus punya LogID')
    assert.equal(body.Quantity, 100)

    const afterMovements = await api('/api/inventory/movements?type=IN')
    assert.ok(
      Array.isArray(afterMovements.body),
      'Response harus array'
    )
    assert.ok(
      afterMovements.body.length > beforeCount,
      `InventoryMovements IN harus bertambah (before=${beforeCount}, after=${afterMovements.body.length})`
    )
  })

  it('should return 404 for non-existent product_id (rollback)', async () => {
    const { status, body } = await api('/api/production-logs', {
      method: 'POST',
      body: JSON.stringify({
        product_id: 99999,
        quantity: 100,
        operator_name: 'Test Rollback',
      }),
    })
    assert.equal(status, 404)
    assert.ok(body.error.includes('tidak ditemukan'))
  })

  it('should return 400 for missing fields', async () => {
    const { status } = await api('/api/production-logs', {
      method: 'POST',
      body: JSON.stringify({ product_id: validProductId }),
    })
    assert.equal(status, 400)
  })
})

describe('GET /api/inventory/movements', () => {
  it('should return 200 with array', async () => {
    const { status, body } = await api('/api/inventory/movements')
    assert.equal(status, 200)
    assert.ok(Array.isArray(body))
  })

  it('should filter by type=IN', async () => {
    const { status, body } = await api('/api/inventory/movements?type=IN')
    assert.equal(status, 200)
    assert.ok(Array.isArray(body))
    for (const m of body) {
      assert.equal(m.MovementType, 'IN')
    }
  })

  it('should filter by type=OUT', async () => {
    const { status, body } = await api('/api/inventory/movements?type=OUT')
    assert.equal(status, 200)
    assert.ok(Array.isArray(body))
    for (const m of body) {
      assert.equal(m.MovementType, 'OUT')
    }
  })

  it('should return 400 for invalid type', async () => {
    const { status, body } = await api(
      '/api/inventory/movements?type=TRANSFER'
    )
    assert.equal(status, 400)
    assert.ok(body.error)
  })
})

describe('GET /api/dashboard/summary', () => {
  it('should return 200 with summary data', async () => {
    const { status, body } = await api('/api/dashboard/summary')
    assert.equal(status, 200)
    assert.equal(typeof body.total_products, 'number')
    assert.ok(body.total_products >= 0)
    assert.equal(typeof body.total_production_today, 'number')
    assert.ok(Array.isArray(body.low_stock_alerts))
  })

  it('low_stock_alerts items should have required fields', async () => {
    const { body } = await api('/api/dashboard/summary')
    for (const alert of body.low_stock_alerts) {
      assert.ok(
        alert.ProductID !== undefined,
        'Harus punya ProductID'
      )
      assert.ok(
        alert.ProductName !== undefined,
        'Harus punya ProductName'
      )
      assert.ok(
        alert.MinStock !== undefined,
        'Harus punya MinStock'
      )
      assert.ok(
        alert.CurrentStock !== undefined,
        'Harus punya CurrentStock'
      )
      assert.ok(
        alert.CurrentStock < alert.MinStock,
        'CurrentStock harus < MinStock'
      )
    }
  })
})

describe('POST /api/inventory/movements (OUT)', () => {
  let validProductId: number

  before(async () => {
    const { body } = await api('/api/products')
    assert.ok(body.length > 0)
    validProductId = body[0].ProductID
  })

  it('should return 422 when stock is insufficient', async () => {
    const { status, body } = await api('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify({
        product_id: validProductId,
        quantity: 999999,
        movement_type: 'OUT',
      }),
    })
    assert.equal(status, 422)
    assert.ok(body.error.includes('Stok tidak mencukupi'))
  })

  it('should return 400 when movement_type is IN', async () => {
    const { status, body } = await api('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify({
        product_id: validProductId,
        quantity: 10,
        movement_type: 'IN',
      }),
    })
    assert.equal(status, 400)
    assert.ok(body.error)
  })

  it('should return 404 for non-existent product_id', async () => {
    const { status } = await api('/api/inventory/movements', {
      method: 'POST',
      body: JSON.stringify({
        product_id: 99999,
        quantity: 10,
        movement_type: 'OUT',
      }),
    })
    assert.equal(status, 404)
  })
})

describe('Authentication API', () => {
  it('should get current user info with valid session', async () => {
    const { status, body } = await api('/api/auth/me')
    assert.equal(status, 200)
    assert.ok(body.user)
    assert.equal(body.user.Username, 'admin')
    assert.equal(body.user.Role, 'admin')
  })

  it('should return 401 when accessing me without session', async () => {
    const originalCookie = sessionCookie
    sessionCookie = null
    const { status } = await api('/api/auth/me')
    sessionCookie = originalCookie
    assert.equal(status, 401)
  })

  it('should return 401 for invalid login credentials', async () => {
    const { status, body } = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' }),
    })
    assert.equal(status, 401)
    assert.ok(body.error)
  })
})

