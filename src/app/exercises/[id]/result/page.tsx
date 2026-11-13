"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { getWorkouts } from "@/lib/db"
import { todayKey } from "@/lib/db"
import { getUserProfile } from "@/lib/db"
import { useEffect, useState } from "react"
import Confetti from "react-confetti"
import { Button } from "@/components/ui/Button"
import { CheckCircle2, Flame, ArrowRight } from "lucide-react"
import { StreakFlame } from "@/components/ui/StreakFlame"
import { Header } from "@/components/layout/Header"

export default function ResultPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params as any).id as string
  const { user } = useAuth()
  const [workout, setWorkout] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [showConfetti, setShowConfetti] = React.useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      setProfile(p)
      const date = todayKey(p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone)
      const logs = await getWorkouts(user.uid, date)
      const w = logs.find((l) => l.exerciseId === id)
      setWorkout(w)
    }
    load()
  }, [user, id])

  const completed = workout?.completed
  const target = workout?.type === "rep" ? workout.goalReps : workout?.goalSeconds
  const current = workout?.type === "rep" ? workout.reps : workout.seconds

  React.useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 2200)
    return () => clearTimeout(t)
  }, [])

  if (!user) return null

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-slate-50 px-4 safe-area-pad-bottom">
      <Header />
      {showConfetti && <Confetti />}

      <div className="relative z-10 flex flex-col items-center text-center py-6">
        {completed ? (
          <>
            <div className="relative inline-block mb-6">
              <StreakFlame count={profile?.streak ?? 0} longest={profile?.longestStreak ?? 0} size="lg" />
              <div className="absolute -top-4 -right-4 animate-pulse text-flame-500 text-2xl">✨</div>
            </div>
            <div className="w-16 h-16 rounded-full border-4 border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2">Streak extended!</h2>
            <p className="text-slate-500 mb-6">
              You completed today's {workout ? `${workout.reps}` : ""} {id}. Keep it going!
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full border-4 border-slate-200 flex items-center justify-center mx-auto mb-4">
              <Flame className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Good effort</h2>
            <p className="text-slate-500 mb-6">
              {current} / {target}. Try again tomorrow to keep your streak.
            </p>
          </>
        )}

        <div className="flex gap-3">
          <Button variant="primary" onClick={() => router.push("/home")}>
            <ArrowRight className="w-4 h-4 ml-2" /> Home
          </Button>
          <Button variant="ghost" onClick={() => router.push(`/exercises/${id}`)}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}
