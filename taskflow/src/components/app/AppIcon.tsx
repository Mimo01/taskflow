/** Inline SVG app icon — renders crisp at any size unlike <img> which rasterizes filters. */
export default function AppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="app-sq">
          <rect x="100" y="100" width="824" height="824" rx="185" ry="185" />
        </clipPath>
      </defs>
      <g clipPath="url(#app-sq)">
        <rect x="100" y="100" width="824" height="824" fill="#ffffff" />
        {/* Blue ribbon (behind) */}
        <path
          d="M 195,390 C 339,283 501,283 512,372 C 523,461 685,461 829,354 L 829,516 C 685,624 523,624 512,534 C 501,445 339,445 195,552 Z"
          fill="#0ea5e9"
        />
        {/* Blue ribbon highlight */}
        <path
          d="M 204,413 C 343,310 501,310 512,395 C 523,480 681,480 821,377 L 821,417 C 681,516 523,516 512,432 C 501,346 343,346 204,450 Z"
          fill="#ffffff"
          opacity="0.18"
        />
        {/* Orange ribbon (in front) */}
        <path
          d="M 195,507 C 339,399 501,399 512,489 C 523,579 685,579 829,471 L 829,633 C 685,741 523,741 512,651 C 501,561 339,561 195,669 Z"
          fill="#f97316"
        />
        {/* Orange ribbon highlight */}
        <path
          d="M 204,530 C 343,422 501,422 512,512 C 523,597 681,597 821,494 L 821,534 C 681,633 523,633 512,552 C 501,463 343,463 204,566 Z"
          fill="#ffffff"
          opacity="0.18"
        />
      </g>
    </svg>
  );
}
