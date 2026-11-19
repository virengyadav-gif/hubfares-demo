import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'exceljs', 'unpdf'],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
