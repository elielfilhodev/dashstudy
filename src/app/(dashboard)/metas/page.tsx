import { GoalsView } from "@/components/goals/goals-view"
import { fetchFromApi } from "@/lib/session"
import type { Goal } from "@/types"

export default async function MetasPage() {
  const goals = await fetchFromApi<Goal[]>("/goals")
  return <GoalsView initialGoals={goals} />
}
