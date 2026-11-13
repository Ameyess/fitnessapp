"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import Link from "next/link"
import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/Button"
import { LogIn, Mail, Lock } from "lucide-react"

export default function SignInPage() {
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    loading,
  } = useAuth()
  const [mode, setMode] = React.useState<"login" | "signup">("login")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")

  if (user) return null // handled by layout redirect

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      if (mode === "login") await signInWithEmail(email, password)
      else await signUpWithEmail(email, password)
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong")
    }
  }

  const handleReset = async () => {
    setError("")
    try {
      await resetPassword(email)
      setError("Reset link sent")
    } catch (err: any) {
      setError(err?.message ?? "Failed")
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col items-center justify-center bg-slate-50 px-6">
      <Header />
      <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm mt-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-3xl">💪</span>
          <span className="text-2xl font-black text-slate-900 tracking-tight">FitStreak</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Keep your streak alive. Sign in to save your progress.
        </p>

        <form onSubmit={handleEmail} className="w-full space-y-3">
          <label className="label">Email</label>
          <input
            required
            type="email"
            className="input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="label">Password</label>
          <input
            required
            type="password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={loading}
          >
            {loading ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          {mode === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-emerald-600 font-semibold underline underline-offset-4"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>

        <div className="mt-6 w-full">
          <hr className="border-slate-200" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-3 mb-4">
            Or continue with
          </p>
          <Button variant="ghost" className="w-full" onClick={signInWithGoogle} disabled={loading}>
            <LogIn className="w-4 h-4 mr-2" />
            Sign in with Google
          </Button>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Forgot password?{" "}
          <button
            onClick={() => handleReset()}
            className="text-emerald-600 font-semibold underline underline-offset-4"
          >
            Reset
          </button>
        </p>
      </div>
    </div>
  )
}
