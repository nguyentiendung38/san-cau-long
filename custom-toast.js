const fs = require('fs');

const filePath = 'apps/frontend/src/pages/PortalPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Add toast state and ref
const stateInject = `
    const [favToast, setFavToast] = useState<{show: boolean, isAdd: boolean, id: number}>({ show: false, isAdd: true, id: 0 });
`;

if (!content.includes('const [favToast, setFavToast]')) {
    content = content.replace('const [favoriteVenueIds, setFavoriteVenueIds]', stateInject + '\n    const [favoriteVenueIds, setFavoriteVenueIds]');
}

// Replace toggleFavorite
const newToggle = `    const toggleFavorite = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavoriteVenueIds(prev => {
            const isRemoving = prev.includes(id);
            const next = isRemoving ? prev.filter(v => v !== id) : [...prev, id];
            localStorage.setItem('portal_favorites', JSON.stringify(next));
            
            setFavToast({ show: true, isAdd: !isRemoving, id: Date.now() });
            
            return next;
        });
    };

    // Auto hide toast
    React.useEffect(() => {
        if (favToast.show) {
            const timer = setTimeout(() => setFavToast(prev => ({...prev, show: false})), 3000);
            return () => clearTimeout(timer);
        }
    }, [favToast.id, favToast.show]);`;

const toggleRegex = /const toggleFavorite = [\s\S]*?return next;\n        \}\);\n    \};/;
content = content.replace(toggleRegex, newToggle);

// Inject custom toast JSX just inside the main wrapper
const toastJsx = `
            {/* Custom Fav Toast */}
            <div className={\`fixed top-20 right-4 z-[9999] transition-all duration-300 transform \${favToast.show ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}\`}>
                <div className="bg-[#f0fdf4] border border-[#86efac] shadow-lg rounded-xl p-4 flex items-start gap-3 min-w-[300px]">
                    <div className="mt-0.5 w-6 h-6 rounded-full border border-gray-800 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <div className="font-medium text-gray-800">Thông báo</div>
                        <div className="text-gray-500 text-sm mt-0.5">
                            {favToast.isAdd ? 'Ð? thêm vào danh sách yêu thích' : 'Ð? xóa kh?i danh sách yêu thích'}
                        </div>
                    </div>
                    <button onClick={() => setFavToast(prev => ({...prev, show: false}))} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
`;

content = content.replace('<div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans selection:bg-[#19b251]/30">', '<div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans selection:bg-[#19b251]/30">' + toastJsx);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Injected custom toast');
