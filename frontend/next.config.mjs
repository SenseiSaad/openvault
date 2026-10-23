/** @type {import('next').NextConfig} */
// The production frontend is hosted on AWS Amplify as a static site. Keep
// `output: 'export'` explicit so Amplify detects this as Next.js SSG rather
// than Next.js SSR. The optional Docker/Compose frontend sets
// DOCKER_STANDALONE=true to emit a standalone Next server instead.
const dockerStandalone = process.env.DOCKER_STANDALONE === 'true'

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

if (dockerStandalone) {
  nextConfig.output = 'standalone'
  nextConfig.trailingSlash = false
}

export default nextConfig
