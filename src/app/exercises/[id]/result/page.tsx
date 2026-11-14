"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { getWorkouts, getUserProfile, todayKey } from "@/lib/db"
import { useEffect, useState } from "react"
import Confetti from "react-confetti"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/Button"
import { CheckCircle2, Flame, ArrowRight } from "lucide-react"

export default function ResultPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params as any).id as string
  const { user } = useAuth()
  const [workout, setWorkout] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showConfetti, setShowConfetti] = React.useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      setProfile(p)
      const date = todayKey(p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      const logs = await getWorkouts(user.uid, date)
      const w = logs.find((l) => l.exerciseId === id)
      setWorkout(w)
      if (w?.completed) setShowConfetti(true)
    }
    load()
  }, [user, id])

  React.useEffect(() => {
    if (!showConfetti) return
    const t = setTimeout(() => setShowConfetti(false), 2600)
    return () => clearTimeout(t)
  }, [showConfetti])

  if (!user) return null

  const completed = !!workout?.completed
  const target = workout?.goalReps || workout?.goalSeconds || 0
  const current = workout?.reps || workout?.seconds || 0
  const streak = profile?.streak ?? 0

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-10 text-center">
      {showConfetti && (
        <Confetti
          numberOfPieces={180}
          recycle={false}
          gravity={0.25}
          colors={["#58cc02", "#ff9600", "#1cb0f6", "#ffd93d"]}
        />
      )}

      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="relative mb-5"
      >
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full border-4"
          style={{
            backgroundColor: completed ? "var(--c-primary-soft)" : "var(--c-surface-2)",
            borderColor: completed ? "var(--c-primary)" : "var(--c-border)",
          }}
        >
          {completed ? (
            <CheckCircle2 className="h-14 w-14" style={{ color: "var(--c-primary)" }} />
          ) : (
            <Flame className="h-12 w-12" style={{ color: "var(--c-faint)" }} />
          )}
        </div>
        {completed && (
          <span
            className="absolute -right-2 -top-2 text-3xl"
            style={{ color: "var(--c-flame)" }}
          >
            ✨
          </span>
        )}
      </motion.div>

      {completed ? (
        <>
          <h1 className="mb-1 text-3xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
            Streak extended!
          </h1>
          <p className="mb-1 text-lg font-extrabold" style={{ color: "var(--c-flame)" }}>
            🔥 {streak} day{streak === 1 ? "" : "s"} in a row
          </p>
          <p className="mb-7 max-w-xs text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
            {current} reps logged. Keep it up!
          </p>
        </>
      ) : (
        <>
          <h1 className="mb-1 text-3xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
            Good effort!
          </h1>
          <p className="mb-7 max-w-xs text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
            You logged {current} of {target}. Come back tomorrow to keep your streak.
          </p>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => router.push("/")}>
          Done <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => router.push(`/exercises/${id}`)}>
          Try again
        </Button>
      </div>
    </div>
  )
}
