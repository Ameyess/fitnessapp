import type { Metadata, Viewport } from "next"
import { Nunito } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/hooks/useAuth"
import { ToastProvider } from "@/components/ui/Toast"
import { ThemeProvider, themeInitScript } from "@/components/ui/ThemeProvider"
import TopNav from "@/components/layout/TopNav"

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
  weight: ["400", "600", "700", "800", "900"],
})

export const metadata: Metadata = {
  title: "FitStreak — Camera rep counter & daily streak",
  description: "Count workout reps with your camera and keep your streak alive.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "FitStreak", statusBarStyle: "black-translucent" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#131f24" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the theme before first paint to avoid a flash */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Warm up Firebase connections so auth + Firestore are not cold on first request */}
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://www.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebaseinstallations.googleapis.com" />
      </head>
      <body
        className={`${nunito.variable} min-h-screen font-sans`}
        style={{ backgroundColor: "var(--c-bg)", color: "var(--c-text)" }}
      >
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <TopNav />
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
