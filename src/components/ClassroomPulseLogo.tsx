interface Props {
  size?: number;
  className?: string;
}

export default function ClassroomPulseLogo({ size = 40, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Cap stem */}
      <path d="M 20 27 L 28 27 L 26 40 L 22 40 Z" fill="#0F766E" />

      {/* Brim */}
      <rect x="15" y="24.5" width="18" height="4" rx="2" fill="#0F766E" />

      {/* Mortarboard top (diamond) */}
      <polygon points="24,6 42,16 24,26 6,16" fill="#14B8A6" />

      {/* Pulse / EKG line */}
      <path
        d="M 7 16 L 15 16 L 18 13 L 22 8 L 24 22 L 27 16 L 41 16"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Tassel string */}
      <line
        x1="42" y1="16" x2="42" y2="33"
        stroke="#0F766E"
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Tassel tip */}
      <circle cx="42" cy="36.5" r="3" fill="#0F766E" />
    </svg>
  );
}
