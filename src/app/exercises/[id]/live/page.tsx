"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useRef, useState, useCallback } from "react"
import { usePoseTracker } from "@/components/camera/usePoseTracker"
import { PoseCanvas } from "@/components/camera/PoseCanvas"
import { CameraView } from "@/components/camera/CameraView"
import { RepCounterDisplay } from "@/components/camera/RepCounterDisplay"
import { saveWorkout, getUserProfile } from "@/lib/db"
import { createRepCounter } from "@/lib/exercises/repCounter"
import { getExercise } from "@/lib/exercises"
import { useWorkoutStore } from "@/store/workout"
import { useParams } from "next/navigation"
import { type ExerciseId } from "@/types"
import { Button } from "@/components/ui/Button"
import { useToast } from "@/components/ui/Toast"
import { Pause, Play, RotateCcw, X, Speaker, VolumeX } from "lucide-react"

const DETECT_FPS = 15
const FRAME_INTERVAL = 1000 / DETECT_FPS

export default function LiveWorkoutPage() {
  const router = useRouter()
  const { add } = useToast()
  const { user } = useAuth()
  const params = useParams()
  const id = (params as any).id as string
  const config = getExercise(id) ?? null

  const {
    reps, seconds, phase, angle, inFrame,
    isActive, isPaused, isCompleted,
  } = useWorkoutStore()

  const setExercise = useWorkoutStore((s) => s.setExercise)
  const start = useWorkoutStore((s) => s.start)
  const pause = useWorkoutStore((s) => s.pause)
  const resume = useWorkoutStore((s) => s.resume)
  const complete = useWorkoutStore((s) => s.complete)
  const addRep = useWorkoutStore((s) => s.addRep)
  const tick = useWorkoutStore((s) => s.tick)
  const setFrame = useWorkoutStore((s) => s.setFrame)

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [cameraReady, setCameraReady] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [hapticsOn, setHapticsOn] = useState(true)
  const [showGuide, setShowGuide] = useState(true)
  const [landmarks, setLandmarks] = useState<any[] | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const wakeLockRef = useRef<any>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const lastRepRef = useRef<number>(0)
  const repsRef = useRef(0)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const repCounterRef = useRef<ReturnType<typeof createRepCounter> | null>(null)
  if (config && !repCounterRef.current) repCounterRef.current = createRepCounter(config)
  const { detector, isLoading, error } = usePoseTracker()

  useEffect(() => {
    if (config) setExercise(id as ExerciseId)
  }, [config, id, setExercise])

  if (!config) return null

  useEffect(() => {
    let active = true
    const startCam = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: 1280, height: 720, frameRate: 30 },
        })
        if (!active) return
        setStream(s)
        setCameraReady(true)
      } catch (e: any) {
        console.error("Camera error", e)
        add({ type: "error", title: "Camera access denied", description: "Enable camera to count reps." })
      }
    }
    startCam()
    return () => { active = false; stream?.getTracks().forEach((t) => t.stop()) }
  }, [facingMode, add, stream])

  const requestWakeLock = useCallback(async () => {
    try { wakeLockRef.current = await navigator.wakeLock?.request("screen") } catch {}
  }, [])

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release?.()
    wakeLockRef.current = null
  }, [])

  const beep = useCallback(() => {
    if (!soundOn) return
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch {}
  }, [soundOn])

  useEffect(() => {
    if (!isActive || isPaused || !detector || !videoRef.current) return
    const loop = (now: number) => {
      if (now - lastTimeRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(loop)
        return
      }
      lastTimeRef.current = now
      const res = detector.detectForVideo(videoRef.current!, now)
      const lm = res.landmarks[0] ?? null
      setLandmarks(lm)
      if (!repCounterRef.current) repCounterRef.current = createRepCounter(config!)
      const state = repCounterRef.current.update({ config: config!, landmarks: lm, now })
      setFrame(state.inFrame, state.angle, state.phase)
      if (state.inFrame && state.reps > repsRef.current && now - lastRepRef.current > 700) {
        lastRepRef.current = now
        repsRef.current = state.reps
        addRep()
        beep()
        if (hapticsOn) navigator.vibrate?.(80)
        add({ type: "success", title: "Nice one!", description: `Rep ${state.reps}` })
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isActive, isPaused, detector, config, addRep, beep, hapticsOn, setFrame, add])

  useEffect(() => {
    if (!isActive || isPaused) return
    const id2 = setInterval(() => tick(Date.now()), 1000)
    return () => clearInterval(id2)
  }, [isActive, isPaused, tick])

  const handleStart = async () => {
    await requestWakeLock()
    start()
    setShowGuide(false)
  }

  const handlePause = () => {
    if (isPaused) { resume(); releaseWakeLock() } else { pause(); requestWakeLock() }
  }

  const handleFinish = async () => {
    releaseWakeLock()
    cancelAnimationFrame(rafRef.current)
    stream?.getTracks().forEach((t) => t.stop())
    complete()
    if (user) await saveAndUpdateStreak()
    router.push(`/exercises/${id}/result`)
  }

  const saveAndUpdateStreak = async () => {
    if (!user || !config) return
    const profile = await getUserProfile(user.uid)
    const tz = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const date = new Date().toLocaleString("en-US", { timeZone: tz }).split(",")[0]
    const goal = (profile?.goals[id as ExerciseId] ?? {}) as any
    const targetReps = goal.reps ?? (config.type === "rep" ? 10 : 0)
    const targetSeconds = goal.seconds ?? (config.type === "timed" ? 30 : 0)
    const completed = config.type === "rep" ? reps >= targetReps : seconds >= targetSeconds
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

  if (error) {
    return (
      <div className="fixed inset-0 z-20 bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Pose model failed to load</h2>
        <p className="text-slate-500 mb-4">{error}</p>
        <Button onClick={() => router.back()}>Back</Button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-20 bg-slate-900">
      {!cameraReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p>Opening camera…</p>
        </div>
      )}
      <CameraView stream={stream} width={1280} height={720} mirror={facingMode === "user"} />
      {landmarks && (
        <PoseCanvas landmarks={landmarks} width={1280} height={720} mirror={facingMode === "user"} />
      )}

      <div className="absolute inset-0 flex flex-col p-4 safe-area-pad-top safe-area-pad-bottom pointer-events-none">
        <div className="self-start">
          <Button variant="ghost" size="sm" onClick={() => router.replace("/home")}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-auto">
          {showGuide ? (
            <div className="rounded-3xl border border-slate-200 bg-white/95 backdrop-blur p-6 max-w-md text-center shadow-lg">
              <div className="text-3xl mb-2">📱</div>
              <p className="text-sm font-semibold text-slate-900 mb-1">Set up your phone</p>
              <p className="text-xs text-slate-500 mb-4">{config.phonePlacement}</p>
              <p className="text-xs text-slate-500 mb-4">{config.distance}</p>
              <Button variant="primary" className="w-full" onClick={handleStart}>
                I'm ready
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <RepCounterDisplay config={config} reps={reps} phase={phase} angle={angle} inFrame={inFrame} seconds={seconds} />
              {!inFrame && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-amber-700 text-sm font-semibold flex items-center gap-2">
                  <span>⚠</span> Get in frame
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={handlePause}>
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </Button>
                <Button variant="danger" size="sm" onClick={handleFinish}>
                  Finish
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="self-end flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFacingMode(facingMode === "user" ? "environment" : "user")}>
            <RotateCcw className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSoundOn(!soundOn)}>
            {soundOn ? <Speaker className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
