export function SmileyFab() {
  return (
    <button
      type="button"
      aria-label="Give feedback"
      className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg ring-1 ring-accent-foreground/10 transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <circle cx="12" cy="12" r="10" className="fill-accent" />
        <circle cx="9" cy="10" r="1.2" className="fill-accent-foreground" />
        <circle cx="15" cy="10" r="1.2" className="fill-accent-foreground" />
        <path
          d="M8 14c1 1.6 2.4 2.5 4 2.5s3-.9 4-2.5"
          className="stroke-accent-foreground"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
