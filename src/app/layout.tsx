import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { SessionProvider } from "@/components/layout/session-provider"
import { SWRProvider } from "@/components/layout/swr-provider"
import { Toaster } from "@/components/ui/sonner"
import { StudyAlerts } from "@/components/layout/study-alerts"

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Dash Estudos",
  description: "Aplicativo completo de controle de estudos com dashboard.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider>
          <SWRProvider>
            <ThemeProvider>
              {children}
              <Toaster />
              <StudyAlerts />
            </ThemeProvider>
          </SWRProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
