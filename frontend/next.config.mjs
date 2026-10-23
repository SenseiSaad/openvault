/** @type {import('next').NextConfig} */
const amplifyStaticExport = process.env.AMPLIFY_STATIC_EXPORT === 'true'

const nextConfig = {
  // Amplify Hosting's managed Next.js SSR currently supports through Next 15.
  // This app's routes are static and its API is external, so Amplify uses
  // Next 16's static export. Docker deployments keep the standalone server.
  output: amplifyStaticExport ? 'export' : 'standalone',
  trailingSlash: amplifyStaticExport,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
