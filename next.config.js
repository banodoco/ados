/** @type {import('next').NextConfig} */

// Debug logging during build
console.log('========================================')
console.log('🔧 next.config.js - NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL)
console.log('🔧 next.config.js - NODE_ENV:', process.env.NODE_ENV)
console.log('🔧 next.config.js - All NEXT_PUBLIC_* vars:')
Object.keys(process.env)
  .filter(key => key.startsWith('NEXT_PUBLIC_'))
  .forEach(key => console.log(`   ${key}:`, process.env[key]))
console.log('========================================')

const path = require('path')

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    return config
  },
}

module.exports = nextConfig

