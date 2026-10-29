const PHONE = import.meta.env.VITE_PHONE_NUMBER || '0333655059'
const ZALO_URL = import.meta.env.VITE_ZALO_URL || `https://zalo.me/${PHONE}`

const linkClass =
    'w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform'

/** Nút liên hệ nhanh Zalo + Gọi điện, xếp ngay trên nút chat AI */
export function ContactButtons() {
    return (
        <div className="fixed bottom-[144px] md:bottom-[84px] right-4 md:right-6 z-[60] flex flex-col gap-3">
            <a href={ZALO_URL} target="_blank" rel="noopener noreferrer" title="Chat Zalo" className={linkClass}>
                <img src="/icons/zalo.webp" alt="Zalo" className="w-12 h-12 rounded-full object-contain" />
            </a>
            <a href={`tel:${PHONE}`} title="Gọi điện" className={linkClass}>
                <img src="/icons/phone.png" alt="Gọi điện" className="w-12 h-12 rounded-full object-contain" />
            </a>
        </div>
    )
}
