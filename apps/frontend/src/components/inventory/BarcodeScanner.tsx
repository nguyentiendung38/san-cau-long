import { useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FormEvent } from 'react';

interface BarcodeScannerProps {
    onScan: (barcode: string) => void;
    onClose: () => void;
    isOpen: boolean;
    acceptedFormats?: ('ean' | 'code128' | 'qr' | 'all')[];
}

export function BarcodeScanner({
    onScan,
    onClose,
    isOpen,
    acceptedFormats = ['all'],
}: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const controlsRef = useRef<{ stop: () => void } | null>(null);
    const onScanRef = useRef(onScan);
    const [error, setError] = useState<string | null>(null);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [scanning, setScanning] = useState(false);

    onScanRef.current = onScan;

    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        let hasScanned = false;
        setError(null);
        setLastScanned(null);
        setScanning(false);

        if (!navigator.mediaDevices?.getUserMedia) {
            setError('Trình duyệt không hỗ trợ camera. Hãy mở trang bằng Chrome hoặc Safari mới nhất.');
            return;
        }
        if (!window.isSecureContext) {
            setError('Camera cần kết nối an toàn HTTPS. Hãy mở website bằng địa chỉ HTTPS rồi thử lại.');
            return;
        }

        const startScanning = async () => {
            try {
                const { BrowserMultiFormatReader, BrowserQRCodeReader } = await import('@zxing/browser');
                if (!active) return;
                const video = videoRef.current;
                if (!video) return;
                const reader = acceptedFormats.length === 1 && acceptedFormats[0] === 'qr'
                    ? new BrowserQRCodeReader()
                    : new BrowserMultiFormatReader();
                const controls = await reader.decodeFromConstraints(
                    { video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } },
                    video,
                    (result) => {
                        if (!active || hasScanned || !result) return;
                        hasScanned = true;
                        const value = result.getText();
                        setLastScanned(value);
                        setScanning(false);
                        if (navigator.vibrate) navigator.vibrate(100);
                        onScanRef.current(value);
                    },
                );

                if (!active) {
                    controls.stop();
                    return;
                }
                controlsRef.current = controls;
                setScanning(true);
            } catch (scanError) {
                if (!active) return;
                console.error('QR scanner error:', scanError);
                setError('Không mở được camera. Hãy cấp quyền camera cho trình duyệt, kiểm tra HTTPS rồi thử lại.');
            }
        };

        void startScanning();
        return () => {
            active = false;
            controlsRef.current?.stop();
            controlsRef.current = null;
        };
    }, [acceptedFormats, facingMode, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black">
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-4">
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white" aria-label="Đóng máy quét">
                    <X className="h-6 w-6" />
                </Button>
                <span className="font-medium text-white">
                    {acceptedFormats.length === 1 && acceptedFormats[0] === 'qr' ? 'Quét mã QR check-in' : 'Quét mã'}
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFacingMode((mode) => mode === 'environment' ? 'user' : 'environment')}
                    className="text-white"
                    aria-label="Đổi camera"
                >
                    <RotateCcw className="h-6 w-6" />
                </Button>
            </div>

            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

            {error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-8">
                    <div className="max-w-sm text-center">
                        <AlertCircle className="mx-auto mb-4 h-14 w-14 text-red-400" />
                        <p className="text-white">{error}</p>
                        <Button onClick={onClose} className="mt-5">Đóng</Button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="relative h-64 w-64">
                            <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-primary-500" />
                            <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-primary-500" />
                            <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-primary-500" />
                            <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-primary-500" />
                            {scanning && <div className="absolute left-4 right-4 top-1/2 h-0.5 bg-primary-500 animate-pulse" />}
                        </div>
                    </div>

                    {lastScanned && (
                        <div className="absolute bottom-24 left-4 right-4">
                            <div className="flex items-center gap-3 rounded-xl bg-green-500/90 p-4 text-white">
                                <Check className="h-6 w-6" />
                                <div>
                                    <p className="text-sm opacity-80">Đã quét</p>
                                    <p className="break-all font-mono font-bold">{lastScanned}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-8">
                        <p className="text-center text-sm text-white/90">
                            Đưa mã QR vào khung hình, giữ điện thoại ổn định
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

interface ManualBarcodeInputProps {
    onSubmit: (barcode: string) => void;
    placeholder?: string;
}

export function ManualBarcodeInput({ onSubmit, placeholder = 'Nhập mã vạch...' }: ManualBarcodeInputProps) {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        let buffer = '';
        let lastKeyTime = 0;
        const handleKeyDown = (event: KeyboardEvent) => {
            const now = Date.now();
            buffer = now - lastKeyTime < 50 ? `${buffer}${event.key}` : event.key;
            lastKeyTime = now;

            if (event.key === 'Enter' && buffer.length > 1) {
                onSubmit(buffer.slice(0, -1));
                setValue('');
                buffer = '';
            }
        };

        input.addEventListener('keydown', handleKeyDown);
        return () => input.removeEventListener('keydown', handleKeyDown);
    }, [onSubmit]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const barcode = value.trim();
        if (!barcode) return;
        onSubmit(barcode);
        setValue('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex gap-2">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={placeholder}
                className="flex-1 rounded-lg border border-border bg-background-tertiary px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button type="submit" disabled={!value.trim()} aria-label="Nhập mã">
                <Check className="h-4 w-4" />
            </Button>
        </form>
    );
}
