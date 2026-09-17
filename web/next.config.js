/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "tesseract.js", "@prisma/client", "prisma"],
};

module.exports = nextConfig;
