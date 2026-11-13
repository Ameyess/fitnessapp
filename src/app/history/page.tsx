"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { getWorkouts } from "@/lib/db"
import { todayKey } from "@/lib/db"
import { getUserProfile } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/Input"
import { BarChart3, Flame, Activity } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

export default function HistoryPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      setProfile(p)
      const tz = p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      // load last 30 days
      const days = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        days.push(d.toLocaleString("en-US", { timeZone: tz }).split(",")[0])
      }
      const all: any[] = []
      for (const date of days) {
        const ld = await getWorkouts(user.uid, date)
        all.push(...ld)
      }
      setLogs(all)
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50">Loading…</div>
  if (!user) return null

  // reps per day chart
  const byDay: Record<string, number> = {}
  logs.forEach((l) => {
    byDay[l.date] = (byDay[l.date] || 0) + (l.reps || 0)
  })
  const chartData = Object.entries(byDay).map(([date, reps]) => ({ date, reps }))

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 safe-area-pad-top">
        <h2 className="text-xl font-bold text-slate-900">History</h2>
      </header>

      <main className="flex-1 px-4 py-4 space-y-6">
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Reps per day (last 30 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData.slice(-14)} barSize="24">
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip />
                <Bar dataKey="reps" fill="#22c55e" radius={[4, 4, 0, 0]}>
                  {chartData.slice(-14).map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.reps > 0 ? "#22c55e" : "#cbd5e1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Recent workouts</h3>
          <div className="space-y-2">
            {logs.slice().reverse().slice(0, 10).map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white">
                <div>
                  <span className="text-sm font-medium text-slate-900">{l.exerciseId}</span>
                  <span className="text-xs text-slate-500 ml-2">{l.date}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">{l.reps} reps{l.seconds > 0 ? ` · ${l.seconds}s` : ""}</div>
                  <span className={`text-xs font-bold ${l.completed ? "text-emerald-600" : "text-slate-400"}`}>
                    {l.completed ? "✓ Goal met" : "In progress"}
                  </span>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <EmptyState title="No workouts yet" description="Start your first workout to build your history." icon={<Activity className="w-6 h-6" />} />
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
