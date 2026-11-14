"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { getUserProfile, setUserProfile } from "@/lib/db"
import { STREAK_MILESTONES } from "@/types"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { useTheme } from "@/components/ui/ThemeProvider"
import { Moon, Sun, Bell, Trophy, LogOut, Check } from "lucide-react"

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [reminderTime, setReminderTime] = useState("")
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      if (p) {
        setProfile(p)
        setReminderTime(p.reminderTime ?? "")
        setReminderEnabled(!!p.reminderEnabled)
      }
      setLoading(false)
    }
    load()
  }, [user])

  const save = async () => {
    if (!user || !profile) return
    setLoading(true)
    await setUserProfile(user.uid, {
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : "",
    })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: "var(--c-primary)" }}
        />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="mx-auto max-w-lg px-4 py-5 pb-10">
      <h1 className="mb-5 text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
        You
      </h1>

      {/* Profile */}
      <div
        className="mb-4 flex items-center gap-4 rounded-3xl border-2 p-5"
        style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-black"
          style={{ backgroundColor: "var(--c-primary-soft)", color: "var(--c-primary-dark)" }}
        >
          {(profile?.displayName || user.email || "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-black" style={{ color: "var(--c-text)" }}>
            {profile?.displayName || "Athlete"}
          </p>
          <p className="truncate text-xs font-semibold" style={{ color: "var(--c-muted)" }}>
            {user.email}
          </p>
        </div>
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon={<Moon className="h-4 w-4" />}>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className="tap-target flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 text-xs font-extrabold capitalize transition-colors active:scale-95"
              style={{
                backgroundColor: theme === t ? "var(--c-primary)" : "var(--c-surface-2)",
                borderColor: theme === t ? "transparent" : "var(--c-border)",
                color: theme === t ? "#fff" : "var(--c-muted)",
              }}
            >
              {t === "light" && <Sun className="h-3.5 w-3.5" />}
              {t === "dark" && <Moon className="h-3.5 w-3.5" />}
              {t === "system" && <span className="text-xs">auto</span>}
              {t}
            </button>
          ))}
        </div>
      </Section>

      {/* Reminders */}
      <Section title="Daily reminder" icon={<Bell className="h-4 w-4" />}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
            Nudge me if goals aren&apos;t done
          </p>
          <button
            onClick={() => setReminderEnabled(!reminderEnabled)}
            aria-label="Toggle reminders"
            aria-pressed={reminderEnabled}
            className="tap-target w-16 shrink-0 justify-center"
          >
            <span
              className="relative block h-7 w-12 rounded-full transition-colors"
              style={{
                backgroundColor: reminderEnabled ? "var(--c-primary)" : "var(--c-border)",
              }}
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: reminderEnabled ? 26 : 4 }}
              />
            </span>
          </button>
        </div>
        {reminderEnabled && (
          <div className="mt-3">
            <label className="label">Reminder time (your local time)</label>
            <Input
              type="time"
              value={reminderTime}
              onChange={(e) => setReminderTime(e.target.value)}
            />
          </div>
        )}
      </Section>

      {/* Milestones */}
      <Section title="Streak milestones" icon={<Trophy className="h-4 w-4" />}>
        <div className="space-y-2">
          {STREAK_MILESTONES.map((m) => {
            const hit = (profile?.milestones ?? []).includes(m.days)
            return (
              <div
                key={m.days}
                className="flex items-center justify-between rounded-2xl border-2 px-4 py-3"
                style={{
                  backgroundColor: hit ? "var(--c-primary-soft)" : "var(--c-surface-2)",
                  borderColor: hit ? "transparent" : "var(--c-border)",
                }}
              >
                <span className="text-sm font-bold" style={{ color: "var(--c-text)" }}>
                  {m.label} · {m.days} days
                </span>
                {hit ? (
                  <span className="flex items-center gap-1 text-xs font-black" style={{ color: "var(--c-primary-dark)" }}>
                    <Check className="h-3.5 w-3.5" /> Achieved
                  </span>
                ) : (
                  <span className="text-xs font-black" style={{ color: "var(--c-faint)" }}>
                    Locked
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      <Button variant="primary" block onClick={save} disabled={loading}>
        {saved ? "Saved!" : loading ? "Saving…" : "Save changes"}
      </Button>

      <Button variant="outline" block className="mt-3" onClick={logout}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      className="mb-4 rounded-3xl border-2 p-5"
      style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
    >
      <h2
        className="mb-3 flex items-center gap-2 text-sm font-extrabold"
        style={{ color: "var(--c-text)" }}
      >
        <span style={{ color: "var(--c-primary)" }}>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}
