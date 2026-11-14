"use client"

import * as React from "react"
import { motion } from "framer-motion"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "flame" | "blue" | "danger" | "outline"
  size?: "sm" | "md" | "lg"
  block?: boolean
}

const VARIANTS: Record<string, string> = {
  primary: "btn-primary",
  flame: "btn-flame",
  blue: "btn-blue",
  danger: "btn-danger",
  outline: "btn-outline",
}

const SIZES: Record<string, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  block,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${
        className ?? ""
      }`}
      disabled={disabled}
      {...(props as any)}
    >
      {children}
    </motion.button>
  )
}
