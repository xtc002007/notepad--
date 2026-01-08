import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Copy } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    onCopy: () => void;
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onCopy, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    // Default to false (light), updated immediately on mount
    const [isDark, setIsDark] = useState(false);

    // Use layout effect to prevent flash
    useLayoutEffect(() => {
        const checkTheme = () => {
            const hasDarkClass = document.documentElement.classList.contains('dark');
            setIsDark(hasDarkClass);
        };
        checkTheme();

        // Watch for class changes on html element
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        // Delay event listeners slightly to avoid immediate trigger from the opening click
        const timeout = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', onClose, { capture: true });
        }, 50);

        return () => {
            clearTimeout(timeout);
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', onClose, { capture: true });
        };
    }, [onClose]);

    // Ensure menu stays within the viewport
    const width = 150;
    const height = 60;
    let adjustedX = x;
    let adjustedY = y;

    if (typeof window !== 'undefined') {
        if (x + width > window.innerWidth) adjustedX = window.innerWidth - width - 10;
        if (y + height > window.innerHeight) adjustedY = window.innerHeight - height - 10;
    }

    // Styles defined in JS to guarantee visibility/opacity regardless of CSS conficts
    const menuStyle: React.CSSProperties = {
        position: 'fixed',
        top: adjustedY,
        left: adjustedX,
        zIndex: 2147483647, // Max safe integer
        backgroundColor: isDark ? '#1e293b' : '#ffffff', // Slate-800 / White
        border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, // Slate-700 / Gray-200
        borderRadius: '12px',
        padding: '6px',
        boxShadow: isDark
            ? '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.3)'
            : '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        minWidth: '140px',
        opacity: 1, // FORCE opacity
        isolation: 'isolate', // Create new stacking context
    };

    const buttonStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '8px 12px',
        fontSize: '14px',
        fontWeight: 500,
        color: isDark ? '#f3f4f6' : '#374151',
        background: 'transparent', // Default transparent
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        textAlign: 'left',
    };

    const menuContent = (
        <div
            ref={menuRef}
            style={menuStyle}
            // Add a class for potential specialized overrides, but rely on inline styles
            className="context-menu-portal"
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onCopy();
                    onClose();
                }}
                style={buttonStyle}
                // Use Tailwind for hover states since inline hover is hard
                className="hover:bg-blue-50 dark:hover:bg-blue-800/50 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                onMouseEnter={(e) => {
                    // JS fallback for hover color if tailwind fails
                    e.currentTarget.style.backgroundColor = isDark ? 'rgba(30, 64, 175, 0.3)' : '#eff6ff';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <Copy size={16} style={{ color: isDark ? '#9ca3af' : '#9ca3af' }} />
                <span>复制</span>
            </button>
        </div>
    );

    return createPortal(menuContent, document.body);
};
