"use client"

import * as React from "react"

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

  const add = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, add, remove }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-xs items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === "success" ? "bg-emerald-100 text-emerald-600" : t.type === "error" ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>
              {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{t.title}</h4>
              {t.description && <p className="text-xs text-slate-500">{t.description}</p>}
            </div>
            <button
              onClick={() => remove(t.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
