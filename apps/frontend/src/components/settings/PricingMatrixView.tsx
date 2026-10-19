import { useState, useMemo } from 'react';
import {
    Grid3X3,
    List,
    Calculator,
    AlertTriangle,
    CheckCircle2,
    Plus,
    Edit2,
    Trash2,
    Search,
    Building2,
    Clock,
    DollarSign,
    Layers,
    Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, cn } from '@/lib/utils';
import { Venue } from '@/services/venue.service';
import { PricingRule } from '@/services/inventory.service';
import { OperatingHour } from '@/services/operating-hour.service';

export const DAYS_OF_WEEK = [
    { key: 'MONDAY', index: 1, label: 'Thứ Hai', short: 'T2' },
    { key: 'TUESDAY', index: 2, label: 'Thứ Ba', short: 'T3' },
    { key: 'WEDNESDAY', index: 3, label: 'Thứ Tư', short: 'T4' },
    { key: 'THURSDAY', index: 4, label: 'Thứ Năm', short: 'T5' },
    { key: 'FRIDAY', index: 5, label: 'Thứ Sáu', short: 'T6' },
    { key: 'SATURDAY', index: 6, label: 'Thứ Bảy', short: 'T7' },
    { key: 'SUNDAY', index: 0, label: 'Chủ Nhật', short: 'CN' },
] as const;

export const DAY_LABELS: Record<string, string> = {
    MONDAY: 'Thứ Hai',
    TUESDAY: 'Thứ Ba',
    WEDNESDAY: 'Thứ Tư',
    THURSDAY: 'Thứ Năm',
    FRIDAY: 'Thứ Sáu',
    SATURDAY: 'Thứ Bảy',
    SUNDAY: 'Chủ Nhật',
};

// Show every valid half-hour booking slot through 23:30.
const TIME_SLOTS: Array<{ start: string; end: string; label: string }> = [];
for (let minutes = 0; minutes <= 23 * 60; minutes += 30) {
    const endMinutes = minutes + 30;
    const start = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    TIME_SLOTS.push({ start, end, label: `${start} - ${end}` });
}

interface PricingMatrixViewProps {
    venues: Venue[];
    pricingRules: PricingRule[];
    operatingHours: OperatingHour[];
    onAddRule: (initialValues?: Partial<PricingRule>) => void;
    onEditRule: (rule: PricingRule) => void;
    onDeleteRule: (rule: PricingRule) => void;
}

export function PricingMatrixView({
    venues,
    pricingRules,
    operatingHours,
    onAddRule,
    onEditRule,
    onDeleteRule,
}: PricingMatrixViewProps) {
    const [viewMode, setViewMode] = useState<'matrix' | 'simulator' | 'list'>('matrix');
    const [selectedVenueId, setSelectedVenueId] = useState<string>(venues[0]?.id || '');
    const [selectedCellInfo, setSelectedCellInfo] = useState<{
        day: typeof DAYS_OF_WEEK[number];
        slot: typeof TIME_SLOTS[number];
        winner: PricingRule | null;
        overrides: PricingRule[];
        isOpen: boolean;
    } | null>(null);

    // List filter state
    const [listSearch, setListSearch] = useState('');
    const [listDayFilter, setListDayFilter] = useState<string>('ALL');

    // Simulator state
    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [simDate, setSimDate] = useState<string>(todayStr);
    const [simStartTime, setSimStartTime] = useState<string>('17:00');
    const [simEndTime, setSimEndTime] = useState<string>('19:00');

    // Make sure selectedVenueId is valid
    const currentVenue = useMemo(() => {
        return venues.find(v => v.id === selectedVenueId) || venues[0] || null;
    }, [venues, selectedVenueId]);

    // Active venue rules
    const venueRules = useMemo(() => {
        if (!currentVenue) return [];
        return pricingRules.filter(r => r.venueId === currentVenue.id && r.isActive !== false);
    }, [pricingRules, currentVenue]);

    // Check if slot is within operating hours for this venue
    const checkOperatingHour = (dayIndex: number, slotStart: string, slotEnd: string) => {
        if (!currentVenue) return false;
        const matchingOhs = operatingHours.filter(oh => {
            if (oh.venueId !== currentVenue.id || !oh.isActive) return false;
            try {
                const days: number[] = JSON.parse(oh.daysOfWeek);
                return days.includes(dayIndex);
            } catch {
                return false;
            }
        });

        if (matchingOhs.length > 0) {
            return matchingOhs.some(oh => oh.startTime <= slotStart && oh.endTime >= slotEnd);
        }

        const vOpen = currentVenue.openTime || '06:00';
        const vClose = currentVenue.closeTime || '23:00';
        return vOpen <= slotStart && vClose >= slotEnd;
    };

    // Evaluate matching rule for a specific half-hour or one-hour block
    const evaluateSlot = (dayKey: string, slotStart: string, slotEnd: string) => {
        const sorted = [...venueRules].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

        const matches = sorted.filter(rule => {
            if (rule.dayOfWeek && rule.dayOfWeek !== dayKey) return false;
            if (rule.startTime && rule.startTime > slotStart) return false;
            if (rule.endTime && rule.endTime < slotEnd) return false;
            return true;
        });

        const winner = matches[0] || null;
        const overrides = matches.slice(1);

        return {
            winner,
            overrides,
            matchesCount: matches.length,
            hasPrice: !!winner,
            price: winner ? winner.pricePerHour : 0,
        };
    };

    // Calculate matrix summary statistics
    const matrixStats = useMemo(() => {
        if (!currentVenue) return { totalOpenSlots: 0, unpricedSlots: 0, conflictingSlots: 0 };
        let totalOpenSlots = 0;
        let unpricedSlots = 0;
        let conflictingSlots = 0;

        DAYS_OF_WEEK.forEach(day => {
            TIME_SLOTS.forEach(slot => {
                const isOpen = checkOperatingHour(day.index, slot.start, slot.end);
                if (isOpen) {
                    totalOpenSlots++;
                    const evalSlot = evaluateSlot(day.key, slot.start, slot.end);
                    if (!evalSlot.hasPrice) {
                        unpricedSlots++;
                    }
                    if (evalSlot.matchesCount > 1) {
                        conflictingSlots++;
                    }
                }
            });
        });

        return { totalOpenSlots, unpricedSlots, conflictingSlots };
    }, [currentVenue, venueRules, operatingHours]);

    // Simulator calculation matching backend calculatePriceFromRules
    const simulationResult = useMemo(() => {
        if (!currentVenue || !simDate || !simStartTime || !simEndTime) return null;

        const [sH, sM] = simStartTime.split(':').map(Number);
        const [eH, eM] = simEndTime.split(':').map(Number);
        const startMinutes = sH * 60 + sM;
        const endMinutes = eH * 60 + eM;

        if (endMinutes <= startMinutes) {
            return {
                isValid: false,
                errorMessage: 'Giờ kết thúc phải sau giờ bắt đầu',
                steps: [],
                totalPrice: 0,
                duration: 0,
                appliedRules: [],
            };
        }

        const dateObj = new Date(simDate);
        const dayOfWeekIndex = dateObj.getDay();
        const dayOfWeekKey = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][dayOfWeekIndex];
        const dayLabel = DAY_LABELS[dayOfWeekKey] || dayOfWeekKey;

        const duration = (endMinutes - startMinutes) / 60;
        let total = 0;
        let hasUnpricedSlot = false;
        const appliedRulesSet = new Set<string>();

        const steps: Array<{
            slotStart: string;
            slotEnd: string;
            slotDuration: number;
            winner: PricingRule | null;
            overrides: PricingRule[];
            subtotal: number;
            reason: string;
        }> = [];

        const sorted = [...venueRules].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));

        for (let slotStart = startMinutes; slotStart < endMinutes;) {
            const slotEnd = Math.min(endMinutes, (Math.floor(slotStart / 30) + 1) * 30);
            const slotStartTime = `${String(Math.floor(slotStart / 60)).padStart(2, '0')}:${String(slotStart % 60).padStart(2, '0')}`;
            const slotEndTime = `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`;
            const slotDur = (slotEnd - slotStart) / 60;

            const matches = sorted.filter(rule => {
                if (rule.dayOfWeek && rule.dayOfWeek !== dayOfWeekKey) return false;
                if (rule.startTime && rule.startTime > slotStartTime) return false;
                if (rule.endTime && rule.endTime < slotEndTime) return false;
                return true;
            });

            const winner = matches[0] || null;
            const overrides = matches.slice(1);

            let reason = '';
            let subtotal = 0;

            if (winner) {
                subtotal = winner.pricePerHour * slotDur;
                total += subtotal;
                appliedRulesSet.add(winner.name);

                if (overrides.length > 0) {
                    reason = `Áp dụng "${winner.name}" (Ưu tiên ${winner.priority}) - Vượt qua ${overrides.length} quy tắc khác (${overrides.map(o => `"${o.name}" P${o.priority}`).join(', ')})`;
                } else {
                    reason = `Áp dụng "${winner.name}" (Ưu tiên ${winner.priority})`;
                }
            } else {
                hasUnpricedSlot = true;
                reason = '⚠️ Không có quy tắc giá nào bao phủ khung giờ này!';
            }

            steps.push({
                slotStart: slotStartTime,
                slotEnd: slotEndTime,
                slotDuration: slotDur,
                winner,
                overrides,
                subtotal,
                reason,
            });

            slotStart = slotEnd;
        }

        return {
            isValid: !hasUnpricedSlot,
            errorMessage: hasUnpricedSlot
                ? 'Chưa thiết lập giá cho toàn bộ khung giờ đã chọn! Khách hàng sẽ bị chặn đặt sân ở khung giờ này.'
                : null,
            steps,
            totalPrice: hasUnpricedSlot ? 0 : total,
            duration,
            appliedRules: Array.from(appliedRulesSet),
            dayLabel,
        };
    }, [currentVenue, simDate, simStartTime, simEndTime, venueRules]);

    return (
        <div className="space-y-6">
            {/* Header / Venue Select & View Mode Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background-tertiary/40 border border-border p-4 rounded-xl">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-primary-500" />
                        <span className="text-sm font-semibold text-foreground">Cơ sở:</span>
                    </div>
                    <select
                        value={selectedVenueId}
                        onChange={(e) => setSelectedVenueId(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        {venues.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.name}
                            </option>
                        ))}
                    </select>

                    <span className="text-xs text-foreground-muted hidden md:inline">
                        ({venueRules.length} quy tắc đã tạo)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* View mode toggle buttons */}
                    <div className="inline-flex rounded-lg border border-border bg-background p-1 text-xs">
                        <button
                            onClick={() => setViewMode('matrix')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
                                viewMode === 'matrix'
                                    ? 'bg-primary-500 text-white shadow-sm'
                                    : 'text-foreground-secondary hover:text-foreground'
                            )}
                        >
                            <Grid3X3 className="w-3.5 h-3.5" />
                            Ma trận tuần
                        </button>
                        <button
                            onClick={() => setViewMode('simulator')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
                                viewMode === 'simulator'
                                    ? 'bg-primary-500 text-white shadow-sm'
                                    : 'text-foreground-secondary hover:text-foreground'
                            )}
                        >
                            <Calculator className="w-3.5 h-3.5" />
                            Xem thử tính giá
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors',
                                viewMode === 'list'
                                    ? 'bg-primary-500 text-white shadow-sm'
                                    : 'text-foreground-secondary hover:text-foreground'
                            )}
                        >
                            <List className="w-3.5 h-3.5" />
                            Danh sách ({venueRules.length})
                        </button>
                    </div>

                    <Button onClick={() => onAddRule({ venueId: selectedVenueId })} size="sm" className="gap-1.5 shrink-0">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Thêm khung giá</span>
                    </Button>
                </div>
            </div>

            {/* Matrix View */}
            {viewMode === 'matrix' && (
                <div className="space-y-4">
                    {/* Matrix Status Banner */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-background-tertiary/60 border border-border rounded-xl p-3 flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground-secondary">Khung giờ mở cửa</span>
                            <span className="text-sm font-bold text-foreground">{matrixStats.totalOpenSlots} giờ/tuần</span>
                        </div>
                        <div className={cn(
                            'border rounded-xl p-3 flex items-center justify-between transition-colors',
                            matrixStats.unpricedSlots > 0
                                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        )}>
                            <div className="flex items-center gap-2">
                                {matrixStats.unpricedSlots > 0 ? (
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                )}
                                <span className="text-xs font-medium">Khung hổng giá</span>
                            </div>
                            <span className="text-sm font-bold">
                                {matrixStats.unpricedSlots > 0
                                    ? `${matrixStats.unpricedSlots} giờ thiếu giá!`
                                    : '100% có giá'}
                            </span>
                        </div>
                        <div className="bg-background-tertiary/60 border border-border rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Layers className="w-4 h-4" />
                                <span className="text-xs font-medium text-foreground-secondary">Khung trùng quy tắc</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">{matrixStats.conflictingSlots} giờ có ưu tiên</span>
                        </div>
                    </div>

                    {matrixStats.unpricedSlots > 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 flex items-start gap-3 text-red-400">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                            <div className="text-xs leading-relaxed">
                                <span className="font-semibold text-red-300">Cảnh báo hổng giá:</span> Phát hiện {matrixStats.unpricedSlots} khung giờ trong thời gian hoạt động của cơ sở chưa được gán bất kỳ quy tắc giá nào. <strong>Khách hàng sẽ bị chặn đặt sân</strong> ở các khung giờ này. Vui lòng tạo thêm quy tắc cơ bản hoặc bấm vào ô màu đỏ để thiết lập.
                            </div>
                        </div>
                    )}

                    {/* Color Legend */}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-secondary px-1">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/40"></div>
                            <span>Đã có giá</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3.5 h-3.5 rounded bg-indigo-500/20 border border-indigo-500/40"></div>
                            <span>Quy tắc ưu tiên (Đè giá cơ bản)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3.5 h-3.5 rounded bg-red-500/25 border border-red-500/60 animate-pulse"></div>
                            <span className="text-red-400 font-medium">Hổng giá (Cảnh báo)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3.5 h-3.5 rounded bg-background-tertiary/30 border border-border opacity-40"></div>
                            <span>Ngoài giờ mở cửa</span>
                        </div>
                    </div>

                    {/* The Grid Table */}
                    <div className="border border-border rounded-xl overflow-hidden bg-background-secondary shadow-sm">
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead className="sticky top-0 z-20 bg-background-tertiary text-foreground border-b border-border shadow-sm">
                                    <tr>
                                        <th className="p-2.5 text-left font-semibold border-r border-border min-w-[95px] sticky left-0 z-30 bg-background-tertiary">
                                            Khung giờ
                                        </th>
                                        {DAYS_OF_WEEK.map(day => (
                                            <th key={day.key} className="p-2.5 text-center font-semibold border-r border-border min-w-[120px] last:border-r-0">
                                                <div>{day.label}</div>
                                                <div className="text-[10px] text-foreground-muted font-normal">({day.short})</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {TIME_SLOTS.map((slot) => (
                                        <tr key={slot.start} className="border-b border-border/60 hover:bg-background-hover/30 transition-colors">
                                            <td className="p-2 text-foreground font-mono text-[11px] font-medium border-r border-border bg-background-tertiary/70 sticky left-0 z-10 whitespace-nowrap">
                                                {slot.start} - {slot.end}
                                            </td>

                                            {DAYS_OF_WEEK.map(day => {
                                                const isOpen = checkOperatingHour(day.index, slot.start, slot.end);
                                                const evalResult = evaluateSlot(day.key, slot.start, slot.end);

                                                if (!isOpen) {
                                                    return (
                                                        <td
                                                            key={day.key}
                                                            className="p-1.5 text-center border-r border-border/40 bg-background-tertiary/20 text-foreground-muted/40 select-none last:border-r-0"
                                                        >
                                                            <span className="text-[10px] italic">Đóng</span>
                                                        </td>
                                                    );
                                                }

                                                if (!evalResult.hasPrice) {
                                                    return (
                                                        <td
                                                            key={day.key}
                                                            onClick={() => onAddRule({
                                                                venueId: selectedVenueId,
                                                                dayOfWeek: day.key,
                                                                startTime: slot.start,
                                                                endTime: slot.end,
                                                                name: `Giá ${day.label} (${slot.start}-${slot.end})`,
                                                            })}
                                                            className="p-1.5 text-center border-r border-border/40 bg-red-500/20 hover:bg-red-500/30 cursor-pointer transition-colors text-red-300 border-l-2 border-l-red-500 last:border-r-0 group"
                                                            title="Bấm để tạo giá cho khung giờ này"
                                                        >
                                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                                <span className="font-bold flex items-center gap-1 text-[11px] text-red-400">
                                                                    <AlertTriangle className="w-3 h-3 text-red-500" />
                                                                    Chưa có giá
                                                                </span>
                                                                <span className="text-[9px] text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    + Bấm để thêm
                                                                </span>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                const isHighPriority = evalResult.winner && evalResult.winner.priority > 0;
                                                const hasConflicts = evalResult.matchesCount > 1;

                                                return (
                                                    <td
                                                        key={day.key}
                                                        onClick={() => setSelectedCellInfo({
                                                            day,
                                                            slot,
                                                            winner: evalResult.winner,
                                                            overrides: evalResult.overrides,
                                                            isOpen: true,
                                                        })}
                                                        className={cn(
                                                            'p-1.5 text-center border-r border-border/40 cursor-pointer transition-all hover:ring-2 hover:ring-primary-500/50 last:border-r-0 relative',
                                                            isHighPriority
                                                                ? 'bg-indigo-500/15 hover:bg-indigo-500/25'
                                                                : 'bg-emerald-500/10 hover:bg-emerald-500/20'
                                                        )}
                                                    >
                                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className={cn(
                                                                    'font-bold text-[11px]',
                                                                    isHighPriority ? 'text-indigo-400' : 'text-emerald-400'
                                                                )}>
                                                                    {formatCurrency(evalResult.price)}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-1 text-[10px] text-foreground-secondary truncate max-w-[110px]">
                                                                <span className="truncate">{evalResult.winner?.name}</span>
                                                                {isHighPriority && (
                                                                    <span className="px-1 py-0.2 text-[9px] bg-indigo-500/30 text-indigo-300 rounded font-semibold shrink-0">
                                                                        P{evalResult.winner?.priority}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {hasConflicts && (
                                                                <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
                                                                    <Layers className="w-2.5 h-2.5" />
                                                                    +{evalResult.overrides.length} đè
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Cell Inspection Drawer / Modal */}
                    {selectedCellInfo && (
                        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-background-secondary border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
                                <div className="flex items-start justify-between border-b border-border pb-3">
                                    <div>
                                        <h3 className="text-base font-bold text-foreground">Chi tiết khung giá</h3>
                                        <p className="text-xs text-foreground-secondary">
                                            {selectedCellInfo.day.label} · {selectedCellInfo.slot.label} · {currentVenue?.name}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedCellInfo(null)}
                                        className="p-1.5 rounded-lg hover:bg-background-tertiary text-foreground-secondary"
                                    >
                                        ✕
                                    </button>
                                </div>

                                {selectedCellInfo.winner ? (
                                    <div className="space-y-3">
                                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-semibold text-emerald-400">Quy tắc đang áp dụng</span>
                                                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                                    Ưu tiên {selectedCellInfo.winner.priority}
                                                </span>
                                            </div>
                                            <h4 className="text-sm font-bold text-foreground">{selectedCellInfo.winner.name}</h4>
                                            <p className="text-lg font-extrabold text-primary-500 mt-1">
                                                {formatCurrency(selectedCellInfo.winner.pricePerHour)}/giờ
                                            </p>
                                            <p className="text-xs text-foreground-secondary mt-1">
                                                Khung hiệu lực: {selectedCellInfo.winner.startTime || '00:00'} - {selectedCellInfo.winner.endTime || '23:59'} (
                                                {selectedCellInfo.winner.dayOfWeek ? DAY_LABELS[selectedCellInfo.winner.dayOfWeek] : 'Tất cả các ngày'}
                                                )
                                            </p>
                                        </div>

                                        {selectedCellInfo.overrides.length > 0 && (
                                            <div className="space-y-2">
                                                <h5 className="text-xs font-semibold text-foreground-secondary flex items-center gap-1.5">
                                                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                                                    Quy tắc bị đè do ưu tiên thấp hơn ({selectedCellInfo.overrides.length})
                                                </h5>
                                                {selectedCellInfo.overrides.map(override => (
                                                    <div key={override.id} className="bg-background-tertiary border border-border rounded-lg p-2.5 text-xs flex items-center justify-between opacity-80">
                                                        <div>
                                                            <div className="font-medium text-foreground">{override.name}</div>
                                                            <div className="text-foreground-muted">{formatCurrency(override.pricePerHour)}/giờ</div>
                                                        </div>
                                                        <span className="px-2 py-0.5 rounded bg-background border border-border text-foreground-muted text-[10px]">
                                                            Ưu tiên {override.priority}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-2 border-t border-border">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const rule = selectedCellInfo.winner!;
                                                    setSelectedCellInfo(null);
                                                    onEditRule(rule);
                                                }}
                                                className="flex-1 gap-1.5"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                Sửa quy tắc này
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedCellInfo(null);
                                                    onAddRule({
                                                        venueId: selectedVenueId,
                                                        dayOfWeek: selectedCellInfo.day.key,
                                                        startTime: selectedCellInfo.slot.start,
                                                        endTime: selectedCellInfo.slot.end,
                                                    });
                                                }}
                                                className="flex-1 gap-1.5"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Thêm quy tắc mới
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-4 text-center space-y-3">
                                        <AlertTriangle className="w-8 h-8 mx-auto text-red-500" />
                                        <p className="text-xs text-foreground-secondary">
                                            Chưa có quy tắc nào bao phủ khung giờ này.
                                        </p>
                                        <Button
                                            onClick={() => {
                                                setSelectedCellInfo(null);
                                                onAddRule({
                                                    venueId: selectedVenueId,
                                                    dayOfWeek: selectedCellInfo.day.key,
                                                    startTime: selectedCellInfo.slot.start,
                                                    endTime: selectedCellInfo.slot.end,
                                                });
                                            }}
                                            className="w-full gap-1.5"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Tạo khung giá ngay
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Price Preview Simulator */}
            {viewMode === 'simulator' && (
                <div className="space-y-6">
                    <div className="bg-background-secondary border border-border rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-border">
                            <Sparkles className="w-5 h-5 text-primary-500" />
                            <div>
                                <h3 className="font-semibold text-foreground text-base">Xem thử & Giải thích tính giá</h3>
                                <p className="text-xs text-foreground-secondary">
                                    Mô phỏng quy trình tính tiền chính xác của backend khi khách đặt sân vào một ngày và giờ bất kỳ
                                </p>
                            </div>
                        </div>

                        {/* Input Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-foreground-secondary mb-1">
                                    Ngày đặt sân
                                </label>
                                <Input
                                    type="date"
                                    value={simDate}
                                    onChange={(e) => setSimDate(e.target.value)}
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground-secondary mb-1">
                                    Giờ bắt đầu
                                </label>
                                <Input
                                    type="time"
                                    step={1800}
                                    value={simStartTime}
                                    onChange={(e) => setSimStartTime(e.target.value)}
                                    className="bg-background"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-foreground-secondary mb-1">
                                    Giờ kết thúc
                                </label>
                                <Input
                                    type="time"
                                    step={1800}
                                    value={simEndTime}
                                    onChange={(e) => setSimEndTime(e.target.value)}
                                    className="bg-background"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Simulation Result */}
                    {simulationResult && (
                        <div className="space-y-4">
                            {/* Status Card */}
                            {simulationResult.isValid ? (
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="font-bold text-foreground text-base">
                                                    Bảng giá hợp lệ — Có thể đặt sân
                                                </h4>
                                                <p className="text-xs text-foreground-secondary mt-0.5">
                                                    Áp dụng cho {simulationResult.dayLabel} ({simDate}) · Thời lượng: {simulationResult.duration} giờ
                                                </p>
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    {simulationResult.appliedRules.map(rName => (
                                                        <span key={rName} className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                                            {rName}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right sm:border-l sm:border-emerald-500/20 sm:pl-6">
                                            <span className="text-xs text-foreground-secondary block">Tổng giá tạm tính</span>
                                            <span className="text-2xl font-black text-primary-500">
                                                {formatCurrency(simulationResult.totalPrice)}
                                            </span>
                                            <span className="text-xs text-foreground-muted block mt-0.5">
                                                (~{formatCurrency(Math.round(simulationResult.totalPrice / (simulationResult.duration || 1)))}/giờ)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 flex items-start gap-3 text-red-400">
                                    <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5 text-red-500" />
                                    <div>
                                        <h4 className="font-bold text-red-300 text-base">Khung giờ không thể đặt sân!</h4>
                                        <p className="text-xs text-red-300/90 mt-1 leading-relaxed">
                                            {simulationResult.errorMessage}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Detailed breakdown per 30 minutes */}
                            <div className="bg-background-secondary border border-border rounded-xl p-5 shadow-sm space-y-3">
                                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary-500" />
                                    Chi tiết giải thích theo từng block 30 phút
                                </h4>

                                <div className="border border-border rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-background-tertiary text-foreground border-b border-border">
                                            <tr>
                                                <th className="p-3 text-left font-semibold">Khung 30 phút</th>
                                                <th className="p-3 text-left font-semibold">Quy tắc được chọn</th>
                                                <th className="p-3 text-left font-semibold hidden md:table-cell">Giải thích / Xung đột ưu tiên</th>
                                                <th className="p-3 text-right font-semibold">Thành tiền</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {simulationResult.steps.map((step, idx) => (
                                                <tr key={idx} className={cn(
                                                    'hover:bg-background-hover/40 transition-colors',
                                                    !step.winner && 'bg-red-500/10'
                                                )}>
                                                    <td className="p-3 font-mono font-medium text-foreground whitespace-nowrap">
                                                        {step.slotStart} - {step.slotEnd}
                                                    </td>
                                                    <td className="p-3">
                                                        {step.winner ? (
                                                            <div>
                                                                <span className="font-semibold text-foreground">{step.winner.name}</span>
                                                                <span className="ml-2 text-[10px] px-1.5 py-0.2 bg-primary-500/20 text-primary-400 rounded font-bold">
                                                                    P{step.winner.priority}
                                                                </span>
                                                                <div className="text-[11px] text-foreground-muted">
                                                                    {formatCurrency(step.winner.pricePerHour)}/h
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-red-400 font-bold flex items-center gap-1">
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                                Hổng giá
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-foreground-secondary hidden md:table-cell">
                                                        {step.reason}
                                                    </td>
                                                    <td className="p-3 text-right font-semibold text-foreground whitespace-nowrap">
                                                        {step.winner ? formatCurrency(step.subtotal) : '0đ (Lỗi)'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-4">
                    {/* Filter bar */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                            <Input
                                placeholder="Tìm theo tên khung giá..."
                                value={listSearch}
                                onChange={(e) => setListSearch(e.target.value)}
                                className="pl-9 bg-background"
                            />
                        </div>
                        <select
                            value={listDayFilter}
                            onChange={(e) => setListDayFilter(e.target.value)}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground"
                        >
                            <option value="ALL">Tất cả ngày</option>
                            {DAYS_OF_WEEK.map(d => (
                                <option key={d.key} value={d.key}>{d.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Rule Cards */}
                    {venueRules.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-xl">
                            <DollarSign className="w-10 h-10 mx-auto mb-2 text-foreground-muted opacity-40" />
                            <p className="text-sm text-foreground-secondary mb-3">
                                Chưa có khung giá nào cho {currentVenue?.name}
                            </p>
                            <Button onClick={() => onAddRule({ venueId: selectedVenueId })} size="sm">
                                Thêm khung giá đầu tiên
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {venueRules
                                .filter(rule => {
                                    if (listSearch && !rule.name.toLowerCase().includes(listSearch.toLowerCase())) {
                                        return false;
                                    }
                                    if (listDayFilter !== 'ALL') {
                                        if (rule.dayOfWeek && rule.dayOfWeek !== listDayFilter) return false;
                                    }
                                    return true;
                                })
                                .map((rule) => {
                                    const days = rule.dayOfWeek
                                        ? DAY_LABELS[rule.dayOfWeek] || rule.dayOfWeek
                                        : 'Tất cả các ngày (T2 - CN)';
                                    const timeRange = rule.startTime && rule.endTime
                                        ? `${rule.startTime} - ${rule.endTime}`
                                        : 'Toàn bộ thời gian (00:00 - 23:59)';

                                    return (
                                        <div
                                            key={rule.id}
                                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-border rounded-xl bg-background-secondary hover:border-primary-500/40 transition-colors"
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-foreground text-sm">{rule.name}</h4>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary-500/20 text-primary-400">
                                                        Ưu tiên {rule.priority}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-foreground-secondary">
                                                    📅 {days} · ⏰ {timeRange}
                                                </p>
                                                {rule.description && (
                                                    <p className="text-xs text-foreground-muted italic">
                                                        {rule.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                                                <div className="text-left sm:text-right">
                                                    <span className="block font-bold text-primary-500 text-base">
                                                        {formatCurrency(rule.pricePerHour)}/giờ
                                                    </span>
                                                    <span className="block text-[10px] text-foreground-muted">
                                                        ({formatCurrency(rule.pricePerHour / 2)} / 30p)
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => onEditRule(rule)}>
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        onClick={() => onDeleteRule(rule)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
