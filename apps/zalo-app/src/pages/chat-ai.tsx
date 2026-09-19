import React, { useState, useEffect, useRef, useCallback } from "react";
import { Page, Header, Box, Text, useSnackbar } from "zmp-ui";
import { useNavigate } from "zmp-ui";

// Địa chỉ Backend AI Chatbot - cùng server với web quản lý
const API_URL = "http://192.168.1.17:3005/api/chatbot";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
}

const QUICK_ACTIONS = [
  "📅 Đặt sân hôm nay",
  "🔍 Xem lịch trống",
  "💰 Xem bảng giá",
  "📋 Tra cứu lịch đặt",
];

export default function ChatAIPage() {
  const navigate = useNavigate();
  const { openSnackbar } = useSnackbar();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content:
        "Xin chào! 🏸 Tôi là trợ lý AI của Sân Cầu Lông Hue.\n\nTôi có thể giúp bạn:\n• Đặt sân cầu lông\n• Kiểm tra lịch trống\n• Xem bảng giá\n• Tra cứu lịch đã đặt\n\nHãy cho tôi biết bạn cần gì!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch(`${API_URL}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim(), sessionId }),
        });

        const data = await res.json();

        if (data.success) {
          setSessionId(data.data.sessionId);
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-${Date.now()}`,
              role: "bot",
              content: data.data.reply,
            },
          ]);
        } else {
          throw new Error(data.message || "Lỗi không xác định");
        }
      } catch (err: any) {
        openSnackbar({
          type: "error",
          text: "Không kết nối được với AI. Vui lòng thử lại!",
        });
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "bot",
            content: "⚠️ Xin lỗi, hệ thống AI đang bận. Vui lòng thử lại sau hoặc gọi Hotline để được hỗ trợ nhé!",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, sessionId, openSnackbar]
  );

  return (
    <Page className="flex flex-col bg-gray-50" style={{ height: "100vh" }}>
      <Header
        title="Trợ lý AI 🏸"
        showBackIcon
        onBackClick={() => navigate(-1)}
      />

      {/* Khu vực tin nhắn */}
      <Box
        className="flex-1 overflow-y-auto p-3 space-y-3"
        style={{ paddingBottom: "120px" }}
      >
        {messages.map((msg) => (
          <Box
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "bot" && (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #10B981, #059669)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 8,
                  flexShrink: 0,
                  fontSize: 16,
                  marginTop: 4,
                }}
              >
                🤖
              </div>
            )}
            <Box
              style={{
                maxWidth: "78%",
                padding: "10px 14px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "user"
                  ? "linear-gradient(135deg, #10B981, #059669)"
                  : "white",
                color: msg.role === "user" ? "white" : "#1F2937",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
            </Box>
          </Box>
        ))}

        {isLoading && (
          <Box className="flex justify-start">
            <div
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #10B981, #059669)",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginRight: 8, fontSize: 16, flexShrink: 0,
              }}
            >
              🤖
            </div>
            <Box
              style={{
                padding: "12px 16px", borderRadius: "18px 18px 18px 4px",
                background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: "#10B981",
                      animation: `bounce 0.8s ${delay}ms infinite`,
                    }}
                  />
                ))}
              </div>
            </Box>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Quick actions - chỉ hiện khi mới bắt đầu */}
      {messages.length <= 1 && (
        <Box
          className="px-3 py-2 flex flex-wrap gap-2"
          style={{ background: "white", borderTop: "1px solid #F3F4F6" }}
        >
          {QUICK_ACTIONS.map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                border: "1px solid #D1FAE5",
                background: "#F0FDF4",
                color: "#059669",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </Box>
      )}

      {/* Input gửi tin nhắn */}
      <Box
        className="flex items-end gap-2 p-3"
        style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: "white",
          borderTop: "1px solid #E5E7EB",
          paddingBottom: "env(safe-area-inset-bottom, 12px)",
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          placeholder="Nhắn tin với AI..."
          disabled={isLoading}
          rows={1}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 22,
            border: "1.5px solid #D1FAE5",
            fontSize: 14,
            color: "#1F2937",
            background: "#F9FAFB",
            resize: "none",
            outline: "none",
            maxHeight: 96,
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          style={{
            width: 42, height: 42, borderRadius: "50%",
            background: input.trim() && !isLoading
              ? "linear-gradient(135deg, #10B981, #059669)"
              : "#E5E7EB",
            border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
            flexShrink: 0,
            fontSize: 18,
          }}
        >
          {isLoading ? "⏳" : "➤"}
        </button>
      </Box>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </Page>
  );
}
