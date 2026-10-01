/** Soft grid wash behind public pages. */
export function GridVeil() {
  return (
    <div className="grid-veil" aria-hidden="true">
      <svg className="grid-veil__lines" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="d26-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M56 0H0M0 0V56" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#d26-grid)" />
      </svg>
    </div>
  );
}
