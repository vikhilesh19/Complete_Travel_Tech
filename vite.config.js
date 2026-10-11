import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiPort =
    process.env.NODE_ENV === "production"
      ? env.PORT || env.API_PORT || "5000"
      : env.API_PORT || "5000";
  const target =
    env.API_PROXY_TARGET ||
    env.VITE_API_BASE_URL ||
    `http://localhost:${apiPort}`;

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
