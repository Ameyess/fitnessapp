"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"

/**
 * Gates the app behind auth WITHOUT a redirect hop for signed-in users
 * (avoids the extra round-trip that made first paint feel slow).
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!loading && !user) router.replace("/sign-in")
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-transparent"
          style={{ borderTopColor: "var(--c-primary)" }}
        />
      </div>
    )
  }

  return <>{children}</>
}
