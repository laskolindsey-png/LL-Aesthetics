/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse (and its pdfjs dependency) must run as a real Node module at
  // runtime, not be bundled — otherwise PDF text extraction fails.
  serverExternalPackages: ["pdf-parse", "xlsx"],
  experimental: {
    // Aura scan PDFs can be several MB — allow uploads up to 25 MB.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
