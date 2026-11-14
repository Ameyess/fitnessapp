"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  createUserProfile,
  getUserProfile,
  getWorkouts,
  todayKey,
} from "@/lib/db"
import {
  useProfileStore,
  readCache,
  writeCache,
  isCacheFresh,
} from "@/store/profile"
import type { ExerciseId } from "@/types"

/**
 * Loads the user profile + today's workouts.
 *
 * Performance strategy:
 *  1. Paint immediately from the localStorage cache (instant shell).
 *  2. Revalidate in the background, fetching profile and workouts
 *     *in parallel* (not sequentially) to cut a round trip.
 */
export function useProfileLoader() {
  const { user, loading: authLoading } = useAuth()
  const { profile, workouts, loading, error, ready, setProfile, setWorkouts, setLoading, setError, setReady } =
    useProfileStore()

  const store = useProfileStore

  const load = React.useCallback(
    async (uid: string, opts: { useCache: boolean }) => {
      if (opts.useCache) {
        const cached = readCache(uid)
        if (cached) {
          setProfile(cached.profile)
          setWorkouts(cached.workouts)
          setLoading(false)
          setReady(true)
        }
      }

      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
        const date = todayKey(tz)

        // Profile and workouts are independent -> fetch in parallel.
        const [existing, logs] = await Promise.all([
          getUserProfile(uid).catch(() => null),
          getWorkouts(uid, date).catch(() => [] as any[]),
        ])

        let finalProfile = existing
        if (!finalProfile) {
          finalProfile = await createUserProfile(uid)
        }

        const byExercise: Record<string, any> = {}
        logs.forEach((l: any) => {
          byExercise[l.exerciseId] = l
        })

        setProfile(finalProfile)
        setWorkouts(byExercise)
        setError(null)
        writeCache(uid, { profile: finalProfile, workouts: byExercise })
      } catch (e: any) {
        console.error("Failed to load profile", e)
        setError(e?.message ?? "Failed to load your profile")
      } finally {
        setLoading(false)
        setReady(true)
      }
    },
    [setProfile, setWorkouts, setLoading, setError, setReady]
  )

  React.useEffect(() => {
    if (authLoading) return
    if (!user) {
      store.getState().setProfile(null)
      store.getState().setWorkouts({})
      store.getState().setLoading(false)
      store.getState().setReady(true)
      return
    }
    store.getState().setLoading(true)
    load(user.uid, { useCache: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, load])

  return {
    profile,
    workouts,
    loading: loading && !ready,
    error,
    ready,
    refresh: () => user && load(user.uid, { useCache: false }),
  }
}

export type { ExerciseId }
