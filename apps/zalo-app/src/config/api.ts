const localApiUrl = "http://127.0.0.1:3005/api";
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (import.meta.env.PROD && !configuredApiUrl) {
  throw new Error("Thiếu VITE_API_URL: cần cấu hình URL HTTPS công khai của backend khi build Zalo Mini App.");
}

if (import.meta.env.PROD && configuredApiUrl) {
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

export const API_BASE_URL = (configuredApiUrl || (import.meta.env.DEV ? localApiUrl : "/api")).replace(/\/$/, "");
