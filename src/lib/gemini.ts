import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Note } from "../types";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || ''
});

// Helper for Groq/Llama fallback
async function callGroqBackup(prompt: string, isJson: boolean) {
  // @ts-ignore
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  
  if (!apiKey) {
    console.error('Missing VITE_GROQ_API_KEY in environment');
    throw new Error("Missing backup API key");
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: isJson ? { type: "json_object" } : undefined
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Dispatch event for UI
  window.dispatchEvent(new CustomEvent('gemini-fallback-triggered'));
  
  return content;
}

// Centralized wrapper for Gemini with Fallback
async function safeGenerateContent(config: {
  prompt: string;
  isJson?: boolean;
  mimeType?: string;
  fileData?: string;
  schema?: any;
}) {
  try {
    let contents: any;
    
    if (config.fileData && config.mimeType) {
      contents = {
        parts: [
          { inlineData: { data: config.fileData.split(',')[1] || config.fileData, mimeType: config.mimeType } },
          { text: config.prompt }
        ]
      };
    } else {
      contents = {
        parts: [{ text: config.prompt }]
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: config.isJson ? { responseMimeType: "application/json", responseSchema: config.schema } : undefined
    });

    return response.text;
  } catch (err: any) {
    // If rate limited (429) or other failure, try fallback
    const isRateLimit = err.message?.includes('429') || err.status === 429;
    
    if (isRateLimit || err) {
      console.warn("Gemini failure, switching to Llama backup:", err.message);
      try {
        return await callGroqBackup(config.prompt, !!config.isJson);
      } catch (fallbackErr) {
        console.error("Backup failed too:", fallbackErr);
        throw err; // Throw original error if fallback fails
      }
    }
    throw err;
  }
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

  const text = await safeGenerateContent({
    prompt,
    fileData,
    mimeType,
    isJson: true
  });

  try {
    let cleanText = text || '{}';
    // Extraction logic similar to performSmartScan
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

  const text = await safeGenerateContent({
    prompt,
    fileData,
    mimeType,
    isJson: true
  });

  try {
    let cleanText = text || '[]';
    
    // Aggressive JSON Array Extraction for Llama Fallback
    const arrayStart = cleanText.indexOf('[');
    const arrayEnd = cleanText.lastIndexOf(']');
    
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
        cleanText = cleanText.substring(arrayStart, arrayEnd + 1);
    } else {
        // Fallback: If no array brackets found, it might be an object wrapping the array
        const objStart = cleanText.indexOf('{');
        const objEnd = cleanText.lastIndexOf('}');
        if(objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
             cleanText = cleanText.substring(objStart, objEnd + 1);
        }
    }

    let parsed = JSON.parse(cleanText);
    
    // Llama fallback fix: Handle case where it returned an object like { events: [...] }
    if (parsed && !Array.isArray(parsed) && Array.isArray(parsed.events)) {
        parsed = parsed.events;
    } else if (parsed && !Array.isArray(parsed)) {
        // If it's an object but doesn't have an events array, try to find an array property
        const arrayProps = Object.values(parsed).filter(val => Array.isArray(val));
        if (arrayProps.length > 0) {
            parsed = arrayProps[0];
        } else {
            parsed = []; // Fallback to empty array if no array found
        }
    }
    
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse JSON from AI response:", e);
    return [];
  }
}

export async function categorizeNote(content: string, currentTime: string, hasImage: boolean, availableIndicators: string[] = []) {
  const indicatorContext = availableIndicators.length > 0 
    ? `Choose from these specific indicators if they apply: ${availableIndicators.join(', ')}. Otherwise, use general categories.`
    : `Choose from: Behavior, Academic, Social, Attendance, Health, Other.`;

  const prompt = `Categorize this student observation note: "${content}". 
      Current time is ${currentTime}. 
      Note has image: ${hasImage}.
      ${indicatorContext}
      Return a JSON object with:
      - tags: array of strings
      - sentiment: string (Positive, Neutral, Negative)`;

  const responseText = await safeGenerateContent({
    prompt,
    isJson: true,
    schema: {
      type: Type.OBJECT,
      properties: {
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        sentiment: { type: Type.STRING }
      },
      required: ["tags", "sentiment"]
    }
  });

  try {
    return JSON.parse(responseText || '{"tags":["Other"],"sentiment":"Neutral"}');
  } catch (e) {
    return { tags: ["Other"], sentiment: "Neutral" };
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
  return await safeGenerateContent({ prompt });
}
export async function refineReport(currentContent: string, instructions: string) {
  const prompt = `Here is a student progress report:
      
"${currentContent}"

The teacher wants to refine this report with the following instructions:
"${instructions}"

Please rewrite the report based on these instructions while maintaining the Glow, Grow, Goal structure and the South Jersey Teacher Vibe (8th grade reading level, warm, supportive, no jargon).`;

  return await safeGenerateContent({ prompt });
}

export async function magicImport(rosterText: string) {
  const prompt = `Extract student information from this messy roster text:
      "${rosterText}"
      
      Return a JSON array of objects, each with:
      - name: Full Name (Properly formatted)
      - parent_guardian_names: Array of Parent/Guardian Names (if found, else empty array)
      - parent_emails: Array of objects { value: string, label: string } (Labels like "Home", "Work", "Personal", etc.)
      - parent_phones: Array of objects { value: string, label: string } (Labels like "Cell", "Home", "Work", etc.)
      - class_name: The name of the class or section (e.g. "Homeroom", "Science Block B", "AM", "PM")`;

  const responseText = await safeGenerateContent({
    prompt,
    isJson: true,
    schema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          parent_guardian_names: { type: Type.ARRAY, items: { type: Type.STRING } },
          parent_emails: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                label: { type: Type.STRING }
              },
              required: ["value", "label"]
            } 
          },
          parent_phones: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT,
              properties: {
                value: { type: Type.STRING },
                label: { type: Type.STRING }
              },
              required: ["value", "label"]
            } 
          },
          class_name: { type: Type.STRING }
        },
        required: ["name", "class_name", "parent_guardian_names", "parent_emails", "parent_phones"]
      }
    }
  });

  try {
    return JSON.parse(responseText || '[]');
  } catch (e) {
    return [];
  }
}

export async function draftParentSquareMessage(content: string, studentName: string) {
  const prompt = `Draft a professional and supportive ParentSquare message based on this observation:
      Student: ${studentName}
      Observation: ${content}
      
      The tone should be collaborative and focus on student growth.`;
  return await safeGenerateContent({ prompt });
}

export async function parseVoiceLog(transcript: string, students: string[], indicators: string[]) {
  const prompt = `Parse this teacher's voice note: "${transcript}".
      
      Available Students: ${students.join(', ')}
      Available Indicators: ${indicators.join(', ')}
      
      Extract:
      1. student_name: The name of the student mentioned (must match one from the list if possible, else return the name found).
      2. content: The core observation/note without the student's name.
      3. tags: Array of indicators that match the sentiment or keywords.
      
      Return as JSON.`;

  const responseText = await safeGenerateContent({
    prompt,
    isJson: true,
    schema: {
      type: Type.OBJECT,
      properties: {
        student_name: { type: Type.STRING },
        content: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["student_name", "content", "tags"]
    }
  });

  try {
    return JSON.parse(responseText || 'null');
  } catch (e) {
    return null;
  }
}
