import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/stores/auth.store';

export default function AdminRegisterPage() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const login = useAuthStore((state) => state.login);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async (event: React.FormEvent) => {
        event.preventDefault();
        if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
            toast({ title: 'Mật khẩu phải có ít nhất 8 ký tự và không vượt quá 72 byte', variant: 'error' });
            return;
        }
        if (password !== confirmPassword) {
            toast({ title: 'Mật khẩu nhập lại không khớp', variant: 'error' });
            return;
        }

        setIsLoading(true);
        try {
            const response = await authService.register({
                email: email.trim(),
                password,
                name: name.trim(),
                phone: phone.trim() || undefined,
            });
            if (response.success && response.data) {
                login(response.data.user, response.data.accessToken, response.data.refreshToken);
                toast({ title: 'Đăng ký thành công', variant: 'success' });
                navigate('/');
            }
        } catch (error: any) {
            toast({
                title: 'Không thể đăng ký',
                description: error.response?.data?.message || 'Vui lòng thử lại sau',
                variant: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-foreground-secondary hover:text-foreground mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Quay lại đăng nhập
                </Link>
                <div className="bg-background-secondary border border-border rounded-2xl p-8 shadow-xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-primary-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldCheck className="w-8 h-8 text-primary-500" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground mb-2">Tạo tài khoản quản lý</h1>
                        <p className="text-foreground-secondary">
                            Điền thông tin để tạo tài khoản. Không cần xác minh OTP qua email.
                        </p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <Input
                            type="text"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            label="Họ và tên"
                            required
                            minLength={2}
                            maxLength={100}
                            disabled={isLoading}
                        />
                        <Input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            label="Email"
                            required
                            disabled={isLoading}
                        />
                        <Input
                            type="tel"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            label="Số điện thoại (không bắt buộc)"
                            maxLength={20}
                            disabled={isLoading}
                        />
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                label="Mật khẩu (ít nhất 8 ký tự)"
                                required
                                minLength={8}
                                maxLength={72}
                                disabled={isLoading}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                aria-pressed={showPassword}
                                onClick={() => setShowPassword((visible) => !visible)}
                                className="absolute right-3 top-[38px] text-foreground-muted hover:text-foreground"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="relative">
                            <Input
                                type={showConfirmPassword ? 'text' : 'password'}
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                label="Nhập lại mật khẩu"
                                required
                                disabled={isLoading}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                aria-label={showConfirmPassword ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                                aria-pressed={showConfirmPassword}
                                onClick={() => setShowConfirmPassword((visible) => !visible)}
                                className="absolute right-3 top-[38px] text-foreground-muted hover:text-foreground"
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
                        </Button>
                    </form>
                </div>
                <p className="text-center text-xs text-foreground-muted mt-4">
                    Tài khoản đăng ký công khai được cấp quyền nhân viên. Quyền quản trị cần được cấp bởi quản trị viên hiện hữu.
                </p>
            </div>
        </div>
    );
}
