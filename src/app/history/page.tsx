"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useMemo, useState } from "react"
import { getWorkouts } from "@/lib/db"
import { todayKey } from "@/lib/db"
import { getUserProfile } from "@/lib/db"
import { ALL_EXERCISES } from "@/types"
import { EmptyState, LoadingSpinner } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { BarChart3, Activity, TrendingUp } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"

export default function HistoryPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>("all")

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      setProfile(p)
      const tz = p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
      const days: string[] = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        days.push(d.toLocaleString("en-US", { timeZone: tz }).split(",")[0])
      }
      const all: any[] = []
      // Fetch in parallel - much faster than a sequential loop
      const results = await Promise.all(days.map((date) => getWorkouts(user.uid, date).catch(() => [])))
      results.forEach((r) => all.push(...r))
      setLogs(all)
      setLoading(false)
    }
    load()
  }, [user])

  const filtered = useMemo(
    () => (filter === "all" ? logs : logs.filter((l) => l.exerciseId === filter)),
    [logs, filter]
  )

  const chartData = useMemo(() => {
    const byDay: Record<string, number> = {}
    filtered.forEach((l) => {
      byDay[l.date] = (byDay[l.date] || 0) + (l.reps || 0)
    })
    return Object.entries(byDay)
      .map(([date, reps]) => ({ date: date.slice(5), reps }))
      .slice(-14)
  }, [filtered])

  const totalReps = filtered.reduce((s, l) => s + (l.reps || 0), 0)
  const activeDays = new Set(filtered.map((l) => l.date)).size

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 pb-10">
      <h1 className="mb-4 text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
        Stats
      </h1>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <StatTile label="Total reps" value={totalReps} icon={<Activity className="h-4 w-4" />} />
        <StatTile label="Active days" value={activeDays} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* Filter */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {ALL_EXERCISES.map((id) => (
          <FilterChip
            key={id}
            active={filter === id}
            onClick={() => setFilter(id)}
            label={id}
          />
        ))}
      </div>

      {/* Chart */}
      <Card className="mb-5">
        <h2 className="mb-3 text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
          Reps per day (last 14 days)
        </h2>
        {chartData.length === 0 ? (
          <EmptyState
            title="No data yet"
            description="Finish a workout and your reps will show up here."
            icon={<BarChart3 className="h-6 w-6" />}
          />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--c-border)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--c-faint)", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--c-faint)", fontWeight: 700 }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "var(--c-surface-2)" }}
                  contentStyle={{
                    backgroundColor: "var(--c-surface)",
                    border: "2px solid var(--c-border)",
                    borderRadius: 14,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                />
                <Bar dataKey="reps" fill="var(--c-primary)" radius={[6, 6, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Recent workouts */}
      <h2 className="mb-3 text-lg font-black" style={{ color: "var(--c-text)" }}>
        Recent workouts
      </h2>
      {filtered.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          description="Start your first workout to build your history."
          icon={<Activity className="h-6 w-6" />}
        />
      ) : (
        <div className="space-y-2">
          {filtered
            .slice()
            .reverse()
            .slice(0, 15)
            .map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-2xl border-2 px-4 py-3"
                style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-extrabold capitalize" style={{ color: "var(--c-text)" }}>
                    {String(l.exerciseId).replace(/([A-Z])/g, " $1")}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--c-faint)" }}>
                    {l.date}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold tabular-nums" style={{ color: "var(--c-text)" }}>
                    {l.reps} reps{l.seconds > 0 ? ` · ${l.seconds}s` : ""}
                  </div>
                  <span
                    className="text-xs font-extrabold"
                    style={{ color: l.completed ? "var(--c-primary)" : "var(--c-faint)" }}
                  >
                    {l.completed ? "✓ Goal met" : "In progress"}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border-2 p-4"
      style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <span style={{ color: "var(--c-primary)" }}>{icon}</span>
        <span
          className="text-[11px] font-extrabold uppercase tracking-wider"
          style={{ color: "var(--c-faint)" }}
        >
          {label}
        </span>
      </div>
      <div className="text-3xl font-black tabular-nums" style={{ color: "var(--c-text)" }}>
        {value}
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="tap-target shrink-0 rounded-full border-2 px-3.5 text-xs font-extrabold capitalize transition-colors active:scale-95"
      style={{
        backgroundColor: active ? "var(--c-primary)" : "var(--c-surface)",
        borderColor: active ? "transparent" : "var(--c-border)",
        color: active ? "#fff" : "var(--c-muted)",
      }}
    >
      {label.replace(/([A-Z])/g, " $1")}
    </button>
  )
}
