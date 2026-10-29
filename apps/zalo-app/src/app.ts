// ZaUI stylesheet
import "zmp-ui/zaui.css";
// Tailwind stylesheet
import "@/css/tailwind.scss";
// Your stylesheet
import "@/css/app.scss";

// React core
import React from "react";
import { createRoot } from "react-dom/client";

// Mount the app
import Layout from "@/components/layout";
import logoHue from "@/static/logo-hue.jpg";

// Expose app configuration
import appConfig from "../app-config.json";

if (!window.APP_CONFIG) {
  window.APP_CONFIG = appConfig as any;
}

// Đảm bảo hiển thị icon logo HUE và tiêu đề trên tab trình duyệt / thanh đường dẫn (cả trực tiếp lẫn khung giả lập zmp port 3000)
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const appTitle = "Sân Cầu Lông HUE - Trường Đại Học Kinh Tế Huế";
  const baseLogoUrl = new URL(logoHue, window.location.origin).href;
  const absoluteLogoUrl = baseLogoUrl.includes("?")
    ? `${baseLogoUrl}&v=hue`
    : `${baseLogoUrl}?v=hue`;

  const applyFaviconAndTitle = () => {
    document.title = appTitle;
    let favicon = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.type = "image/jpeg";
    favicon.href = absoluteLogoUrl;

    // Nếu đang chạy trong iframe giả lập của ZMP CLI (ví dụ localhost:3000 bọc iframe localhost:2999)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "config-title", data: appTitle }, "*");
      window.parent.postMessage(
        {
          type: "custom",
          data: `
            (function() {
              document.title = ${JSON.stringify(appTitle)};
              var titleEl = document.getElementById("title");
              if (titleEl) titleEl.innerHTML = ${JSON.stringify(appTitle)};
              var oldLinks = document.querySelectorAll("link[rel*='icon']");
              oldLinks.forEach(function(el) { el.parentNode.removeChild(el); });
              var link = document.createElement("link");
              link.rel = "shortcut icon";
              link.type = "image/jpeg";
              link.href = ${JSON.stringify(absoluteLogoUrl)};
              document.head.appendChild(link);
              var link2 = document.createElement("link");
              link2.rel = "icon";
              link2.type = "image/jpeg";
              link2.href = ${JSON.stringify(absoluteLogoUrl)};
              document.head.appendChild(link2);
            })();
          `,
        },
        "*"
      );
    }
  };

  applyFaviconAndTitle();
  setTimeout(applyFaviconAndTitle, 500);
}

const root = createRoot(document.getElementById("app")!);
root.render(React.createElement(Layout));
