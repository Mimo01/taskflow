/** Inline SVG app icon — renders crisp at any size unlike <img> which rasterizes filters. */
export default function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className={className}
    >
      <defs>
        <clipPath id="app-sq">
          <rect x="100" y="100" width="824" height="824" rx="185" ry="185" />
        </clipPath>
        <filter id="app-gC" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#0ea5e9" floodOpacity="0.55" />
        </filter>
        <filter id="app-gO" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#f97316" floodOpacity="0.55" />
        </filter>
        <filter id="app-gW" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#94a3b8" floodOpacity="0.35" />
        </filter>
      </defs>
      <g clipPath="url(#app-sq)">
        <rect x="100" y="100" width="824" height="824" fill="#ffffff" />
        <rect x="216" y="216" width="592" height="592" rx="80" fill="none" stroke="#0ea5e9" strokeWidth="22" transform="rotate(15 512 512)" filter="url(#app-gC)" />
        <rect x="216" y="216" width="592" height="592" rx="80" fill="none" stroke="#f97316" strokeWidth="22" transform="rotate(-15 512 512)" filter="url(#app-gO)" />
        <rect x="372" y="372" width="280" height="280" rx="44" fill="none" stroke="#94a3b8" strokeWidth="13" filter="url(#app-gW)" />
      </g>
    </svg>
  );
}
