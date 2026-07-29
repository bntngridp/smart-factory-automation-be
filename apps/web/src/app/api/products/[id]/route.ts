import { NextRequest, NextResponse } from 'next/server'
import { getProductById, updateProduct, deleteProduct } from '@/services/productService'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id, 10)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400, headers: corsHeaders })
    }

    const product = await getProductById(productId)
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json(product, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id, 10)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400, headers: corsHeaders })
    }

    const body = await request.json()
    const updated = await updateProduct(productId, {
      ProductName: body.ProductName,
      Unit: body.Unit,
      MinStock: body.MinStock !== undefined ? Number(body.MinStock) : undefined,
    })

    return NextResponse.json(updated, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id, 10)
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400, headers: corsHeaders })
    }

    const result = await deleteProduct(productId)
    return NextResponse.json(result, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
