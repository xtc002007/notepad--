import React, { useState, useEffect, useRef } from 'react';
import { Note, NoteType, SearchOptions } from '../types';
import { Zap, Plus, X, Calendar, Pencil, Eye, Search, ChevronDown, ChevronRight, CaseSensitive, WholeWord, ChevronUp, Copy, Check, Pin } from 'lucide-react';
import { ContextMenu } from './ContextMenu';
import { format } from 'date-fns';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TurndownService from 'turndown';
import * as gfmPlugin from 'turndown-plugin-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface QuickNotesViewProps {
    notes: Note[];
    onAddNote: (content: string, type: NoteType) => void;
    onUpdateNoteContent: (noteId: string, newContent: string) => void;
    collapsedNoteIds: string[];
    onToggleCollapse: (noteId: string) => void;
    highlightNoteId?: string;
    searchQuery?: string;
    onTouchNote?: (noteId: string) => void;
    onTogglePin?: (noteId: string) => void;
}

// --- Helper: Highlight logic ---
const getHighlightParts = (content: string, query: string, options: SearchOptions) => {
    if (!content) return [];
    if (!query) return [{ text: content, isMatch: false }];
    const { caseSensitive, wholeWord } = options;
    const flags = caseSensitive ? 'g' : 'gi';
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = wholeWord ? `(\\b${escapedQuery}\\b)` : `(${escapedQuery})`;
    const parts = content.split(new RegExp(pattern, flags));
    return parts.map(part => {
        let isMatch = false;
        try { isMatch = new RegExp(`^${pattern}$`, flags).test(part); } catch { isMatch = false; }
        return { text: part, isMatch };
    });
};

const simpleMarkdownToHtml = (md: string) => {
    return md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/^\s*[\-\*]\s+(.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/^\s*\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>')
        .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*)\*/gim, '<em>$1</em>')
        .replace(/__(.*)__/gim, '<strong>$1</strong>')
        .replace(/_(.*)_/gim, '<em>$1</em>')
        .replace(/`(.*?)`/gim, '<code>$1</code>')
        .replace(/\n/g, '<br />')
        .replace(/<\/ul>\s*<ul>/g, '')
        .replace(/<\/ol>\s*<ol>/g, '');
};

const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
});
turndownService.use(gfmPlugin.gfm);

// Rule 1: STRICT CODE HANDLING
turndownService.addRule('code', {
    filter: 'code',
    replacement: (content, node) => {
        if (node.parentNode && node.parentNode.nodeName === 'PRE') {
            return content;
        }
        const trimmed = content.trim();
        return trimmed ? '`' + trimmed + '`' : '';
    }
});

// Rule 2: Code blocks
turndownService.addRule('pre', {
    filter: 'pre',
    replacement: (content, node: any) => {
        let lang = '';
        const className = node.getAttribute('class') || '';
        const codeChild = node.querySelector('code');
        const codeClass = codeChild ? codeChild.getAttribute('class') || '' : '';
        const langMatch = (className + ' ' + codeClass).match(/language-(\w+)/);
        if (langMatch) lang = langMatch[1];
        return '\n\n```' + lang + '\n' + content.trim() + '\n```\n\n';
    }
});

// Rule 2b: IDE Paste Detection
turndownService.addRule('idePaste', {
    filter: (node) => {
        const style = node.getAttribute('style') || '';
        const className = node.getAttribute('class') || '';
        const isCodeEditor = className.includes('monaco') || className.includes('vscode') || className.includes('ace_') || className.includes('hljs');
        const isMonospace = style.includes('monospace') || style.includes('Courier') || style.includes('Consolas');
        return (isCodeEditor || isMonospace) && (node.nodeName === 'DIV' || node.nodeName === 'PRE');
    },
    replacement: (content) => '\n\n```\n' + content.trim() + '\n```\n\n'
});

// Rule 3: Mark tags (keep content)
turndownService.addRule('mark', {
    filter: ['mark'],
    replacement: (content) => content
});

// Rule 4: Transparent containers (inline only)
turndownService.addRule('transparent', {
    filter: ['span'],
    replacement: (content) => content
});

// Rule 5: Clean paragraphs
turndownService.addRule('paragraph', {
    filter: 'p',
    replacement: (content) => {
        const trimmed = content.trim();
        return trimmed ? `\n${trimmed}\n` : '';
    }
});

const turndown = (html: string) => {
    const cleanHtml = html
        .replace(/\u00a0/g, ' ')
        .replace(/&nbsp;/g, ' ');

    let md = turndownService.turndown(cleanHtml);

    md = md.split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

    return md.trim();
};

const HighlightElements: React.FC<{
    children?: React.ReactNode;
    query: string;
    options: SearchOptions;
}> = ({ children, query, options }) => {
    if (!query) return <>{children}</>;

    if (typeof children === 'string') {
        const parts = getHighlightParts(children, query, options);
        return (
            <>
                {parts.map((part, i) =>
                    part.isMatch ?
                        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/80 text-gray-900 dark:text-gray-100 rounded-[1px] px-0">{part.text}</mark> :
                        part.text
                )}
            </>
        );
    }

    if (Array.isArray(children)) {
        return <>{children.map((child, i) => <HighlightElements key={i} query={query} options={options}>{child}</HighlightElements>)}</>;
    }

    return <>{children}</>;
};

const AutoResizeTextarea: React.FC<{
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    className?: string;
    searchQuery?: string;
    searchOptions?: SearchOptions;
    onContextMenu?: (e: React.MouseEvent) => void;
    onCopy?: () => void;
    onBlur?: () => void;
    isCollapsed?: boolean;
}> = ({ value, onChange, placeholder, className, searchQuery, searchOptions, onContextMenu, onCopy, onBlur, isCollapsed }) => {

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            if (isCollapsed) {
                textarea.style.height = '';
                if (backdropRef.current) backdropRef.current.style.height = '';
                return;
            }
            textarea.style.height = 'auto';
            const newHeight = `${textarea.scrollHeight}px`;
            textarea.style.height = newHeight;
            if (backdropRef.current) {
                backdropRef.current.style.height = newHeight;
            }
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value, searchQuery, isCollapsed]);

    const handleScroll = () => {
        if (textareaRef.current && backdropRef.current) {
            backdropRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    return (
        <div className="relative w-full">
            {searchQuery && searchOptions && (
                <div
                    ref={backdropRef}
                    className={`absolute inset-0 pointer-events-none whitespace-pre-wrap overflow-hidden ${className}`}
                    aria-hidden="true"
                >
                    <HighlightElements query={searchQuery} options={searchOptions}>
                        {value}
                    </HighlightElements>
                </div>
            )}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                onCopy={(e) => {
                    const textarea = e.currentTarget;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const selectedText = textarea.value.substring(start, end);
                    if (!selectedText) return;

                    // Note: noteId is not available here directly in AutoResizeTextarea props. 
                    // But we can pass it if we want strict event handling or rely on parent.
                    // However, we are inside QuickNotesView where we map notes.
                    // IMPORTANT: AutoResizeTextarea needs to know the noteId to callback? 
                    // No, we can just let the parent handle it if we pass a callback to AutoResizeTextarea.
                    // But AutoResizeTextarea is a generic component. 
                    // Let's modify AutoResizeTextarea to accept onCopy cb or handle it in parent.
                    // Actually, simpler: The parent (QuickNotesView) renders this.
                    // But onCopy is on the textarea element.

                    // Let's use the onContextMenu approach but for onCopy?
                    // No, onCopy event bubbles? Yes.
                    // We can handle onCopy on the parent div?

                    const html = simpleMarkdownToHtml(selectedText);
                    e.clipboardData.setData('text/plain', selectedText);
                    e.clipboardData.setData('text/html', `<div style="font-family: sans-serif;">${html}</div>`);
                    e.preventDefault();
                    if (onCopy) onCopy();
                }}
                onPaste={(e) => {
                    const html = e.clipboardData.getData('text/html');
                    const hasRichContent = html && /<p|h\d|ul|ol|li|table|tr|td|blockquote|pre|code|strong|em/i.test(html);
                    const hasCodeIndicators = html && /monospace|monaco|vscode|consolas|courier|hljs|ace_/i.test(html);

                    if (html && (hasRichContent || hasCodeIndicators)) {
                        e.preventDefault();
                        const markdown = turndown(html);

                        const textarea = e.currentTarget;
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const val = textarea.value;

                        const newVal = val.substring(0, start) + markdown + val.substring(end);
                        onChange(newVal);

                        setTimeout(() => {
                            textarea.setSelectionRange(start + markdown.length, start + markdown.length);
                        }, 0);
                    }
                }}
                placeholder={placeholder}
                onContextMenu={onContextMenu}
                onBlur={onBlur}
                className={`w-full resize-none overflow-hidden outline-none bg-transparent block relative z-10 ${className} ${searchQuery ? 'text-transparent caret-gray-900 dark:caret-white' : ''} ${isCollapsed ? 'line-clamp-2 max-h-[3.2em]' : ''}`}

                rows={isCollapsed ? 2 : 1}
            />
        </div>
    );
};

export const QuickNotesView: React.FC<QuickNotesViewProps> = ({
    notes,
    onAddNote,
    onUpdateNoteContent,
    collapsedNoteIds,
    onToggleCollapse,
    highlightNoteId,
    searchQuery,
    onTouchNote,
    onTogglePin
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newContent, setNewContent] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const [searchOptions, setSearchOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
    const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, isPreview: boolean, noteId?: string } | null>(null);


    // Sync with global search query when it changes
    useEffect(() => {
        if (searchQuery) {
            setLocalSearchQuery(searchQuery);
            setIsSearchVisible(true);
        } else {
            setIsSearchVisible(false);
            setLocalSearchQuery('');
        }
    }, [searchQuery]);

    const filteredNotes = React.useMemo(() => {
        if (!localSearchQuery) return notes;

        const { caseSensitive, wholeWord } = searchOptions;
        const flags = caseSensitive ? 'g' : 'gi';
        const escapedQuery = localSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;

        try {
            const regex = new RegExp(pattern, flags);
            return notes.filter(n => regex.test(n.content));
        } catch {
            return notes;
        }
    }, [notes, localSearchQuery, searchOptions]);

    const toggleSearch = () => {
        if (isSearchVisible) {
            setIsSearchVisible(false);
            setLocalSearchQuery('');
        } else {
            setIsSearchVisible(true);
        }
    };

    const handleSave = () => {
        if (newContent.trim()) {
            onAddNote(newContent, NoteType.TEXT);
            setNewContent('');
            setIsAdding(false);
        }
    };



    const handleCopyNote = (note: Note) => {
        navigator.clipboard.writeText(note.content).then(() => {
            setCopiedNoteId(note.id);
            setTimeout(() => setCopiedNoteId(null), 2000);
            onTouchNote?.(note.id);
        });
    };

    const handleContextMenu = (e: React.MouseEvent, isPreview: boolean, noteId?: string) => {
        const selection = window.getSelection();
        const hasSelection = (selection && selection.toString().length > 0);

        // Note: For textarea we can't easily check selection here without a ref, 
        // but the ContextMenu will only appear if we call e.preventDefault().
        // For QuickNotes, we can just allow it and the user can copy if they selected something.

        if (hasSelection || !isPreview) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, isPreview, noteId });
        }
    };

    const handleCopySelection = () => {
        if (!contextMenu) return;

        // For textarea in QuickNotes, it's a bit trickier because we have multiple.
        // But we can just use window.getSelection().toString() if it's there,
        // or if it's a textarea, it might not show up in window.getSelection().

        const selection = window.getSelection();
        const text = selection?.toString();
        if (text) {
            if (contextMenu.noteId) onTouchNote?.(contextMenu.noteId);
            const html = simpleMarkdownToHtml(text);
            navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                    'text/html': new Blob([`<div style="font-family: sans-serif;">${html}</div>`], { type: 'text/html' })
                })
            ]).catch(() => {
                navigator.clipboard.writeText(text);
            });
        }
    };



    const markdownComponents = React.useMemo(() => {
        const Wrapper = ({ children }: any) => <HighlightElements query={localSearchQuery} options={searchOptions}>{children}</HighlightElements>;
        return {
            p: ({ children }: any) => <p className="mb-2"><Wrapper>{children}</Wrapper></p>,
            li: ({ children }: any) => <li><Wrapper>{children}</Wrapper></li>,
            h1: ({ children }: any) => <h1 className="text-xl font-bold mb-2"><Wrapper>{children}</Wrapper></h1>,
            h2: ({ children }: any) => <h2 className="text-lg font-bold mb-2"><Wrapper>{children}</Wrapper></h2>,
            h3: ({ children }: any) => <h3 className="text-base font-bold mb-1"><Wrapper>{children}</Wrapper></h3>,
            strong: ({ children }: any) => <strong><Wrapper>{children}</Wrapper></strong>,
            em: ({ children }: any) => <em><Wrapper>{children}</Wrapper></em>,
            code: (props: any) => {
                const { className, children, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                const content = String(children).replace(/\n$/, '');
                const isBlock = match || String(children).includes('\n');

                if (isBlock) {
                    return (
                        <div className="my-4 rounded-lg overflow-hidden text-sm bg-slate-900 border border-slate-800 shadow-lg group/code relative">
                            <div className="bg-slate-800/80 px-4 py-1.5 flex justify-between items-center text-slate-400 text-[10px] font-mono border-b border-slate-700/50">
                                <span>{match ? match[1].toUpperCase() : 'CODE'}</span>
                            </div>
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match ? match[1] : 'text'}
                                PreTag="div"
                                customStyle={{ margin: 0, padding: '1rem', background: 'transparent' }}
                            >
                                {content}
                            </SyntaxHighlighter>
                        </div>
                    );
                }

                return (
                    <code className="bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[0.85em] font-mono text-blue-600 dark:text-blue-400" {...rest}>
                        <Wrapper>{children}</Wrapper>
                    </code>
                );
            },
        };
    }, [localSearchQuery, searchOptions]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (!isSearchVisible) {
                    setIsSearchVisible(true);
                } else {
                    document.getElementById('quick-notes-search-input')?.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchVisible]);

    // Scroll to highlight
    const noteRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    useEffect(() => {
        if (highlightNoteId && noteRefs.current[highlightNoteId]) {
            const el = noteRefs.current[highlightNoteId];
            setTimeout(() => {
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
                setTimeout(() => {
                    el?.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2');
                }, 2000);
            }, 100);
        }
    }, [highlightNoteId]);

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50/50 dark:bg-slate-900/50 relative transition-colors overflow-hidden font-sans">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-16 px-6 flex items-center justify-between z-10">
                <div className="flex flex-col min-w-0 flex-1 mr-4">
                    <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 mb-0.5">
                        <span className="mr-1">Context:</span>
                        <span>Local</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Zap size={18} className="text-orange-500" />
                        <span className="text-lg font-bold text-gray-800 dark:text-white truncate">
                            Quick Notes
                        </span>
                        <span className="text-xs font-normal px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full ml-2">Beta</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAdding(true)}
                        className="p-2 rounded-md transition-all text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800"
                        title="Add Quick Note"
                    >
                        <Plus size={20} />
                    </button>
                    <div className="flex items-center gap-1 border-l border-gray-100 dark:border-slate-800 pl-4 ml-2">
                        {!isSearchVisible ? (
                            <button onClick={toggleSearch} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors" title="Find in notes (Ctrl+F)">
                                <Search size={18} />
                            </button>
                        ) : (
                            <div className="flex items-center gap-0 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md shadow-sm animate-in slide-in-from-right-2 fade-in overflow-hidden">
                                <div className="pl-3 pr-1 flex items-center justify-center shrink-0">
                                    <Search size={14} className="text-gray-400" />
                                </div>
                                <input
                                    autoFocus
                                    id="quick-notes-search-input"
                                    type="text"
                                    value={localSearchQuery}
                                    onChange={(e) => { setLocalSearchQuery(e.target.value); }}
                                    placeholder="Filter notes..."
                                    className="bg-transparent border-none focus:ring-0 w-32 text-sm text-gray-800 dark:text-gray-200 py-1.5 px-2"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            toggleSearch();
                                        }
                                    }}
                                />
                                {localSearchQuery && (
                                    <button onClick={() => setLocalSearchQuery('')} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                        <X size={14} />
                                    </button>
                                )}
                                <div className="flex items-center border-l border-gray-300 dark:border-slate-700 pl-1 gap-0.5">
                                    <span className="text-[10px] text-gray-400 min-w-[3ch] text-center">{localSearchQuery ? filteredNotes.length : 0}</span>
                                </div>
                                <div className="flex items-center border-l border-gray-300 dark:border-slate-700 pl-1 gap-0.5">
                                    <button onClick={() => setSearchOptions(o => ({ ...o, caseSensitive: !o.caseSensitive }))} className={`p-0.5 rounded ${searchOptions.caseSensitive ? 'text-blue-600 bg-blue-100' : 'text-gray-400'}`} title="Case Sensitive"><CaseSensitive size={14} /></button>
                                    <button onClick={() => setSearchOptions(o => ({ ...o, wholeWord: !o.wholeWord }))} className={`p-0.5 rounded ${searchOptions.wholeWord ? 'text-blue-600 bg-blue-100' : 'text-gray-400'}`} title="Whole Word"><WholeWord size={14} /></button>
                                </div>
                                <button onClick={toggleSearch} className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded"><X size={14} /></button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Add Modal */}
            {isAdding && (
                <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-800 p-6 mx-4">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">New Quick Note</h3>
                            <button onClick={() => setIsAdding(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <textarea
                            autoFocus
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            placeholder="Type your thought here..."
                            className="w-full h-40 p-4 text-base border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-gray-200 mb-4"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
                            }}
                        />
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-400 dark:text-slate-500">Ctrl/Cmd + Enter to save</span>
                            <div className="flex gap-3">
                                <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                                <button
                                    onClick={handleSave}
                                    disabled={!newContent.trim()}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-medium text-sm transition-all disabled:opacity-50"
                                >
                                    Save Note
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {notes.length === 0 && !isAdding && (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-slate-600">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-gray-300 dark:text-slate-500">
                            <Zap size={32} />
                        </div>
                        <p className="text-lg font-medium text-gray-500 dark:text-slate-500">No quick notes yet</p>
                    </div>
                )}

                {filteredNotes.map(note => {
                    const isCollapsed = collapsedNoteIds.includes(note.id);
                    return (
                        <div
                            key={note.id}
                            ref={el => { noteRefs.current[note.id] = el; }}
                            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl p-0 shadow-sm hover:shadow-md transition-all duration-200 group overflow-hidden"
                        >
                            {/* Note Toolbar */}
                            <div className="px-4 py-1.5 border-b border-gray-50 dark:border-slate-800 flex justify-between items-center bg-gray-50/30 dark:bg-slate-900/30">
                                <div className="flex items-center text-[10px] font-medium text-gray-400 dark:text-slate-500 gap-2">
                                    <Calendar size={12} />
                                    <span>{format(note.createdAt, 'MMM d, HH:mm')}</span>
                                </div>

                                <div className="flex gap-1">
                                    <button
                                        onClick={() => onTogglePin?.(note.id)}
                                        className={`p-1.5 rounded transition-colors ${note.isPinned ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                        title={note.isPinned ? "Unpin Note" : "Pin Note to Top"}
                                    >
                                        <Pin size={14} className={note.isPinned ? "fill-current" : ""} />
                                    </button>

                                    <button
                                        onClick={() => {
                                            onToggleCollapse(note.id);
                                        }}
                                        className="p-1.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                        title={isCollapsed ? "Expand" : "Collapse"}
                                    >
                                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    </button>



                                    <button
                                        onClick={() => handleCopyNote(note)}
                                        className={`p-1.5 rounded transition-colors ${copiedNoteId === note.id ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                                        title="Copy Content"
                                    >
                                        {copiedNoteId === note.id ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div className="p-0">
                                {isCollapsed ? (
                                    <AutoResizeTextarea
                                        className="px-4 pb-4 pt-1 text-sm text-gray-800 dark:text-gray-200 leading-[1.6]"
                                        value={note.content}
                                        onChange={(newVal) => onUpdateNoteContent(note.id, newVal)}
                                        onContextMenu={(e) => handleContextMenu(e, false, note.id)}
                                        placeholder="Empty note..."
                                        searchQuery={localSearchQuery}
                                        searchOptions={searchOptions}
                                        onCopy={() => onTouchNote?.(note.id)}
                                        onBlur={() => onTouchNote?.(note.id)}
                                        isCollapsed={true}
                                    />
                                ) : (
                                    <AutoResizeTextarea
                                        className="px-4 pb-4 pt-1 text-sm text-gray-800 dark:text-gray-200 leading-[1.6]"
                                        value={note.content}
                                        onChange={(newVal) => onUpdateNoteContent(note.id, newVal)}
                                        onContextMenu={(e) => handleContextMenu(e, false, note.id)}
                                        placeholder="Empty note..."
                                        searchQuery={localSearchQuery}
                                        searchOptions={searchOptions}
                                        onCopy={() => onTouchNote?.(note.id)}
                                        onBlur={() => onTouchNote?.(note.id)}
                                    />
                                )}
                            </div>

                            {/* Floating message for search */}
                            {!isCollapsed && localSearchQuery && note.content.toLowerCase().includes(localSearchQuery.toLowerCase()) && (
                                <div className="px-4 pb-2 text-[10px] text-blue-500/50 flex items-center gap-1 italic">
                                    <Search size={10} />
                                    <span>Editing note (Matches found)</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onCopy={handleCopySelection}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </div>

    );
};