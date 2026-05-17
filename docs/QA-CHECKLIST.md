# ShortHand QA Checklist

Use this after every feature or bug fix before closing the chat with Claude.

---

## After every change — ask Claude this first

Before we call this done, review the change and tell me:
1. Which checklist items below are affected by this change?
2. Which ones do I need to manually test right now?
3. Any data or privacy risk introduced?
4. Any Supabase table or RLS policy involved?
5. Should this failure mode send a custom Sentry log?
6. Any risk to Android back button behavior?

Do not make new changes yet. Just analyze first.

---

## Core flows (manual test after any related change)

- [ ] Add a student
- [ ] Add a note to a student
- [ ] Edit a note
- [ ] Delete a note
- [ ] Generate a parent message from a note
- [ ] Save a parent communication
- [ ] Switch between classes
- [ ] Open settings and change something
- [ ] Use the Android back button to go back from settings

---

## Data safety (check after any Supabase or query change)

- [ ] Teacher can only see their own students
- [ ] Teacher can only see their own notes
- [ ] Teacher can only see their own communications
- [ ] Teacher can only see their own classes
- [ ] A logged-out user cannot access any app data
- [ ] Teacher A cannot edit or delete Teacher B's records

---

## UI safety (check after any layout or theme change)

- [ ] Mobile layout looks correct
- [ ] Desktop layout looks correct
- [ ] Dark mode works using `.dark` class only (no Tailwind `dark:` variants)
- [ ] Destructive actions (delete, wipe) are small text links, not big buttons

---

## Error handling (check after any new feature)

- [ ] Failed Supabase save shows a useful toast or message
- [ ] Loading states appear on async actions
- [ ] AI generation failure (parent message, etc.) shows a helpful message
- [ ] Sentry will catch unexpected crashes in this flow

---

## Risky files — stop and explain risk before editing these

If any change touches these files, Claude should explain the security/data impact before writing code:

- `App.tsx`
- `src/lib/supabase.ts`
- `src/lib/auth.ts`
- `src/hooks/useClassroomData.ts`
- Any Supabase migration or RLS policy SQL
- Settings save/load logic
- Any file touching student or note data directly

---

## Before deploy

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes (TypeScript, no emit)
- [ ] Main flows tested manually above
- [ ] No new `dark:` Tailwind variants introduced
- [ ] No API keys or secrets in code or responses

---

## After a database change

- [ ] Did this add a new table? Add RLS policies immediately.
- [ ] Did this add a new column? Confirm it does not expose data across teachers.
- [ ] Did this add a new query? Confirm it filters by `user_id` or equivalent.
- [ ] Ask Codex or Gemini to review the RLS impact if uncertain.
