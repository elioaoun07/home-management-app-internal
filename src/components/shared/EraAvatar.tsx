"use client";

type Props = {
  size?: number;
};

export function EraAvatar({ size = 32 }: Props) {
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* Outer breathing ring — expands & fades */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ animation: "era-ring-pulse 2.8s ease-in-out infinite" }}
      >
        <div className="w-full h-full rounded-full bg-cyan-400/30" />
      </div>

      {/* Core gradient circle with heartbeat scale + glow */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #22d3ee 0%, #0891b2 55%, #1e40af 100%)",
          animation: "era-heartbeat 2.8s ease-in-out infinite, era-core-glow 2.8s ease-in-out infinite",
        }}
      >
        {/* Neural network SVG overlay */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute inset-0"
        >
          {/* Neural connections */}
          <line x1="16" y1="8.5" x2="10" y2="20.5" stroke="white" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="16" y1="8.5" x2="22" y2="20.5" stroke="white" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="10" y1="20.5" x2="22" y2="20.5" stroke="white" strokeOpacity="0.35" strokeWidth="0.9" strokeLinecap="round" />
          {/* Center spokes */}
          <line x1="16" y1="8.5" x2="16" y2="15.5" stroke="white" strokeOpacity="0.2" strokeWidth="0.7" strokeLinecap="round" />
          <line x1="10" y1="20.5" x2="16" y2="15.5" stroke="white" strokeOpacity="0.2" strokeWidth="0.7" strokeLinecap="round" />
          <line x1="22" y1="20.5" x2="16" y2="15.5" stroke="white" strokeOpacity="0.2" strokeWidth="0.7" strokeLinecap="round" />
          {/* Outer nodes */}
          <circle cx="16" cy="8.5" r="2" fill="white" fillOpacity="0.9" />
          <circle cx="10" cy="20.5" r="2" fill="white" fillOpacity="0.9" />
          <circle cx="22" cy="20.5" r="2" fill="white" fillOpacity="0.9" />
          {/* Center hub — bright core */}
          <circle cx="16" cy="15.5" r="3" fill="white" fillOpacity="0.95" />
          <circle cx="16" cy="15.5" r="1.4" fill="rgba(6,182,212,0.85)" />
        </svg>
      </div>
    </div>
  );
}
