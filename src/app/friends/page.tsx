"use client"

import * as React from "react"
import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import { getUserProfile, getFriends, getPendingRequests, sendFriendRequest, acceptFriendRequest, declineFriendRequest, getPublicStats } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { EmptyState } from "@/components/ui/Input"
import { Users, UserPlus, Clock, Check, X, Send } from "lucide-react"

export default function FriendsPage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [friends, setFriends] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const p = await getUserProfile(user.uid)
      setProfile(p)
      const f = await getFriends(user.uid)
      setFriends(f)
      const r = await getPendingRequests(user.uid)
      setRequests(r)
      setLoading(false)
    }
    load()
  }, [user])

  const addFriend = async () => {
    if (!user || !search) return
    // search by username/email - naive: treat search as friend uid lookup via public stats
    try {
      const stats = await getPublicStats(search)
      if (!stats) throw new Error("User not found")
      await sendFriendRequest(user.uid, search)
      setSearch("")
    } catch (e: any) {
      alert(e.message ?? "Failed to send request")
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50">Loading…</div>
  if (!user) return null

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-50 px-4 safe-area-pad-bottom">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 safe-area-pad-top">
        <h2 className="text-xl font-bold text-slate-900">Friends</h2>
      </header>

      <main className="flex-1 px-4 py-4 space-y-6">
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Add friend</h3>
          <div className="flex gap-2">
            <Input placeholder="username or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button variant="primary" onClick={addFriend}><Send className="w-4 h-4" /></Button>
          </div>
          <p className="text-xs text-slate-400 mt-1">Send an invite link or search by username.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Friend requests</h3>
          <div className="space-y-2">
            {requests.length === 0 && (
              <div className="text-center py-4 text-xs text-slate-400">No pending requests</div>
            )}
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><UserPlus className="w-5 h-5 text-slate-400" /></div>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{r.from}</div>
                    <div className="text-xs text-slate-500">wants to be friends</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => acceptFriendRequest(r.id, r.from, r.from)}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => declineFriendRequest(r.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-3">Your friends</h3>
          <div className="space-y-2">
            {friends.length === 0 && (
              <EmptyState title="No friends yet" description="Add friends to compare streaks." icon={<Users className="w-6 h-6" />} />
            )}
            {friends.map((f) => (
              <Link key={f.id} href={`/friends/${f.friendId}`} className="block">
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center"><Users className="w-5 h-5 text-slate-400" /></div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{f.friendId}</div>
                      <div className="text-xs text-slate-500">Friend</div>
                    </div>
                  </div>
                  <StreakFlameMini count={0} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function StreakFlameMini({ count = 0 }: { count?: number }) {
  return (
    <span className="inline-flex items-center rounded-full border border-flame-200 bg-flame-50 px-2 py-0.5 text-[10px] font-bold text-flame-700">
      🔥 {count}
    </span>
  )
}
