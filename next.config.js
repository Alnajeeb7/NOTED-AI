/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@blocknote/core'],
  },
  async headers() {
    return [
      {
        source: '/favicon.svg',
        headers: [{ key: 'Content-Type', value: 'image/svg+xml' }],
      },
    ]
  },
}
module.exports = nextConfig
