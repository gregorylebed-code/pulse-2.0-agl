# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Classroom Pulse 2.0 — Claude Instructions

## What this app is
A React/TypeScript PWA for teachers to track student behavior and mood in real time. Built for personal classroom use, now being shared with other teachers. The user is a teacher, not a developer — write clear, working code without expecting them to debug or fill in gaps.

## Commands
```bash
npm run dev        # dev server on port 3000
npm run build      # production build
npm run lint       # TypeScript type-check (no emit)
npm run test       # run all tests (vitest)
```
Run a single test file: `npx vitest run src/utils/__tests__/roster.test.ts`

## Stack
- React 19 + TypeScript + Vite (ESM only)
- Supabase (auth + Postgres with RLS)
- Tailwind CSS v4
- framer-motion, lucide-react, sonner (toasts), jsPDF, papaparse
- AI: Groq Llama (primary) → Together AI (fallback), via `src/lib/gemini.ts` (file name is legacy — do not rename)

## Deployment
- Vercel, auto-deploys from `main` branch on GitHub
- When asked to commit and deploy: `git add <files>`, `git commit`, `git push` — all in one chain. Do not stop between steps.

## Dark mode — critical rule
**Never use Tailwind `dark:` variants.** The app toggles `.dark` on `<html>` via JavaScript. Tailwind v4 `dark:` variants respond to OS `prefers-color-scheme`, not the class — this causes dark styles to leak into light mode.

For any dark mode styling, add rules to `src/index.css` under the `/* ===== DARK MODE =====*/` section using `.dark .class-name { }` selectors.

## Code architecture

### Data flow
All Supabase reads/writes go through `src/hooks/useClassroomData.ts` — the single source of truth for every data entity (students, notes, goals, accommodations, attendance, etc.). `App.tsx` calls this hook, destructures everything, and passes it down as props.

### Feature modes
`src/lib/mode.ts` exports `isFullMode` — set `VITE_MODE=full` in Vercel env vars to unlock advanced features. Default (unset) is the simplified public version.

### Screens / routing
No router library — `App.tsx` manages a `tab` state (`'pulse' | 'students' | 'insights' | 'shoutouts' | 'settings'`) and a `settingsView` ref. `AnimatePresence` + `tabVariants` handles slide transitions between tabs.

### Offline support
`src/lib/offlineQueue.ts` queues notes when offline; `src/hooks/useOfflineSync.ts` flushes the queue on reconnect.

### AI calls
All AI calls go through `src/lib/gemini.ts` (legacy name). `callGroq()` is primary; falls back to Together AI on failure. Token usage is logged to the `token_usage` Supabase table.

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

## ShortHand URL rule — critical
- **Never use `getshorthand.app`** — abandoned and blocked by school filters.
- **Use `getshorthandapp.com`** for the marketing website in all copy, video scripts, and captions.
- **Use `app.getshorthandapp.com`** for the app itself.
- Domain switch completed 2026-05-01 — all code updated.

## Obsidian Brain — auto-update rule
When the user shares any status update about content (videos recorded, videos mixed, days posted, tasks completed), automatically update the relevant Obsidian Brain files without being asked:
- `C:\Users\doubl\GOOGLE DRIVE\My Drive\Google AI Studio\ShortHand\Brain\GSD.md` — update active tasks and project status
- `C:\Users\doubl\GOOGLE DRIVE\My Drive\Google AI Studio\ShortHand\Brain\ShortHand Content Calendar.md` — mark days as ✅ POSTED or ✅ MIXED as appropriate

## "Save memory" — deep save rule
When the user says "save memory", do a thorough save — not just surface preferences. Actively look for and save:
- Procedural workflows (step-by-step processes we developed together)
- Checklists and repeatable sequences
- Keyword/SEO strategies and decisions
- Anything that would save time or prevent mistakes in a future conversation
- Save to both the memory files (`~/.claude/projects/.../memory/`) AND to the Obsidian Brain folder (`C:\Users\doubl\GOOGLE DRIVE\My Drive\Google AI Studio\ShortHand\Brain\`) if the content is ShortHand/business-related

The goal: a future version of me should be able to pick up exactly where we left off, with full procedural context — not just "G likes X tone."

## Context management
- If a task is large or multi-part (e.g. redesign a whole page, build a new feature end-to-end), suggest upfront whether it's better handled in a fresh conversation or split into sub-agents — don't wait until the conversation is already long.
- When wrapping up a long session, save anything important to memory before the user starts a new chat.

## Karpathy Skills — Coding Principles
*Behavioral guidelines to reduce common LLM coding mistakes.*

### 1. Think Before Coding
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Every changed line should trace directly to the user's request.
- If anything else looks off (dead code, potential bugs, bad patterns), flag it at the end of the response — don't silently ignore it, but don't fix it either. Let the user decide.

### 4. Goal-Driven Execution
- Transform tasks into verifiable goals before starting.
- For multi-step tasks, state a brief plan with a verify step for each.
- Strong success criteria let you loop independently — weak criteria ("make it work") require constant clarification.

## Three Brain Workflow
- If the user mentions **"Review"**: use the **OpenAI Codex CLI** (`codex`) to get a second opinion or analysis.
- If the user mentions **"Visuals"**: use the **Gemini CLI** (`gemini`) for image files and visual assets. Note: Gemini CLI cannot watch YouTube videos — for video analysis, direct the user to paste the URL into **claude.ai** (the web app) instead.
