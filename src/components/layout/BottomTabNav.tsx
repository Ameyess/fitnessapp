"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Flame, Home, BarChart3, Users, Settings, Activity } from "lucide-react"

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/history", label: "History", icon: BarChart3 },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "You", icon: Settings },
]

export default function BottomTabNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center border-t border-slate-200 bg-white/90 backdrop-blur-md px-4 pb-2 safe-area-pad-bottom"
      style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex w-full max-w-2xl justify-around gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href))
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-colors duration-200"
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`w-5 h-5 ${active ? "text-emerald-600" : "text-slate-400"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-emerald-600" : "text-slate-500"}`}>
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
