import React, { createContext, useContext } from 'react';

const FullModeContext = createContext(false);

const FULL_MODE_USER_IDS = new Set([
  '75b95d80-d400-4168-8538-7d3e76c058a7',
]);

export function FullModeProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  return (
    <FullModeContext.Provider value={FULL_MODE_USER_IDS.has(userId)}>
      {children}
    </FullModeContext.Provider>
  );
}

export function useFullMode() {
  return useContext(FullModeContext);
}
