import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "../../lib/supabase";

type Mode = "app-pitch" | "resource-drop";

interface Slide {
  title: string;
  content: string;
}

const SLIDE_W = 1080;
const SLIDE_H = 1350;
const SCALE = 0.35;

async function callGroq(prompt: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch("/api/groq", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error(`Groq error: ${response.status}`);
  const data = await response.json();
  return data.choices[0].message.content as string;
}

function buildPrompt(input: string, mode: Mode): string {
  if (mode === "app-pitch") {
    return `You are writing slides for a teacher who talks like this: direct, blunt, no-BS. Short sentences. Tired but driven. Not a salesperson — a real teacher who found something that works.

Topic: "${input}"

The angle: manually writing parent emails and behavior reports takes too long. It burns time teachers don't have. ShortHand fixes that — it drafts them fast so you can move on.

Generate 5–7 slides. Each slide has a title (4 words max) and 1–2 sentences of body copy.

Rules:
- Sound like a real teacher, not a marketer
- No "desired outcomes." No "potentially." No "hey teachers." No emojis. No hashtags.
- Short sentences. Say the hard thing plainly.
- The content should make a tired teacher nod, not roll their eyes.

Return JSON: { "slides": [{ "title": "...", "content": "..." }] }`;
  }

  return `You are writing a 7-slide cheat sheet carousel for teachers. Purely informational. No sales pitch. No app mentions.

Topic: "${input}"

Structure:
- Slide 1: The "Why" — one blunt reason this topic matters
- Slides 2–6: Step-by-step instructions or high-value tips. Specific and actionable.
- Slide 7: "Follow for more no-fluff teaching assets." — exact words, no changes.

Each slide has a title (4 words max) and 1–2 sentences of body copy.

Rules:
- Logic-based and blunt. No warmth, no cheerleading.
- Short sentences. Cut anything that doesn't add information.
- No emojis. No hashtags. No "amazing" or "game-changer."

Return JSON: { "slides": [{ "title": "...", "content": "..." }] }`;
}

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  return (
    <div
      style={{ width: SLIDE_W, height: SLIDE_H, fontFamily: "monospace" }}
      className="bg-zinc-950 text-white flex flex-col justify-between p-[80px] box-border"
    >
      <div className="text-zinc-500 text-[28px] tracking-[0.3em] uppercase">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="flex flex-col gap-[48px]">
        <div className="w-[120px] h-[3px] bg-white" />
        <h2 className="text-[72px] font-bold leading-tight tracking-tight">
          {slide.title}
        </h2>
        <p className="text-[40px] leading-relaxed text-zinc-300">
          {slide.content}
        </p>
      </div>

      <div className="text-zinc-600 text-[24px] tracking-widest uppercase">
        ///
      </div>
    </div>
  );
}

export default function CarouselMaker() {
  const [mode, setMode] = useState<Mode>("app-pitch");
  const [vent, setVent] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  async function generateSlides() {
    if (!vent.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await callGroq(buildPrompt(vent, mode));
      const parsed = JSON.parse(raw);
      const result: Slide[] = Array.isArray(parsed.slides) ? parsed.slides : [];
      if (result.length === 0) throw new Error("No slides returned.");
      setSlides(result);
    } catch (e: any) {
      setError(e.message || "Failed to generate slides.");
    } finally {
      setLoading(false);
    }
  }

  async function exportImages() {
    setExporting(true);
    for (let i = 0; i < slides.length; i++) {
      const node = slideRefs.current[i];
      if (!node) continue;
      const dataUrl = await toPng(node, { pixelRatio: 1 });
      const link = document.createElement("a");
      link.download = `slide-${String(i + 1).padStart(2, "0")}.png`;
      link.href = dataUrl;
      link.click();
    }
    setExporting(false);
  }

  return (
    <div className="min-h-screen bg-black text-white font-mono p-8 flex flex-col gap-8">
      <a
        href="/"
        className="text-xs tracking-widest uppercase text-zinc-600 hover:text-white transition-colors"
      >
        ← Back to App
      </a>

      <h1 className="text-sm tracking-[0.4em] uppercase text-zinc-400">
        // Carousel Maker
      </h1>

      {/* Mode toggle */}
      <div className="flex items-center gap-4">
        <span
          className={`text-xs tracking-widest uppercase cursor-pointer transition-colors ${mode === "app-pitch" ? "text-white" : "text-zinc-600"}`}
          onClick={() => setMode("app-pitch")}
        >
          App Pitch
        </span>
        <button
          onClick={() => setMode(mode === "app-pitch" ? "resource-drop" : "app-pitch")}
          className="relative w-12 h-6 border border-zinc-600 focus:outline-none"
          aria-label="Toggle mode"
        >
          <div
            className={`absolute top-[3px] w-4 h-4 bg-white transition-all duration-200 ${mode === "resource-drop" ? "left-[26px]" : "left-[3px]"}`}
          />
        </button>
        <span
          className={`text-xs tracking-widest uppercase cursor-pointer transition-colors ${mode === "resource-drop" ? "text-white" : "text-zinc-600"}`}
          onClick={() => setMode("resource-drop")}
        >
          Resource Drop
        </span>
      </div>

      {/* Input */}
      <div className="flex flex-col gap-3">
        <label className="text-xs tracking-widest uppercase text-zinc-500">
          {mode === "app-pitch" ? "Raw thought" : "Cheat sheet topic"}
        </label>
        <textarea
          value={vent}
          onChange={(e) => setVent(e.target.value)}
          rows={5}
          placeholder={
            mode === "app-pitch"
              ? "e.g. writing parent emails takes 20 minutes every night..."
              : "e.g. how to handle a Tier 3 behavior in the hallway"
          }
          className="bg-zinc-950 border border-zinc-700 text-white font-mono text-sm p-4 resize-none focus:outline-none focus:border-white placeholder:text-zinc-700"
        />
        <div className="flex gap-4">
          <button
            onClick={generateSlides}
            disabled={loading || !vent.trim()}
            className="border border-white px-6 py-2 text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Generating..." : "Generate Slides"}
          </button>
          {slides.length > 0 && (
            <button
              onClick={exportImages}
              disabled={exporting}
              className="border border-zinc-600 px-6 py-2 text-sm tracking-widest uppercase text-zinc-400 hover:border-white hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {exporting ? "Exporting..." : "Export Images"}
            </button>
          )}
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>

      {/* Canvas preview */}
      {slides.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="text-xs tracking-widest uppercase text-zinc-500">
            {slides.length} slides — previewed at {Math.round(SCALE * 100)}%
          </p>
          <div className="flex flex-wrap gap-4">
            {slides.map((slide, i) => (
              <div
                key={i}
                style={{
                  width: SLIDE_W * SCALE,
                  height: SLIDE_H * SCALE,
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    transform: `scale(${SCALE})`,
                    transformOrigin: "top left",
                    width: SLIDE_W,
                    height: SLIDE_H,
                  }}
                  ref={(el) => { slideRefs.current[i] = el; }}
                >
                  <SlideCard slide={slide} index={i} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
