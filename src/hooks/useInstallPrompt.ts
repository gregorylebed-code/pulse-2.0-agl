import { useState, useEffect } from 'react';

type Platform = 'android' | 'ios' | 'other';

function getPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform] = useState<Platform>(getPlatform);
  const [isInstalled] = useState(isInStandaloneMode);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const canInstallAndroid = platform === 'android' && !!deferredPrompt && !isInstalled;
  const showIosInstructions = platform === 'ios' && !isInstalled;

  return { canInstallAndroid, showIosInstructions, triggerInstall, isInstalled };
}
