import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
    // Evita gerar formatos extras desnecessários; mantém apenas os essenciais
    formats: ["image/avif", "image/webp"],
  },

  serverExternalPackages: ["@prisma/client", "bcryptjs"],

  // Remove logs de console em produção (não afeta erros)
  compiler: {
    removeConsole: process.env.NODE_ENV === "production"
      ? { exclude: ["error", "warn"] }
      : false,
  },

  // Headers de cache para assets estáticos do Next (_next/static)
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ]
  },
}

export default nextConfig
