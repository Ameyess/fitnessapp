import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  writeBatch,
} from "firebase/firestore"
import { getFirebase } from "@/lib/firebase"
import type { UserProfile, WorkoutLog, Friend, ExerciseId } from "@/types"

const { db } = getFirebase()

const USERS = "users"
const WORKOUTS = "workouts"
const FRIENDS = "friends"
const FRIEND_REQUESTS = "friendRequests"

export const todayKey = (timezone: string) => {
  return new Date().toLocaleString("en-US", { timeZone: timezone }).split(",")[0]
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid))
  if (!snap.exists()) return null
  return snap.data() as UserProfile
}

export async function setUserProfile(uid: string, data: Partial<UserProfile>) {
  await setDoc(doc(db, USERS, uid), { ...data, updatedAt: Date.now() }, { merge: true })
}

export async function createUserProfile(uid: string, email?: string | null, displayName?: string | null) {
  const ref = doc(db, USERS, uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return snap.data() as UserProfile
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: "en",
    goals: {
      pushups: { reps: 10, enabled: true },
      situps: { reps: 15, enabled: true },
      crunches: { reps: 15, enabled: true },
      squats: { reps: 15, enabled: true },
      jumpingjacks: { reps: 20, enabled: true },
      planks: { seconds: 30, enabled: true },
    },
    rampEnabled: true,
    restDays: [],
    streak: 0,
    longestStreak: 0,
    lastActiveDate: undefined,
    milestones: [],
    soundEnabled: true,
    hapticsEnabled: true,
    darkMode: false,
    reminderEnabled: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await setDoc(ref, profile)
  return profile
}

export async function getWorkouts(uid: string, date: string) {
  const q = query(
    collection(db, WORKOUTS),
    where("userId", "==", uid),
    where("date", "==", date),
    orderBy("createdAt", "asc"),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as WorkoutLog & { id: string })
}

export async function saveWorkout(log: Omit<WorkoutLog, "id">) {
  const ref = doc(collection(db, WORKOUTS))
  const payload: WorkoutLog = { ...log, id: ref.id, createdAt: Date.now(), updatedAt: Date.now() }
  await setDoc(ref, payload)
  return { ...payload, id: ref.id }
}

export async function updateWorkout(id: string, data: Partial<WorkoutLog>) {
  await updateDoc(doc(db, WORKOUTS, id), { ...data, updatedAt: Date.now() })
}

export async function getFriends(uid: string): Promise<Friend[]> {
  const q = query(collection(db, FRIENDS), where("userId", "==", uid), where("status", "==", "accepted"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Friend & { id: string })
}

export async function getPendingRequests(uid: string): Promise<Friend[]> {
  const q = query(collection(db, FRIEND_REQUESTS), where("to", "==", uid), where("status", "==", "pending"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Friend & { id: string })
}

export async function sendFriendRequest(from: string, to: string) {
  const ref = doc(collection(db, FRIEND_REQUESTS))
  await setDoc(ref, { from, to, status: "pending", createdAt: Date.now() })
}

export async function acceptFriendRequest(id: string, from: string, to: string) {
  const batch = writeBatch(db)
  batch.update(doc(db, FRIEND_REQUESTS, id), { status: "accepted" })
  batch.set(doc(collection(db, FRIENDS)), { userId: to, friendId: from, status: "accepted", createdAt: Date.now() })
  batch.set(doc(collection(db, FRIENDS)), { userId: from, friendId: to, status: "accepted", createdAt: Date.now() })
  await batch.commit()
}

export async function declineFriendRequest(id: string) {
  await updateDoc(doc(db, FRIEND_REQUESTS, id), { status: "declined" })
}

export async function getPublicStats(uid: string) {
  const snap = await getDoc(doc(db, USERS, uid))
  if (!snap.exists()) return null
  const d = snap.data() as UserProfile
  return { uid, displayName: d.displayName, photoURL: d.photoURL, streak: d.streak, longestStreak: d.longestStreak }
}
