import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/hooks/useAuth"
import { ToastProvider } from "@/components/ui/Toast"
import BottomTabNav from "@/components/layout/BottomTabNav"

// (toast container is rendered inside ToastProvider)

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })

export const metadata: Metadata = {
  title: "FitStreak — Camera rep counter & daily streak",
  description: "Count workout reps with your camera and keep your streak alive.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-slate min-h-screen bg-slate-50 text-slate-900`}>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
        <BottomTabNav />
      </body>
    </html>
  )
}
