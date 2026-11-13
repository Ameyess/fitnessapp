"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { getFriends, getPublicStats, getWorkouts, todayKey } from "@/lib/db"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/Input"
import { Users, Trophy, Flame } from "lucide-react"

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const friends = await getFriends(user.uid)
      const out: any[] = []
      for (const f of friends) {
        const stats = await getPublicStats(f.friendId)
        if (stats) out.push({ ...stats, friendId: f.friendId })
      }
      out.sort((a, b) => b.streak - a.streak)
      setEntries(out)
      setLoading(false)
    }
    load()
  }, [user])

  const weekStart = () => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff)).toLocaleDateString("en-CA")
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50">Loading…</div>
  if (!user) return null

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 safe-area-pad-top">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-slate-900">Friends leaderboard</h2>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        <p className="text-xs text-slate-500">Ranked by current streak · Friends only</p>
        <div className="space-y-2">
          {entries.length === 0 && (
            <EmptyState title="No friends on the leaderboard" description="Add friends to see who's on fire." icon={<Users className="w-6 h-6" />} />
          )}
          {entries.map((e, i) => (
            <div key={e.uid} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-white border-slate-200 text-slate-400"}`}>
                  #{i + 1}
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Users className="w-5 h-5 text-slate-400" /></div>
                <div className="flex flex-col">
                  <div className="text-sm font-medium text-slate-900">{e.displayName || e.friendId}</div>
                  <div className="text-xs text-slate-500">Friend</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Flame className="w-4 h-4 text-flame-500" />
                  <span className="text-sm font-bold text-slate-900">{e.streak}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
