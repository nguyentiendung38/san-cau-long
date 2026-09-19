import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { Send, Bot, User, Loader2, Sparkles, RotateCcw } from 'lucide-react'
import { chatbotService } from '@/services/chatbot.service'

interface Message {
    id: string
    role: 'user' | 'bot'
    content: string
    timestamp: Date
}

export default function PublicChatPage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [sessionId, setSessionId] = useState<string | undefined>()
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        chatbotService.getStatus()
            .then((status) => setIsAvailable(status.isAvailable))
            .catch(() => setIsAvailable(false))
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (messages.length === 0) {
            setMessages([
                {
                    id: 'welcome',
                    role: 'bot',
                    content: 'Xin chào! 🏸 Tôi là **SÂN CẦU LÔNG HUE AI**, trợ lý đặt sân cầu lông thông minh.\n\nTôi có thể giúp bạn:\n• 📅 Đặt sân cầu lông\n• 🔍 Kiểm tra lịch trống\n• 💰 Xem bảng giá\n• 📋 Tra cứu lịch đặt\n\nHãy cho tôi biết bạn cần gì nhé!',
                    timestamp: new Date(),
                },
            ])
        }
    }, [messages.length])

    const sendMessage = useCallback(async () => {
        const trimmed = input.trim()
        if (!trimmed || isLoading) return

        const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: trimmed, timestamp: new Date() }
        setMessages((prev) => [...prev, userMsg])
        setInput('')
        setIsLoading(true)

        try {
            const response = await chatbotService.sendMessage(trimmed, sessionId)
            setSessionId(response.sessionId)
            const botMsg: Message = { id: `bot-${Date.now()}`, role: 'bot', content: response.reply, timestamp: new Date() }
            setMessages((prev) => [...prev, botMsg])
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.'
            setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'bot', content: `⚠️ ${errorMessage}`, timestamp: new Date() }])
        } finally {
            setIsLoading(false)
        }
    }, [input, isLoading, sessionId])

    const sendQuickMessage = useCallback((text: string) => {
        if (isLoading) return
        setInput('')
        
        const userMsg: Message = { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date() }
        setMessages((prev) => [...prev, userMsg])
        setIsLoading(true)
        
        chatbotService.sendMessage(text, sessionId)
            .then((response) => {
                setSessionId(response.sessionId)
                const botMsg: Message = { id: `bot-${Date.now()}`, role: 'bot', content: response.reply, timestamp: new Date() }
                setMessages((prev) => [...prev, botMsg])
            })
            .catch((error: any) => {
                const errorMessage = error.response?.data?.message || 'Xin lỗi, có lỗi xảy ra.'
                setMessages((prev) => [...prev, { id: `error-${Date.now()}`, role: 'bot', content: `⚠️ ${errorMessage}`, timestamp: new Date() }])
            })
            .finally(() => setIsLoading(false))
    }, [isLoading, sessionId])

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const clearChat = async () => {
        if (sessionId) {
            try { await chatbotService.clearSession(sessionId) } catch { /* ignore */ }
        }
        setMessages([])
        setSessionId(undefined)
    }

    const renderContent = (text: string) => {
        const lines = text.split('\n')
        return lines.map((line, i) => {
            let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            if (processed.startsWith('• ') || processed.startsWith('- ')) {
                return (
                    <div key={i} className="flex gap-1.5 ml-1">
                        <span className="text-green-500 shrink-0">•</span>
                        <span dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />
                    </div>
                )
            }
            if (processed.trim() === '') return <div key={i} className="h-2" />
            return <div key={i} dangerouslySetInnerHTML={{ __html: processed }} />
        })
    }

    if (isAvailable === false) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Bot className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Hệ thống bảo trì</h2>
                    <p className="text-gray-500">Tính năng trợ lý ảo hiện đang được bảo trì. Vui lòng quay lại sau hoặc liên hệ Hotline để đặt sân.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white flex flex-col lg:flex-row font-sans">
            {/* Left Panel - Branding (Hidden on mobile) */}
            <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-12 text-white overflow-hidden shadow-2xl z-10">
                <div className="absolute inset-0 z-0">
                    <img 
                        src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070&auto=format&fit=crop" 
                        alt="Sân cầu lông SÂN CẦU LÔNG HUE"
                        className="w-full h-full object-cover" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 via-green-800/90 to-emerald-900/95"></div>
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-16">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                            <Sparkles className="w-6 h-6 text-green-600" />
                        </div>
                        <span className="text-3xl font-bold tracking-tight">SÂN CẦU LÔNG HUE</span>
                    </div>

                    <h1 className="text-5xl lg:text-6xl font-extrabold mb-6 leading-[1.15] tracking-tight">
                        Trải nghiệm <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-200">đặt sân thể thao</span> <br/>
                        thời đại AI
                    </h1>
                    <p className="text-lg text-green-100/90 max-w-md mb-12 leading-relaxed">
                        Không cần gọi điện, không cần chờ đợi. Chat trực tiếp với Trợ lý AI của chúng tôi để tìm sân, báo giá và chốt lịch chỉ trong 10 giây.
                    </p>

                    <div className="space-y-8">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                                <Bot className="w-6 h-6 text-green-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-1">AI Trợ Lý 24/7</h3>
                                <p className="text-green-100/70">Luôn sẵn sàng phục vụ bất cứ lúc nào</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                                <Sparkles className="w-6 h-6 text-green-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-1">Đặt Sân Siêu Tốc</h3>
                                <p className="text-green-100/70">Chốt lịch tự động vào hệ thống ngay lập tức</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-sm text-green-200/50 font-medium">
                    &copy; 2026 SÂN CẦU LÔNG HUE. Powered by Gemini AI.
                </div>
            </div>

            {/* Right Panel - Chatbot */}
            <div className="w-full lg:w-[55%] bg-[#F8FAFC] flex flex-col h-screen">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
                            <Bot className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg leading-tight tracking-wide">SÂN CẦU LÔNG HUE Assistant</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
                                <span className="text-green-100 text-sm font-medium">Trực tuyến</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={clearChat}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2 text-white text-sm font-medium"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gray-50/50">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'bot' && (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                    <Sparkles className="w-4 h-4 text-green-600" />
                                </div>
                            )}
                            <div
                                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
                                    msg.role === 'user'
                                        ? 'bg-green-600 text-white rounded-tr-sm'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                                }`}
                            >
                                {msg.role === 'bot' ? renderContent(msg.content) : msg.content}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center shrink-0 shadow-sm mt-1">
                                <Sparkles className="w-4 h-4 text-green-600" />
                            </div>
                            <div className="bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-gray-100">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length <= 1 && (
                    <div className="px-4 py-3 bg-white border-t border-gray-100 flex gap-2 flex-wrap justify-center">
                        {['📅 Đặt sân hôm nay', '🔍 Xem lịch trống', '💰 Xem bảng giá', '📋 Tra cứu lịch đặt'].map((q) => (
                            <button
                                key={q}
                                onClick={() => sendQuickMessage(q)}
                                className="text-sm font-medium bg-gray-50 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-all active:scale-95"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                    <div className="flex items-end gap-3 max-w-4xl mx-auto">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập yêu cầu của bạn (VD: Cho tôi đặt sân mai 7h sáng)..."
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3.5 text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 max-h-32 bg-gray-50/50"
                            style={{ minHeight: '52px', height: 'auto' }}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement
                                target.style.height = 'auto'
                                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                            }}
                            disabled={isLoading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || !input.trim()}
                            className="p-3.5 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm shrink-0"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                    <div className="mt-3 text-center">
                        <span className="text-[11px] text-gray-400 font-medium tracking-wide">POWERED BY GEMINI AI</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
