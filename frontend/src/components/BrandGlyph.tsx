// Lockup glyph: a loupe ring drawn as concentric hexagons, 1.5px line-style
// stroke in the current text color. No chromatic fill - violet stays on the CTA.

export function BrandGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        d="M10.5 2.6 17 6.3v7.4l-6.5 3.7L4 13.7V6.3z"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10.5 7.2l3.2 1.8v3.6l-3.2 1.8-3.2-1.8V9z" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="m16.2 15.4 4.3 5.6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
