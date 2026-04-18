import { useState, useRef } from 'react';

const SECTIONS = [
  {
    id: 'strengths',
    label: 'Academic strengths',
    color: 'teal',
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
  teal:   { active: 'bg-teal-500 text-white border-teal-500',     inactive: 'bg-white text-slate-600 border-slate-200 hover:border-teal-300' },
  amber:  { active: 'bg-amber-400 text-white border-amber-400',   inactive: 'bg-white text-slate-600 border-slate-200 hover:border-amber-300' },
  violet: { active: 'bg-violet-500 text-white border-violet-500', inactive: 'bg-white text-slate-600 border-slate-200 hover:border-violet-300' },
};

const LENGTH_OPTIONS = [
  { id: 'short', label: 'Short', hint: '1–2 sentences' },
  { id: 'medium', label: 'Medium', hint: '3–4 sentences' },
  { id: 'long', label: 'Long', hint: '5–6 sentences' },
];

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: 'Write exactly 1-2 sentences.',
  medium: 'Write exactly 3-4 sentences.',
  long: 'Write exactly 5-6 sentences.',
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

  const extraMic = useSpeechToText(text => setExtra(prev => (prev ? prev + ' ' : '') + text));
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
    setResult(''); setName(''); setSelected(new Set()); setExtra(''); setError('');
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <img src="/icon-192.png" alt="ShortHand" className="w-8 h-8 rounded-lg" />
            <span className="text-slate-500 font-medium">ShortHand</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Report Card Comment Generator</h1>
          <p className="text-slate-500 text-sm">Free. No sign-up. Takes 10 seconds.</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">

          {/* Student name — optional */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Student name <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
          </div>

          {/* Three chip sections */}
          {SECTIONS.map(section => {
            const colors = CHIP_COLORS[section.color];
            return (
              <div key={section.id}>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {section.label} <span className="font-normal text-slate-400">(pick all that apply)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggle(item.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
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

          {/* Length selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Comment length</label>
            <div className="flex gap-2">
              {LENGTH_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setLength(opt.id)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-colors ${
                    length === opt.id
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${length === opt.id ? 'text-slate-300' : 'text-slate-400'}`}>{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Optional extra */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Anything else? <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <div className="relative">
              <textarea
                value={extra}
                onChange={e => setExtra(e.target.value)}
                placeholder="e.g. loves soccer, recently moved schools, made big progress this term"
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm resize-none"
              />
              <button
                type="button"
                onClick={extraMic.toggle}
                className={`absolute right-2.5 bottom-2.5 p-1 rounded-lg transition-colors ${extraMic.listening ? 'text-red-500' : 'text-slate-400 hover:text-slate-600'}`}
                title="Speak"
              >
                🎤
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={generate}
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            {loading ? 'Generating…' : 'Generate comment'}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <p className="text-slate-700 text-sm leading-relaxed mb-4">{result}</p>

            {/* Refine instructions */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Refine instructions <span className="font-normal">(optional — tell AI what to change)</span></label>
              <div className="relative">
                <textarea
                  value={refineInstructions}
                  onChange={e => setRefineInstructions(e.target.value)}
                  placeholder="e.g. don't mention math, or add something about her growth mindset"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-10 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm resize-none"
                />
                <button
                  type="button"
                  onClick={refineMic.toggle}
                  className={`absolute right-2.5 bottom-2.5 p-1 rounded-lg transition-colors ${refineMic.listening ? 'text-red-500' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Speak"
                >
                  🎤
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copy}
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
              <button
                onClick={refine}
                disabled={loading}
                className="flex-1 border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {loading ? 'Refining…' : 'Refine'}
              </button>
              <button
                onClick={reset}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm"
              >
                New
              </button>
            </div>

            {/* Soft upsell */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <p className="text-slate-500 text-sm mb-2">Want to do this for your whole class in 2 minutes?</p>
              <a
                href="https://getshorthand.app"
                className="inline-block bg-slate-800 hover:bg-slate-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                Try ShortHand free →
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Built by a teacher, for teachers. &nbsp;
          <a href="https://getshorthand.app" className="underline hover:text-slate-600">getshorthand.app</a>
        </p>
      </div>
    </div>
  );
}
