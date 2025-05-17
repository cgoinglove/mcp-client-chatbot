import type { NextConfig } from "next";

export default () => {
  const nextConfig: NextConfig = {
    cleanDistDir: true,
    devIndicators: {
      position: "bottom-right",
    },
    env: {
      NO_HTTPS: process.env.NO_HTTPS,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST,
    },
  };
  return nextConfig;
};
