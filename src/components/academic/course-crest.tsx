"use client"

import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  Code2,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Palette,
  Scale,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { AcademicSummary } from "@/types"

const ICONS = {
  business: BriefcaseBusiness,
  code: Code2,
  creative: Palette,
  engineering: Building2,
  "graduation-cap": GraduationCap,
  health: HeartPulse,
  humanities: BookOpen,
  scale: Scale,
  science: FlaskConical,
} as const

const SIZE_CLASSES = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
} as const

const ICON_SIZE_CLASSES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const

type Props = {
  academic: AcademicSummary | null | undefined
  size?: keyof typeof SIZE_CLASSES
  className?: string
}

export function CourseCrest({ academic, size = "sm", className }: Props) {
  if (!academic) return null

  const Icon = ICONS[academic.crestIcon as keyof typeof ICONS] ?? GraduationCap
  const label = `${academic.courseName} · ${academic.levelLabel} · ${academic.currentSemester}º semestre`

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border",
        SIZE_CLASSES[size],
        className
      )}
      style={{
        backgroundColor: academic.crestBackground,
        borderColor: academic.crestColor,
        color: academic.crestColor,
      }}
    >
      <Icon className={ICON_SIZE_CLASSES[size]} aria-hidden />
    </span>
  )
}
