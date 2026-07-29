import { NextRequest, NextResponse } from 'next/server'
import { getUsers, createUser } from '@/services/userService'

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
    const users = await getUsers()
    return NextResponse.json(users, { status: 200, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, role } = body

    if (!username) {
      return NextResponse.json(
        { error: 'Username wajib diisi' },
        { status: 400, headers: corsHeaders }
      )
    }

    const user = await createUser({
      Username: username,
      Password: password,
      Role: role,
    })

    return NextResponse.json(user, { status: 201, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'

    if (message.includes('sudah terdaftar')) {
      return NextResponse.json({ error: message }, { status: 409, headers: corsHeaders })
    }

    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders })
  }
}
