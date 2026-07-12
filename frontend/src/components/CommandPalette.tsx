import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import {
  Sparkles, ArrowRight, Command, Loader2,
  Filter, Navigation, Zap, Info, AlertTriangle,
  CornerDownLeft
} from 'lucide-react';

interface CommandResult {
  intent: string;
  description: string;
  route?: string | null;
  filters?: Record<string, any> | null;
  bulk_payload?: Record<string, any> | null;
  results?: Array<Record<string, any>> | null;
}

interface CommandPaletteProps {
  onApplyFilters?: (filters: Record<string, any>) => void;
}

export default function CommandPalette({ onApplyFilters }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResult(null);
      setQuery('');
      setShowConfirm(false);
      setExecuted(false);
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    setShowConfirm(false);
    setExecuted(false);

    try {
      const res = await api.post('/ai/command', { query: query.trim() });
      const data: CommandResult = res.data;
      setResult(data);

      // Auto-navigate for navigation intents
      if (data.intent === 'navigate' && data.route) {
        setTimeout(() => {
          navigate(data.route!);
          setIsOpen(false);
        }, 600);
      }

      // For filter intents, prepare to apply
      if (data.intent === 'filter' && data.route) {
        // Will render filter results, user can click "Apply"
      }

      // For bulk updates, show confirmation
      if (data.intent === 'bulk_update') {
        setShowConfirm(true);
      }
    } catch (err) {
      console.error('Command failed', err);
      setResult({
        intent: 'info',
        description: 'Failed to process command. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [query, navigate]);

  const handleApplyFilter = () => {
    if (result?.route) {
      navigate(result.route);
    }
    if (result?.filters && onApplyFilters) {
      onApplyFilters(result.filters);
    }
    setIsOpen(false);
  };

  const handleExecuteBulk = async () => {
    if (!result?.bulk_payload) return;
    setExecuting(true);
    try {
      await api.post('/ai/command/execute-bulk', {
        from_location: result.bulk_payload.from_location,
        to_location: result.bulk_payload.to_location,
      });
      setExecuted(true);
      setShowConfirm(false);
    } catch (err) {
      console.error('Bulk update failed', err);
    } finally {
      setExecuting(false);
    }
  };

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'navigate': return <Navigation size={16} className="text-accent" />;
      case 'filter': return <Filter size={16} className="text-info" />;
      case 'bulk_update': return <Zap size={16} className="text-warning" />;
      case 'info': return <Info size={16} className="text-textSecondary" />;
      default: return <Sparkles size={16} className="text-accent" />;
    }
  };

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case 'navigate': return 'Navigation';
      case 'filter': return 'Smart Filter';
      case 'bulk_update': return 'Bulk Operation';
      case 'info': return 'System Info';
      default: return 'AI Response';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-[620px] mx-4 bg-surfaceCard rounded-2xl shadow-2xl border border-borderBase overflow-hidden animate-scale-in">
        {/* Header Search */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-3 px-5 border-b border-borderBase">
            <Sparkles size={18} className="text-accent shrink-0 animate-pulse" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask AI — e.g. 'Show damaged electronics' or 'Move assets from Desk E12 to Room B2'"
              className="flex-1 py-4 bg-transparent text-sm text-textPrimary placeholder:text-textMuted outline-none"
            />
            {loading ? (
              <Loader2 size={16} className="animate-spin text-accent shrink-0" />
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-textMuted bg-surfaceHover rounded border border-borderBase">
                  <CornerDownLeft size={10} /> Enter
                </kbd>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-textMuted bg-surfaceHover rounded border border-borderBase">
                  Esc
                </kbd>
              </div>
            )}
          </div>
        </form>

        {/* Quick Suggestions (when no result) */}
        {!result && !loading && (
          <div className="px-5 py-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-textMuted">Quick Commands</p>
            <div className="grid grid-cols-1 gap-1">
              {[
                'Show all damaged electronics',
                'How many assets do we have?',
                'Go to maintenance board',
                'Move all assets from Desk E12 to Room B2',
                'Show all available assets',
                'System overview',
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setQuery(suggestion); setTimeout(() => handleSubmit(), 50); }}
                  className="text-left px-3 py-2 text-xs text-textSecondary hover:text-textPrimary hover:bg-surfaceHover rounded-lg transition-colors flex items-center gap-2 group"
                >
                  <Command size={12} className="text-textMuted group-hover:text-accent transition-colors" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result Panel */}
        {result && (
          <div className="px-5 py-4 space-y-3 max-h-[50vh] overflow-y-auto">
            {/* Intent badge */}
            <div className="flex items-center gap-2">
              {getIntentIcon(result.intent)}
              <span className="text-[10px] font-bold uppercase tracking-wider text-textMuted">
                {getIntentLabel(result.intent)}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm text-textPrimary font-medium leading-relaxed">
              {result.description}
            </p>

            {/* Results list */}
            {result.results && result.results.length > 0 && (
              <div className="space-y-1 pt-1">
                {result.results.slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-surfaceHover rounded-lg text-xs border border-borderBase/60">
                    <div className="flex items-center gap-2 truncate">
                      {item.asset_tag && (
                        <span className="font-mono font-bold text-accent bg-accentLight px-1.5 py-0.5 rounded text-[10px]">
                          {item.asset_tag}
                        </span>
                      )}
                      <span className="text-textPrimary font-medium truncate">
                        {item.name || item.metric}
                      </span>
                    </div>
                    <span className="text-textMuted shrink-0 ml-2">
                      {item.status || item.current_location || item.value}
                    </span>
                  </div>
                ))}
                {result.results.length > 8 && (
                  <p className="text-[10px] text-textMuted text-center pt-1">
                    +{result.results.length - 8} more results
                  </p>
                )}
              </div>
            )}

            {/* Bulk Update Confirmation */}
            {showConfirm && result.bulk_payload && (
              <div className="p-3 bg-warning/10 border border-warning/30 rounded-xl space-y-2 mt-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-warning">Confirm Bulk Operation</p>
                    <p className="text-[11px] text-textSecondary mt-0.5">
                      This will move <strong>{result.bulk_payload.affected_count}</strong> asset(s) from{' '}
                      <strong>{result.bulk_payload.from_location}</strong> to{' '}
                      <strong>{result.bulk_payload.to_location}</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteBulk}
                    disabled={executing}
                    className="btn-primary text-xs py-1.5 px-3 bg-warning hover:bg-warning/90 border-warning"
                  >
                    {executing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    Execute Update
                  </button>
                </div>
              </div>
            )}

            {/* Success feedback */}
            {executed && (
              <div className="p-3 bg-successLight text-success text-xs font-semibold rounded-xl flex items-center gap-2">
                <Sparkles size={14} />
                Bulk operation completed successfully!
              </div>
            )}

            {/* Action buttons */}
            {!showConfirm && !executed && (
              <div className="flex gap-2 pt-2 border-t border-borderBase">
                {result.intent === 'filter' && result.route && (
                  <button onClick={handleApplyFilter} className="btn-primary text-xs py-2 px-4 flex-1">
                    <Filter size={13} />
                    Apply Filter & Navigate
                    <ArrowRight size={13} />
                  </button>
                )}
                {result.intent === 'navigate' && (
                  <div className="flex items-center gap-2 text-xs text-accent font-semibold animate-pulse">
                    <Loader2 size={13} className="animate-spin" />
                    Navigating...
                  </div>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="btn-secondary text-xs py-2 px-3 ml-auto"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 bg-surfaceHover/60 border-t border-borderBase flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-textMuted">
            <Sparkles size={11} className="text-accent" />
            <span>AssetFlow AI Engine</span>
          </div>
          <kbd className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-textMuted bg-surfaceCard rounded border border-borderBase">
            <Command size={10} /> K
          </kbd>
        </div>
      </div>
    </div>
  );
}
