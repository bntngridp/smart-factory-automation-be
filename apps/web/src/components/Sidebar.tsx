'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/products', label: 'Master Produk', icon: '📦' },
  { href: '/production-logs', label: 'Log Produksi', icon: '📝' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ Username: string; Role: string } | null>(null)

  useEffect(() => {
    if (pathname === '/login') return

    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error('Unauthorized')
      })
      .then((data) => {
        setUser(data.user)
      })
      .catch(() => {
        setUser(null)
      })
  }, [pathname])

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.ok) {
        router.push('/login')
        router.refresh()
      }
    } catch (err) {
      console.error('Logout gagal:', err)
    }
  }

  if (pathname === '/login') return null

  return (
    <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-800">
        <h1 className="text-lg font-bold tracking-tight">
          Smart Factory
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Automation System
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {user && (
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-semibold text-blue-400">
              {user.Username.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.Username}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{user.Role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] border border-red-500/20 text-xs font-semibold text-red-400 rounded-md transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      )}

      <div className="px-6 py-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
        <span>v0.1.0</span>
        <span>Dubu Engine 🦅</span>
      </div>
    </aside>
  )
}
