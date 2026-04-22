import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Note, Student } from '../../types';

// Mock the AI call so tests never hit the network.
vi.mock('../../lib/gemini', () => ({
  queryStudentInsights: vi.fn(async (prompt: string) => prompt),
}));

import { askAboutStudents } from '../aiAssistant';
import { queryStudentInsights } from '../../lib/gemini';

const mockQuery = vi.mocked(queryStudentInsights);

function makeStudent(name: string): Student {
  return { id: '1', name, class_id: null, user_id: 'u1', created_at: '2024-01-01' };
}

function makeNote(overrides: Partial<Note> & { student_name: string; content: string; created_at: string }): Note {
  return {
    id: '1',
    student_id: '1',
    user_id: 'u1',
    tags: [],
    image_url: null,
    is_parent_communication: false,
    parent_communication_type: null,
    is_pinned: false,
    ...overrides,
  };
}

beforeEach(() => mockQuery.mockClear());

describe('askAboutStudents', () => {
  it('includes all student first names in the prompt', async () => {
    const students = [makeStudent('Jane Smith'), makeStudent('Bob Jones')];
    await askAboutStudents('Who struggled today?', [], students);
    const prompt = mockQuery.mock.calls[0][0];
    expect(prompt).toContain('Jane');
    expect(prompt).toContain('Bob');
  });

  it('uses first name only, not full name', async () => {
    await askAboutStudents('q', [], [makeStudent('Jane Smith')]);
    const prompt = mockQuery.mock.calls[0][0];
    expect(prompt).not.toContain('Smith');
  });

  it('includes the teacher question in the prompt', async () => {
    await askAboutStudents('Who was off task?', [], [makeStudent('Jane')]);
    const prompt = mockQuery.mock.calls[0][0];
    expect(prompt).toContain('Who was off task?');
  });

  it('formats note content with date and student first name', async () => {
    const note = makeNote({ student_name: 'Jane Smith', content: 'distracted', created_at: '2024-09-09T00:00:00Z' });
    await askAboutStudents('q', [note], [makeStudent('Jane Smith')]);
    const prompt = mockQuery.mock.calls[0][0];
    expect(prompt).toContain('Jane');
    expect(prompt).toContain('distracted');
  });

  it('includes tags when present', async () => {
    const note = makeNote({ student_name: 'Jane', content: 'great work', created_at: '2024-09-09T00:00:00Z', tags: ['positive', 'math'] });
    await askAboutStudents('q', [note], [makeStudent('Jane')]);
    const prompt = mockQuery.mock.calls[0][0];
    expect(prompt).toContain('positive');
    expect(prompt).toContain('math');
  });

  it('omits tag section when tags array is empty', async () => {
    const note = makeNote({ student_name: 'Jane', content: 'quiet', created_at: '2024-09-09T00:00:00Z', tags: [] });
    await askAboutStudents('q', [note], [makeStudent('Jane')]);
    const prompt = mockQuery.mock.calls[0][0];
    // No parenthesised tag list should appear after the note content
    expect(prompt).not.toMatch(/quiet \(/);
  });

  it('falls back to "No notes recorded yet." when notes array is empty', async () => {
    await askAboutStudents('q', [], [makeStudent('Jane')]);
    const prompt = mockQuery.mock.calls[0][0];
    expect(prompt).toContain('No notes recorded yet.');
  });

  it('returns whatever queryStudentInsights resolves with', async () => {
    mockQuery.mockResolvedValueOnce('AI answer here');
    const result = await askAboutStudents('q', [], [makeStudent('Jane')]);
    expect(result).toBe('AI answer here');
  });
});
