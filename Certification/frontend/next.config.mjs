const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:8000";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api/* to the existing backend so the opaque session cookie and
    // CSRF cookie stay first-party on the app origin (SameSite friendly).
    return process.env.BACKEND_PROXY === "true"
      ? [{ source: "/api/:path*", destination: `${backendOrigin}/api/:path*` }]
      : [];
  },
};

export default nextConfig;
