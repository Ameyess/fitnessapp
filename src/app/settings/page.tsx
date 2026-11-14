"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { getUserProfile, setUserProfile } from "@/lib/db"
import { STREAK_MILESTONES } from "@/types"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Header } from "@/components/layout/Header"
import { Moon, Sun, Bell, Clock, RefreshCw } from "lucide-react"

export default function SettingsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [reminderTime, setReminderTime] = useState("")
  const [reminderEnabled, setReminderEnabled] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      if (!p) { setLoading(false); return }
      setProfile(p)
      setDarkMode(!!p.darkMode)
      setReminderTime(p.reminderTime ?? "")
      setReminderEnabled(!!p.reminderEnabled)
      setLoading(false)
    }
    load()
  }, [user])

  const save = async () => {
    if (!user || !profile) return
    await setUserProfile(user.uid, {
      darkMode,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : "",
    })
    setLoading(true)
    setTimeout(() => setLoading(false), 600)
  }

  const toggleTheme = () => setDarkMode(!darkMode)

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50">Loading…</div>
  if (!user) return null

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
      <Header />
      <main className="flex-1 px-4 py-6 space-y-6">
        <h2 className="text-2xl font-bold text-slate-900">You</h2>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dark mode</p>
              <p className="text-sm text-slate-600">Light by default, dark when you want.</p>
            </div>
            <button
              onClick={toggleTheme}
              className="relative w-14 h-7 rounded-full border border-slate-200 bg-slate-200 transition-colors focus:outline-none"
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow-md absolute ${darkMode ? "right-2" : "left-2"} top-0.5 transition-transform`}></span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Reminder</p>
              <p className="text-sm text-slate-600">Daily nudge if goals aren't done.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-slate-300 bg-slate-50 text-emerald-600 focus:ring-emerald-500"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
              />
              <input
                type="time"
                className="input w-28"
                disabled={!reminderEnabled}
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-3">Streak milestones</h3>
          <div className="grid gap-2">
            {STREAK_MILESTONES.map((m) => {
              const hit = (profile?.milestones ?? []).includes(m.days)
              return (
                <div key={m.days} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${hit ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  <span className="text-sm text-slate-600">{m.label} ({m.days} days)</span>
                  <span className={`text-xs font-bold ${hit ? "text-emerald-600" : "text-slate-400"}`}>
                    {hit ? "Achieved" : "Locked"}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <Button variant="primary" className="w-full" onClick={save} disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </main>
    </div>
  )
}
