import { NextRequest, NextResponse } from 'next/server'
import { updateUser, deleteUser } from '@/services/userService'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:6061',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400, headers: corsHeaders })
    }

    const body = await request.json()
    const updated = await updateUser(userId, {
      Role: body.role || body.Role,
      Password: body.password || body.Password,
    })

    return NextResponse.json(updated, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    const statusCode = message.includes('tidak ditemukan') ? 404 : 400
    return NextResponse.json({ error: message }, { status: statusCode, headers: corsHeaders })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(request, context)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id, 10)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400, headers: corsHeaders })
    }

    const result = await deleteUser(userId)
    return NextResponse.json(result, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    const statusCode = message.includes('tidak ditemukan') ? 404 : 400
    return NextResponse.json({ error: message }, { status: statusCode, headers: corsHeaders })
  }
}
