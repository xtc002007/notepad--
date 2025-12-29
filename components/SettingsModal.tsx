
import React from 'react';
import { X, Moon, Sun, Monitor, Trash2, Download } from 'lucide-react';
import { Theme } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClearData: () => void;
  onExportData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  onClearData,
  onExportData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-100 dark:border-slate-700">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Settings</h2>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          
          {/* Theme Section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Appearance</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => onThemeChange('light')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  theme === 'light' 
                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sun size={24} className="mb-2" />
                <span className="text-xs font-medium">Light</span>
              </button>
              
              <button
                onClick={() => onThemeChange('dark')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  theme === 'dark' 
                     ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <Moon size={24} className="mb-2" />
                <span className="text-xs font-medium">Dark</span>
              </button>

              <button
                onClick={() => onThemeChange('system')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                  theme === 'system' 
                     ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400' 
                    : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
              >
                <Monitor size={24} className="mb-2" />
                <span className="text-xs font-medium">System</span>
              </button>
            </div>
          </section>

          {/* Data Section */}
          <section>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Data Management</h3>
            <div className="space-y-3">
              <button 
                onClick={onExportData}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-gray-700 dark:text-slate-200"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
                    <Download size={18} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Export Data</div>
                    <div className="text-xs text-gray-400">Save your notes as JSON</div>
                  </div>
                </div>
              </button>

              <button 
                onClick={onClearData}
                className="w-full flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg group-hover:bg-red-200 dark:group-hover:bg-red-800 transition-colors">
                    <Trash2 size={18} />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm text-red-600 dark:text-red-400">Clear All Data</div>
                    <div className="text-xs text-red-400/70 dark:text-red-500/70">Permanently delete all projects</div>
                  </div>
                </div>
              </button>
            </div>
          </section>

          <div className="pt-4 border-t border-gray-100 dark:border-slate-800 text-center">
             <p className="text-xs text-gray-400 dark:text-slate-600">Notepad-- v1.0.0</p>
          </div>

        </div>
      </div>
    </div>
  );
};
