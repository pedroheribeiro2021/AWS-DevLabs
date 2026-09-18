interface LogoProps {
  size?: number;
}

export function LogoMark({ size = 28 }: LogoProps) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <polyline
        points="34,38 18,60 34,82"
        fill="none"
        stroke="#16233E"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="86,38 102,60 86,82"
        fill="none"
        stroke="#FF6B1A"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="50" y="20" width="20" height="26" rx="2" fill="none" stroke="#16233E" strokeWidth="6" />
      <polygon
        points="50,46 70,46 92,96 28,96"
        fill="none"
        stroke="#16233E"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <polygon points="40,96 80,96 76,76 44,76" fill="#FF6B1A" />
      <circle cx="57" cy="12" r="4" fill="#FF6B1A" />
      <circle cx="67" cy="7" r="2.6" fill="#FF6B1A" />
      <circle cx="62" cy="1" r="1.8" fill="#FF6B1A" />
    </svg>
  );
}

export function Logo({ size = 28 }: LogoProps) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-lg font-extrabold tracking-tight">
        <span className="text-slate-900">AWS</span>
        <span className="text-orange-600">DevLab</span>
      </span>
    </span>
  );
}
