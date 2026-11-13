"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { getExercise } from "@/lib/exercises"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Header } from "@/components/layout/Header"
import { Smartphone, Clock, CheckCircle2, AlertCircle } from "lucide-react"

export default function ExerciseSetupPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = (params as any).id as string
  const config = getExercise(id)
  const [ready, setReady] = React.useState(false)

  if (!config) return <div className="p-6">Exercise not found</div>

  const startWorkout = () => {
    router.push(`/exercises/${id}/live`)
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
      <Header />
      <main className="flex-1 px-4 py-6 space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-lg">📱</span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{config.name}</h2>
              <p className="text-sm text-slate-500">{config.type === "rep" ? "Rep counter" : "Timed hold"}</p>
            </div>
          </div>
          <p className="text-slate-600 mb-4">{config.setupText}</p>

          <div className="grid gap-3 mb-6">
            <GuideRow icon={<Smartphone className="w-5 h-5" />} label="Place your phone" text={config.phonePlacement} />
            <GuideRow icon={<Clock className="w-5 h-5" />} label="Distance" text={config.distance} />
            <GuideRow icon={<CheckCircle2 className="w-5 h-5" />} label="Camera angle" text={config.cameraAngle === "side" ? "Side view — phone to your side." : "Front view — phone facing you."} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">Ready check</span>
            </div>
            <p className="text-sm text-slate-600 mb-3">
              We'll confirm your {config.trackedLandmarks.length} key body parts are visible before counting starts.
            </p>
            <Button
              variant="primary"
              className="w-full"
              disabled={!user}
              onClick={startWorkout}
            >
              {user ? "Start workout" : "Sign in to start"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}

function GuideRow({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-slate-700">{text}</p>
      </div>
    </div>
  )
}
