
import React, { useState } from 'react';
import { X, Moon, Sun, Monitor, Trash2, Download, Type, Layout, AlignJustify, Hash, WrapText, MousePointerClick, Zap } from 'lucide-react';
import { AppSettings, Theme, AppFont } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onClearData: () => void;
  onExportData: () => void;
}

type SettingsTab = 'general' | 'editor' | 'appearance' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearData,
  onExportData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('editor');

  if (!isOpen) return null;

  const update = (key: keyof AppSettings, value: any) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'editor', label: 'Editor', icon: <Type size={18} /> },
    { id: 'appearance', label: 'Appearance', icon: <Layout size={18} /> },
    { id: 'general', label: 'General', icon: <Zap size={18} /> },
    { id: 'data', label: 'Data', icon: <Trash2 size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Window */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-slate-800 flex flex-col md:flex-row">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 bg-gray-50/50 dark:bg-slate-950/50 border-b md:border-b-0 md:border-r border-gray-200 dark:border-slate-800 flex flex-col">
            <div className="p-6 pb-4">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">Settings</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Configure your experience</p>
            </div>
            
            <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-900 hover:text-gray-900 dark:hover:text-slate-200'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-slate-800">
                <button onClick={onClose} className="w-full py-2 px-4 rounded-lg border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors">
                    Close
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
            {/* Mobile Header with Close (Only visible on small screens usually, but we keep it simple here) */}
            <div className="md:hidden flex justify-end p-2">
                <button onClick={onClose}><X size={24} className="text-gray-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* --- EDITOR SETTINGS --- */}
                {activeTab === 'editor' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Typography</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Customize how your text looks.</p>
                            
                            <div className="space-y-6">
                                {/* Font Family */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {['sans', 'serif', 'mono'].map((f) => (
                                        <button
                                            key={f}
                                            onClick={() => update('fontFamily', f as AppFont)}
                                            className={`relative p-4 rounded-xl border-2 text-left transition-all group ${
                                                settings.fontFamily === f 
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' 
                                                : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
                                            }`}
                                        >
                                            <div className={`text-2xl mb-2 ${f === 'serif' ? 'font-serif' : f === 'mono' ? 'font-mono' : 'font-sans'} text-gray-800 dark:text-gray-200`}>Ag</div>
                                            <div className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{f}</div>
                                            <div className="text-xs text-gray-500 dark:text-slate-500">{f === 'sans' ? 'Clean & Modern' : f === 'serif' ? 'Elegant & Classic' : 'Code Friendly'}</div>
                                            {settings.fontFamily === f && <div className="absolute top-2 right-2 w-3 h-3 bg-blue-500 rounded-full"></div>}
                                        </button>
                                    ))}
                                </div>

                                {/* Font Size Slider */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Font Size</label>
                                        <span className="text-sm font-mono text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">{settings.fontSize}px</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="12" 
                                        max="32" 
                                        step="1"
                                        value={settings.fontSize}
                                        onChange={(e) => update('fontSize', parseInt(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>Small (12px)</span>
                                        <span>Huge (32px)</span>
                                    </div>
                                </div>

                                {/* Line Height Slider */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2"><AlignJustify size={16}/> Line Height</label>
                                        <span className="text-sm font-mono text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">{settings.lineHeight}</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1.0" 
                                        max="2.5" 
                                        step="0.1"
                                        value={settings.lineHeight}
                                        onChange={(e) => update('lineHeight', parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800 pt-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Behavior</h3>
                            <div className="space-y-4">
                                {/* Toggle: Line Numbers */}
                                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-600 dark:text-slate-400">
                                            <Hash size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Show Line Numbers</div>
                                            <div className="text-xs text-gray-500">Display line numbers in the gutter</div>
                                        </div>
                                    </div>
                                    <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.showLineNumbers ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'}`}>
                                        <input type="checkbox" className="hidden" checked={settings.showLineNumbers} onChange={(e) => update('showLineNumbers', e.target.checked)} />
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${settings.showLineNumbers ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </label>

                                {/* Toggle: Word Wrap */}
                                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-600 dark:text-slate-400">
                                            <WrapText size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Word Wrap</div>
                                            <div className="text-xs text-gray-500">Wrap long lines to fit the view</div>
                                        </div>
                                    </div>
                                    <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.wordWrap ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'}`}>
                                        <input type="checkbox" className="hidden" checked={settings.wordWrap} onChange={(e) => update('wordWrap', e.target.checked)} />
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${settings.wordWrap ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </label>

                                {/* Toggle: Highlight Active Line */}
                                <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-600 dark:text-slate-400">
                                            <MousePointerClick size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Highlight Active Line</div>
                                            <div className="text-xs text-gray-500">Visually emphasize the line you are editing</div>
                                        </div>
                                    </div>
                                    <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.highlightActiveLine ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'}`}>
                                        <input type="checkbox" className="hidden" checked={settings.highlightActiveLine} onChange={(e) => update('highlightActiveLine', e.target.checked)} />
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${settings.highlightActiveLine ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- APPEARANCE SETTINGS --- */}
                {activeTab === 'appearance' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Color Theme</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Choose your preferred visual style.</p>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <button
                                    onClick={() => update('theme', 'light')}
                                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                    settings.theme === 'light' 
                                        ? 'bg-white border-blue-500 text-blue-600 shadow-md ring-2 ring-blue-100 dark:ring-blue-900' 
                                        : 'bg-gray-50 dark:bg-slate-800 border-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <Sun size={32} className="mb-3" />
                                    <span className="font-medium">Light</span>
                                </button>
                                
                                <button
                                    onClick={() => update('theme', 'dark')}
                                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                    settings.theme === 'dark' 
                                        ? 'bg-slate-900 border-blue-500 text-blue-400 shadow-md ring-2 ring-blue-100 dark:ring-blue-900' 
                                        : 'bg-gray-50 dark:bg-slate-800 border-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <Moon size={32} className="mb-3" />
                                    <span className="font-medium">Dark</span>
                                </button>

                                <button
                                    onClick={() => update('theme', 'system')}
                                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                    settings.theme === 'system' 
                                        ? 'bg-gradient-to-br from-gray-100 to-slate-800 border-blue-500 text-blue-500 shadow-md ring-2 ring-blue-100 dark:ring-blue-900' 
                                        : 'bg-gray-50 dark:bg-slate-800 border-transparent text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <Monitor size={32} className="mb-3" />
                                    <span className="font-medium">System</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DATA SETTINGS --- */}
                {activeTab === 'data' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Manage Data</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Backup, restore, or reset your application data.</p>
                            
                            <div className="space-y-4">
                                <div className="p-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
                                            <Download size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-gray-900 dark:text-white">Export Backup</h4>
                                            <p className="text-xs text-gray-500 dark:text-slate-400">Save all notes and settings to a JSON file</p>
                                        </div>
                                    </div>
                                    <button onClick={onExportData} className="px-4 py-2 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors">
                                        Export
                                    </button>
                                </div>

                                <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                                            <Trash2 size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-medium text-red-700 dark:text-red-400">Delete All Data</h4>
                                            <p className="text-xs text-red-500/70 dark:text-red-400/70">Permanently remove all notes and projects</p>
                                        </div>
                                    </div>
                                    <button onClick={onClearData} className="px-4 py-2 bg-white dark:bg-slate-950 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                        Clear Data
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                 {/* --- GENERAL SETTINGS --- */}
                 {activeTab === 'general' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Accessibility</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">Adjust UI behavior.</p>
                            
                             <label className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-600 dark:text-slate-400">
                                            <Zap size={18} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Reduce Motion</div>
                                            <div className="text-xs text-gray-500">Minimize animations for a simpler experience</div>
                                        </div>
                                    </div>
                                    <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${settings.reduceMotion ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-700'}`}>
                                        <input type="checkbox" className="hidden" checked={settings.reduceMotion} onChange={(e) => update('reduceMotion', e.target.checked)} />
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${settings.reduceMotion ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </div>
                                </label>
                        </div>
                         <div className="pt-10 mt-10 border-t border-gray-100 dark:border-slate-800 text-center">
                            <h4 className="text-sm font-bold text-gray-800 dark:text-white">Notepad--</h4>
                            <p className="text-xs text-gray-500 mt-1">Version 1.2.0 (Detailed Edition)</p>
                            <p className="text-xs text-gray-400 mt-4">Made with React & Tailwind</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
