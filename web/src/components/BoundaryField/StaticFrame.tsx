import BlockedStamp from "./BlockedStamp";

export default function StaticFrame({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`boundary-static ${compact ? "boundary-static--compact" : ""}`} aria-label="Mandate Boundary Field static blocked frame">
      <svg className="boundary-static__svg" viewBox="0 0 1200 680" role="img" aria-hidden="true">
        <defs>
          <radialGradient id="fieldGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="var(--safe)" stopOpacity="0.1" />
            <stop offset="48%" stopColor="var(--safe)" stopOpacity="0.035" />
            <stop offset="100%" stopColor="var(--bg)" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="safeArrow" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
            <path d="M0,0 L12,6 L0,12 Z" fill="var(--safe)" />
          </marker>
          <marker id="blockedArrow" markerWidth="12" markerHeight="12" refX="9" refY="6" orient="auto">
            <path d="M0,0 L12,6 L0,12 Z" fill="var(--blocked)" />
          </marker>
        </defs>
        <rect width="1200" height="680" fill="var(--bg)" />
        <rect width="1200" height="680" fill="url(#fieldGlow)" />
        <g transform="translate(120 46)">
          <ellipse cx="470" cy="300" rx="315" ry="210" fill="none" stroke="var(--gate)" strokeWidth="34" opacity="0.28" />
          <ellipse
            cx="470"
            cy="300"
            rx="315"
            ry="210"
            fill="none"
            stroke="var(--safe)"
            strokeDasharray="10 18"
            strokeWidth="2"
            opacity="0.72"
            filter="url(#softGlow)"
          />
          <path d="M104 365 C270 306 356 280 694 226" fill="none" stroke="var(--safe)" strokeWidth="4" opacity="0.9" markerEnd="url(#safeArrow)" />
          <path d="M150 226 C290 240 460 276 774 332" fill="none" stroke="var(--blocked)" strokeWidth="4" opacity="0.95" markerEnd="url(#blockedArrow)" />
          <circle cx="774" cy="332" r="18" fill="none" stroke="var(--blocked)" strokeWidth="3" opacity="0.95" />
          <circle cx="774" cy="332" r="42" fill="none" stroke="var(--blocked)" strokeWidth="1" opacity="0.3" />
          <path d="M760 284 L830 382" stroke="var(--blocked)" strokeWidth="1" opacity="0.42" />
          <path d="M826 282 L754 380" stroke="var(--blocked)" strokeWidth="1" opacity="0.42" />
          <text x="690" y="207" fill="var(--safe)" fontFamily="var(--chrome)" fontSize="18" letterSpacing="2">SAFE · 48 USDG</text>
          <text x="786" y="321" fill="var(--blocked)" fontFamily="var(--chrome)" fontSize="18" letterSpacing="2">DANGEROUS · 500 USDG</text>
          <text x="364" y="305" fill="var(--fg)" opacity="0.65" fontFamily="var(--chrome)" fontSize="16" letterSpacing="2">35% POLICY BOUNDARY</text>
        </g>
      </svg>
      <div className="boundary-static__stamp">
        <BlockedStamp compact={compact} />
      </div>
    </div>
  );
}
