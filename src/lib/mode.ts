// Controls which features are visible.
// Full mode: set VITE_MODE=full in Vercel environment variables.
// Simple mode: leave VITE_MODE unset (default for public version).
export const isFullMode = (import.meta as any).env?.VITE_MODE === 'full';
