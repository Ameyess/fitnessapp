import { create } from "zustand"
import type { UserProfile, ExerciseId } from "@/types"

interface ProfileState {
  profile: UserProfile | null
  workouts: Record<string, any>
  loading: boolean
  error: string | null
  ready: boolean
  setProfile: (p: UserProfile | null) => void
  setWorkouts: (w: Record<string, any>) => void
  setLoading: (l: boolean) => void
  setError: (e: string | null) => void
  setReady: (r: boolean) => void
  patchProfile: (patch: Partial<UserProfile>) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  workouts: {},
  loading: true,
  error: null,
  ready: false,
  setProfile: (profile) => set({ profile }),
  setWorkouts: (workouts) => set({ workouts }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setReady: (ready) => set({ ready }),
  patchProfile: (patch) =>
    set((s) => (s.profile ? { profile: { ...s.profile, ...patch } } : s)),
}))

/* ------------------------------------------------------------------ */
/* Local cache - makes the app feel instant on repeat visits.         */
/* ------------------------------------------------------------------ */

const CACHE_PREFIX = "fitstreak:cache:"
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export interface CachedProfile {
  profile: UserProfile
  workouts: Record<string, any>
  ts: number
}

export function readCache(uid: string): CachedProfile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + uid)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedProfile
    if (!parsed?.profile) return null
    return parsed
  } catch {
    return null
  }
}

export function writeCache(uid: string, data: Omit<CachedProfile, "ts">) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(
      CACHE_PREFIX + uid,
      JSON.stringify({ ...data, ts: Date.now() })
    )
  } catch {}
}

export function isCacheFresh(c: CachedProfile | null) {
  return !!c && Date.now() - c.ts < CACHE_TTL
}

export type { ExerciseId }
