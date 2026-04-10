# Classroom Pulse 2.0 — Claude Instructions

## What this app is
A React/TypeScript PWA for teachers to track student behavior and mood in real time. Built for personal classroom use, now being shared with other teachers. The user is a teacher, not a developer — write clear, working code without expecting them to debug or fill in gaps.

## Stack
- React 19 + TypeScript + Vite (ESM only)
- Supabase (auth + Postgres with RLS)
- Tailwind CSS v4
- framer-motion, lucide-react, sonner (toasts), jsPDF, papaparse
- AI: Groq Llama (primary) → Cerebras (fallback), via `src/lib/gemini.ts` (file name is legacy)

## Deployment
- Vercel, auto-deploys from `main` branch on GitHub
- When asked to commit and deploy: `git add <files>`, `git commit`, `git push` — all in one chain. Do not stop between steps.

## Dark mode — critical rule
**Never use Tailwind `dark:` variants.** The app toggles `.dark` on `<html>` via JavaScript. Tailwind v4 `dark:` variants respond to OS `prefers-color-scheme`, not the class — this causes dark styles to leak into light mode.

For any dark mode styling, add rules to `src/index.css` under the `/* ===== DARK MODE =====*/` section using `.dark .class-name { }` selectors.

## Key architecture notes
- Settings `view` state is lifted into `App.tsx` (not local to SettingsScreen) so the Android back button can reset it
- Android back button handler uses synchronous ref updates — do not refactor to async state
- Calendar event dates are parsed as local midnight (`new Date(y, m-1, d)`), not UTC — prevents timezone bugs
- After 4 PM, the calendar banner skips today and shows the next upcoming event
- Destructive buttons (Factory Wipe, Class Reset) should be small, low-prominence text links — not full-width buttons

## Security — critical rule
**Never display, echo, or repeat API keys, tokens, or secrets in any response.** If a key needs to be added somewhere manually (e.g. Vercel dashboard), tell the user where to find it themselves — do not paste the value. This has happened before and keys had to be rotated.

## Approach
- For small bug fixes and cosmetic changes: just do it
- For new features or structural changes: briefly explain the approach and options first, then wait for a go-ahead unless the user says "go for it"
- Don't add unnecessary abstractions, helpers, or future-proofing — keep it simple
- Don't use Tailwind `dark:` variants (see above)

## Context management
- If a task is large or multi-part (e.g. redesign a whole page, build a new feature end-to-end), suggest upfront whether it's better handled in a fresh conversation or split into sub-agents — don't wait until the conversation is already long.
- When wrapping up a long session, save anything important to memory before the user starts a new chat.
