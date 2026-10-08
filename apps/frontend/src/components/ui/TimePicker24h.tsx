import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePicker24hProps {
    value: string;
    onChange: (val: string) => void;
    className?: string;
}

export function TimePicker24h({ value, onChange, className }: TimePicker24hProps) {
    const parts = (value || '00:00').split(':');
    const hours = parts[0] ? parts[0].padStart(2, '0') : '00';
    const minutes = parts[1] ? parts[1].padStart(2, '0') : '00';

    const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(`${e.target.value}:${minutes}`);
    };

    const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(`${hours}:${e.target.value}`);
    };

    return (
        <div className={cn("flex items-center h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-within:ring-2 focus-within:ring-primary-500 transition-shadow", className)}>
            <Clock className="w-4 h-4 text-gray-500 mr-2 shrink-0" />
            
            <select
                className="bg-transparent border-none outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 appearance-none text-center font-medium focus:ring-0"
                value={hours}
                onChange={handleHourChange}
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
            >
                {Array.from({ length: 24 }).map((_, i) => {
                    const h = i.toString().padStart(2, '0');
                    return <option key={h} value={h}>{h}</option>;
                })}
            </select>
            
            <span className="mx-1 text-gray-500 font-medium">:</span>
            
            <select
                className="bg-transparent border-none outline-none cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded px-1 appearance-none text-center font-medium focus:ring-0"
                value={minutes}
                onChange={handleMinuteChange}
                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
            >
                {Array.from({ length: 60 }).map((_, i) => {
                    const m = i.toString().padStart(2, '0');
                    return <option key={m} value={m}>{m}</option>;
                })}
            </select>
        </div>
    );
}
