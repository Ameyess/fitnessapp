"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import SignInView from "@/components/auth/SignInView"

/**
 * Gates the app behind auth WITHOUT a redirect hop.
 *
 * A signed-out visitor gets the sign-in form rendered inline, so the app
 * never does `/ -> /sign-in -> /` (three navigations) on the way in.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: "var(--c-primary)" }}
        />
      </div>
    )
  }

  if (!user) return <SignInView inline />

  return <>{children}</>
}
