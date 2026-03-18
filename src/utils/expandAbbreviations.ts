export interface Abbreviation {
  id: string;
  abbreviation: string;
  expansion: string;
  caseSensitive: boolean;
}

export function expandAbbreviations(content: string, abbreviations: Abbreviation[]): string {
  if (!abbreviations || abbreviations.length === 0) return content;
  let result = content;
  for (const abbr of abbreviations) {
    if (!abbr.abbreviation || !abbr.expansion) continue;
    const escaped = abbr.abbreviation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = abbr.caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(`\\b${escaped}\\b`, flags);
    result = result.replace(regex, abbr.expansion);
  }
  return result;
}
