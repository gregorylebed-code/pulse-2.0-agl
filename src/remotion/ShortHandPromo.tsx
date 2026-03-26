import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
  Img,
  staticFile,
} from "remotion";

// ─── Palette ───────────────────────────────────────────────────────────────
const ORANGE = "#f97316";
const ORANGE_DARK = "#ea6305";
const WHITE = "#ffffff";
const BLACK = "#0a0a0a";
const GRAY = "#1a1a1a";

// ─── Safe-zone constants (short-form: avoid top 12% and bottom 15%) ────────
const SAFE_TOP = "12%";
const SAFE_BOTTOM = "15%";

// ─── Multicolor ShortHand letters (matching the app icon) ───────────────────
const LETTER_COLORS: Record<string, string> = {
  S: "#E53935", // red
  h: "#43A047", // green
  o: "#FB8C00", // orange
  r: "#8E24AA", // purple
  t: "#1E88E5", // blue
  H: "#E53935", // red
  a: "#43A047", // green
  n: "#FB8C00", // orange
  d: "#8E24AA", // purple
};

function ColorfulShortHand({ fontSize, style }: { fontSize: number; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: "'Arial Black', Impact, sans-serif", fontWeight: 900, fontSize, ...style }}>
      {"ShortHand".split("").map((char, i) => (
        <span key={i} style={{ color: LETTER_COLORS[char] ?? "#ffffff" }}>
          {char}
        </span>
      ))}
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function useSpr(frame: number, delay: number, damping = 14, mass = 0.8) {
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass } });
}

// ─── Scene 1: Viral Hook (frames 0-149) ─────────────────────────────────────
function HookScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "Still doing THIS?" — appear at frame 8
  const hookIn = spring({ frame: frame - 8, fps, config: { damping: 12, mass: 0.6 } });
  const hookScale = interpolate(hookIn, [0, 1], [0.4, 1]);
  const hookOpacity = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });

  // Clipboard emoji bouncing chaos (frame 18-60)
  const clipA = spring({ frame: frame - 18, fps, config: { damping: 8, mass: 1.2 } });
  const clipB = spring({ frame: frame - 25, fps, config: { damping: 7, mass: 1.5 } });
  const clipC = spring({ frame: frame - 32, fps, config: { damping: 9, mass: 0.9 } });

  // Red chaos swipe (frame 55-70)
  const swipeIn = interpolate(frame, [55, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // "There's a better way →" (frame 95-115)
  const betterIn = spring({ frame: frame - 95, fps, config: { damping: 14, mass: 0.7 } });
  const betterOpacity = interpolate(frame, [95, 112], [0, 1], { extrapolateRight: "clamp" });

  // Whole scene fades out at frame 138
  const sceneOpacity = interpolate(frame, [138, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: BLACK,
        opacity: sceneOpacity,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Radial glow behind text */}
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}22 0%, transparent 70%)`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* ── Floating clipboard chaos ────────────────────── */}
      {[
        { spr: clipA, x: -200, y: -280, rot: -22, scale: 1.1 },
        { spr: clipB, x: 210, y: -240, rot: 18, scale: 0.9 },
        { spr: clipC, x: -60, y: -310, rot: 5, scale: 1.0 },
      ].map(({ spr, x, y, rot, scale }, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            fontSize: 96,
            opacity: spr * 0.85,
            transform: `translate(${x * spr}px, ${y * spr}px) rotate(${rot * (1 - spr) + rot * 0.1}deg) scale(${spr * scale})`,
          }}
        >
          📋
        </div>
      ))}

      {/* Red X strike-through (swipe) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scaleX(${swipeIn})`,
          transformOrigin: "left center",
          width: 600,
          height: 8,
          background: "#ef4444",
          borderRadius: 4,
          boxShadow: "0 0 24px #ef444488",
        }}
      />

      {/* Main hook text */}
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          paddingTop: 60,
          opacity: hookOpacity,
        }}
      >
        <div
          style={{
            fontSize: 68,
            fontWeight: 900,
            fontFamily: "'Arial Black', Impact, sans-serif",
            color: WHITE,
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: -1,
            transform: `scale(${hookScale})`,
            padding: "0 60px",
            textShadow: "0 4px 32px #00000088",
          }}
        >
          Still tracking behavior
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 900,
            fontFamily: "'Arial Black', Impact, sans-serif",
            color: ORANGE,
            textAlign: "center",
            lineHeight: 1,
            transform: `scale(${hookScale})`,
            padding: "0 60px",
            textShadow: `0 0 40px ${ORANGE}88`,
          }}
        >
          on PAPER? 📋
        </div>
      </div>

      {/* "There's a better way" */}
      <div
        style={{
          position: "absolute",
          bottom: SAFE_BOTTOM,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          paddingBottom: 40,
          opacity: betterOpacity,
          transform: `translateY(${interpolate(betterIn, [0, 1], [40, 0])}px)`,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            fontFamily: "'Arial Black', Impact, sans-serif",
            color: WHITE,
            textAlign: "center",
            padding: "0 60px",
          }}
        >
          There's a better way →
        </div>
        <div
          style={{
            width: 120,
            height: 4,
            borderRadius: 2,
            background: ORANGE,
            boxShadow: `0 0 20px ${ORANGE}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ─── Feature card ────────────────────────────────────────────────────────────
interface FeatureCardProps {
  icon: string;
  label: string;
  delay: number;
  fromDir: "left" | "right" | "bottom";
}
function FeatureCard({ icon, label, delay, fromDir }: FeatureCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spr = spring({ frame: frame - delay, fps, config: { damping: 13, mass: 0.7 } });

  const fromX =
    fromDir === "left" ? interpolate(spr, [0, 1], [-340, 0])
    : fromDir === "right" ? interpolate(spr, [0, 1], [340, 0])
    : 0;
  const fromY = fromDir === "bottom" ? interpolate(spr, [0, 1], [200, 0]) : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 22,
        background: "rgba(255,255,255,0.06)",
        border: `1.5px solid rgba(249,115,22,0.35)`,
        borderRadius: 20,
        padding: "20px 32px",
        opacity: spr,
        transform: `translate(${fromX}px, ${fromY}px) scale(${interpolate(spr, [0, 1], [0.85, 1])})`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)`,
        backdropFilter: "blur(12px)",
        width: "88%",
      }}
    >
      <span style={{ fontSize: 42 }}>{icon}</span>
      <span
        style={{
          fontSize: 36,
          fontWeight: 700,
          fontFamily: "Arial, sans-serif",
          color: WHITE,
          letterSpacing: -0.3,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Scene 2: Features (frames 150-299) ─────────────────────────────────────
function FeaturesScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo entrance
  const logoSpr = spring({ frame: frame - 5, fps, config: { damping: 11, mass: 0.9 } });
  const logoY = interpolate(logoSpr, [0, 1], [-80, 0]);

  // Scene in/out
  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [138, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, #0f0f0f 0%, #1a0a00 50%, #0f0f0f 100%)`,
        opacity: fadeIn * fadeOut,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
        overflow: "hidden",
      }}
    >
      {/* Background grid lines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(249,115,22,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(249,115,22,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Orange glow orb */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ORANGE}18 0%, transparent 65%)`,
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* Logo / Brand name */}
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 40,
          opacity: logoSpr,
          transform: `translateY(${logoY}px)`,
        }}
      >
        {/* App logo photo */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <Img
            src={staticFile("Shorthand Logo White.png")}
            style={{
              width: 220,
              height: 220,
              objectFit: "cover",
              borderRadius: 28,
              boxShadow: `0 0 60px ${ORANGE}44, 0 12px 48px rgba(0,0,0,0.6)`,
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>
        <ColorfulShortHand fontSize={52} style={{ letterSpacing: -1 }} />
        <div
          style={{
            fontSize: 26,
            color: "rgba(255,255,255,0.55)",
            fontFamily: "Arial, sans-serif",
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          The app every teacher needs
        </div>
      </div>

      {/* Feature cards */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          marginTop: 180,
          width: "100%",
          paddingBottom: 140,
        }}
      >
        <FeatureCard icon="⚡" label="Instant behavior logs" delay={30} fromDir="left" />
        <FeatureCard icon="😊" label="Daily mood check-ins" delay={48} fromDir="right" />
        <FeatureCard icon="🤖" label="AI-powered insights" delay={66} fromDir="left" />
        <FeatureCard icon="📊" label="Reports in seconds" delay={84} fromDir="right" />
        <FeatureCard icon="📅" label="Calendar integration" delay={102} fromDir="bottom" />
      </div>
    </AbsoluteFill>
  );
}

// ─── Scene 3: CTA (frames 300-449) ──────────────────────────────────────────
function CTAScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Flash transition in
  const flashOut = interpolate(frame, [0, 18], [1, 0], { extrapolateRight: "clamp" });

  // Title
  const titleSpr = spring({ frame: frame - 15, fps, config: { damping: 11, mass: 0.8 } });
  const titleScale = interpolate(titleSpr, [0, 1], [0.5, 1]);

  // Tagline
  const tagSpr = spring({ frame: frame - 38, fps, config: { damping: 14, mass: 0.7 } });
  const tagY = interpolate(tagSpr, [0, 1], [50, 0]);

  // Pill badge (free)
  const freeSpr = spring({ frame: frame - 58, fps, config: { damping: 12, mass: 0.6 } });

  // URL
  const urlSpr = spring({ frame: frame - 75, fps, config: { damping: 14, mass: 0.7 } });

  // Pulsing ring animation
  const pulse1 = interpolate((frame * 1.8) % 60, [0, 60], [0.6, 1.4]);
  const pulse1Opacity = interpolate((frame * 1.8) % 60, [0, 30, 60], [0.5, 0.0, 0.5]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(170deg, #0a0a0a 0%, #1c0900 60%, #0a0a0a 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: ORANGE,
          opacity: flashOut,
          zIndex: 10,
        }}
      />

      {/* Pulsing rings */}
      {[1, 0.75, 0.5].map((baseScale, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            border: `2px solid ${ORANGE}`,
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${baseScale * pulse1})`,
            opacity: pulse1Opacity * (1 - i * 0.25) * titleSpr,
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Center logo photo */}
      <Img
        src={staticFile("Shorthand Logo White.png")}
        style={{
          width: 280,
          height: 280,
          objectFit: "cover",
          borderRadius: 40,
          boxShadow: `0 0 120px ${ORANGE}55, 0 20px 60px rgba(0,0,0,0.6)`,
          transform: `scale(${titleScale})`,
          marginBottom: 28,
          display: "block",
        }}
      />

      {/* Title */}
      <div style={{ transform: `scale(${titleScale})`, textShadow: "0 4px 40px rgba(0,0,0,0.6)" }}>
        <ColorfulShortHand fontSize={90} style={{ letterSpacing: -2, lineHeight: 1 }} />
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 38,
          fontWeight: 600,
          fontFamily: "Arial, sans-serif",
          color: "rgba(255,255,255,0.85)",
          textAlign: "center",
          marginTop: 16,
          padding: "0 80px",
          lineHeight: 1.3,
          opacity: tagSpr,
          transform: `translateY(${tagY}px)`,
        }}
      >
        The teacher tool that actually saves you time
      </div>

      {/* FREE badge */}
      <div
        style={{
          marginTop: 32,
          background: `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE_DARK} 100%)`,
          borderRadius: 50,
          padding: "14px 44px",
          opacity: freeSpr,
          transform: `scale(${interpolate(freeSpr, [0, 1], [0.7, 1])})`,
          boxShadow: `0 8px 40px ${ORANGE}55`,
        }}
      >
        <span
          style={{
            fontSize: 36,
            fontWeight: 900,
            fontFamily: "'Arial Black', Impact, sans-serif",
            color: WHITE,
            letterSpacing: 1,
          }}
        >
          ✓ FREE FOR ALL TEACHERS
        </span>
      </div>

      {/* URL */}
      <div
        style={{
          position: "absolute",
          bottom: SAFE_BOTTOM,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          paddingBottom: 30,
          opacity: urlSpr,
          transform: `translateY(${interpolate(urlSpr, [0, 1], [30, 0])}px)`,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.07)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            borderRadius: 14,
            padding: "14px 40px",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 600,
              fontFamily: "Arial, sans-serif",
              color: "rgba(255,255,255,0.75)",
              letterSpacing: 0.5,
            }}
          >
            GetShortHand.app
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── Main composition ─────────────────────────────────────────────────────────
export function ShortHandPromo() {
  return (
    <AbsoluteFill style={{ background: BLACK }}>
      <Sequence from={0} durationInFrames={150}>
        <HookScene />
      </Sequence>
      <Sequence from={150} durationInFrames={150}>
        <FeaturesScene />
      </Sequence>
      <Sequence from={300} durationInFrames={150}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
}
