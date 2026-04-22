import { Note, Student } from '../types';
import { queryStudentInsights } from '../lib/gemini';

export async function askAboutStudents(
  question: string,
  notes: Note[],
  students: Student[]
): Promise<string> {
  const studentList = students.map(s => s.name).join(', ');

  const notesContext = notes
    .map(n =>
      `[${new Date(n.created_at).toLocaleDateString()}] ${n.student_name}: ${n.content}` +
      (n.tags?.length ? ` (${n.tags.join(', ')})` : '')
    )
    .join('\n');

  const prompt = `You are a helpful assistant for a classroom teacher. Answer the question below based ONLY on the observation notes provided. Be specific, reference student names and dates when available. If no relevant notes exist for the question, say so clearly and briefly.

Students: ${studentList}

Observation Notes:
${notesContext || 'No notes recorded yet.'}

Teacher's Question: "${question}"

Answer directly and concisely. Do not add disclaimers or repeat the question.`;

  return queryStudentInsights(prompt);
}
