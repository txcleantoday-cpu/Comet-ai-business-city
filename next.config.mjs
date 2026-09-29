/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@abc/core','@abc/db','@abc/agents','@abc/integrations','@abc/workflows']
};
export default nextConfig;
