import type { NextConfig } from "next";

/**
 * Set BASE_PATH when the site is hosted under a sub-path, e.g.
 * `BASE_PATH=/learn2slither npm run build` for https://user.github.io/learn2slither/.
 */
const basePath = process.env.BASE_PATH?.replace(/\/+$/, "") ?? "";

const nextConfig: NextConfig = {
  // Fully static site: `next build` writes plain HTML/CSS/JS to `out/`.
  output: "export",
  // Write /fr as fr/index.html, which every static host serves without extra config.
  trailingSlash: true,
  basePath,
  env: {
    // basePath is not applied to plain fetch() calls, so expose it to the client.
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
