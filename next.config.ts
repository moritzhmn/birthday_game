import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname, // ✅ dein bestehender Fix bleibt
  },

  // ✅ NEU: erlaubt Zugriff vom Handy / anderen Geräten im Netzwerk
  allowedDevOrigins: ["192.168.178.144","192.168.2.192","192.168.178.88"],

  // Optional: ganzes Netzwerk erlauben
  // allowedDevOrigins: ["192.168.178.*"],
};

export default nextConfig;