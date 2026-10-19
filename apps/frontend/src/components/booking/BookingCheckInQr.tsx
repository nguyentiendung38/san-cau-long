import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function BookingCheckInQr({ token }: { token: string }) {
    const [image, setImage] = useState('');
    useEffect(() => {
        let active = true;
        QRCode.toDataURL(token, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
            .then((dataUrl) => { if (active) setImage(dataUrl); })
            .catch(() => { if (active) setImage(''); });
        return () => { active = false; };
    }, [token]);

    return image ? <img src={image} alt="Mã QR check-in" className="h-32 w-32 rounded-lg bg-white p-1" /> : null;
}
