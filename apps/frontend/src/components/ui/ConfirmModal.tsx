import { Trash2, AlertCircle } from 'lucide-react';
import { Button } from './button';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    icon?: 'trash' | 'alert';
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    icon = 'trash'
}: ConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-background-secondary border border-border rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${icon === 'trash' ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                        {icon === 'trash' ? (
                            <Trash2 className="w-6 h-6 text-red-500" />
                        ) : (
                            <AlertCircle className="w-6 h-6 text-yellow-500" />
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
                    <p className="text-sm text-foreground-secondary mb-6">
                        {description}
                    </p>
                    <div className="flex w-full gap-3">
                        <Button 
                            variant="outline" 
                            className="flex-1" 
                            onClick={onClose}
                        >
                            {cancelText}
                        </Button>
                        <Button 
                            className={`flex-1 text-white ${icon === 'trash' ? 'bg-red-500 hover:bg-red-600 border-red-500' : 'bg-primary-500 hover:bg-primary-600 border-primary-500'}`}
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
