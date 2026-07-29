import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createMovementOut } from '@/services/inventoryService'
import { createMovementOutSchema, formatZodError } from '@/lib/validations'

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    const where: Record<string, unknown> = {}
    if (type) {
      const upperType = type.toUpperCase()
      if (upperType !== 'IN' && upperType !== 'OUT') {
        return NextResponse.json(
          { error: 'Query parameter type harus "IN" atau "OUT"' },
          { status: 400, headers: corsHeaders }
        )
      }
      where.MovementType = upperType
    }

    const movements = await prisma.inventoryMovements.findMany({
      where,
      orderBy: { MovementDate: 'desc' },
      include: {
        Products: {
          select: {
            ProductName: true,
            Unit: true,
          },
        },
      },
    })

    return NextResponse.json(movements, { status: 200, headers: corsHeaders })
  } catch {
    return NextResponse.json(
      { error: 'Gagal mengambil data pergerakan inventaris' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createMovementOutSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(formatZodError(parsed.error), { status: 400, headers: corsHeaders })
    }

    if (parsed.data.movement_type !== 'OUT') {
      return NextResponse.json(
        {
          error:
            'Hanya movement_type "OUT" yang didukung. Movement IN otomatis dari production log.',
        },
        { status: 400, headers: corsHeaders }
      )
    }

    const movement = await createMovementOut({
      ProductID: parsed.data.product_id,
      Quantity: parsed.data.quantity,
    })

    return NextResponse.json(movement, { status: 201, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'

    if (message.includes('tidak ditemukan')) {
      return NextResponse.json({ error: message }, { status: 404, headers: corsHeaders })
    }

    if (message.includes('Stok tidak mencukupi')) {
      return NextResponse.json({ error: message }, { status: 422, headers: corsHeaders })
    }

    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
