// Firebase Cloud Messaging + PWA service worker
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-sw.js"

const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "__FIREBASE_AUTH_DOMAIN__",
  projectId: "__FIREBASE_PROJECT_ID__",
  storageBucket: "__FIREBASE_STORAGE_BUCKET__",
  messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__FIREBASE_APP_ID__",
}

const app = initializeApp(firebaseConfig)
const messaging = getMessaging(app)

onBackgroundMessage(messaging, (payload) => {
  const { title, body, icon } = payload.notification || {}
  self.registration.showNotification(title || "FitStreak", {
    body: body || "Don't break your streak!",
    icon: icon || "/icon.svg",
    badge: "/icon.svg",
    tag: "fitstreak-reminder",
    renotify: true,
  })
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  // "/" is the canonical, auth-gated home route. "/home" is a duplicate
  // route kept for backwards compatibility.
  event.waitUntil(clients.openWindow("/"))
})

// Basic PWA cache for installability
const CACHE = "fitstreak-v1"
const ASSETS = ["/", "/manifest.json", "/icon.svg"]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)))
  self.skipWaiting()
})

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  )
})
