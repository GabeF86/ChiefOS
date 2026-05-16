import type { DailySpend } from "@/lib/domain/costs/server";

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function DailyBarChart({
  data,
  hardDaily,
}: {
  data: DailySpend[];
  hardDaily: number;
}) {
  const max = Math.max(hardDaily, ...data.map((d) => d.variable_usd), 0.01);

  // Layout
  const width = 720;
  const height = 160;
  const padTop = 12;
  const padBottom = 24;
  const padLeft = 36;
  const padRight = 12;
  const chartH = height - padTop - padBottom;
  const chartW = width - padLeft - padRight;
  const barGap = 2;
  const barW = (chartW - barGap * (data.length - 1)) / data.length;

  const hardY = padTop + chartH - (hardDaily / max) * chartH;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[480px] h-40"
        role="img"
        aria-label={`Daily variable spend over ${data.length} days, max ${fmt.format(max)}`}
      >
        {/* Hard-daily threshold line */}
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={hardY}
          y2={hardY}
          stroke="var(--gold)"
          strokeWidth="1"
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <text
          x={width - padRight}
          y={hardY - 4}
          textAnchor="end"
          fontSize="9"
          fill="var(--gold)"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {fmt.format(hardDaily)} daily cap
        </text>

        {/* Y axis labels — just 0 and max */}
        <text
          x={padLeft - 6}
          y={padTop + chartH + 4}
          textAnchor="end"
          fontSize="9"
          fill="var(--ink-3)"
          fontFamily="var(--font-geist-mono), monospace"
        >
          $0
        </text>
        <text
          x={padLeft - 6}
          y={padTop + 8}
          textAnchor="end"
          fontSize="9"
          fill="var(--ink-3)"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {fmt.format(max)}
        </text>

        {/* Bars */}
        {data.map((d, i) => {
          const x = padLeft + i * (barW + barGap);
          const h = Math.max(0, (d.variable_usd / max) * chartH);
          const y = padTop + chartH - h;
          const overCap = d.variable_usd > hardDaily;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={1}
                fill={overCap ? "var(--red)" : "var(--teal)"}
                opacity={d.variable_usd === 0 ? 0.08 : 0.9}
              >
                <title>{`${d.date} — ${fmt.format(d.variable_usd)}`}</title>
              </rect>
              {/* X-axis label every 5 days */}
              {i % 5 === 0 && (
                <text
                  x={x + barW / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="8"
                  fill="var(--ink-3)"
                  fontFamily="var(--font-geist-mono), monospace"
                >
                  {d.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
