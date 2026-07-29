import { NextRequest, NextResponse } from 'next/server'
import { loginUser } from '@/services/authService'
import { signToken } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Accept either username or email field
    let inputUser = body.username || body.email || ''
    if (inputUser.includes('@')) {
      inputUser = inputUser.split('@')[0]
    }

    const user = await loginUser(inputUser, body.password)
    
    const token = await signToken(user)
    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    })

    return NextResponse.json({ success: true, token, user })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
