import { Link } from 'react-router-dom'
import { Calendar, MapPin, Sparkles, ArrowRight, ShieldCheck, Clock, Zap } from 'lucide-react'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-white font-sans text-gray-900">
            {/* Header / Navbar */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center transform rotate-12">
                                <Sparkles className="w-5 h-5 text-white -rotate-12" />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-500 bg-clip-text text-transparent">
                                Courtify
                            </span>
                        </div>
                        <div className="hidden md:flex space-x-8">
                            <a href="#features" className="text-gray-600 hover:text-green-600 font-medium transition-colors">Dịch vụ</a>
                            <a href="#venues" className="text-gray-600 hover:text-green-600 font-medium transition-colors">Hệ thống sân</a>
                            <a href="#pricing" className="text-gray-600 hover:text-green-600 font-medium transition-colors">Bảng giá</a>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-gray-600 hover:text-green-600 font-medium hidden sm:block">
                                Đăng nhập
                            </Link>
                            <Link
                                to="/dat-san"
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-full font-semibold transition-all hover:shadow-lg hover:shadow-green-500/30 flex items-center gap-2"
                            >
                                Đặt sân ngay
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent z-10" />
                    {/* Placeholder for Badminton Background */}
                    <img 
                        src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=2070&auto=format&fit=crop" 
                        alt="Badminton Court" 
                        className="w-full h-full object-cover object-right opacity-40"
                    />
                </div>
                
                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium text-sm mb-6 animate-fade-in-up">
                            <Sparkles className="w-4 h-4" />
                            Hệ thống đặt sân cầu lông thông minh AI
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
                            Trải nghiệm thể thao <br/>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-400">
                                Đỉnh Cao
                            </span>
                        </h1>
                        <p className="text-lg text-gray-600 mb-10 leading-relaxed max-w-xl">
                            Courtify cung cấp hệ thống sân cầu lông đạt chuẩn quốc tế. Đặt sân dễ dàng chưa từng có với Trợ lý AI thông minh hoạt động 24/7.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Link
                                to="/dat-san"
                                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all hover:shadow-2xl hover:shadow-green-500/40 flex items-center justify-center gap-2"
                            >
                                <Calendar className="w-5 h-5" />
                                Đặt Sân Tự Động Với AI
                            </Link>
                            <a
                                href="#venues"
                                className="bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 px-8 py-4 rounded-full font-bold text-lg transition-all flex items-center justify-center gap-2"
                            >
                                <MapPin className="w-5 h-5" />
                                Xem Hệ Thống Sân
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div id="features" className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Vì sao chọn Courtify?</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">Chúng tôi mang đến trải nghiệm liền mạch từ lúc đặt sân đến khi bạn bước lên sân thi đấu.</p>
                    </div>
                    
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                                <Bot className="w-7 h-7 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">AI Trợ Lý 24/7</h3>
                            <p className="text-gray-600">Không cần gọi điện chờ đợi. Trợ lý ảo của chúng tôi giúp bạn kiểm tra lịch, báo giá và đặt sân chỉ trong 10 giây qua chat.</p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-6">
                                <ShieldCheck className="w-7 h-7 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Cơ Sở Đạt Chuẩn</h3>
                            <p className="text-gray-600">100% thảm sân đạt tiêu chuẩn BWF, hệ thống ánh sáng chống chói và khoảng không gian rộng rãi chuyên nghiệp.</p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                            <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-6">
                                <Zap className="w-7 h-7 text-orange-600" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Dịch Vụ Trọn Gói</h3>
                            <p className="text-gray-600">Phục vụ nước uống, thuê vợt, đan lưới và tủ đồ cá nhân. Tích lũy điểm thưởng thành viên sau mỗi lần chơi.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-green-600 py-16 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-4xl font-extrabold mb-2">5+</div>
                            <div className="text-green-100 font-medium">Chi Nhánh</div>
                        </div>
                        <div>
                            <div className="text-4xl font-extrabold mb-2">40+</div>
                            <div className="text-green-100 font-medium">Sân Đạt Chuẩn</div>
                        </div>
                        <div>
                            <div className="text-4xl font-extrabold mb-2">10k+</div>
                            <div className="text-green-100 font-medium">Lượt Chơi / Tháng</div>
                        </div>
                        <div>
                            <div className="text-4xl font-extrabold mb-2">24/7</div>
                            <div className="text-green-100 font-medium">AI Hỗ Trợ Đặt Sân</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-gray-900 text-gray-400 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-white" />
                            </div>
                            <span className="text-xl font-bold text-white">Courtify</span>
                        </div>
                        <p className="mb-6 max-w-sm">Nền tảng quản lý và đặt sân cầu lông hiện đại nhất Việt Nam. Trải nghiệm thể thao thông minh thời đại AI.</p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4">Liên Hệ</h4>
                        <ul className="space-y-2">
                            <li>📞 Hotline: 1900 xxxx</li>
                            <li>📧 Email: hello@courtify.vn</li>
                            <li>📍 Trụ sở: Quận 1, TP.HCM</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4">Liên Kết</h4>
                        <ul className="space-y-2">
                            <li><Link to="/dat-san" className="hover:text-green-400">Đặt sân bằng AI</Link></li>
                            <li><Link to="/login" className="hover:text-green-400">Dành cho chủ sân (Admin)</Link></li>
                            <li><a href="#" className="hover:text-green-400">Điều khoản sử dụng</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-800 text-sm text-center">
                    &copy; 2026 Courtify. Bản quyền thuộc về Kteam.
                </div>
            </footer>
        </div>
    )
}
