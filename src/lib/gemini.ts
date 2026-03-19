import { Note } from "../types";

// @ts-ignore
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;

async function callGroq(prompt: string, isJson: boolean, imageData?: { data: string; mimeType: string }): Promise<string> {
  if (!GROQ_API_KEY) {
    console.error('Missing VITE_GROQ_API_KEY in environment');
    throw new Error("Missing GROQ API key");
  }

  let messages: any[];

  if (imageData && imageData.mimeType.startsWith('image/')) {
    // Vision request — use llama vision model
    const base64 = imageData.data.includes(',') ? imageData.data.split(',')[1] : imageData.data;
    messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${imageData.mimeType};base64,${base64}` } },
        { type: 'text', text: prompt }
      ]
    }];
  } else {
    messages = [{ role: 'user', content: prompt }];
  }

  const model = imageData?.mimeType.startsWith('image/') ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: isJson ? { type: 'json_object' } : undefined
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

export async function extractRotationMapping(fileData: string, mimeType: string) {
  const prompt = `Analyze this school calendar or rotation schedule (e.g., 'Special Area Calendar.pdf').
            I need to map specific dates to their "Letter Days" (e.g., A, B, C, D, E).

            1. Look for a sequence of days (usually A-E or A-F).
            2. Extract EVERY school date and its corresponding Letter Day for the entire academic year shown.
            3. Ignore weekends and major holidays (only map days where a Letter Day is explicitly assigned).
            4. Snow days or unexpected school closings should NOT shift the sequence in this extraction; just give me the static mapping as printed on the provided calendar.
            5. Ensure the year is correct (2025-2026). If a date is "9/2", return it as "2025-09-02".

            Return a JSON object where keys are "YYYY-MM-DD" and values are the Letter Day (e.g., "A"): { "2025-09-02": "A", "2025-09-03": "B", ... }.

            IMPORTANT: Map EVERY date found. If a month is missing or cutoff, do your best with what is visible.`;

  const imageData = mimeType.startsWith('image/') ? { data: fileData, mimeType } : undefined;
  const text = await callGroq(prompt, true, imageData);

  try {
    let cleanText = text || '{}';
    const objStart = cleanText.indexOf('{');
    const objEnd = cleanText.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1) {
      cleanText = cleanText.substring(objStart, objEnd + 1);
    }
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse Rotation JSON:", e);
    return {};
  }
}

export async function performSmartScan(fileData: string, mimeType: string) {
  const prompt = `Analyze this document (likely a school calendar or schedule screenshot).
            Specifically look for a "Chronological List" of dates and events.
            Identify any text that looks like a date (e.g., "3/20", "March 20th", "Next Tuesday").
            If the scan is messy, prioritize "Bold" text or "Headers" as those are usually the event titles.

            Extract events such as:
            - School Holidays / Days Off
            - Early Dismissals / Half Days
            - Parent-Teacher Conference Windows
            - Any other notable school events

            Format Standardizer: Automatically convert all found dates into a strict standard format: "YYYY-MM-DD" (e.g., "2026-03-20" or "2026-04-04"). This is required to prevent "Invalid Date" errors in the system.
            IMPORTANT: Assume the current academic year is 2025-2026. Do NOT default to year 2001. If a year is not specified, infer it based on a typical US school year starting in August 2025 and ending in June 2026.
            Date Sorting: Ensure the final JSON array is sorted by the soonest date first.

            Return a JSON array of objects EXCLUSIVELY: [{ "date": "YYYY-MM-DD", "type": "Holiday" | "Early Dismissal" | "Conference" | "Other", "title": "Name of event paired with the date" }]. Do NOT wrap the array in an object like { "events": [...] }.`;

  const imageData = mimeType.startsWith('image/') ? { data: fileData, mimeType } : undefined;
  const text = await callGroq(prompt, true, imageData);

  try {
    let cleanText = text || '[]';

    const arrayStart = cleanText.indexOf('[');
    const arrayEnd = cleanText.lastIndexOf(']');

    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        cleanText = cleanText.substring(arrayStart, arrayEnd + 1);
    } else {
        const objStart = cleanText.indexOf('{');
        const objEnd = cleanText.lastIndexOf('}');
        if(objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
             cleanText = cleanText.substring(objStart, objEnd + 1);
        }
    }

    let parsed = JSON.parse(cleanText);

    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.events)) {
        parsed = parsed.events;
    } else if (parsed && !Array.isArray(parsed)) {
        const arrayProps = Object.values(parsed).filter(val => Array.isArray(val));
        if (arrayProps.length > 0) {
            parsed = arrayProps[0];
        } else {
            parsed = [];
        }
    }

    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse JSON from AI response:", e);
    return [];
  }
}

export async function categorizeNote(content: string, currentTime: string, hasImage: boolean, availableIndicators: string[] = []) {
  const indicatorList = availableIndicators.length > 0
    ? availableIndicators.join(', ')
    : 'Behavior, Academic, Social, Attendance, Health, Other';

  const prompt = `You are a conservative note categorizer for a teacher app. Categorize this student observation note.

Note: "${content}"
Current time: ${currentTime}
Has image: ${hasImage}
Available tags: ${indicatorList}

STRICT RULES — follow these exactly:
- Only apply a tag if the note DIRECTLY and CLEARLY describes that behavior or situation.
- Do NOT infer intent, assume what might have happened, or add tags based on what could be implied.
- Do NOT apply multiple tags unless the note explicitly describes multiple distinct situations.
- A student being on the wrong website is NOT a "disruption" unless the note explicitly says they disturbed other students.
- A "technical issue" means a device or software malfunction — NOT student misuse or rule-breaking.
- If a note is about rule-breaking or off-task behavior, use "Behavior" only — do not also add "Academic" or other tags unless they are clearly described.
- If no tag fits clearly, return an empty array [].
- Prefer fewer tags over more. One tag is usually correct. Two is rarely needed. Three is almost never right.

Return a JSON object:
- tags: array of strings (use exact tag names from the available list, or [] if none fit)
- sentiment: "Positive", "Neutral", or "Negative"`;

  const responseText = await callGroq(prompt, true);

  try {
    const parsed = JSON.parse(responseText || '{"tags":[],"sentiment":"Neutral"}');
    // Ensure tags is always an array
    if (!Array.isArray(parsed.tags)) parsed.tags = [];
    return parsed;
  } catch (e) {
    return { tags: [], sentiment: "Neutral" };
  }
}

export async function summarizeNotes(notes: Note[], length: 'Quick Pulse' | 'Standard' | 'Detailed' = 'Standard') {
  const notesText = notes.map(n => `[${new Date(n.created_at).toLocaleDateString()}] ${n.student_name}: ${n.content}`).join('\n');

  const toneRules = `
TONE AND FORMAT RULES:
- 8th Grade Reading Level: Use simple, direct language. No academic jargon like 'demonstrates,' 'interpersonal skills,' or 'prosocial.'
- South Jersey Teacher Vibe: Write it like a warm, supportive teacher talking to a parent over coffee. Use phrases like "He's doing great with..." or "We're working on...".
- Format: Keep the Glow, Grow, Goal structure, but make the headers bold (e.g., **Glow:**).
- Brevity: Keep each section to 2-3 sentences max.
- Trend Analysis: Please look at the existing notes and compare them to previous observations to identify any repeating patterns or improvements.
`;

  let lengthInstruction = "";
  if (length === 'Quick Pulse') {
    lengthInstruction = "Make this extra brief, maybe just one sentence per section.";
  } else if (length === 'Detailed') {
    lengthInstruction = "You can add a warm opening and closing sentence, but strict 2-3 sentences per section still applies.";
  }

  const prompt = `Summarize these student observations.\n${toneRules}\n${lengthInstruction}\n\nNotes:\n${notesText}`;
  return await callGroq(prompt, false);
}

export async function refineReport(currentContent: string, instructions: string) {
  const prompt = `Here is a student progress report:

"${currentContent}"

The teacher wants to refine this report with the following instructions:
"${instructions}"

Please rewrite the report based on these instructions while maintaining the Glow, Grow, Goal structure and the South Jersey Teacher Vibe (8th grade reading level, warm, supportive, no jargon).

IMPORTANT: Return ONLY the revised report text. Do not include any introduction, explanation, or commentary such as "Here is a revised version..." — the output will be copied directly into a parent email.`;

  return await callGroq(prompt, false);
}

export async function magicImport(rosterText: string) {
  const prompt = `Extract student information from this messy roster text:
      "${rosterText}"

      Return a JSON object with a "students" array. Each student object must have:
      - name: Full Name (Properly formatted)
      - parent_guardian_names: Array of Parent/Guardian Names (if found, else empty array)
      - parent_emails: Array of objects { value: string, label: string } (Labels like "Home", "Work", "Personal", etc.)
      - parent_phones: Array of objects { value: string, label: string } (Labels like "Cell", "Home", "Work", etc.)
      - class_name: The name of the class or section (e.g. "Homeroom", "Science Block B", "AM", "PM")

      Example: { "students": [{ "name": "Jane Doe", "parent_guardian_names": ["John Doe"], "parent_emails": [], "parent_phones": [], "class_name": "AM" }] }`;

  const responseText = await callGroq(prompt, true);

  try {
    const parsed = JSON.parse(responseText || '{}');
    // Handle both { students: [...] } and direct array responses
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.students)) return parsed.students;
    return [];
  } catch (e) {
    return [];
  }
}

export async function draftParentSquareMessage(content: string, studentName: string) {
  const prompt = `Draft a professional and supportive ParentSquare message based on this observation:
      Student: ${studentName}
      Observation: ${content}

      The tone should be collaborative and focus on student growth.`;
  return await callGroq(prompt, false);
}

export async function parseVoiceLog(transcript: string, students: string[], indicators: string[]) {
  const prompt = `Parse this teacher's voice note: "${transcript}".

      Available Students: ${students.join(', ')}
      Available Indicators: ${indicators.join(', ')}

      Extract:
      1. student_name: The name of the student mentioned (must match one from the list if possible, else return the name found).
      2. content: The core observation/note without the student's name.
      3. tags: Array of indicators that match the sentiment or keywords.

      Return as JSON object with fields: student_name, content, tags.`;

  const responseText = await callGroq(prompt, true);

  try {
    return JSON.parse(responseText || 'null');
  } catch (e) {
    return null;
  }
}

export async function suggestAbbreviations(noteContents: string[]): Promise<Array<{ abbreviation: string; expansion: string }>> {
  const sample = noteContents.slice(0, 50).join('\n');
  const prompt = `Analyze these teacher observation notes and identify short abbreviations or acronyms that appear frequently and could save time if auto-expanded.

Notes:
${sample}

Return a JSON object with an "abbreviations" array of up to 8 suggestions, each with:
- abbreviation: the short form found in the notes (e.g. "ss", "ela", "iep", "sw")
- expansion: what it likely means in a classroom context (e.g. "Social Studies", "English Language Arts", "Individualized Education Program", "social worker")

Only suggest abbreviations that appear at least twice OR are very common classroom abbreviations. Do not suggest single letters.
Example: { "abbreviations": [{ "abbreviation": "ss", "expansion": "Social Studies" }] }`;

  const responseText = await callGroq(prompt, true);

  try {
    const parsed = JSON.parse(responseText || '{}');
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.abbreviations)) return parsed.abbreviations;
    return [];
  } catch (e) {
    return [];
  }
}

export async function summarizeClassPeriod(notes: Note[], className: string): Promise<string> {
  const notesText = notes
    .map(n => `[${new Date(n.created_at).toLocaleDateString()}] ${n.student_name || n.class_name || 'Class'}: ${n.content}`)
    .join('\n');

  const prompt = `You are summarizing observation notes for a class period called "${className}" for a teacher.

Notes:
${notesText}

Write a concise, clear summary (3-6 sentences) of what was observed across this class during this period. Group themes — highlight what went well, any patterns of concern, and any standout moments. Use plain language, no jargon. Do not address parents — this is for the teacher's own record.`;

  const responseText = await callGroq(prompt, false);
  return responseText.trim();
}

export async function queryStudentInsights(prompt: string): Promise<string> {
  const result = await callGroq(prompt, false);
  return (result || '').trim();
}
