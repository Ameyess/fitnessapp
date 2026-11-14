"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import {
  getUserProfile,
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  getPublicStats,
} from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input, EmptyState, LoadingSpinner } from "@/components/ui/Input"
import { Users, UserPlus, Check, X, Send, Copy, Flame, Trophy } from "lucide-react"

export default function FriendsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      setProfile(p)
      const [f, r] = await Promise.all([
        getFriends(user.uid).catch(() => []),
        getPendingRequests(user.uid).catch(() => []),
      ])
      setFriends(f)
      setRequests(r)
      setLoading(false)
    }
    load()
  }, [user])

  const addFriend = async () => {
    if (!user || !search.trim()) return
    setMsg("")
    try {
      const stats = await getPublicStats(search.trim())
      if (!stats) {
        setMsg("No user found with that ID.")
        return
      }
      await sendFriendRequest(user.uid, search.trim())
      setSearch("")
      setMsg("Request sent!")
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to send request")
    }
  }

  const copyInvite = async () => {
    const link = `${window.location.origin}/?invite=${profile?.username ?? user?.uid ?? ""}`
    try {
      await navigator.clipboard.writeText(link)
      setMsg("Invite link copied!")
    } catch {
      setMsg(link)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
  if (!user) return null

  return (
    <div className="mx-auto max-w-lg px-4 py-5 pb-10">
      <h1 className="mb-4 text-2xl font-black tracking-tight" style={{ color: "var(--c-text)" }}>
        Friends
      </h1>

      {/* Add friend */}
      <div
        className="mb-5 rounded-3xl border-2 p-5"
        style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
      >
        <h2 className="mb-3 text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
          Add a friend
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="User ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-0 flex-1"
          />
          <Button variant="primary" onClick={addFriend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <button
          onClick={copyInvite}
          className="tap-target mt-3 w-full justify-center gap-2 rounded-2xl border-2 text-xs font-extrabold"
          style={{ borderColor: "var(--c-border)", color: "var(--c-muted)" }}
        >
          <Copy className="h-3.5 w-3.5" /> Copy invite link
        </button>
        <Link
          href="/leaderboard"
          className="tap-target mt-2 w-full justify-center gap-2 rounded-2xl border-2 text-xs font-extrabold"
          style={{ borderColor: "var(--c-border)", color: "var(--c-muted)" }}
        >
          <Trophy className="h-3.5 w-3.5" /> View leaderboard
        </Link>
        {msg && (
          <p className="mt-2 text-center text-xs font-extrabold" style={{ color: "var(--c-primary)" }}>
            {msg}
          </p>
        )}
      </div>

      {/* Requests */}
      {requests.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-3 text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
            Friend requests
          </h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border-2 px-4 py-3"
                style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--c-surface-2)" }}
                  >
                    <UserPlus className="h-5 w-5" style={{ color: "var(--c-faint)" }} />
                  </div>
                  <span className="truncate text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                    {r.from}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptFriendRequest(r.id, r.from, r.from)}
                    aria-label="Accept"
                    className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-90"
                    style={{ backgroundColor: "var(--c-primary)", color: "#fff" }}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => declineFriendRequest(r.id)}
                    aria-label="Decline"
                    className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-90"
                    style={{ backgroundColor: "var(--c-surface-2)", color: "var(--c-danger)" }}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friend list */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
          Your friends ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <EmptyState
            title="No friends yet"
            description="Add a friend to compare streaks and climb the leaderboard."
            icon={<Users className="h-6 w-6" />}
          />
        ) : (
          <div className="space-y-2">
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-2xl border-2 px-4 py-3"
                style={{ backgroundColor: "var(--c-surface)", borderColor: "var(--c-border)" }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: "var(--c-surface-2)" }}
                  >
                    <Users className="h-5 w-5" style={{ color: "var(--c-faint)" }} />
                  </div>
                  <span className="truncate text-sm font-extrabold" style={{ color: "var(--c-text)" }}>
                    {f.friendId}
                  </span>
                </div>
                <span
                  className="flex shrink-0 items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-extrabold"
                  style={{ borderColor: "var(--c-flame)", color: "var(--c-flame)" }}
                >
                  <Flame className="h-3.5 w-3.5" />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
