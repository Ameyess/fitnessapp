"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { getExercise } from "@/lib/exercises"
import { Button } from "@/components/ui/Button"
import { motion } from "framer-motion"
import { Smartphone, Ruler, Video, Play } from "lucide-react"

export default function ExerciseSetupPage() {
  const router = useRouter()
  const params = useParams()
  const id = (params as any).id as string
  const config = getExercise(id)

  if (!config) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-6 text-center">
        <p className="font-bold" style={{ color: "var(--c-muted)" }}>
          Exercise not found.
        </p>
      </div>
    )
  }

  const isFront = config.cameraAngle === "front"

  return (
    <div className="mx-auto max-w-lg px-5 py-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border-2 p-6"
        style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
            style={{ backgroundColor: "var(--c-primary-soft)" }}
          >
            {config.icon}
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
              {config.name}
            </h1>
            <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--c-primary)" }}>
              {config.type === "rep" ? "Rep counter" : "Timed hold"}
            </p>
          </div>
        </div>

        <p className="mb-5 text-sm font-semibold" style={{ color: "var(--c-muted)" }}>
          {config.setupText}
        </p>

        {/* Phone placement illustration */}
        <div
          className="mb-5 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6"
          style={{ borderColor: "var(--c-border)", backgroundColor: "var(--c-surface-2)" }}
        >
          <div className="relative">
            <div
              className="flex h-24 w-14 items-center justify-center rounded-2xl border-4"
              style={{
                borderColor: "var(--c-primary)",
                backgroundColor: "var(--c-surface)",
              }}
            >
              <Video className="h-6 w-6" style={{ color: "var(--c-primary)" }} />
            </div>
            <div
              className="absolute -right-16 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase"
              style={{ backgroundColor: "var(--c-primary)", color: "#fff" }}
            >
              {isFront ? "Front" : "Side"}
            </div>
          </div>
          <p className="text-center text-xs font-bold" style={{ color: "var(--c-muted)" }}>
            {config.phonePlacement}
          </p>
        </div>

        <div className="mb-6 space-y-3">
          <GuideRow icon={<Smartphone className="h-4 w-4" />} label="Phone placement" text={config.phonePlacement} />
          <GuideRow icon={<Ruler className="h-4 w-4" />} label="Distance" text={config.distance} />
          <GuideRow
            icon={<Video className="h-4 w-4" />}
            label="Camera angle"
            text={isFront ? "Front view — phone facing you." : "Side view — phone to your side."}
          />
        </div>

        <Button variant="primary" block onClick={() => router.push(`/exercises/${id}/live`)}>
          <Play className="h-4 w-4" />
          Start workout
        </Button>
      </motion.div>
    </div>
  )
}

function GuideRow({
  icon,
  label,
  text,
}: {
  icon: React.ReactNode
  label: string
  text: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--c-surface-2)", color: "var(--c-primary)" }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--c-faint)" }}>
          {label}
        </p>
        <p className="text-sm font-semibold" style={{ color: "var(--c-text)" }}>
          {text}
        </p>
      </div>
    </div>
  )
}
