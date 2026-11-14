"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useRef, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { usePoseTracker } from "@/components/camera/usePoseTracker"
import { PoseCanvas } from "@/components/camera/PoseCanvas"
import { CameraView } from "@/components/camera/CameraView"
import { RepCounterDisplay } from "@/components/camera/RepCounterDisplay"
import { saveWorkout, getUserProfile } from "@/lib/db"
import { createRepCounter } from "@/lib/exercises/repCounter"
import { getExercise } from "@/lib/exercises"
import { useWorkoutStore } from "@/store/workout"
import { useProfileStore } from "@/store/profile"
import { type ExerciseId } from "@/types"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { Pause, Play, RotateCcw, X, Speaker, VolumeX, Camera, Minus, Plus } from "lucide-react"

const DETECT_FPS = 15
const FRAME_INTERVAL = 1000 / DETECT_FPS

type CameraState = "starting" | "ready" | "denied" | "unavailable"

export default function LiveWorkoutPage() {
  const router = useRouter()
  const { add } = useToast()
  const { user } = useAuth()
  const params = useParams()
  const id = (params as any).id as string
  const config = getExercise(id) ?? null

  const {
    reps, seconds, phase, angle, inFrame,
    isActive, isPaused,
  } = useWorkoutStore()

  const setExercise = useWorkoutStore((s) => s.setExercise)
  const start = useWorkoutStore((s) => s.start)
  const pause = useWorkoutStore((s) => s.pause)
  const resume = useWorkoutStore((s) => s.resume)
  const complete = useWorkoutStore((s) => s.complete)
  const addRep = useWorkoutStore((s) => s.addRep)
  const subtractRep = useWorkoutStore((s) => s.subtractRep)
  const tick = useWorkoutStore((s) => s.tick)
  const setFrame = useWorkoutStore((s) => s.setFrame)
  const profile = useProfileStore((s) => s.profile)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>("starting")
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [soundOn, setSoundOn] = useState(true)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [showGuide, setShowGuide] = useState(true)
  const [landmarks, setLandmarks] = useState<any[] | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wakeLockRef = useRef<any>(null)
  const lastTimeRef = useRef<number>(0)
  const lastRepRef = useRef<number>(0)
  const repsRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const repCounterRef = useRef<ReturnType<typeof createRepCounter> | null>(null)
  const { detector, status: modelStatus, error: modelError } = usePoseTracker()

  // --- exercise setup ---
  useEffect(() => {
    if (config) setExercise(id as ExerciseId)
  }, [config, id, setExercise])

  useEffect(() => {
    if (!repCounterRef.current && config) repCounterRef.current = createRepCounter(config)
  }, [config])

  // --- camera acquisition: only re-runs when the user flips the camera ---
  useEffect(() => {
    let cancelled = false

    const startCam = async () => {
      setCameraState("starting")
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraState("unavailable")
          return
        }
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        })
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        // Keep a local handle so the cleanup stops *this* stream and not a
        // newer one (React StrictMode remounts effects in development).
        activeStream = s
        streamRef.current = s
        setStream(s)
        setCameraState("ready")
      } catch (e: any) {
        if (cancelled) return
        const name = e?.name ?? ""
        if (name === "NotAllowedError" || name === "SecurityError") {
          setCameraState("denied")
          add({
            type: "error",
            title: "Camera access denied",
            description: "Allow camera access in your browser to count reps.",
          })
        } else {
          setCameraState("unavailable")
          add({
            type: "error",
            title: "Camera unavailable",
            description: "Could not start the camera on this device.",
          })
        }
      }
    }

    let activeStream: MediaStream | null = null

    startCam()
    return () => {
      cancelled = true
      activeStream?.getTracks().forEach((t) => t.stop())
      if (streamRef.current === activeStream) streamRef.current = null
    }
  }, [facingMode, add])

  // --- wake lock ---
  const requestWakeLock = useCallback(async () => {
    try {
      wakeLockRef.current = await navigator.wakeLock?.request("screen")
    } catch {}
  }, [])

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release?.()
    wakeLockRef.current = null
  }, [])

  // --- rep sound ---
  const beep = useCallback(() => {
    if (!soundOn) return
    try {
      if (!audioCtxRef.current)
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch {}
  }, [soundOn])

  // --- detection loop ---
  useEffect(() => {
    if (!isActive || isPaused || !detector || !config) return
    let raf = 0
    let last = 0

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < FRAME_INTERVAL) return
      last = now

      const video = videoRef.current
      if (!video || video.readyState < 2 || video.videoWidth === 0) return

      let lm: any[] | null = null
      try {
        const result = detector.detectForVideo(video, now)
        lm = result.landmarks?.[0] ?? null
      } catch {
        return
      }

      setLandmarks(lm)
      if (!repCounterRef.current) repCounterRef.current = createRepCounter(config)
      const state = repCounterRef.current.update({ config, landmarks: lm, now })
      setFrame(state.inFrame, state.angle, state.phase)

      if (state.inFrame && state.reps > repsRef.current && now - lastRepRef.current > 700) {
        lastRepRef.current = now
        repsRef.current = state.reps
        addRep()
        beep()
        if (hapticsOn) navigator.vibrate?.(80)
        add({ type: "success", title: "Nice one!", description: `Rep ${state.reps}` })
      }
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isActive, isPaused, detector, config, addRep, beep, hapticsOn, setFrame, add])

  // --- timer ---
  useEffect(() => {
    if (!isActive || isPaused) return
    const t = setInterval(() => tick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isActive, isPaused, tick])

  const handleStart = async () => {
    await requestWakeLock()
    start()
    setShowGuide(false)
  }

  const handlePause = () => {
    if (isPaused) {
      resume()
      requestWakeLock()
    } else {
      pause()
      releaseWakeLock()
    }
  }

  const handleFinish = async () => {
    releaseWakeLock()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    complete()
    if (user) await saveAndUpdateStreak()
    router.push(`/exercises/${id}/result`)
  }

  const saveAndUpdateStreak = async () => {
    if (!user || !config) return
    const p = await getUserProfile(user.uid)
    const tz = p?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const date = new Date().toLocaleString("en-US", { timeZone: tz }).split(",")[0]
    const goal = (p?.goals[id as ExerciseId] ?? {}) as any
    const targetReps = goal.reps ?? (config.type === "rep" ? 10 : 0)
    const targetSeconds = goal.seconds ?? (config.type === "timed" ? 30 : 0)
    const completed =
      config.type === "rep" ? reps >= targetReps : seconds >= targetSeconds
    await saveWorkout({
      userId: user.uid,
      date,
      exerciseId: id as ExerciseId,
      reps,
      seconds,
      goalReps: targetReps,
      goalSeconds: targetSeconds,
      completed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    try {
      await fetch("/api/streak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, date, exerciseId: id, completed }),
      })
    } catch {}
  }

  if (!config) return null

  const goal =
    config.type === "rep"
      ? (profile?.goals[id as ExerciseId]?.reps ?? 10)
      : (profile?.goals[id as ExerciseId]?.seconds ?? config.targetSeconds ?? 30)

  const showModelLoading = modelStatus === "loading"

  return (
    <div className="fixed inset-0 z-30 bg-black">
      {/* Camera feed */}
      <CameraView
        stream={stream}
        videoRef={videoRef}
        mirror={facingMode === "user"}
        onLoadedMetadata={() => setCameraState("ready")}
      />

      {/* Skeleton overlay - always mounted so the layer never pops in/out */}
      <PoseCanvas
        landmarks={landmarks}
        video={videoRef.current}
        mirror={facingMode === "user"}
        highlightJoints={config.trackedLandmarks}
      />

      {/* ---- Overlays ---- */}
      <AnimatePresence>
        {cameraState === "starting" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black"
          >
            <div
              className="h-12 w-12 animate-spin rounded-full border-4 border-transparent"
              style={{ borderTopColor: "var(--c-primary)" }}
            />
            <p className="mt-4 text-sm font-bold text-white/80">Starting camera…</p>
          </motion.div>
        )}

        {(cameraState === "denied" || cameraState === "unavailable") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black px-8 text-center"
          >
            <div
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--c-danger-soft)", color: "var(--c-danger)" }}
            >
              <Camera className="h-8 w-8" />
            </div>
            <h2 className="mb-2 text-xl font-black text-white">
              {cameraState === "denied" ? "Camera access blocked" : "Camera unavailable"}
            </h2>
            <p className="mb-6 max-w-xs text-sm text-white/70">
              {cameraState === "denied"
                ? "Enable camera permission for this site, then tap the button below to retry."
                : "This device or browser could not start a camera. You can still log reps manually."}
            </p>
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={() =>
                  setFacingMode((f) => (f === "user" ? "environment" : "user"))
                }
              >
                Try again
              </Button>
              <Button variant="outline" onClick={() => router.replace("/home")}>
                Back
              </Button>
            </div>
          </motion.div>
        )}

        {modelStatus === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-black px-8 text-center"
          >
            <h2 className="mb-2 text-xl font-black text-white">
              Pose tracking failed to load
            </h2>
            <p className="mb-6 max-w-xs text-sm text-white/70">{modelError}</p>
            <Button variant="outline" onClick={() => router.replace("/home")}>
              Back
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- HUD ---- */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-3 safe-area-pad-top safe-area-pad-bottom">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => router.replace("/home")}
            aria-label="Close workout"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-black/45 backdrop-blur active:scale-90"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <div className="flex flex-col items-end gap-2">
            {showModelLoading && (
              <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-bold text-white/90 backdrop-blur">
                Loading pose tracker…
              </span>
            )}
            <div className="pointer-events-auto flex gap-2">
              <button
                onClick={() =>
                  setFacingMode((f) => (f === "user" ? "environment" : "user"))
                }
                aria-label="Switch camera"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/45 backdrop-blur active:scale-90"
              >
                <RotateCcw className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={() => setSoundOn((s) => !s)}
                aria-label="Toggle sound"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/45 backdrop-blur active:scale-90"
              >
                {soundOn ? (
                  <Speaker className="h-5 w-5 text-white" />
                ) : (
                  <VolumeX className="h-5 w-5 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-1 flex-col items-center justify-center gap-3">
          {showGuide ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border-2 p-6 text-center"
              style={{
                backgroundColor: "var(--c-surface)",
                borderColor: "var(--c-border)",
                maxWidth: 380,
              }}
            >
              <div className="mb-2 text-4xl">📱</div>
              <p className="mb-1 text-base font-black" style={{ color: "var(--c-text)" }}>
                Set up your phone
              </p>
              <p className="mb-1 text-xs font-bold" style={{ color: "var(--c-muted)" }}>
                {config.phonePlacement}
              </p>
              <p className="mb-5 text-xs font-bold" style={{ color: "var(--c-muted)" }}>
                {config.distance}
              </p>
              <Button variant="primary" block onClick={handleStart} disabled={cameraState !== "ready"}>
                {cameraState === "ready" ? "Start counting" : "Waiting for camera…"}
              </Button>
            </motion.div>
          ) : (
            <>
              <div
                className="rounded-3xl border-2 px-5 py-4"
                style={{
                  backgroundColor: "rgba(10,16,20,0.72)",
                  borderColor: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <RepCounterDisplay
                  config={config}
                  reps={reps}
                  phase={phase}
                  angle={angle}
                  inFrame={inFrame}
                  seconds={seconds}
                  goal={goal}
                  onDark
                />
              </div>

              {!inFrame && (
                <div
                  className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-extrabold"
                  style={{
                    backgroundColor: "var(--c-flame-soft)",
                    borderColor: "transparent",
                    color: "var(--c-flame)",
                  }}
                >
                  <span aria-hidden>⚠️</span> Get in frame
                </div>
              )}

              {/* Manual rep correction */}
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  onClick={subtractRep}
                  aria-label="Remove a rep"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/45 backdrop-blur active:scale-90"
                >
                  <Minus className="h-5 w-5 text-white" />
                </button>
                <span className="rounded-full bg-black/45 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white/70 backdrop-blur">
                  Fix count
                </span>
                <button
                  onClick={addRep}
                  aria-label="Add a rep"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/45 backdrop-blur active:scale-90"
                >
                  <Plus className="h-5 w-5 text-white" />
                </button>
              </div>

              <div className="pointer-events-auto flex items-center gap-3">
                <button
                  onClick={handlePause}
                  aria-label={isPaused ? "Resume" : "Pause"}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/45 backdrop-blur active:scale-90"
                >
                  {isPaused ? (
                    <Play className="h-6 w-6 text-white" />
                  ) : (
                    <Pause className="h-6 w-6 text-white" />
                  )}
                </button>
                <Button variant="danger" onClick={handleFinish}>
                  Finish
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
