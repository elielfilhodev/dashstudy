import { serializeAcademicProfile } from "@/lib/academic"

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

export const publicUserSelect = {
  id: true,
  name: true,
  username: true,
  displayId: true,
  image: true,
  lastSeenAt: true,
  presenceStatus: true,
  academicProfile: { include: { course: true } },
} as const

export function isUserOnline(lastSeenAt: Date | null) {
  if (!lastSeenAt) return false
  return Date.now() - lastSeenAt.getTime() < ONLINE_THRESHOLD_MS
}

export function serializePublicUser(user: {
  id: string
  name: string | null
  username: string | null
  displayId: string
  image: string | null
  lastSeenAt: Date | null
  presenceStatus: "ONLINE" | "AWAY" | "OFFLINE"
  academicProfile?: Parameters<typeof serializeAcademicProfile>[0]
}) {
  const online = isUserOnline(user.lastSeenAt)

  return {
    id: user.id,
    name: user.name ?? "Usuário",
    username: user.username,
    displayId: user.displayId,
    image: user.image,
    online,
    presenceStatus: online ? user.presenceStatus : "OFFLINE",
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    academic: serializeAcademicProfile(user.academicProfile),
  }
}
