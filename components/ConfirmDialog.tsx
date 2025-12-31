import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'danger'
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                padding: '1.5rem',
            }}
            onClick={onCancel}
            className="animate-in fade-in duration-200"
        >
            <div
                className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden flex flex-row"
                style={{
                    width: '560px',
                    maxWidth: '95vw',
                    maxHeight: '90vh'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Sidebar - Fixed Width */}
                <div className="w-32 bg-gray-50 dark:bg-slate-950/50 border-r border-gray-100 dark:border-slate-800 p-6 flex flex-col items-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 tracking-wider uppercase mb-4">
                        {variant === 'danger' ? 'Warning' : 'Info'}
                    </span>
                    <div className={`p-4 rounded-2xl flex items-center justify-center ${variant === 'danger'
                        ? 'bg-red-100 text-red-500 dark:bg-red-900/20 dark:text-red-400'
                        : 'bg-blue-100 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}>
                        {variant === 'danger' ? <AlertTriangle size={28} /> : <Info size={28} />}
                    </div>
                </div>

                {/* Content - Flexible */}
                <div className="flex-1 p-8 flex flex-col min-w-0 bg-white dark:bg-slate-900">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                            {title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3 justify-end items-center mt-8 pt-6 border-t border-gray-100 dark:border-slate-800/50">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg transition-transform active:scale-95 ${variant === 'danger'
                                ? 'bg-red-500 hover:bg-red-600 shadow-red-200 dark:shadow-none'
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
                                }`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>

                {/* Close Button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 p-2 text-gray-300 hover:text-gray-500 dark:hover:text-slate-300 rounded-full hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>
        </div>,
        document.body
    );
};
