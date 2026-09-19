import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { memo, useMemo, useState, type MouseEvent, type TouchEvent } from "react";
import { LINKS, TIMEFRAMES, type ChartPair, type ChartTimeframe } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { getRoarChart, type Candle } from "@/lib/mx.functions";
import { cn, formatNum, formatPct, formatUsd } from "@/lib/utils";

export const RoarChart = memo(function RoarChart({
  t,
  roarUsd,
  change24h,
}: {
  t: Copy;
  roarUsd: number;
  change24h: number;
}) {
  const [pair, setPair] = useState<ChartPair>("egld");
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("4h");
  const chart = useQuery({
    queryKey: ["roar-chart", pair, timeframe],
    queryFn: () => getRoarChart({ data: { pair, timeframe } }),
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const matched =
    chart.data?.pair === pair && chart.data?.timeframe === timeframe;
  const candles: Candle[] = matched ? (chart.data?.candles ?? []) : [];
  const last = matched ? (chart.data?.last ?? 0) : 0;
  const liveChange = matched ? (chart.data?.change24h ?? change24h) : change24h;
  const up = liveChange >= 0;
  const openUrl = pair === "egld" ? LINKS.ecompassEgld : LINKS.ecompassUsdc;
  const tfLabel = TIMEFRAMES.find((row) => row.id === timeframe)?.label ?? "1H";
  const priceLabel =
    pair === "egld"
      ? `${formatNum(last || 0, 6)} EGLD`
      : formatUsd(last || roarUsd, 4);
  const hi = candles.length ? Math.max(...candles.map((c) => c.h)) : 0;
  const lo = candles.length ? Math.min(...candles.map((c) => c.l)) : 0;
  const vol = candles.reduce((s, c) => s + (Number.isFinite(c.v) ? c.v : 0), 0);
  const fmtStat = (p: number) => (pair === "egld" ? formatNum(p, 6) : formatUsd(p, 4));

  return (
    <section id="charte" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-medium md:text-3xl">{t.chartTitle}</h2>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-volt/15 px-2.5 text-[11px] font-medium text-volt">
              <span className="relative flex size-2">
                <span
                  className={cn(
                    "absolute inline-flex size-full rounded-full bg-volt opacity-60",
                    chart.isFetching ? "animate-live-ping" : "animate-live-pulse",
                  )}
                />
                <span className="relative inline-flex size-2 rounded-full bg-volt" />
              </span>
              {t.chartSource}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.chartLead}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="tabular">
            <span className="font-display text-xl leading-none">{priceLabel}</span>
            <span className={cn("ml-2 text-sm", up ? "text-volt" : "text-ember")}>
              {formatPct(liveChange, 1)}
            </span>
          </p>
          <PairToggle t={t} pair={pair} onChange={setPair} />
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]">
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
        {candles.length >= 2 ? (
          <div className="mb-2 grid grid-cols-2 gap-2 px-1 sm:grid-cols-4">
            <ChartStat label={t.chartHigh} value={fmtStat(hi)} />
            <ChartStat label={t.chartLow} value={fmtStat(lo)} />
            <ChartStat label={t.chartRange} value={fmtStat(hi - lo)} />
            <ChartStat
              label={t.chartVol}
              value={vol > 0 ? formatNum(vol, vol >= 1000 ? 0 : 2) : "—"}
            />
          </div>
        ) : null}
        <div className="overflow-hidden rounded-sm bg-bg">
          {candles.length >= 2 ? (
            <CandleChart t={t} candles={candles} pair={pair} timeframe={timeframe} up={up} />
          ) : (
            <p className="flex h-64 items-center justify-center text-sm text-muted md:h-96">
              {chart.isError ? t.chartError : t.chartLoading}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted">
          {tfLabel} · {t.chartSource}
        </p>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1 text-xs text-muted hover:text-fg"
        >
          {t.chartOpen}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </section>
  );
});

function ChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 truncate font-display text-sm tabular leading-none">{value}</p>
    </div>
  );
}

function PairToggle({
  t,
  pair,
  onChange,
}: {
  t: Copy;
  pair: ChartPair;
  onChange: (pair: ChartPair) => void;
}) {
  const options: { id: ChartPair; label: string }[] = [
    { id: "egld", label: t.chartEgld },
    { id: "usdc", label: t.chartUsdc },
  ];
  return (
    <div className="flex rounded-full bg-surface-2 p-0.5 shadow-[var(--shadow-border)]">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "h-11 min-w-28 rounded-full px-4 text-xs font-medium transition-[background-color,color] duration-150",
            pair === opt.id ? "bg-ember text-primary-foreground" : "text-muted hover:text-fg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TimeframeToggle({
  value,
  onChange,
}: {
  value: ChartTimeframe;
  onChange: (tf: ChartTimeframe) => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-0.5 rounded-full bg-surface-2 p-0.5 shadow-[var(--shadow-border)]">
      {TIMEFRAMES.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onChange(row.id)}
          className={cn(
            "h-11 min-w-11 flex-1 rounded-full px-3 text-xs font-medium tabular transition-[background-color,color] duration-150",
            value === row.id ? "bg-volt text-bg" : "text-muted hover:text-fg",
          )}
        >
          {row.label}
        </button>
      ))}
    </div>
  );
}

function fmtAxis(sec: number, tf: ChartTimeframe) {
  const d = new Date(sec * 1000);
  if (tf === "5m" || tf === "15m") {
    return d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (tf === "1h" || tf === "4h") {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
    });
  }
  if (tf === "1w") {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtHoverTime(sec: number, tf: ChartTimeframe) {
  const d = new Date(sec * 1000);
  if (tf === "1d" || tf === "1w") {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CandleChart({
  t,
  candles,
  pair,
  timeframe,
  up,
}: {
  t: Copy;
  candles: Candle[];
  pair: ChartPair;
  timeframe: ChartTimeframe;
  up: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 960;
  const h = 460;
  const padL = 8;
  const padR = 72;
  const padT = 18;
  const volH = 68;
  const padB = 28 + volH;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const volTop = h - padB + 10;
  const volMax = Math.max(...candles.map((c) => c.v || 0), 1);

  const { min, max, span } = useMemo(() => {
    const lo = Math.min(...candles.map((c) => c.l));
    const hi = Math.max(...candles.map((c) => c.h));
    const pad = (hi - lo) * 0.08 || hi * 0.04;
    return { min: lo - pad, max: hi + pad, span: hi - lo + pad * 2 || 1 };
  }, [candles]);

  const n = candles.length;
  const bw = innerW / n;
  const yOf = (p: number) => padT + ((max - p) / span) * innerH;
  const xOf = (i: number) => padL + i * bw + bw / 2;
  const active = hover ?? n - 1;
  const candle = candles[active];
  const last = candles[n - 1];
  const ticks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((r) => max - r * span);
  }, [max, span]);
  const xTicks = useMemo(() => {
    if (n < 2) return [0];
    const lastIdx = n - 1;
    if (n < 5) return [0, lastIdx];
    return [0, Math.floor(n / 3), Math.floor((2 * n) / 3), lastIdx];
  }, [n]);

  function onMove(event: MouseEvent<SVGSVGElement> | TouchEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in event ? event.touches[0]?.clientX : event.clientX;
    if (clientX == null) return;
    const x = ((clientX - rect.left) / rect.width) * w;
    const i = Math.min(n - 1, Math.max(0, Math.floor((x - padL) / bw)));
    setHover(i);
  }

  function fmtPrice(p: number) {
    return pair === "egld" ? formatNum(p, 6) : formatUsd(p, 4);
  }

  return (
    <div>
      {candle ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-2 py-2 text-[11px] tabular">
          <span className="text-muted">{fmtHoverTime(candle.t, timeframe)}</span>
          <span>O {fmtPrice(candle.o)}</span>
          <span className="text-volt">H {fmtPrice(candle.h)}</span>
          <span className="text-ember">L {fmtPrice(candle.l)}</span>
          <span className={candle.c >= candle.o ? "text-volt" : "text-ember"}>
            {t.chartClose} {fmtPrice(candle.c)}
          </span>
          <span className={candle.c >= candle.o ? "text-volt" : "text-ember"}>
            {formatPct(candle.o ? ((candle.c - candle.o) / candle.o) * 100 : 0, 2)}
          </span>
          {candle.v > 0 ? (
            <span className="text-muted">
              {t.chartVol} {formatNum(candle.v, candle.v >= 1000 ? 0 : 2)}
            </span>
          ) : null}
        </div>
      ) : null}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="candle-chart w-full"
        role="img"
        aria-label={`${pair === "egld" ? "ROAR / EGLD" : "ROAR / USDC"} ${timeframe}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onMove}
        onTouchMove={onMove}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={w - padR}
              y1={yOf(tick)}
              y2={yOf(tick)}
              stroke="currentColor"
              className="text-fg/8"
            />
            <text
              x={w - padR + 8}
              y={yOf(tick) + 4}
              className="fill-muted"
              fontSize="11"
              fontFamily="ui-monospace, monospace"
            >
              {pair === "egld" ? formatNum(tick, 5) : formatUsd(tick, 4)}
            </text>
          </g>
        ))}

        {candles.map((row, i) => {
          const bull = row.c >= row.o;
          const color = bull ? "var(--color-volt)" : "var(--color-ember)";
          const cx = xOf(i);
          const bodyTop = yOf(Math.max(row.o, row.c));
          const bodyBot = yOf(Math.min(row.o, row.c));
          const bodyH = Math.max(1.2, bodyBot - bodyTop);
          const cw = Math.max(1.5, bw * 0.62);
          const dim = hover !== null && hover !== i;
          const vh = Math.max(1, ((row.v || 0) / volMax) * (volH - 16));
          return (
            <g key={row.t} opacity={dim ? 0.35 : 1}>
              <line
                x1={cx}
                x2={cx}
                y1={yOf(row.h)}
                y2={yOf(row.l)}
                stroke={color}
                strokeWidth="1.25"
              />
              <rect
                x={cx - cw / 2}
                y={bodyTop}
                width={cw}
                height={bodyH}
                fill={color}
              />
              <rect
                x={cx - cw / 2}
                y={volTop + (volH - 16) - vh}
                width={cw}
                height={vh}
                fill={color}
                opacity="0.45"
              />
            </g>
          );
        })}

        <line
          x1={padL}
          x2={w - padR}
          y1={volTop - 8}
          y2={volTop - 8}
          stroke="currentColor"
          className="text-fg/15"
        />
        <text
          x={padL + 4}
          y={volTop + 2}
          className="fill-muted"
          fontSize="10"
          fontFamily="ui-sans-serif, sans-serif"
        >
          {t.chartVol}
        </text>

        <line
          x1={padL}
          x2={w - padR}
          y1={yOf(last.c)}
          y2={yOf(last.c)}
          stroke={up ? "var(--color-volt)" : "var(--color-ember)"}
          strokeDasharray="4 4"
          strokeWidth="1"
          opacity="0.7"
        />

        {hover !== null ? (
          <line
            x1={xOf(hover)}
            x2={xOf(hover)}
            y1={padT}
            y2={h - 22}
            stroke="currentColor"
            className="text-fg/25"
            strokeDasharray="3 4"
          />
        ) : null}

        {xTicks.map((i) => (
          <text
            key={`${candles[i].t}-${i}`}
            x={xOf(i)}
            y={h - 10}
            textAnchor="middle"
            className="fill-muted"
            fontSize="11"
            fontFamily="ui-sans-serif, sans-serif"
          >
            {fmtAxis(candles[i].t, timeframe)}
          </text>
        ))}
      </svg>
    </div>
  );
}
