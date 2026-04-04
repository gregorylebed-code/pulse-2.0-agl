import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const DISMISS_KEY = 'cp_install_banner_dismissed';

export default function InstallBanner() {
  const { canInstallAndroid, showIosInstructions, triggerInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const visible = !dismissed && (canInstallAndroid || showIosInstructions);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mx-4 mb-2 px-4 py-3 bg-sage/10 border border-sage/20 rounded-2xl flex items-center justify-between gap-3 no-print"
        >
          {canInstallAndroid ? (
            <div className="flex items-center gap-3 flex-1">
              <span className="text-lg">📲</span>
              <div className="flex-1">
                <p className="text-[12px] font-black text-sage-dark">Install ShortHand</p>
                <p className="text-[11px] text-slate-500">Add to your home screen for faster access</p>
              </div>
              <button
                onClick={() => { triggerInstall(); dismiss(); }}
                className="px-3 py-1.5 bg-sage text-white text-[11px] font-black rounded-xl shrink-0"
              >
                Install
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-1">
              <span className="text-lg">📲</span>
              <div className="flex-1">
                <p className="text-[12px] font-black text-sage-dark">Add to Home Screen</p>
                <p className="text-[11px] text-slate-500">
                  Tap the <span className="font-black">Share</span> button{' '}
                  <span className="inline-block">⬆️</span>{' '}
                  then <span className="font-black">Add to Home Screen</span>
                </p>
              </div>
            </div>
          )}
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0 text-base leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
