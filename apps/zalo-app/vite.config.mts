import { defineConfig, loadEnv } from "vite";
import zaloMiniApp from "zmp-vite-plugin";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const configuredApiUrl = loadEnv(mode, process.cwd(), "").VITE_API_URL?.trim();
  if (mode === "production") {
    if (!configuredApiUrl) {
      throw new Error("Thiếu VITE_API_URL: cần cấu hình URL HTTPS công khai của backend khi build Zalo Mini App.");
    }

    let apiUrl: URL;
    try {
      apiUrl = new URL(configuredApiUrl);
    } catch {
      throw new Error("VITE_API_URL trong production phải là URL tuyệt đối của backend.");
    }
    if (
      apiUrl.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(apiUrl.hostname)
    ) {
      throw new Error("VITE_API_URL trong production phải dùng HTTPS và không được trỏ tới localhost.");
    }
  }

  return {
    root: "./src",
    base: "",
    plugins: [zaloMiniApp(), react()], server: { port: 3001 },
    build: {
      assetsInlineLimit: 0,
    },
    resolve: {
      alias: {
        "@": "/src",
      },
    },
  };
});
