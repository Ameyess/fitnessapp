"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"

export interface Toast {
  id: string
  type: "success" | "error" | "info"
  title: string
  description?: string
}

interface ToastContextType {
  toasts: Toast[]
  add: (toast: Omit<Toast, "id">) => void
  remove: (id: string) => void
}

const ToastContext = React.createContext<ToastContextType>({
  toasts: [],
  add: () => {},
  remove: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const add = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200)
  }, [])

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const palette: Record<string, { bg: string; fg: string; icon: string }> = {
    success: { bg: "var(--c-primary-soft)", fg: "var(--c-primary-dark)", icon: "✓" },
    error: { bg: "var(--c-danger-soft)", fg: "var(--c-danger)", icon: "✕" },
    info: { bg: "var(--c-blue-soft)", fg: "var(--c-blue)", icon: "ℹ" },
  }

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 safe-area-pad-top">
        <AnimatePresence>
          {toasts.map((t) => {
            const p = palette[t.type]
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border-2 p-3"
                style={{
                  backgroundColor: "var(--c-surface)",
                  borderColor: "var(--c-border)",
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-black"
                  style={{ backgroundColor: p.bg, color: p.fg }}
                >
                  {p.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                    {t.title}
                  </h4>
                  {t.description && (
                    <p className="truncate text-xs font-semibold" style={{ color: "var(--c-muted)" }}>
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss"
                  className="shrink-0 text-lg font-bold"
                  style={{ color: "var(--c-faint)" }}
                >
                  ×
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
