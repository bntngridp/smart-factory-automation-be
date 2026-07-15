'use server'

import { loginUser } from '@/services/authService'
import { signToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type ActionState = {
  error?: string
  success?: boolean
}

export async function loginAction(
  prevState: ActionState | undefined,
  formData: FormData,
): Promise<ActionState> {
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  if (!username || !password) {
    return { error: 'Username dan password wajib diisi' }
  }

  try {
    const user = await loginUser(username, password)
    const token = await signToken(user)

    const cookieStore = await cookies()
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 hari
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Username atau password salah'
    return { error: message }
  }

  redirect('/')
}
