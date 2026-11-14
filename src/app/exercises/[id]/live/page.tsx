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
import {
  chooseRotation,
  nextRotation,
  pickFit,
  rotatedSize,
  type Rotation,
} from "@/lib/camera/rotation"
import { Pause, Play, RotateCcw, RotateCw, X, Speaker, VolumeX, Camera, Minus, Plus } from "lucide-react"

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
  const syncReps = useWorkoutStore((s) => s.syncReps)
  const setSeconds = useWorkoutStore((s) => s.setSeconds)
  const tick = useWorkoutStore((s) => s.tick)
  const setFrame = useWorkoutStore((s) => s.setFrame)
  const profile = useProfileStore((s) => s.profile)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraState, setCameraState] = useState<CameraState>("starting")
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [soundOn, setSoundOn] = useState(true)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [showGuide, setShowGuide] = useState(true)
  const [showControls, setShowControls] = useState(true)
  const [landmarks, setLandmarks] = useState<any[] | null>(null)
  /** When set, the workout is logged against a custom plan entry instead
   *  of the built-in exercise (custom entries reuse a built-in tracker). */
  const [logId, setLogId] = useState<string | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  /** True once the user has manually overridden automatic rotation. */
  const [autoRotation, setAutoRotation] = useState(false)
  const [streamDimensions, setStreamDimensions] = useState({
    width: 0,
    height: 0,
  })
  const [viewportSize, setViewportSize] = useState({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    try {
      setLogId(new URLSearchParams(window.location.search).get("log"))
    } catch {}
  }, [])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wakeLockRef = useRef<any>(null)
  const lastTimeRef = useRef<number>(0)
  const lastRepRef = useRef<number>(0)
  const repsRef = useRef(0)
  const lastCountedReps = useRef(0)
  /** Timestamp of the last user interaction with the workout controls. */
  const lastInteractionRef = useRef(Date.now())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const repCounterRef = useRef<ReturnType<typeof createRepCounter> | null>(null)
  const { detector, status: modelStatus, error: modelError } = usePoseTracker()

  // --- viewport and camera orientation ---
  useEffect(() => {
    if (typeof window === "undefined") return

    const updateViewportSize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    updateViewportSize()
    window.addEventListener("resize", updateViewportSize)
    window.addEventListener("orientationchange", updateViewportSize)
    return () => {
      window.removeEventListener("resize", updateViewportSize)
      window.removeEventListener("orientationchange", updateViewportSize)
    }
  }, [])

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return

    setStreamDimensions((current) => {
      if (
        current.width === video.videoWidth &&
        current.height === video.videoHeight
      ) {
        return current
      }
      return { width: video.videoWidth, height: video.videoHeight }
    })
  }, [])

  useEffect(() => {
    if (autoRotation) return
    if (
      streamDimensions.width <= 0 ||
      streamDimensions.height <= 0 ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0
    ) {
      return
    }

    let upVector: { x: number; y: number } | null = null
    if (landmarks && landmarks.length > 24) {
      const leftShoulder = landmarks[11]
      const rightShoulder = landmarks[12]
      const leftHip = landmarks[23]
      const rightHip = landmarks[24]
      if (leftShoulder && rightShoulder && leftHip && rightHip) {
        upVector = {
          x: (leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2,
          y: (leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2,
        }
      }
    }

    const next = chooseRotation({
      streamWidth: streamDimensions.width,
      streamHeight: streamDimensions.height,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
      upVector,
    })
    setRotation((current) => (current === next ? current : next))
  }, [autoRotation, landmarks, streamDimensions, viewportSize])

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
        // Ask for a stream whose aspect ratio matches the screen. Forcing a
        // fixed 1280x720 on a portrait phone returns a LANDSCAPE stream which
        // then gets cropped so hard that the user falls out of frame.
        const screenAspect =
          typeof window !== "undefined" && window.innerHeight > 0
            ? Math.min(2, Math.max(0.4, window.innerWidth / window.innerHeight))
            : 0.5625

        let s: MediaStream
        try {
          s = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode,
              aspectRatio: { ideal: screenAspect },
              frameRate: { ideal: 30 },
            },
            audio: false,
          })
        } catch (err: any) {
          // Some devices reject the aspect-ratio hint - retry with the bare
          // minimum so the camera still comes up.
          if (err?.name === "OverconstrainedError" || err?.name === "NotFoundError") {
            s = await navigator.mediaDevices.getUserMedia({
              video: { facingMode },
              audio: false,
            })
          } else {
            throw err
          }
        }
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

  // Only report the camera as ready once the <video> actually has frames.
  useEffect(() => {
    if (!stream) return
    let raf = 0
    const check = () => {
      const v = videoRef.current
      // Only trust the CURRENT stream - a superseded stream may still be
      // attached for a frame after StrictMode remounts the effect.
      if (v && v.srcObject === stream && v.readyState >= 2 && v.videoWidth > 0) {
        setCameraState("ready")
        return
      }
      raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  }, [stream])

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

      // Mirror the authoritative rep count from the state machine (never
      // increment locally, which would lag by one rep at fast cadence).
      // The delta is applied to the CURRENT store value so a manual
      // correction made with the -/+ buttons is never wiped out.
      if (state.reps !== repsRef.current) {
        const delta = state.reps - repsRef.current
        repsRef.current = state.reps
        syncReps(Math.max(0, useWorkoutStore.getState().reps + delta))
      }

      // Timed exercises measure REAL hold time, not wall-clock time.
      if (config.type === "timed") {
        const holdMs = state.holdStart ? now - state.holdStart : 0
        setSeconds(Math.floor(holdMs / 1000))
      }

      if (state.inFrame && state.reps > lastCountedReps.current && now - lastRepRef.current > 350) {
        lastRepRef.current = now
        lastCountedReps.current = state.reps
        beep()
        if (hapticsOn) navigator.vibrate?.(80)
        add({ type: "success", title: "Nice one!", description: `Rep ${state.reps}` })
      }
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [
    isActive,
    isPaused,
    detector,
    config,
    addRep,
    beep,
    hapticsOn,
    setFrame,
    add,
    setSeconds,
    syncReps,
  ])

  // --- timer ---
  useEffect(() => {
    if (!isActive || isPaused) return
    const t = setInterval(() => tick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [isActive, isPaused, tick])

  // Auto-hide the controls so your body is never covered mid-workout.
  // Uses an interval + an "last interaction" timestamp: a plain setTimeout
  // would be reset by the per-second `seconds` update and never fire.
  useEffect(() => {
    if (!isActive || showGuide) return
    const iv = setInterval(() => {
      if (showControls && Date.now() - lastInteractionRef.current > 4000) {
        setShowControls(false)
      }
    }, 400)
    return () => clearInterval(iv)
  }, [isActive, showGuide, showControls])

  const handleStart = async () => {
    await requestWakeLock()
    start()
    setShowGuide(false)
    setShowControls(true)
    lastInteractionRef.current = Date.now()
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
    const custom = logId
      ? (p?.customPlan ?? []).find((c) => c.id === logId)
      : undefined
    const goal = (p?.goals[id as ExerciseId] ?? {}) as any
    const targetReps = custom
      ? (custom.reps ?? 0)
      : (goal.reps ?? (config.type === "rep" ? 10 : 0))
    const targetSeconds = custom
      ? (custom.seconds ?? 0)
      : (goal.seconds ?? (config.type === "timed" ? 30 : 0))
    const completed =
      (custom?.type ?? config.type) === "rep"
        ? reps >= targetReps
        : seconds >= targetSeconds
    // Custom entries are logged under their own id so the plan can track
    // them separately from the built-in exercise they borrow the tracker from.
    const exerciseId = logId ?? id
    await saveWorkout({
      userId: user.uid,
      date,
      exerciseId,
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
        body: JSON.stringify({ uid: user.uid, date, exerciseId, completed }),
      })
    } catch {}
  }

  if (!config) return null

  const customEntry = logId
    ? (profile?.customPlan ?? []).find((c) => c.id === logId)
    : undefined
  const goal = customEntry
    ? customEntry.type === "rep"
      ? (customEntry.reps ?? 10)
      : (customEntry.seconds ?? 30)
    : config.type === "rep"
      ? (profile?.goals[id as ExerciseId]?.reps ?? 10)
      : (profile?.goals[id as ExerciseId]?.seconds ?? config.targetSeconds ?? 30)

  const showModelLoading = modelStatus === "loading"
  const rotatedStream = rotatedSize(
    rotation,
    streamDimensions.width,
    streamDimensions.height
  )
  const cameraFit: "cover" | "contain" =
    rotatedStream.width > 0 &&
    rotatedStream.height > 0 &&
    viewportSize.width > 0 &&
    viewportSize.height > 0
      ? pickFit(
          rotatedStream.width / rotatedStream.height,
          viewportSize.width / viewportSize.height
        )
      : "contain"

  return (
    <div className="fixed inset-0 z-30 bg-black">
      {/* Camera feed */}
      <CameraView
        stream={stream}
        videoRef={videoRef}
        mirror={facingMode === "user"}
        rotation={rotation}
        fit={cameraFit}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Skeleton overlay - always mounted so the layer never pops in/out */}
      <PoseCanvas
        landmarks={landmarks}
        video={videoRef.current}
        mirror={facingMode === "user"}
        highlightJoints={config.trackedLandmarks}
        rotation={rotation}
        fit={cameraFit}
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

      {/* ---- HUD: top row + bottom controls, centre kept clear for the body ---- */}
      <div className="pointer-events-none absolute inset-0 flex flex-col p-3 safe-area-pad-top safe-area-pad-bottom">
        <div className="relative z-20 flex items-start justify-between gap-2">
          <button
            onClick={() => router.replace("/")}
            aria-label="Close workout"
            className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black/55 backdrop-blur active:scale-90"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          {/* Rep counter lives at the TOP so it never covers your torso */}
          {!showGuide && (
            <div
              className="pointer-events-auto flex flex-col items-center rounded-3xl border-2 px-4 py-2"
              style={{
                backgroundColor: "rgba(10,16,20,0.72)",
                borderColor: "rgba(255,255,255,0.16)",
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
                layout="row"
              />
            </div>
          )}

          <div className="flex shrink-0 flex-col items-end gap-2">
            {showModelLoading && (
              <span className="rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-white/90 backdrop-blur">
                Loading tracker…
              </span>
            )}
            <div className="pointer-events-auto flex gap-2">
              <button
                onClick={() =>
                  setFacingMode((f) => (f === "user" ? "environment" : "user"))
                }
                aria-label="Switch camera"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/55 backdrop-blur active:scale-90"
              >
                <RotateCcw className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={() => {
                  setAutoRotation(true)
                  setRotation((current) => nextRotation(current))
                }}
                aria-label="Rotate camera"
                data-testid="rotate-camera"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/55 backdrop-blur active:scale-90"
              >
                <RotateCw className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={() => setSoundOn((s) => !s)}
                aria-label="Toggle sound"
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/55 backdrop-blur active:scale-90"
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

        {/* Middle - only the setup card lives here, so your body stays visible */}
        <div className="pointer-events-auto flex flex-1 flex-col items-center justify-center gap-3">
          {showGuide && (
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
              <Button
                variant="primary"
                block
                onClick={handleStart}
                disabled={cameraState !== "ready"}
              >
                {cameraState === "ready" ? "Start counting" : "Waiting for camera…"}
              </Button>
            </motion.div>
          )}
        </div>

        {/* Bottom controls - one compact row that auto-hides so your body
            is never covered. Tap anywhere to bring them back. */}
        {!showGuide && (
          <>
            <motion.button
              aria-label="Show controls"
              data-testid="show-controls"
              onClick={() => {
                lastInteractionRef.current = Date.now()
                setShowControls(true)
              }}
              className="pointer-events-auto absolute inset-0 z-10 cursor-default"
              animate={{ opacity: showControls ? 0 : 1 }}
              style={{ pointerEvents: showControls ? "none" : "auto" }}
            />
            <motion.div
              initial={false}
              animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 24 }}
              transition={{ duration: 0.22 }}
              data-testid="workout-controls"
              onPointerDown={() => {
                lastInteractionRef.current = Date.now()
              }}
              className="pointer-events-auto relative z-20 flex items-center justify-center gap-2"
              style={{ pointerEvents: showControls ? "auto" : "none" }}
            >
              {!inFrame && (
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-extrabold"
                  style={{
                    backgroundColor: "rgba(138,74,0,0.95)",
                    color: "#ffffff",
                  }}
                >
                  <span aria-hidden>⚠️</span> Get in frame
                </div>
              )}

              {/* Manual rep correction */}
              <button
                onClick={subtractRep}
                aria-label="Remove a rep"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/55 backdrop-blur active:scale-90"
              >
                <Minus className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={addRep}
                aria-label="Add a rep"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/55 backdrop-blur active:scale-90"
              >
                <Plus className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={handlePause}
                aria-label={isPaused ? "Resume" : "Pause"}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/55 backdrop-blur active:scale-90"
              >
                {isPaused ? (
                  <Play className="h-5 w-5 text-white" />
                ) : (
                  <Pause className="h-5 w-5 text-white" />
                )}
              </button>
              <Button variant="danger" onClick={handleFinish} className="px-5 py-2.5">
                Finish
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
