"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { getFriends, getPublicStats } from "@/lib/db"
import { EmptyState, LoadingSpinner } from "@/components/ui/Input"
import { Trophy, Flame, Users } from "lucide-react"

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const friends = await getFriends(user.uid).catch(() => [])
      const out: any[] = []
      for (const f of friends) {
        const stats = await getPublicStats(f.friendId).catch(() => null)
        if (stats) out.push({ ...stats, friendId: f.friendId })
      }
      out.sort((a, b) => b.streak - a.streak)
      setEntries(out)
      setLoading(false)
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user) return null

  const podium = entries.slice(0, 3)
  const rest = entries.slice(3)

  return (
    <div className="mx-auto max-w-lg px-4 py-5 pb-10">
      <div className="mb-4 flex items-center gap-2">
        <Trophy className="h-6 w-6" style={{ color: "var(--c-flame)" }} />
        <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
          Friends leaderboard
        </h1>
      </div>
      <p className="mb-5 text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
        Ranked by current streak · friends only
      </p>

      {entries.length === 0 ? (
        <EmptyState
          title="No friends on the leaderboard"
          description="Add friends to see who is on fire."
          icon={<Users className="h-6 w-6" />}
        />
      ) : (
        <>
          {/* Podium */}
          <div className="mb-5 flex items-end justify-center gap-2">
            {[podium[1], podium[0], podium[2]].map((e, i) => {
              if (!e) return <div key={i} className="flex-1" />
              const rank = i === 1 ? 1 : i === 0 ? 2 : 3
              const heights = { 1: "h-24", 2: "h-16", 3: "h-12" } as const
              const medals = { 1: "🥇", 2: "🥈", 3: "🥉" } as const
              const medal = medals[rank as 1 | 2 | 3]
              return (
                <div key={e.uid} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-2xl">{medal}</span>
                  <div
                    className={`flex w-full flex-col items-center justify-center rounded-t-2xl border-2 border-b-0 ${heights[rank as 1 | 2 | 3]}`}
                    style={{
                      backgroundColor: "var(--c-surface)",
                      borderColor: "var(--c-border)",
                    }}
                  >
                    <Flame className="h-5 w-5" style={{ color: "var(--c-flame)" }} />
                    <span className="text-lg font-black tabular-nums" style={{ color: "var(--c-text)" }}>
                      {e.streak}
                    </span>
                  </div>
                  <span
                    className="w-full truncate text-center text-[11px] font-extrabold"
                    style={{ color: "var(--c-muted)" }}
                  >
                    {e.displayName || e.friendId}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Rest */}
          <div className="space-y-2">
            {rest.map((e, i) => (
              <div
                key={e.uid}
                className="flex items-center justify-between rounded-2xl border-2 px-4 py-3"
                style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="w-6 shrink-0 text-center text-sm font-black"
                    style={{ color: "var(--c-faint)" }}
                  >
                    {i + 4}
                  </span>
                  <span className="truncate text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                    {e.displayName || e.friendId}
                  </span>
                </div>
                <span
                  className="flex shrink-0 items-center gap-1 text-sm font-black tabular-nums"
                  style={{ color: "var(--c-flame)" }}
                >
                  <Flame className="h-4 w-4" />
                  {e.streak}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
