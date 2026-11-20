/**
 * Radiant Vermilion-Orange Fluted Curtain Backdrop matching Lexicon aesthetic.
 * Combines multi-layered radial warm orange glow clouds with crisp vertical
 * architectural fluted glass hairlines.
 */
export function RayOfLightCanvas() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-[#D93800]">
      {/* Billowing warm orange atmospheric clouds */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 75% 70% at 18% 22%, #FF6B14 0%, rgba(255, 107, 20, 0) 68%)',
            'radial-gradient(ellipse 65% 75% at 78% 18%, #F97316 0%, rgba(249, 115, 22, 0) 65%)',
            'radial-gradient(ellipse 80% 65% at 50% 60%, #EA4A06 0%, rgba(234, 74, 6, 0) 70%)',
            'radial-gradient(ellipse 60% 60% at 22% 85%, #C82B00 0%, rgba(200, 43, 0, 0) 70%)',
            'radial-gradient(ellipse 70% 60% at 86% 82%, #D43400 0%, rgba(212, 52, 0, 0) 72%)',
            'linear-gradient(180deg, #E84A07 0%, #D93800 55%, #B82700 100%)',
          ].join(', '),
        }}
      />

      {/* Vertical fluted glass architectural bands & hairlines */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: [
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.16) 1px, transparent 1px, transparent 144px)',
            'repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0px, rgba(0,0,0,0.05) 72px, rgba(255,255,255,0.03) 144px)',
          ].join(', '),
        }}
      />

      {/* Subtle warm edge finish into cream sections below */}
      <div
        className="absolute inset-x-0 bottom-0 h-20"
        style={{
          background: 'linear-gradient(180deg, rgba(217,56,0,0) 0%, rgba(184,39,0,0.22) 100%)',
        }}
      />
    </div>
  );
}
