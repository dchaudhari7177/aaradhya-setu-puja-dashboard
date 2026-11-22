/** A diya (oil lamp) mark with the wordmark. Original artwork, drawn for this dashboard. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
        <rect width="40" height="40" rx="11" fill="#c5532f" />
        <path d="M20 8c3.2 4 4.4 6.8 4.4 9a4.4 4.4 0 0 1-8.8 0c0-2.2 1.2-5 4.4-9Z" fill="#fdebd4" />
        <path d="M20 13c1.4 1.9 1.9 3.2 1.9 4.2a1.9 1.9 0 0 1-3.8 0c0-1 .5-2.3 1.9-4.2Z" fill="#e08a2b" />
        <path d="M8 23.5h24c-.9 4.9-5.6 8.5-12 8.5S8.9 28.4 8 23.5Z" fill="#fffaf2" />
        <path d="M13 23.5h14" stroke="#e08a2b" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[1.0625rem] font-bold tracking-tight">Aaradhya Setu</span>
          <span className="block text-xs font-medium opacity-70">आराध्य सेतु · Admin</span>
        </span>
      )}
    </span>
  );
}
