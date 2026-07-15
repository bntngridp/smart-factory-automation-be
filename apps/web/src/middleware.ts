import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET_KEY = process.env.JWT_SECRET || 'dubu-secret-eagle-eye-key-shh'
const key = new TextEncoder().encode(SECRET_KEY)

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // Set header x-pathname untuk dibaca oleh Server Components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Izinkan akses ke auth endpoints, halaman login, static assets, dan favicon
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Helper untuk menentukan apakah request adalah API
  const isApiRequest = pathname.startsWith('/api/')

  // Jika tidak ada token
  if (!token) {
    if (isApiRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Verifikasi token JWT
    await jwtVerify(token, key)
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    // Jika token tidak valid/expired
    if (isApiRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }
}

export const config = {
  // Jalankan middleware pada semua route kecuali assets static
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
