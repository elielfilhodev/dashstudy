import { auth } from "@/lib/auth"
import { unauthorized } from "@/lib/api-response"

/**
 * Returns the authenticated user's ID or a 401 Response.
 * Designed to be used at the top of Route Handlers.
 *
 * @example
 * const { userId, error } = await requireAuth()
 * if (error) return error
 */
export async function requireAuth(): Promise<
  { userId: string; error: null } | { userId: null; error: ReturnType<typeof unauthorized> }
> {
  const session = await auth()
  if (!session?.user?.id) {
    return { userId: null, error: unauthorized() }
  }
  return { userId: session.user.id, error: null }
}
