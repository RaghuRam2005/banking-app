/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Allow server-side packages in API routes only
    serverExternalPackages: ['nodemailer'],
};

export default nextConfig;
