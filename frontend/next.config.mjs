/** @type {import('next').NextConfig} */
// Supports three deployment targets from a single codebase:
// 1. Vercel (VERCEL=1): standard Next.js build on Vercel's native runtime.
// 2. Docker/Compose (DOCKER_STANDALONE=true): standalone Next.js server.
// 3. AWS Amplify (default): static export (`output: 'export'`) so Amplify
//    detects this as Next.js SSG.
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true'
const dockerStandalone = process.env.DOCKER_STANDALONE === 'true'
const staticExport = process.env.STATIC_EXPORT === 'true' || (!isVercel && !dockerStandalone)

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

if (staticExport) {
  nextConfig.output = 'export'
} else if (dockerStandalone) {
  nextConfig.output = 'standalone'
  nextConfig.trailingSlash = false
}

export default nextConfig
