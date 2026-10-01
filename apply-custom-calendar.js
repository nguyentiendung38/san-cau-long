const fs = require("fs");
let content = fs.readFileSync("apps/frontend/src/pages/PortalBookingVisual.tsx", "utf8");

// 1. Add required imports (ChevronRight, etc) if not exists
if (!content.includes("ChevronRight")) {
    content = content.replace("ChevronLeft, Calendar as CalendarIcon, X", "ChevronLeft, ChevronRight, Calendar as CalendarIcon, X");
}

// 2. Add state variables right after loading state
const stateHooks = `    const [loading, setLoading] = useState(true);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [viewMonth, setViewMonth] = useState<Date>(new Date());`;

content = content.replace("    const [loading, setLoading] = useState(true);", stateHooks);

// 3. Add calendar helper functions before the return statement
const helperFunctions = `    const generateCalendarDays = () => {
        const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
        const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
        let startOffset = firstDay.getDay() - 1;
        if (startOffset === -1) startOffset = 6;
        
        const days = [];
        for (let i = 0; i < startOffset; i++) {
            days.push(null);
        }
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i));
        }
        return days;
    };

    const isSameDay = (d1: Date, d2: Date) => {
        return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
    };

    const changeMonth = (offset: number) => {
        const newMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1);
        // Only allow this month and next month
        const currentM = new Date(now.getFullYear(), now.getMonth(), 1);
        const maxM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        if (newMonth >= currentM && newMonth <= maxM) {
            setViewMonth(newMonth);
        }
    };
    
    return (`;

content = content.replace("    return (", helperFunctions);

// 4. Replace the old input date
const oldInput = /<div className=\"absolute right-4 flex items-center gap-2 bg-white\/20 rounded-md px-3 py-1\.5 cursor-pointer\">[\s\S]*?<\/div>/;

const newButton = `<div 
                    onClick={() => { 
                        const d = new Date(selectedDate);
                        setTempDate(d); 
                        setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1)); 
                        setShowDatePicker(true); 
                    }} 
                    className="absolute right-4 flex items-center gap-2 bg-white/20 hover:bg-white/30 transition-colors rounded-md px-3 py-1.5 cursor-pointer"
                >
                    <span className="text-white font-medium">
                        {selectedDate.split('-').reverse().join('/')}
                    </span>
                    <CalendarIcon className="w-4 h-4 text-white" />
                </div>`;

content = content.replace(oldInput, newButton);

// 5. Inject the Custom Calendar Modal at the end, right before the last closing div
const customModal = `
            {showDatePicker && (
                <div className="fixed inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-[320px] p-5 shadow-xl font-sans animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 px-1">
                            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full text-[#046c4e] transition-colors">
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="font-medium text-gray-800 text-[15px]">
                                tháng {viewMonth.getMonth() + 1} nãm {viewMonth.getFullYear()}
                            </div>
                            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-full text-[#046c4e] transition-colors">
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-7 mb-3 text-center text-gray-500 text-[13px] font-medium">
                            <div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div><div>CN</div>
                        </div>
                        
                        <div className="grid grid-cols-7 gap-y-2 text-center text-gray-800">
                            {generateCalendarDays().map((day, i) => {
                                if (!day) return <div key={\`empty-\${i}\`}></div>;
                                
                                const isToday = isSameDay(day, now);
                                const isSelected = isSameDay(day, tempDate);
                                const isPast = day < new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                const isBeyondNextMonth = day > maxDate;
            
                                let btnClass = "w-8 h-8 mx-auto flex items-center justify-center rounded-lg text-[15px] transition-all ";
                                if (isPast || isBeyondNextMonth) {
                                    btnClass += "text-gray-300 cursor-not-allowed";
                                } else if (isSelected) {
                                    btnClass += "bg-[#046c4e] text-white font-semibold shadow-md";
                                } else if (isToday) {
                                    btnClass += "border border-[#046c4e] text-[#046c4e] font-semibold";
                                } else {
                                    btnClass += "hover:bg-green-50 cursor-pointer";
                                }
            
                                return (
                                    <button 
                                        key={i} 
                                        disabled={isPast || isBeyondNextMonth}
                                        onClick={() => setTempDate(day)}
                                        className={btnClass}
                                    >
                                        {day.getDate()}
                                    </button>
                                )
                            })}
                        </div>
            
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowDatePicker(false)} className="text-[#046c4e] hover:text-green-800 font-medium px-4 py-2">
                                H?y
                            </button>
                            <button 
                                onClick={() => {
                                    const dStr = \`\${tempDate.getFullYear()}-\${String(tempDate.getMonth() + 1).padStart(2, '0')}-\${String(tempDate.getDate()).padStart(2, '0')}\`;
                                    setSelectedDate(dStr);
                                    setShowDatePicker(false);
                                }} 
                                className="bg-[#046c4e] hover:bg-green-800 text-white font-medium px-6 py-2 rounded-lg transition-colors shadow-sm"
                            >
                                Xác nh?n
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}`;

content = content.replace(/        <\/div>\r?\n    \);\r?\n\}/, customModal);

fs.writeFileSync("apps/frontend/src/pages/PortalBookingVisual.tsx", content, "utf8");
console.log("Custom calendar applied");
