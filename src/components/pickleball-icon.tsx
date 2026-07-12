export function PickleballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <clipPath id="pickleball-face">
          <circle cx="12" cy="12" r="10" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="10" fill="#CBDB2B" stroke="#8FA61F" strokeWidth="0.5" />
      <g clipPath="url(#pickleball-face)" fill="#8FA61F">
        <circle cx="8" cy="5.5" r="1.6" />
        <circle cx="15" cy="4.5" r="1.6" />
        <circle cx="20" cy="9" r="1.6" />
        <circle cx="19" cy="16" r="1.6" />
        <circle cx="13" cy="20" r="1.6" />
        <circle cx="6" cy="18" r="1.6" />
        <circle cx="3" cy="12" r="1.6" />
        <circle cx="4.5" cy="5" r="1.6" />
        <circle cx="12" cy="12.5" r="1.4" />
      </g>
    </svg>
  );
}
