import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,

  // Imagem Docker enxuta: empacota só o necessário para rodar o servidor.
  output: "standalone",

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


  // Melhora drasticamente a performance de tempo de carregamento no front-end
  // isolando os imports da biblioteca de ícones e outras bibliotecas pesadas modulares
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },

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
