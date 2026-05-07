import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, Palette, Tag, X } from 'lucide-react';

export type AccentTheme = 'default' | 'amber' | 'rose' | 'violet' | 'cyan';
export type BgTheme = 'cream' | 'sky' | 'lavender' | 'slate' | 'sage';

const THEMES: { id: AccentTheme; label: string; color: string }[] = [
  { id: 'default', label: 'Mint',   color: '#34d399' },
  { id: 'amber',   label: 'Amber',  color: '#f59e0b' },
  { id: 'rose',    label: 'Rose',   color: '#f43f5e' },
  { id: 'violet',  label: 'Violet', color: '#8b5cf6' },
  { id: 'cyan',    label: 'Cyan',   color: '#06b6d4' },
];

const BG_THEMES: { id: BgTheme; label: string; bg: string; nav: string }[] = [
  { id: 'cream',   label: 'Cream',    bg: '#FFF9E5', nav: 'rgba(255,249,229,1)' },
  { id: 'sky',     label: 'Sky',      bg: '#e8f4fd', nav: 'rgba(232,244,253,1)' },
  { id: 'lavender',label: 'Lavender', bg: '#f0eeff', nav: 'rgba(240,238,255,1)' },
  { id: 'slate',   label: 'Cool',     bg: '#f0f4f8', nav: 'rgba(240,244,248,1)' },
  { id: 'sage',    label: 'Green',    bg: '#e8faf3', nav: 'rgba(232,250,243,1)' },
];

const CLASS_NAMES = [
  'Period 1', 'Period 2', 'Period 3', 'Period 4',
  '7th Grade Math', '8th Grade Science', 'Block A', 'Block B',
  'Room 204', 'Room 11', 'Advisory', 'Homeroom',
];

interface StudiopanelProps {
  open: boolean;
  onClose: () => void;
  onShuffle: () => void;
  theme: AccentTheme;
  onThemeChange: (t: AccentTheme) => void;
  bgTheme: BgTheme;
  onBgThemeChange: (t: BgTheme) => void;
  classLabel: string | null;
  onClassLabel: (label: string | null) => void;
}

export default function StudioPanel({ open, onClose, onShuffle, theme, onThemeChange, bgTheme, onBgThemeChange, classLabel, onClassLabel }: StudiopanelProps) {
  const [showClassPicker, setShowClassPicker] = useState(false);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[210] bg-white rounded-t-[28px] p-6 pb-10 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-black text-slate-800">🎬 Studio Mode</h2>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Secret recording controls</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shuffle */}
            <button
              onClick={() => { onShuffle(); onClose(); }}
              className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl mb-3 active:scale-95 transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-sage/15 flex items-center justify-center">
                <Shuffle className="w-4 h-4 text-sage-dark" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-bold text-slate-700">Shuffle Students</p>
                <p className="text-[11px] text-slate-400">Randomize display order</p>
              </div>
            </button>

            {/* Class Label */}
            <button
              onClick={() => setShowClassPicker(!showClassPicker)}
              className="w-full flex items-center gap-3 p-4 bg-slate-50 rounded-2xl mb-3 active:scale-95 transition-transform"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Tag className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-left flex-1">
                <p className="text-[13px] font-bold text-slate-700">Class Label</p>
                <p className="text-[11px] text-slate-400">{classLabel ?? 'Using real data'}</p>
              </div>
              {classLabel && (
                <button
                  onClick={(e) => { e.stopPropagation(); onClassLabel(null); }}
                  className="text-[11px] text-terracotta font-bold px-2"
                >
                  Clear
                </button>
              )}
            </button>

            <AnimatePresence>
              {showClassPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden mb-3"
                >
                  <div className="flex flex-wrap gap-2 pt-1 pb-2">
                    {CLASS_NAMES.map(name => (
                      <button
                        key={name}
                        onClick={() => { onClassLabel(name); setShowClassPicker(false); }}
                        className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors ${classLabel === name ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Background color */}
            <div className="p-4 bg-slate-50 rounded-2xl mb-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-700">Background</p>
                  <p className="text-[11px] text-slate-400">Biggest visual change</p>
                </div>
              </div>
              <div className="flex gap-2">
                {BG_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onBgThemeChange(t.id)}
                    title={t.label}
                    className={`flex-1 h-8 rounded-xl border transition-all ${bgTheme === t.id ? 'ring-2 ring-slate-400 ring-offset-2 scale-105' : 'opacity-70 hover:opacity-100'}`}
                    style={{ backgroundColor: t.bg }}
                  />
                ))}
              </div>
              <div className="flex gap-2 mt-1">
                {BG_THEMES.map(t => (
                  <span key={t.id} className="flex-1 text-center text-[10px] text-slate-400 font-medium">{t.label}</span>
                ))}
              </div>
            </div>

            {/* Accent color */}
            <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[12px] font-bold text-slate-500 mb-2">Accent Color</p>
              <div className="flex gap-2">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => onThemeChange(t.id)}
                    title={t.label}
                    className={`flex-1 h-8 rounded-xl transition-all ${theme === t.id ? 'ring-2 ring-offset-2 scale-105' : 'opacity-60 hover:opacity-100'}`}
                    style={{ backgroundColor: t.color }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
