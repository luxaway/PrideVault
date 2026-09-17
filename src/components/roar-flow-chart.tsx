import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Flame, Lock, Waves } from "lucide-react";
import { useMemo, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
import { BURN_ADDRESS, explorerAddrUrl } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { getRoarFlowChart, type RoarFlowPoint } from "@/lib/mx.functions";
import { cn, fillAmt, formatNum, formatUsd } from "@/lib/utils";

const RANGES = [
  { id: "1d", seconds: 86400 },
  { id: "7d", seconds: 7 * 86400 },
  { id: "30d", seconds: 30 * 86400 },
  { id: "90d", seconds: 90 * 86400 },
  { id: "1y", seconds: 365 * 86400 },
  { id: "all", seconds: 0 },
] as const;

type FlowRange = (typeof RANGES)[number]["id"];
type FlowUnit = "roar" | "usd";

function roarDigits(n: number) {
  if (n >= 1000) return 0;
  if (n >= 10) return 1;
  return 2;
}

function fmtCompact(n: number, unit: FlowUnit) {
  if (unit === "usd") {
    if (n >= 1000) return formatUsd(n, 0);
    if (n >= 100) return formatUsd(n, 0);
    return formatUsd(n, n >= 10 ? 1 : 2);
  }
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${formatNum(n / 1_000_000, 2)}M`;
  if (abs >= 10_000) return formatNum(n, 0);
  return formatNum(n, roarDigits(n));
}

function fmtAxis(sec: number, spanSec: number) {
  const d = new Date(sec * 1000);
  if (spanSec > 400 * 86400) {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  if (spanSec > 100 * 86400) {
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtHover(sec: number) {
  return new Date(sec * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function yDomain(values: number[], fromZero: boolean) {
  const finite = values.filter((v) => Number.isFinite(v));
  const lo = finite.length ? Math.min(...finite) : 0;
  const hi = finite.length ? Math.max(...finite) : 1;
  const gap = hi - lo;
  if (fromZero || lo <= hi * 0.18) {
    const pad = hi * 0.08 || 1;
    return { min: 0, max: hi + pad, span: hi + pad || 1 };
  }
  const pad = Math.max(gap * 0.16, hi * 0.02, 1);
  const min = Math.max(0, lo - pad);
  const max = hi + pad;
  return { min, max, span: max - min || 1 };
}

function areaPath(xs: number[], ys: number[], bottom: number) {
  if (xs.length === 0) return "";
  const line = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
  return `${line} L${xs[xs.length - 1].toFixed(2)},${bottom} L${xs[0].toFixed(2)},${bottom} Z`;
}

function strokePath(xs: number[], ys: number[]) {
  if (xs.length === 0) return "";
  return xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
}

function xTicksOf(n: number) {
  if (n < 2) return [0];
  if (n < 5) return [0, n - 1];
  if (n < 20) return [0, Math.floor((n - 1) / 2), n - 1];
  return [0, Math.floor((n - 1) / 3), Math.floor((2 * (n - 1)) / 3), n - 1];
}

function sliceFlow(points: RoarFlowPoint[], range: FlowRange) {
  if (range === "all" || points.length < 2) return points;
  const end = points[points.length - 1]!.t;
  const cut = end - RANGES.find((row) => row.id === range)!.seconds;
  const view = points.filter((row) => row.t >= cut);
  if (view.length >= 2) return view;
  return points.slice(-2);
}

function pointAtOrBefore(points: RoarFlowPoint[], t: number) {
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i]!.t <= t) return points[i];
  }
  return points[0];
}

function roarOf(row: RoarFlowPoint, key: "liq" | "burn" | "staked") {
  if (key === "liq") return row.liqRoar;
  if (key === "burn") return row.burnRoar;
  return row.stakedRoar;
}

function delta30(points: RoarFlowPoint[], key: "liq" | "burn" | "staked") {
  if (points.length < 2) return 0;
  const last = points[points.length - 1]!;
  const first = pointAtOrBefore(points, last.t - 30 * 86400) ?? points[0]!;
  return roarOf(last, key) - roarOf(first, key);
}

export function RoarFlowChart({ t }: { t: Copy }) {
  const [unit, setUnit] = useState<FlowUnit>("roar");
  const [liqRange, setLiqRange] = useState<FlowRange>("7d");
  const [stakeRange, setStakeRange] = useState<FlowRange>("7d");
  const flow = useQuery({
    queryKey: ["roar-flow"],
    queryFn: () => getRoarFlowChart(),
    staleTime: 45_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const points = flow.data?.points ?? [];
  const liqView = useMemo(() => sliceFlow(points, liqRange), [points, liqRange]);
  const stakeView = useMemo(() => sliceFlow(points, stakeRange), [points, stakeRange]);
  const liqLast = liqView.at(-1) ?? points.at(-1);
  const stakeLast = stakeView.at(-1) ?? points.at(-1);
  const liq30 = delta30(points, "liq");
  const burn30 = delta30(points, "burn");
  const stake30 = delta30(points, "staked");
  const fetching = flow.isFetching;
  const stakePct = stakeLast && stakeLast.supply > 0 ? (stakeLast.stakedRoar / stakeLast.supply) * 100 : 0;

  return (
    <div className="mt-2 grid gap-2">
      <article className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-medium md:text-2xl">{t.flowTitle}</h3>
              <LiveDot fetching={fetching} label={t.flowLive} />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.flowLead}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UnitToggle t={t} value={unit} onChange={setUnit} />
            <a
              href={explorerAddrUrl(BURN_ADDRESS)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-1 text-xs text-muted hover:text-fg"
            >
              {t.flowOpen}
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <LiveStat
            icon={<Waves className="size-4 text-volt" />}
            label={t.flowLiq}
            value={
              liqLast
                ? unit === "usd"
                  ? formatUsd(liqLast.liqUsd, 0)
                  : formatNum(liqLast.liqRoar, roarDigits(liqLast.liqRoar))
                : "—"
            }
            sub={liqLast ? (unit === "usd" ? `${formatNum(liqLast.liqRoar, 0)} ROAR` : formatUsd(liqLast.liqUsd, 0)) : "—"}
            delta={shiftLabel(t.flow30Liq, liq30)}
            deltaTone={liq30 >= 0 ? "volt" : "ember"}
            tone="volt"
          />
          <LiveStat
            icon={<Flame className="size-4 text-ember" />}
            label={t.flowBurn}
            value={
              liqLast
                ? unit === "usd"
                  ? formatUsd(liqLast.burnUsd, 0)
                  : formatNum(liqLast.burnRoar, roarDigits(liqLast.burnRoar))
                : "—"
            }
            sub={liqLast ? (unit === "usd" ? `${formatNum(liqLast.burnRoar, 0)} ROAR` : formatUsd(liqLast.burnUsd, 0)) : "—"}
            delta={shiftLabel(t.flow30Burn, burn30)}
            deltaTone={burn30 >= 0 ? "ember" : "volt"}
            tone="ember"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg bg-bg">
          <RangeToggle t={t} value={liqRange} onChange={setLiqRange} />
          {liqView.length >= 2 ? (
            <FlowPair
              points={liqView}
              unit={unit}
              fromZero={liqRange === "all" || liqRange === "1y"}
              a={liqView.map((row) => (unit === "usd" ? row.liqUsd : row.liqRoar))}
              b={liqView.map((row) => (unit === "usd" ? row.burnUsd : row.burnRoar))}
              aLabel={t.flowLiq}
              bLabel={t.flowBurn}
              aRoar={(row) => row.liqRoar}
              bRoar={(row) => row.burnRoar}
              aUsd={(row) => row.liqUsd}
              bUsd={(row) => row.burnUsd}
            />
          ) : (
            <p className="flex h-64 items-center justify-center text-sm text-muted">
              {flow.isError ? t.flowError : flow.isPending ? t.flowLoading : t.flowEmpty}
            </p>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">{t.flowHint}</p>
      </article>

      <article className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-medium md:text-2xl">{t.flowStakeTitle}</h3>
              <LiveDot fetching={fetching} label={t.flowLive} />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.flowStakeLead}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <LiveStat
            icon={<Lock className="size-4 text-volt" />}
            label={t.flowStake}
            value={
              stakeLast
                ? unit === "usd"
                  ? formatUsd(stakeLast.stakedUsd, 0)
                  : formatNum(stakeLast.stakedRoar, roarDigits(stakeLast.stakedRoar))
                : "—"
            }
            sub={stakeLast ? `${formatNum(stakePct, 1)}% ${t.flowStakePct}` : "—"}
            delta={shiftLabel(t.flow30Stake, stake30)}
            deltaTone={stake30 >= 0 ? "volt" : "ember"}
            tone="volt"
          />
          <LiveStat
            icon={<Waves className="size-4 text-ember" />}
            label={t.flowLiq}
            value={
              stakeLast
                ? unit === "usd"
                  ? formatUsd(stakeLast.liqUsd, 0)
                  : formatNum(stakeLast.liqRoar, roarDigits(stakeLast.liqRoar))
                : "—"
            }
            sub={stakeLast ? (unit === "usd" ? `${formatNum(stakeLast.liqRoar, 0)} ROAR` : formatUsd(stakeLast.liqUsd, 0)) : "—"}
            delta={shiftLabel(t.flow30Liq, liq30)}
            deltaTone={liq30 >= 0 ? "volt" : "ember"}
            tone="ember"
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg bg-bg">
          <RangeToggle t={t} value={stakeRange} onChange={setStakeRange} />
          {stakeView.length >= 2 ? (
            <FlowPair
              points={stakeView}
              unit={unit}
              fromZero={stakeRange === "all" || stakeRange === "1y"}
              a={stakeView.map((row) => (unit === "usd" ? row.stakedUsd : row.stakedRoar))}
              b={stakeView.map((row) => (unit === "usd" ? row.liqUsd : row.liqRoar))}
              aLabel={t.flowStake}
              bLabel={t.flowLiq}
              aRoar={(row) => row.stakedRoar}
              bRoar={(row) => row.liqRoar}
              aUsd={(row) => row.stakedUsd}
              bUsd={(row) => row.liqUsd}
            />
          ) : (
            <p className="flex h-52 items-center justify-center text-sm text-muted">
              {flow.isError ? t.flowError : flow.isPending ? t.flowLoading : t.flowEmpty}
            </p>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">{t.flowStakeHint}</p>
      </article>
    </div>
  );
}

function shiftLabel(template: string, delta: number) {
  if (!Number.isFinite(delta)) return fillAmt(template, "0");
  const signed = `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${formatNum(Math.abs(delta), 0)}`;
  return fillAmt(template, signed);
}

function LiveDot({ fetching, label }: { fetching: boolean; label: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-volt/15 px-2.5 text-[11px] font-medium text-volt">
      <span className="relative flex size-2">
        <span
          className={cn(
            "absolute inline-flex size-full rounded-full bg-volt opacity-60",
            fetching ? "animate-live-ping" : "animate-live-pulse",
          )}
        />
        <span className="relative inline-flex size-2 rounded-full bg-volt" />
      </span>
      {label}
    </span>
  );
}

function LiveStat({
  icon,
  label,
  value,
  sub,
  delta,
  deltaTone,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  delta: string;
  deltaTone: "volt" | "ember";
  tone: "volt" | "ember" | "fg";
}) {
  const color = tone === "volt" ? "text-volt" : tone === "ember" ? "text-ember" : "text-fg";
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        {icon}
        {label}
      </p>
      <p className={cn("mt-1 font-display text-xl tabular leading-none sm:text-2xl", color)}>{value}</p>
      <p className="mt-1 truncate text-[11px] tabular text-muted">{sub}</p>
      <p className={cn("mt-0.5 text-[11px] leading-snug tabular", deltaTone === "ember" ? "text-ember" : "text-volt")}>
        {delta}
      </p>
    </div>
  );
}

function UnitToggle({
  t,
  value,
  onChange,
}: {
  t: Copy;
  value: FlowUnit;
  onChange: (unit: FlowUnit) => void;
}) {
  const options: { id: FlowUnit; label: string }[] = [
    { id: "roar", label: t.flowRoar },
    { id: "usd", label: t.flowUsd },
  ];
  return (
    <div className="flex rounded-full bg-surface-2 p-0.5 shadow-[var(--shadow-border)]">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "h-11 min-w-20 rounded-full px-4 text-xs font-medium transition-[background-color,color] duration-150",
            value === opt.id ? "bg-ember text-primary-foreground" : "text-muted hover:text-fg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RangeToggle({
  t,
  value,
  onChange,
}: {
  t: Copy;
  value: FlowRange;
  onChange: (range: FlowRange) => void;
}) {
  const options: { id: FlowRange; label: string }[] = [
    { id: "1d", label: t.flowRange1d },
    { id: "7d", label: t.flowRange7d },
    { id: "30d", label: t.flowRange30 },
    { id: "90d", label: t.flowRange90 },
    { id: "1y", label: t.flowRange1y },
    { id: "all", label: t.flowRangeAll },
  ];
  return (
    <div className="flex flex-wrap gap-0.5 p-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "h-11 min-w-9 flex-1 rounded-full px-2 text-[11px] font-medium tabular transition-[background-color,color] duration-150 sm:px-3 sm:text-xs",
            value === opt.id ? "bg-volt text-bg" : "text-muted hover:text-fg",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function useHover(n: number) {
  const [hover, setHover] = useState<number | null>(null);
  function onMove(event: MouseEvent<SVGSVGElement> | TouchEvent<SVGSVGElement>) {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = "touches" in event ? event.touches[0]?.clientX : event.clientX;
    if (clientX == null) return;
    const x = (clientX - rect.left) / rect.width;
    const i = Math.min(n - 1, Math.max(0, Math.round(x * (n - 1))));
    setHover(i);
  }
  return { hover, setHover, onMove, onLeave: () => setHover(null) };
}

function FlowPair({
  points,
  unit,
  fromZero,
  a,
  b,
  aLabel,
  bLabel,
  aRoar,
  bRoar,
  aUsd,
  bUsd,
}: {
  points: RoarFlowPoint[];
  unit: FlowUnit;
  fromZero: boolean;
  a: number[];
  b: number[];
  aLabel: string;
  bLabel: string;
  aRoar: (row: RoarFlowPoint) => number;
  bRoar: (row: RoarFlowPoint) => number;
  aUsd: (row: RoarFlowPoint) => number;
  bUsd: (row: RoarFlowPoint) => number;
}) {
  const n = points.length;
  const spanSec = points[n - 1].t - points[0].t;
  const { hover, onMove, onLeave } = useHover(n);
  const i = hover ?? n - 1;
  const row = points[i];

  return (
    <div>
      <p className="px-3 pb-1 text-[11px] tabular text-muted">
        {fmtHover(row.t)}
        <span className="ml-2 text-volt">
          {aLabel} · {formatNum(aRoar(row), roarDigits(aRoar(row)))} · {formatUsd(aUsd(row), 0)}
        </span>
        <span className="ml-2 text-ember">
          {bLabel} · {formatNum(bRoar(row), roarDigits(bRoar(row)))} · {formatUsd(bUsd(row), 0)}
        </span>
      </p>
      <MiniPlot
        points={points}
        values={a}
        label={aLabel}
        color="var(--color-volt)"
        unit={unit}
        hover={hover}
        spanSec={spanSec}
        fromZero={fromZero}
        onMove={onMove}
        onLeave={onLeave}
      />
      <MiniPlot
        points={points}
        values={b}
        label={bLabel}
        color="var(--color-ember)"
        unit={unit}
        hover={hover}
        spanSec={spanSec}
        fromZero={fromZero}
        onMove={onMove}
        onLeave={onLeave}
        axis
      />
    </div>
  );
}

function MiniPlot({
  points,
  values,
  label,
  color,
  unit,
  hover,
  spanSec,
  fromZero,
  onMove,
  onLeave,
  axis,
}: {
  points: RoarFlowPoint[];
  values: number[];
  label: string;
  color: string;
  unit: FlowUnit;
  hover: number | null;
  spanSec: number;
  fromZero: boolean;
  onMove: (event: MouseEvent<SVGSVGElement> | TouchEvent<SVGSVGElement>) => void;
  onLeave: () => void;
  axis?: boolean;
}) {
  const w = 960;
  const h = 176;
  const padL = 10;
  const padR = 88;
  const padT = 22;
  const padB = axis ? 30 : 10;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = points.length;
  const { min, max, span } = useMemo(() => yDomain(values, fromZero), [values, fromZero]);
  const yOf = (v: number) => padT + ((max - v) / span) * innerH;
  const xOf = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const xs = values.map((_, i) => xOf(i));
  const ys = values.map((v) => yOf(v));
  const ticks = [0, 1 / 3, 2 / 3, 1].map((r) => min + (1 - r) * span);
  const xTicks = xTicksOf(n);
  const bottom = padT + innerH;
  const active = hover ?? n - 1;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label={label}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchStart={onMove}
      onTouchMove={onMove}
    >
      {ticks.map((tick, i) => (
        <g key={`${label}-${i}`}>
          <line
            x1={padL}
            x2={w - padR}
            y1={yOf(tick)}
            y2={yOf(tick)}
            stroke="currentColor"
            className="text-fg/10"
          />
          <text
            x={w - padR + 8}
            y={yOf(tick) + 4}
            className="fill-muted"
            fontSize="11"
            fontFamily="ui-monospace, monospace"
          >
            {fmtCompact(tick, unit)}
          </text>
        </g>
      ))}
      <path d={areaPath(xs, ys, bottom)} fill={color} opacity="0.2" />
      <path
        d={strokePath(xs, ys)}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {hover !== null ? (
        <>
          <line
            x1={xOf(hover)}
            x2={xOf(hover)}
            y1={padT}
            y2={bottom}
            stroke="currentColor"
            className="text-fg/25"
            strokeDasharray="3 4"
          />
          <circle cx={xOf(hover)} cy={ys[hover]} r="4" fill={color} />
        </>
      ) : (
        <circle cx={xOf(active)} cy={ys[active]} r="3.5" fill={color} />
      )}
      <text x={padL + 4} y={16} fill={color} fontSize="11" fontFamily="ui-sans-serif, sans-serif">
        {label}
      </text>
      {axis
        ? xTicks.map((i) => (
            <text
              key={`${points[i].t}-${i}`}
              x={xOf(i)}
              y={h - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              className="fill-muted"
              fontSize="11"
              fontFamily="ui-sans-serif, sans-serif"
            >
              {fmtAxis(points[i].t, spanSec)}
            </text>
          ))
        : null}
    </svg>
  );
}
