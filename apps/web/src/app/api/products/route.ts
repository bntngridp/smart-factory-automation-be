import { NextRequest, NextResponse } from 'next/server'
import { getProducts, createProduct } from '@/services/productService'
import { createProductSchema, formatZodError } from '@/lib/validations'

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

export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json(products, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createProductSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400, headers: corsHeaders })
    }

    const product = await createProduct({
      ProductName: parsed.data.ProductName,
      Unit: parsed.data.Unit,
      MinStock: parsed.data.MinStock,
    })

    return NextResponse.json(product, { status: 201, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
