import { SubjectsView } from "@/components/subjects/subjects-view"
import { fetchFromApi } from "@/lib/session"
import type { Subject } from "@/types"

export default async function MateriasPage() {
  const subjects = await fetchFromApi<Subject[]>("/subjects")
  return <SubjectsView initialSubjects={subjects} />
}
