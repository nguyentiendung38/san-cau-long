import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import QRCode from 'qrcode';

export default function BookingCheckInQr({ token }: { token: string }) {
    const [image, setImage] = useState('');
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        setImage('');
        setError(false);
        const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL?.trim() || window.location.origin;
        const checkInUrl = new URL(`/check-in/${encodeURIComponent(token)}`, `${publicAppUrl.replace(/\/+$/, '')}/`).toString();
        QRCode.toDataURL(checkInUrl, { errorCorrectionLevel: 'M', margin: 2, width: 320 })
            .then((dataUrl) => { if (active) setImage(dataUrl); })
            .catch((generationError) => {
                console.error('Không thể tạo mã QR check-in:', generationError);
                if (active) setError(true);
            });
        return () => { active = false; };
    }, [token]);

    if (error) {
        return <p role="alert" className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700">Không tạo được mã QR. Vui lòng tải lại trang.</p>;
    }
    if (!image) {
        return <div aria-label="Đang tạo mã QR check-in" className="h-44 w-44 max-w-full animate-pulse rounded-lg bg-white/80" />;
    }
    return (
        <div className="flex shrink-0 flex-col items-center gap-2">
            <img src={image} alt="Mã QR xem lịch đặt sân" className="h-44 w-44 max-w-full rounded-lg bg-white p-2" />
            <a
                href={image}
                download="ma-qr-lich-dat-san.png"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-50"
            >
                <Download className="h-3.5 w-3.5" />
                Tải mã QR
            </a>
        </div>
    );
}
