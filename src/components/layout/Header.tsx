"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { StreakFlame } from "@/components/ui/StreakFlame"
import { Button } from "@/components/ui/Button"

export function Header() {
  const { user, logout } = useAuth()
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 safe-area-pad-top">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💪</span>
          <span className="text-xl font-black text-slate-900 tracking-tight">FitStreak</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StreakFlame count={0} longest={0} size="md" />
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
