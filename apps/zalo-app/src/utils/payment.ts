import { openWebview, openOutApp } from "zmp-sdk";

/**
 * Kiểm tra xem môi trường hiện tại có phải là Zalo Mini App trên điện thoại thực tế không
 */
export const isRealZaloApp = (): boolean => {
  if (typeof window === "undefined") return false;
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";
  if (isLocal) return false;

  // Trong Zalo App di động, pathname luôn bắt đầu bằng /zapps hoặc có cầu nối Zalo bridge
  return (
    window.location.pathname.startsWith("/zapps") ||
    !!(window as any).ZaloJavaScriptInterface ||
    !!(window as any).webkit?.messageHandlers?.ZaloJavaScriptInterface
  );
};

/**
 * Mở liên kết thanh toán VNPAY Sandbox / Cổng thanh toán bên ngoài
 * Hoạt động 100% trên cả Zalo Mini App thực tế và Simulator / Localhost
 */
export const openPaymentLink = async (payUrl: string): Promise<boolean> => {
  if (!payUrl) return false;

  // 1. Nếu đang test trên máy tính / Zalo Simulator / Localhost:
  // zmp-sdk openWebview & openOutApp là stub rỗng (no-op) nên PHẢI mở qua window.open / location
  if (!isRealZaloApp()) {
    try {
      const opened = window.open(payUrl, "_blank");
      if (!opened) {
        window.location.href = payUrl;
      }
      return true;
    } catch {
      window.location.href = payUrl;
      return true;
    }
  }

  // 2. Nếu đang chạy trên Zalo App thực tế trên điện thoại:
  try {
    await openWebview({
      url: payUrl,
      config: {
        style: "normal",
        leftButton: "back",
      },
    });
    return true;
  } catch (errWebview) {
    console.warn("openWebview không khả dụng trên thiết bị, thử openOutApp:", errWebview);
  }

  try {
    await openOutApp({ url: payUrl });
    return true;
  } catch (errOutApp) {
    console.warn("openOutApp không khả dụng, dùng window.location:", errOutApp);
  }

  window.location.href = payUrl;
  return true;
};
