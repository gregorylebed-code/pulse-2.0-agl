import React, { createContext, useContext, useState } from 'react';

interface AliasModeContextType {
  aliasMode: boolean;
  toggleAliasMode: () => void;
}

const AliasModeContext = createContext<AliasModeContextType>({
  aliasMode: false,
  toggleAliasMode: () => {},
});

export function AliasModeProvider({ children }: { children: React.ReactNode }) {
  const [aliasMode, setAliasMode] = useState<boolean>(() => {
    return localStorage.getItem('cp_alias_mode') === 'true';
  });

  const toggleAliasMode = () => {
    setAliasMode(prev => {
      const next = !prev;
      localStorage.setItem('cp_alias_mode', String(next));
      return next;
    });
  };

  return (
    <AliasModeContext.Provider value={{ aliasMode, toggleAliasMode }}>
      {children}
    </AliasModeContext.Provider>
  );
}

export function useAliasMode() {
  return useContext(AliasModeContext);
}
