"use client"

import * as React from "react"

export function Card({
  children,
  className,
  raised,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return (
    <div
      className={`${raised ? "card-raised" : "card"} ${className ?? ""}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-black tracking-tight" style={{ color: "var(--c-text)" }}>
        {children}
      </h2>
      {action}
    </div>
  )
}
