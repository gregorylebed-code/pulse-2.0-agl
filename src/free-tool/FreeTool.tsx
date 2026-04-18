import { useState } from 'react';

const BEHAVIORS = [
  { id: 'participates', label: 'Participates in class' },
  { id: 'kind', label: 'Kind to peers' },
  { id: 'focused', label: 'Stays focused' },
  { id: 'effort', label: 'Shows strong effort' },
  { id: 'struggles_focus', label: 'Struggles to stay on task' },
  { id: 'struggles_reading', label: 'Struggles with reading' },
  { id: 'struggles_math', label: 'Struggles with math' },
  { id: 'disruptive', label: 'Can be disruptive' },
  { id: 'growth', label: 'Showing recent growth' },
  { id: 'leadership', label: 'Shows leadership' },
];

export default function FreeTool() {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function generate() {
    if (!name.trim()) { setError('Please enter a student name.'); return; }
    if (selected.size === 0) { setError('Please select at least one behavior.'); return; }
    setError('');
    setResult('');
    setLoading(true);

    const behaviors = BEHAVIORS.filter(b => selected.has(b.id)).map(b => b.label);
    const prompt = [
      `Write a 2-3 sentence report card comment for a student named ${name.trim()}.`,
      `Observed behaviors: ${behaviors.join(', ')}.`,
      extra.trim() ? `Additional context: ${extra.trim()}.` : '',
      'Be warm, specific, and professional. Do not use hollow phrases like "a pleasure to have in class." Focus on what the teacher actually observed.',
    ].filter(Boolean).join(' ');

    try {
      const res = await fetch('/api/free-tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Something went wrong.');
      setResult(data.comment);
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">

          {/* Student name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Student name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm"
            />
          </div>

          {/* Behavior tags */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">What did you observe? <span className="font-normal text-slate-400">(pick all that apply)</span></label>
            <div className="flex flex-wrap gap-2">
              {BEHAVIORS.map(b => (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selected.has(b.id)
                      ? 'bg-teal-500 text-white border-teal-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional extra */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Anything else? <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="e.g. loves soccer, recently moved schools, made big progress in November"
              rows={2}
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 text-sm resize-none"
            />
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
            <div className="flex gap-3">
              <button
                onClick={copy}
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </button>
              <button
                onClick={() => { setResult(''); setName(''); setSelected(new Set()); setExtra(''); }}
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
