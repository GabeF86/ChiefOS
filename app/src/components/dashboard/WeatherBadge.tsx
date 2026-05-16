import {
  getCurrentWeather,
  weatherGlyph,
} from "@/lib/weather/openMeteo";

export async function WeatherBadge() {
  const w = await getCurrentWeather();
  if (!w) return null;
  return (
    <div
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-pill border border-border bg-surface/70"
      title={`${w.label} · feels ${w.feelsLikeF}°F · wind ${w.windMph} mph · Paoli, PA`}
    >
      <span className="text-base leading-none" aria-hidden>
        {weatherGlyph(w.code, w.isDay)}
      </span>
      <span className="text-sm tabular-nums text-ink">{w.tempF}°F</span>
      <span className="text-[11px] font-mono uppercase tracking-widest text-ink-3 hidden md:inline">
        {w.label}
      </span>
    </div>
  );
}
