import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TurndownService from 'turndown';
import * as gfmPlugin from 'turndown-plugin-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Project, Note, NoteType, SearchOptions, AppSettings } from '../types';
import { File as FileIcon, Search, CaseSensitive, WholeWord, X, ChevronDown, ChevronUp, FileText, Code, Eye, Pencil } from 'lucide-react';
import { ContextMenu } from './ContextMenu';


interface WorkspaceProps {
    project: Project | null;
    notes: Note[];
    activeNoteId: string | null;
    initialSearchQuery?: string;
    onAddNote: (content: string, type: NoteType, title?: string) => void;
    onRenameProject: (projectId: string, newName: string) => void;
    onRenameNote: (noteId: string, newTitle: string) => void;
    onUpdateNoteContent: (noteId: string, newContent: string) => void;
    highlightNoteId?: string;
    settings: AppSettings;
    viewMode: 'raw' | 'markdown';
    onViewModeChange: (mode: 'raw' | 'markdown') => void;
}

// --- Helper: Highlight logic for raw text ---
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

// --- Helper: Simple Markdown to HTML for clipboard ---
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
        .replace(/<\/ul>\s*<ul>/g, '') // Merge lists
        .replace(/<\/ol>\s*<ol>/g, '');
};

const turndownService = new TurndownService({
    headingStyle: 'atx',
    hr: '---',
    bulletListMarker: '-',
});
turndownService.use(gfmPlugin.gfm);

// Rule 1: STRICT CODE HANDLING
// This rule catches ALL <code> tags. 
// - If inside <pre>, return raw content so <pre> rule can wrap it in a block.
// - Otherwise, force it to be inline with single backticks.
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

// Rule 2b: IDE Paste Detection (Detecting nested code structures)
turndownService.addRule('idePaste', {
    filter: (node) => {
        const style = node.getAttribute('style') || '';
        const className = node.getAttribute('class') || '';
        // Look for common code editor signals
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
    // 1. Replace NBSP with normal spaces and clean HTML entities
    const cleanHtml = html
        .replace(/\u00a0/g, ' ')
        .replace(/&nbsp;/g, ' ');

    // 2. Process with turndown
    let md = turndownService.turndown(cleanHtml);

    // 3. Post-process: collapse excessive newlines and trim each line
    md = md.split('\n')
        .map(line => line.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');

    return md.trim();
};

// --- Component: Highlight Backdrop for Source Mode ---
const HighlightBackdrop: React.FC<{
    content: string;
    query: string;
    options: SearchOptions;
    settings: AppSettings;
}> = ({ content, query, options, settings }) => {
    if (!query) return null;

    const parts = getHighlightParts(content, query, options);
    let matchCounter = 0;

    return (
        <div
            className={`w-full pointer-events-none ${settings.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}
            style={{
                fontFamily: settings.fontFamily === 'mono' ? 'monospace' : 'inherit',
                fontSize: `${settings.fontSize}px`,
                lineHeight: settings.lineHeight,
                padding: '1rem',
            }}
        >
            {parts.map((part, i) => {
                if (part.isMatch) {
                    const id = `match-${matchCounter}`;
                    matchCounter++;
                    return <mark id={id} key={i} className="bg-yellow-300/60 dark:bg-yellow-600/60 text-gray-900 dark:text-gray-100 rounded-[1px]">{part.text}</mark>;
                }
                return <span key={i} className="text-gray-900 dark:text-gray-200">{part.text}</span>;
            })}
            <span className="invisible">.</span>
        </div>
    );
};

// --- Helper: Safer Non-Recursive Highlighter for Markdown Preview ---
interface HighlightElementsProps {
    children?: React.ReactNode;
    query: string;
    options: SearchOptions;
}

const HighlightElements: React.FC<HighlightElementsProps> = ({ children, query, options }) => {
    if (!query) return <>{children}</>;

    if (typeof children === 'string') {
        const parts = getHighlightParts(children, query, options);
        return (
            <>
                {parts.map((part, i) =>
                    part.isMatch ?
                        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-gray-100 rounded-[1px] px-0.5">{part.text}</mark> :
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

export const Workspace: React.FC<WorkspaceProps> = ({
    project,
    notes,
    activeNoteId,
    initialSearchQuery,
    onRenameProject,
    onRenameNote,
    onUpdateNoteContent,
    settings,
    viewMode,
    onViewModeChange,
}) => {
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOptions, setSearchOptions] = useState<SearchOptions>({ caseSensitive: false, wholeWord: false });
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);


    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const projectInputRef = useRef<HTMLInputElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId) || null, [notes, activeNoteId]);

    useEffect(() => {
        if (initialSearchQuery) {
            setSearchQuery(initialSearchQuery);
            setIsSearchVisible(true);
            onViewModeChange('raw');
            // Give time for text rendering before scrolling
            setTimeout(() => scrollToMatch(0), 100);
        } else {
            setIsSearchVisible(false);
            setSearchQuery('');
        }
    }, [initialSearchQuery, activeNoteId, onViewModeChange]);

    const searchMatchesCount = useMemo(() => {
        if (!searchQuery || !activeNote || !activeNote.content) return 0;
        const { caseSensitive, wholeWord } = searchOptions;
        const flags = caseSensitive ? 'g' : 'gi';
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        try {
            const matches = activeNote.content.match(new RegExp(pattern, flags));
            return matches ? matches.length : 0;
        } catch { return 0; }
    }, [searchQuery, searchOptions, activeNote]);

    const scrollToMatch = (index: number) => {
        if (viewMode === 'raw') {
            const markId = `match-${index}`;
            const markElement = document.getElementById(markId);
            if (markElement && textareaRef.current) {
                const top = markElement.offsetTop;
                const left = markElement.offsetLeft;
                textareaRef.current.scrollTo({
                    top: top - (textareaRef.current.clientHeight / 2),
                    left: left - 50,
                    behavior: 'smooth'
                });
            }
        } else if (viewMode === 'markdown' && previewContainerRef.current) {
            const marks = previewContainerRef.current.getElementsByTagName('mark');
            if (marks[index]) {
                marks[index].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }
        }
        setCurrentMatchIndex(index);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (!isSearchVisible) {
                    setIsSearchVisible(true);
                } else {
                    document.getElementById('workspace-search-input')?.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchVisible]);

    useEffect(() => {
        const handleJump = (e: any) => {
            const { lineIndex } = e.detail;
            if (!activeNote) return;
            if (viewMode === 'raw' && textareaRef.current) {
                const lineHeight = settings.fontSize * settings.lineHeight;
                const padding = 16;
                textareaRef.current.scrollTo({
                    top: lineIndex * lineHeight + padding - 40,
                    behavior: 'smooth'
                });
            } else if (viewMode === 'markdown' && previewContainerRef.current) {
                const lineText = activeNote.content.split('\n')[lineIndex];
                const cleanText = lineText.replace(/^#+\s+/, '').trim();
                const headings = previewContainerRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6');
                const targetHeader = Array.from(headings).find(h => h.textContent?.includes(cleanText));
                if (targetHeader) targetHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        window.addEventListener('editor-jump-to-line', handleJump);
        return () => window.removeEventListener('editor-jump-to-line', handleJump);
    }, [viewMode, settings, activeNote]);

    const handleNextMatch = () => {
        if (searchMatchesCount === 0) return;
        const nextIndex = (currentMatchIndex + 1) % searchMatchesCount;
        scrollToMatch(nextIndex);
    };

    const handlePrevMatch = () => {
        if (searchMatchesCount === 0) return;
        const prevIndex = (currentMatchIndex - 1 + searchMatchesCount) % searchMatchesCount;
        scrollToMatch(prevIndex);
    };

    const handleScroll = () => {
        if (textareaRef.current) {
            const { scrollTop, scrollLeft } = textareaRef.current;
            if (backdropRef.current) {
                backdropRef.current.scrollTop = scrollTop;
                backdropRef.current.scrollLeft = scrollLeft;
            }
            if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = scrollTop;
            }
        }
    };

    const toggleSearch = () => {
        if (isSearchVisible) {
            setIsSearchVisible(false);
            setSearchQuery('');
        } else {
            setIsSearchVisible(true);
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const selection = window.getSelection();
        const hasSelection = (selection && selection.toString().length > 0) ||
            (textareaRef.current && textareaRef.current.selectionStart !== textareaRef.current.selectionEnd);

        if (hasSelection) {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };

    const handleCopySelection = () => {
        if (viewMode === 'markdown') {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;

            const range = selection.getRangeAt(0);
            const container = document.createElement('div');
            container.appendChild(range.cloneContents());

            const html = container.innerHTML;
            const markdown = turndown(html);

            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', markdown);
            clipboardData.setData('text/html', `<div style="font-family: sans-serif;">${html}</div>`);

            // Use modern clipboard API or fallback
            navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([markdown], { type: 'text/plain' }),
                    'text/html': new Blob([`<div style="font-family: sans-serif;">${html}</div>`], { type: 'text/html' })
                })
            ]).catch(() => {
                // Fallback for some browsers
                navigator.clipboard.writeText(markdown);
            });
        } else {
            const textarea = textareaRef.current;
            if (!textarea) return;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = textarea.value.substring(start, end);
            if (!selectedText) return;

            const html = simpleMarkdownToHtml(selectedText);

            navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([selectedText], { type: 'text/plain' }),
                    'text/html': new Blob([`<div style="font-family: sans-serif;">${html}</div>`], { type: 'text/html' })
                })
            ]).catch(() => {
                navigator.clipboard.writeText(selectedText);
            });
        }
    };



    const lineCount = useMemo(() => {
        if (!activeNote || !activeNote.content) return 1;
        return activeNote.content.split('\n').length;
    }, [activeNote?.content]);

    const markdownComponents = useMemo(() => {
        const Wrapper = ({ children }: any) => <HighlightElements query={searchQuery} options={searchOptions}>{children}</HighlightElements>;
        return {
            p: ({ children }: any) => <p className="mb-4"><Wrapper>{children}</Wrapper></p>,
            li: ({ children }: any) => <li><Wrapper>{children}</Wrapper></li>,
            h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-4"><Wrapper>{children}</Wrapper></h1>,
            h2: ({ children }: any) => <h2 className="text-xl font-bold mb-3"><Wrapper>{children}</Wrapper></h2>,
            h3: ({ children }: any) => <h3 className="text-lg font-bold mb-2"><Wrapper>{children}</Wrapper></h3>,
            h4: ({ children }: any) => <h4 className="text-base font-bold mb-2"><Wrapper>{children}</Wrapper></h4>,
            h5: ({ children }: any) => <h5 className="text-sm font-bold mb-1"><Wrapper>{children}</Wrapper></h5>,
            h6: ({ children }: any) => <h6 className="text-xs font-bold mb-1"><Wrapper>{children}</Wrapper></h6>,
            blockquote: ({ children }: any) => <blockquote className="border-l-4 border-gray-200 dark:border-slate-800 pl-4 italic"><Wrapper>{children}</Wrapper></blockquote>,
            strong: ({ children }: any) => <strong><Wrapper>{children}</Wrapper></strong>,
            em: ({ children }: any) => <em><Wrapper>{children}</Wrapper></em>,
            code: (props: any) => {
                const { className, children, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                const content = String(children).replace(/\n$/, '');
                const isBlock = match || String(children).includes('\n');

                if (isBlock) {
                    return (
                        <div className="my-6 rounded-lg overflow-hidden text-sm bg-slate-900 border border-slate-800 shadow-xl group/code relative">
                            <div className="bg-slate-800/80 px-4 py-1.5 flex justify-between items-center text-slate-400 text-[11px] font-mono border-b border-slate-700/50">
                                <span>{match ? match[1].toUpperCase() : 'CODE'}</span>
                            </div>
                            <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match ? match[1] : 'text'}
                                PreTag="div"
                                customStyle={{ margin: 0, padding: '1.25rem', background: 'transparent' }}
                                showLineNumbers={content.split('\n').length > 5}
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
            a: ({ children, href }: any) => <a href={href} className="text-blue-600 hover:underline"><Wrapper>{children}</Wrapper></a>,
            del: ({ children }: any) => <del><Wrapper>{children}</Wrapper></del>,
            td: ({ children }: any) => <td className="border border-gray-200 dark:border-slate-800 px-4 py-2"><Wrapper>{children}</Wrapper></td>,
            th: ({ children }: any) => <th className="border border-gray-200 dark:border-slate-800 px-4 py-2 bg-gray-100 dark:bg-slate-800"><Wrapper>{children}</Wrapper></th>,
        };
    }, [searchQuery, searchOptions]);

    if (!activeNote) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 text-gray-400 dark:text-slate-600">
                <FileText size={64} className="mb-4 opacity-20" />
                <p>Select a file from the explorer to view</p>
            </div>
        );
    }

    const editorFontFamily = settings.fontFamily === 'mono' ? 'monospace' : settings.fontFamily === 'serif' ? 'serif' : 'sans-serif';

    return (
        <main className="flex-1 flex flex-col h-full relative bg-white dark:bg-slate-950 transition-colors overflow-hidden">
            <header className="flex-shrink-0 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-16 px-6 flex items-center justify-between z-10">
                <div className="flex flex-col min-w-0 flex-1 mr-4">
                    <div className="flex items-center text-xs text-gray-400 dark:text-slate-500 mb-0.5">
                        <span className="mr-1">Project:</span>
                        {project ? (
                            <div className="flex items-center gap-2 group/edit-project">
                                <input
                                    ref={projectInputRef}
                                    className="bg-transparent border-none p-0 focus:ring-0 text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-blue-600 cursor-pointer hover:border-b hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                                    value={project.name}
                                    onChange={(e) => onRenameProject(project.id, e.target.value)}
                                    title="Rename Project"
                                />
                                <button onClick={() => projectInputRef.current?.focus()} className="opacity-0 group-hover/edit-project:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-opacity">
                                    <Pencil size={10} />
                                </button>
                            </div>
                        ) : <span>Uncategorized</span>}
                    </div>
                    <div className="flex items-center gap-2 group/edit-title">
                        {activeNote.type === NoteType.TEXT ? <FileText size={18} className="text-blue-500" /> : <FileIcon size={18} className="text-orange-500" />}
                        <input
                            ref={titleInputRef}
                            className="bg-transparent border-none p-0 focus:ring-0 text-lg font-bold text-gray-800 dark:text-white w-full hover:border-b-2 hover:border-gray-200 dark:hover:border-slate-700 focus:border-blue-500 transition-all rounded-none"
                            value={activeNote.title || 'Untitled'}
                            onChange={(e) => onRenameNote(activeNote.id, e.target.value)}
                            placeholder="Untitled Note"
                        />
                        <button onClick={() => titleInputRef.current?.focus()} className="opacity-0 group-hover/edit-title:opacity-100 p-1.5 text-gray-400 hover:text-blue-500 transition-opacity">
                            <Pencil size={14} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1 border-l border-gray-100 dark:border-slate-800 pl-4 ml-2">
                    <button
                        onClick={() => onViewModeChange('raw')}
                        className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 px-3 ${viewMode === 'raw' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        title="Source Mode"
                    >
                        <Code size={16} />
                        <span className="text-xs font-semibold">Source</span>
                    </button>
                    <button
                        onClick={() => onViewModeChange('markdown')}
                        className={`p-1.5 rounded-md transition-all flex items-center gap-1.5 px-3 ${viewMode === 'markdown' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                        title="Preview Mode"
                    >
                        <Eye size={16} />
                        <span className="text-xs font-semibold">Preview</span>
                    </button>
                </div>

                <div className="ml-4 pl-4 border-l border-gray-200 dark:border-slate-800 flex items-center gap-2">
                    {!isSearchVisible ? (
                        <button onClick={toggleSearch} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded transition-colors" title="Find in file">
                            <Search size={18} />
                        </button>
                    ) : (
                        <div className="flex items-center bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-md shadow-sm animate-in slide-in-from-right-2 fade-in overflow-hidden">
                            <div className="pl-3 pr-1 flex items-center justify-center shrink-0">
                                <Search size={14} className="text-gray-400" />
                            </div>
                            <input
                                autoFocus
                                id="workspace-search-input"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => { setSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
                                placeholder="Find..."
                                className="bg-transparent border-none focus:ring-0 w-32 text-sm text-gray-800 dark:text-gray-200 py-1.5 px-2"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.shiftKey ? handlePrevMatch() : handleNextMatch();
                                    } else if (e.key === 'Escape') {
                                        toggleSearch();
                                    }
                                }}
                            />
                            <div className="flex items-center border-l border-gray-300 dark:border-slate-700 ml-1 pl-1 gap-0.5">
                                <span className="text-[10px] text-gray-400 min-w-[3ch] text-center">{searchMatchesCount > 0 ? `${currentMatchIndex + 1}/${searchMatchesCount}` : '0'}</span>
                                <button onClick={handlePrevMatch} className="hover:bg-gray-200 dark:hover:bg-slate-700 rounded p-0.5"><ChevronUp size={14} /></button>
                                <button onClick={handleNextMatch} className="hover:bg-gray-200 dark:hover:bg-slate-700 rounded p-0.5"><ChevronDown size={14} /></button>
                            </div>
                            <div className="flex items-center border-l border-gray-300 dark:border-slate-700 ml-1 pl-1 gap-0.5">
                                <button onClick={() => setSearchOptions(o => ({ ...o, caseSensitive: !o.caseSensitive }))} className={`p-0.5 rounded ${searchOptions.caseSensitive ? 'text-blue-600 bg-blue-100' : 'text-gray-400'}`} title="Case Sensitive"><CaseSensitive size={14} /></button>
                                <button onClick={() => setSearchOptions(o => ({ ...o, wholeWord: !o.wholeWord }))} className={`p-0.5 rounded ${searchOptions.wholeWord ? 'text-blue-600 bg-blue-100' : 'text-gray-400'}`} title="Whole Word"><WholeWord size={14} /></button>
                            </div>
                            <button onClick={toggleSearch} className="ml-1 p-0.5 text-gray-400 hover:text-red-500 rounded"><X size={14} /></button>
                        </div>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-hidden relative group/editor flex">
                {viewMode === 'raw' && settings.showLineNumbers && (
                    <div
                        ref={lineNumbersRef}
                        className="flex-shrink-0 bg-gray-50 dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 pt-4 pb-4 text-right pr-3 select-none overflow-hidden text-sm"
                        style={{
                            fontFamily: editorFontFamily,
                            fontSize: `${settings.fontSize}px`,
                            lineHeight: settings.lineHeight,
                            width: `${Math.max(3, lineCount.toString().length) * settings.fontSize * 0.8}px`
                        }}
                    >
                        {Array.from({ length: lineCount }).map((_, i) => (
                            <div key={i} className="text-gray-300 dark:text-slate-600">{i + 1}</div>
                        ))}
                    </div>
                )}

                <div className="flex-1 relative h-full min-w-0">
                    {viewMode === 'markdown' ? (
                        <div
                            ref={previewContainerRef}
                            className="h-full w-full overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none p-4 cursor-text"
                            onDoubleClick={() => onViewModeChange('raw')}
                            onCopy={(e) => {
                                const selection = window.getSelection();
                                if (!selection || selection.rangeCount === 0) return;

                                const range = selection.getRangeAt(0);
                                const container = document.createElement('div');
                                container.appendChild(range.cloneContents());

                                const html = container.innerHTML;
                                const markdown = turndown(html);

                                e.clipboardData.setData('text/plain', markdown);
                                e.clipboardData.setData('text/html', `<div style="font-family: sans-serif;">${html}</div>`);
                                e.preventDefault();
                            }}
                            style={{
                                fontFamily: settings.fontFamily === 'serif' ? 'serif' : 'sans-serif',
                                fontSize: `${settings.fontSize}px`,
                                lineHeight: settings.lineHeight,
                            }}
                            onContextMenu={handleContextMenu}
                        >

                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {activeNote.content}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <div className="relative w-full h-full bg-white dark:bg-slate-950">
                            {searchQuery && (
                                <div ref={backdropRef} className="absolute inset-0 z-0 overflow-auto select-none pointer-events-none custom-scrollbar" aria-hidden="true">
                                    <HighlightBackdrop content={activeNote.content} query={searchQuery} options={searchOptions} settings={settings} />
                                </div>
                            )}
                            <textarea
                                ref={textareaRef}
                                value={activeNote.content}
                                onChange={(e) => onUpdateNoteContent(activeNote.id, e.target.value)}
                                onScroll={handleScroll}
                                onCopy={(e) => {
                                    const textarea = e.currentTarget;
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const selectedText = textarea.value.substring(start, end);
                                    if (!selectedText) return;

                                    const html = simpleMarkdownToHtml(selectedText);
                                    e.clipboardData.setData('text/plain', selectedText);
                                    e.clipboardData.setData('text/html', `<div style="font-family: sans-serif;">${html}</div>`);
                                    e.preventDefault();
                                }}
                                onPaste={(e) => {
                                    const html = e.clipboardData.getData('text/html');
                                    // Significantly broaden the detection:
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
                                        onUpdateNoteContent(activeNote.id, newVal);
                                        setTimeout(() => {
                                            if (textareaRef.current) {
                                                const newCursorPos = start + markdown.length;
                                                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
                                            }
                                        }, 0);
                                    }
                                }}
                                spellCheck={false}
                                className={`absolute inset-0 z-10 w-full h-full p-4 overflow-auto bg-transparent resize-none outline-none custom-scrollbar ${searchQuery ? 'text-transparent caret-gray-900 dark:caret-white selection:bg-blue-200/50 dark:selection:bg-blue-800/50' : 'text-gray-900 dark:text-gray-200'} ${settings.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'} ${settings.highlightActiveLine ? 'focus:ring-2 ring-inset ring-blue-500/10' : ''}`}
                                placeholder="Start typing..."
                                style={{
                                    fontFamily: editorFontFamily,
                                    fontSize: `${settings.fontSize}px`,
                                    lineHeight: settings.lineHeight,
                                }}
                                onContextMenu={handleContextMenu}
                            />
                        </div>
                    )}
                </div>
            </div>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onCopy={handleCopySelection}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </main>

    );
};
