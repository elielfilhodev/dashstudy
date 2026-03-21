"use client"

import { Toaster as Sonner } from "sonner"
import { useTheme } from "@/components/layout/theme-provider"

export function Toaster() {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme}
      position="top-right"
      richColors
      closeButton
      expand={false}
      duration={4500}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  )
}
