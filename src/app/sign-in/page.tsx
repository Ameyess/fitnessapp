"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { LogIn, Chrome, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

export default function SignInPage() {
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    loading,
  } = useAuth()
  const router = useRouter()
  const [mode, setMode] = React.useState<"login" | "signup">("login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [notice, setNotice] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (user) router.replace("/")
  }, [user, router])

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setNotice("")
    setBusy(true)
    try {
      if (mode === "login") await signInWithEmail(email, password)
      else await signUpWithEmail(email, password)
    } catch (err: any) {
      setError(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setError("")
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err: any) {
      setError(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const handleReset = async () => {
    setError("")
    setNotice("")
    if (!email) {
      setError("Enter your email first, then tap Reset.")
      return
    }
    try {
      await resetPassword(email)
      setNotice("Reset link sent — check your inbox.")
    } catch (err: any) {
      setError(mapAuthError(err))
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">💪</div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--c-primary)" }}>
            FitStreak
          </h1>
          <p className="mt-1 text-sm font-bold" style={{ color: "var(--c-muted)" }}>
            {mode === "login" ? "Welcome back!" : "Create your account"}
          </p>
        </div>

        <div
          className="rounded-3xl border-2 p-6"
          style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
        >
          <Button variant="outline" block onClick={handleGoogle} disabled={busy}>
            <Chrome className="h-4 w-4" />
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-0.5 flex-1" style={{ backgroundColor: "var(--c-border)" }} />
            <span className="text-xs font-extrabold uppercase" style={{ color: "var(--c-faint)" }}>
              or
            </span>
            <div className="h-0.5 flex-1" style={{ backgroundColor: "var(--c-border)" }} />
          </div>

          <form onSubmit={handleEmail}>
            <Input
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <p
                className="mb-3 rounded-xl px-3 py-2 text-sm font-bold"
                style={{ backgroundColor: "var(--c-danger-soft)", color: "var(--c-danger)" }}
              >
                {error}
              </p>
            )}
            {notice && (
              <p
                className="mb-3 rounded-xl px-3 py-2 text-sm font-bold"
                style={{ backgroundColor: "var(--c-primary-soft)", color: "var(--c-primary-dark)" }}
              >
                {notice}
              </p>
            )}

            <Button type="submit" variant="primary" block disabled={busy || loading}>
              {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
              {!busy && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-2 text-sm">
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="tap-target font-extrabold"
              style={{ color: "var(--c-primary)" }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
            <button
              onClick={handleReset}
              className="tap-target font-bold"
              style={{ color: "var(--c-muted)" }}
            >
              Forgot password?
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs font-semibold" style={{ color: "var(--c-faint)" }}>
          Video never leaves your device.
        </p>
      </motion.div>
    </div>
  )
}

function mapAuthError(err: any): string {
  const code = err?.code ?? ""
  switch (code) {
    case "auth/operation-not-allowed":
      return "Email sign-in isn't enabled yet. Ask the admin to enable it in Firebase."
    case "auth/invalid-api-key":
      return "Firebase isn't configured correctly. Check the environment variables."
    case "auth/email-already-in-use":
      return "That email already has an account. Try signing in."
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Wrong email or password."
    case "auth/weak-password":
      return "Password must be at least 6 characters."
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed."
    case "auth/network-request-failed":
      return "Network error. Check your connection."
    default:
      return err?.message ?? "Something went wrong. Please try again."
  }
}
