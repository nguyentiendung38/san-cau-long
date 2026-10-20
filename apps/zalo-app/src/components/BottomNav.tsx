import React from "react";
import { useNavigate, useLocation } from "zmp-ui";

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: (active: boolean) => React.ReactNode;
}

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // On full-screen chat page, hide bottom tab bar so input & keyboard have full space
  if (currentPath === "/chat-ai") {
    return null;
  }

  const items: NavItem[] = [
    {
      key: "home",
      label: "Trang chủ",
      path: "/",
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? "2" : "1.8"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      key: "availability",
      label: "Giờ trống",
      path: "/availability",
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? "2.2" : "1.8"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      key: "chat-ai",
      label: "Trợ lý AI",
      path: "/chat-ai",
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={active ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={active ? "2" : "1.8"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      key: "history",
      label: "Lịch sử",
      path: "/history",
      icon: (active) => (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? "2.2" : "1.8"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 999,
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(16px)",
        borderTop: "1px solid #E2E8F0",
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          height: "56px",
          maxWidth: "480px",
          margin: "0 auto",
        }}
      >
        {items.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.path)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                border: "none",
                background: "transparent",
                color: isActive ? "#047857" : "#64748B",
                cursor: "pointer",
                padding: "4px 0",
                transition: "all 0.2s ease",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "36px",
                  height: "28px",
                  borderRadius: "14px",
                  backgroundColor: isActive ? "#ECFDF5" : "transparent",
                  color: isActive ? "#047857" : "#64748B",
                  transition: "background-color 0.2s ease",
                }}
              >
                {item.icon(isActive)}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: isActive ? "700" : "500",
                  marginTop: "2px",
                }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
