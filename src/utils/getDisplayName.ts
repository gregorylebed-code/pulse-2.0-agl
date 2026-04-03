import { Student } from '../types';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return `${parts[0][0].toUpperCase()}.${parts[parts.length - 1][0].toUpperCase()}.`;
}

export function getDisplayName(student: Student, aliasMode: boolean): string {
  if (!aliasMode) return student.name;
  if (student.alias) return student.alias;
  return getInitials(student.name);
}

export function getDisplayFirst(student: Student, aliasMode: boolean): string {
  const full = getDisplayName(student, aliasMode);
  return full.split(' ')[0];
}
