import { useState, useRef } from 'react';

const SECTIONS = [
  {
    id: 'strengths',
    label: 'Academic strengths',
    color: 'teal',
    accent: '#0d9488',
    items: [
      { id: 's_math', label: 'Math' },
      { id: 's_ela', label: 'ELA' },
      { id: 's_reading', label: 'Reading' },
      { id: 's_writing', label: 'Writing' },
      { id: 's_science', label: 'Science' },
      { id: 's_social_studies', label: 'Social Studies' },
      { id: 's_phonics', label: 'Phonics' },
      { id: 's_problem_solving', label: 'Problem solving' },
      { id: 's_creativity', label: 'Creativity' },
      { id: 's_critical_thinking', label: 'Critical thinking' },
    ],
  },
  {
    id: 'struggles',
    label: 'Areas for growth',
    color: 'amber',
    accent: '#d97706',
    items: [
      { id: 'g_math', label: 'Math' },
      { id: 'g_ela', label: 'ELA' },
      { id: 'g_reading', label: 'Reading' },
      { id: 'g_writing', label: 'Writing' },
      { id: 'g_science', label: 'Science' },
      { id: 'g_social_studies', label: 'Social Studies' },
      { id: 'g_phonics', label: 'Phonics' },
      { id: 'g_comprehension', label: 'Reading comprehension' },
      { id: 'g_number_sense', label: 'Number sense' },
      { id: 'g_fluency', label: 'Reading fluency' },
    ],
  },
  {
    id: 'behavior',
    label: 'Social & behavior',
    color: 'violet',
    accent: '#7c3aed',
    items: [
      { id: 'b_participates', label: 'Participates actively' },
      { id: 'b_kind', label: 'Kind to peers' },
      { id: 'b_focused', label: 'Stays focused' },
      { id: 'b_effort', label: 'Strong effort' },
      { id: 'b_leadership', label: 'Shows leadership' },
      { id: 'b_growth', label: 'Showing recent growth' },
      { id: 'b_disruptive', label: 'Can be disruptive' },
      { id: 'b_off_task', label: 'Struggles to stay on task' },
      { id: 'b_social', label: 'Working on social skills' },
      { id: 'b_independent', label: 'Works well independently' },
      { id: 'b_cooperative', label: 'Works well in groups' },
      { id: 'b_self_advocacy', label: 'Asks for help when needed' },
    ],
  },
];

const CHIP_COLORS: Record<string, { active: string; inactive: string }> = {
  teal:   { active: 'bg-teal-600 text-white border-teal-600',       inactive: 'bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-700' },
  amber:  { active: 'bg-amber-500 text-white border-amber-500',     inactive: 'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700' },
  violet: { active: 'bg-violet-600 text-white border-violet-600',   inactive: 'bg-white text-slate-600 border-slate-200 hover:border-violet-400 hover:text-violet-700' },
};

const LENGTH_OPTIONS = [
  { id: 'short',  label: 'Short',  hint: '1–2 sentences' },
  { id: 'medium', label: 'Medium', hint: '3–4 sentences' },
  { id: 'long',   label: 'Long',   hint: '5–6 sentences' },
];

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short:  'Write exactly 1-2 sentences.',
  medium: 'Write exactly 3-4 sentences.',
  long:   'Write exactly 5-6 sentences.',
};

function buildPrompt(name: string, selected: Set<string>, extra: string, length: string) {
  const strengths = SECTIONS[0].items.filter(i => selected.has(i.id)).map(i => i.label);
  const struggles = SECTIONS[1].items.filter(i => selected.has(i.id)).map(i => i.label);
  const behavior  = SECTIONS[2].items.filter(i => selected.has(i.id)).map(i => i.label);

  const parts = [
    `Write a report card comment${name.trim() ? ` for a student named ${name.trim()}` : ''}.`,
    LENGTH_INSTRUCTIONS[length],
    strengths.length ? `Academic strengths: ${strengths.join(', ')}.` : '',
    struggles.length ? `Areas for growth: ${struggles.join(', ')}.` : '',
    behavior.length  ? `Social and behavior observations: ${behavior.join(', ')}.` : '',
    extra.trim()     ? `Additional context from the teacher: ${extra.trim()}.` : '',
    'Be warm, specific, and professional. Do not use hollow phrases like "a pleasure to have in class." Write as if the teacher genuinely knows this student. Never use em dashes (—) under any circumstances.',
  ];

  return parts.filter(Boolean).join(' ');
}

function useSpeechToText(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  function toggle() {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  return { listening, toggle };
}

export default function FreeTool() {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState('');
  const [refineInstructions, setRefineInstructions] = useState('');
  const [length, setLength] = useState('medium');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const extraMic  = useSpeechToText(text => setExtra(prev => (prev ? prev + ' ' : '') + text));
  const refineMic = useSpeechToText(text => setRefineInstructions(prev => (prev ? prev + ' ' : '') + text));

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function callApi(prompt: string) {
    const res = await fetch('/api/free-tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? 'Something went wrong.');
    return data.comment as string;
  }

  async function generate() {
    if (selected.size === 0) { setError('Please select at least one option.'); return; }
    setError('');
    setResult('');
    setLoading(true);
    try {
      setResult(await callApi(buildPrompt(name, selected, extra, length)));
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    if (!result) return;
    setError('');
    setLoading(true);
    try {
      const instructions = refineInstructions.trim()
        ? `Teacher instructions: ${refineInstructions.trim()}`
        : 'Make it sound more natural and human — less generic.';
      const prompt = `Here is a report card comment: "${result}"\n\nRewrite it based on these instructions: ${instructions}\n\nKeep the same student name (if any) and same length. Never use em dashes (—) under any circumstances.`;
      setResult(await callApi(prompt));
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setResult(''); setName(''); setSelected(new Set()); setExtra(''); setRefineInstructions(''); setError('');
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <a href="https://shorthand-website.vercel.app" className="inline-flex items-center gap-2 mb-5 group">
            <img src="/icon-192.png" alt="ShortHand" className="w-7 h-7 rounded-lg" />
            <span className="text-sm font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">ShortHand</span>
          </a>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Report Card Comment Generator
          </h1>
          <p className="text-slate-500 text-sm">Free · No sign-up · Ready in 10 seconds</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 divide-y divide-slate-100">

          {/* Student name */}
          <div className="p-6">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Student name <span className="normal-case font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm transition"
            />
          </div>

          {/* Chip sections */}
          {SECTIONS.map(section => {
            const colors = CHIP_COLORS[section.color];
            return (
              <div key={section.id} className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full" style={{ background: section.accent }} />
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {section.label} <span className="normal-case font-normal text-slate-400">(pick all that apply)</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selected.has(item.id) ? colors.active : colors.inactive
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Length */}
          <div className="p-6">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Comment length</label>
            <div className="flex gap-2">
              {LENGTH_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setLength(opt.id)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                    length === opt.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-xs font-normal mt-0.5 ${length === opt.id ? 'text-slate-400' : 'text-slate-400'}`}>{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Extra context */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Anything else? <span className="normal-case font-normal text-slate-400">(optional)</span>
              </label>
              <button
                type="button"
                onClick={extraMic.toggle}
                title="Speak instead of type"
                className={`text-base px-2 py-1 rounded-lg transition-colors ${extraMic.listening ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🎤
              </button>
            </div>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="e.g. loves soccer, recently moved schools, made big progress this term"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none transition"
            />
          </div>

          {/* Generate */}
          <div className="p-6">
            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            <button
              onClick={generate}
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm tracking-wide shadow-sm"
            >
              {loading ? 'Generating…' : 'Generate comment →'}
            </button>
          </div>
        </div>

        {/* Result card */}
        {result && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="text-slate-800 text-sm leading-relaxed flex-1">{result}</p>
            </div>

            {/* Refine */}
            <div className="mb-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Refine <span className="normal-case font-normal text-slate-400">(tell AI what to change)</span>
                </label>
                <button
                  type="button"
                  onClick={refineMic.toggle}
                  className={`text-base px-2 py-1 rounded-lg transition-colors ${refineMic.listening ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  🎤
                </button>
              </div>
              <textarea
                value={refineInstructions}
                onChange={e => setRefineInstructions(e.target.value)}
                placeholder="e.g. don't mention math, or add something about her growth mindset"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none transition"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-sm"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <button
                onClick={refine}
                disabled={loading}
                className="flex-1 border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Refining…' : 'Refine'}
              </button>
              <button
                onClick={reset}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-medium"
              >
                New
              </button>
            </div>

            {/* Upsell */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm mb-3">Want to do this for your whole class in 2 minutes?</p>
              <a
                href="https://shorthand-website.vercel.app"
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
              >
                Try ShortHand free →
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Built by a teacher, for teachers. &nbsp;
          <a href="https://shorthand-website.vercel.app" className="underline hover:text-slate-600 transition-colors">shorthand-website.vercel.app</a>
        </p>

      </div>
    </div>
  );
}
