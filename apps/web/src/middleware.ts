import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET_KEY = process.env.JWT_SECRET || 'dubu-secret-eagle-eye-key-shh'
const key = new TextEncoder().encode(SECRET_KEY)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Hanya proteksi route API selain endpoints auth (/api/auth/*)
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      await jwtVerify(token, key)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  // Hanya jalankan middleware untuk route API (/api/*)
  matcher: ['/api/:path*'],
}
