"use client"

import { memo, useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

type Props = {
  value: number | null
  onChange?: (v: number | null) => void
  readOnly?: boolean
  className?: string
  /** Tamanho visual */
  size?: "sm" | "md"
}

export const LibraryStarRating = memo(function LibraryStarRating({
  value,
  onChange,
  readOnly,
  className,
  size = "md",
}: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value ?? 0
  const iconClass = size === "sm" ? "size-4" : "size-5"

  return (
    <div
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`Avaliação: ${value ?? 0} de 5 estrelas`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= display
        if (readOnly) {
          return (
            <Star
              key={n}
              className={cn(
                iconClass,
                "shrink-0 transition-colors duration-200",
                active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"
              )}
              aria-hidden
            />
          )
        }
        return (
          <button
            key={n}
            type="button"
            className={cn(
              "p-0.5 rounded-md transition-transform duration-150 ease-out",
              "hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onChange?.(value === n ? null : n)}
          >
            <Star
              className={cn(
                iconClass,
                "shrink-0 transition-colors duration-200",
                active ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"
              )}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
})
