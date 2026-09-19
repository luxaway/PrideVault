import { useMemo, useState } from "react";
import { ScanLine, ShoppingBag } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Copy, Lang } from "@/lib/i18n";
import type { HeartPnl } from "@/lib/mx.functions";
import { COLLECTION } from "@/lib/config";
import { cn, formatEgld, formatEgldAmount, formatNum, formatRoarClaim, formatUsd } from "@/lib/utils";
import {
  remainingFromDaily,
  simulateFarmDays,
  weeklyBuybackRoar,
} from "@/lib/vault";

export function HeartGate({
  t,
  status,
  connected,
  onVerify,
  onConnect,
}: {
  t: Copy;
  status: "locked" | "checking" | "denied";
  connected: boolean;
  onVerify: () => void;
  onConnect: () => void;
}) {
  const denied = status === "denied";
  const checking = status === "checking";
  return (
    <section className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-lg items-center px-4 py-10">
      <article className="relative w-full overflow-hidden rounded-xl bg-surface px-6 py-10 shadow-[var(--shadow-border)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 dual-bar" />
        <div className="flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-muted">{t.heartGateBadge}</p>
          <h1 className="mt-3 font-display text-3xl font-medium tracking-wide sm:text-4xl">
            {t.heartGateTitle}
          </h1>
          <p className="mt-2 text-sm text-muted">{COLLECTION.sftId}</p>

          <div
            className={cn(
              "mt-8 rounded-xl",
              checking && "heart-scan",
            )}
          >
            <img
              src="/heart-of-roar.jpg"
              alt=""
              className={cn(
                "size-36 rounded-xl object-cover sm:size-40",
                checking && "opacity-80",
                denied && "opacity-50",
              )}
            />
          </div>

          <p className="mt-8 max-w-sm text-sm leading-relaxed text-muted">
            {denied
              ? t.heartGateDeniedLead
              : connected
                ? t.heartGateVerifyLead
                : t.heartGateConnectLead}
          </p>
          <p className="mt-3 text-xs uppercase tracking-widest text-muted">
            {checking ? t.heartGateChecking : denied ? t.heartGateDenied : t.heartGateRule}
          </p>
        </div>

        {denied ? (
          <div className="mt-8 grid gap-2">
            <Button className="h-12 w-full" size="lg" asChild>
              <a href="#buy">
                <ShoppingBag className="size-4" />
                {t.heartGateBuy}
              </a>
            </Button>
            <Button variant="outline" className="h-12 w-full" onClick={onVerify} disabled={checking}>
              <ScanLine className="size-4" />
              {t.heartGateRetry}
            </Button>
          </div>
        ) : (
          <Button
            className="mt-8 h-12 w-full"
            size="lg"
            onClick={connected ? onVerify : onConnect}
            disabled={checking}
          >
            {checking ? (
              t.heartGateChecking
            ) : connected ? (
              <>
                <ScanLine className="size-4" />
                {t.heartGateVerify}
              </>
            ) : (
              t.connectXportal
            )}
          </Button>
        )}
        <p className="mt-4 text-center text-xs text-muted">{t.heartGateFoot}</p>
      </article>
    </section>
  );
}

export function HeartPnlCard({
  t,
  lang,
  pnl,
  heartsWallet,
  heartsStaked,
  pending,
  markEgld: markUnitEgld,
  egldUsd,
  roarUsd,
  dailyPerNft,
  farmHearts,
  egldStakeApr,
  poolRoar,
}: {
  t: Copy;
  lang: Lang;
  pnl?: HeartPnl | null;
  heartsWallet: number;
  heartsStaked: number;
  pending: number;
  markEgld: number;
  egldUsd: number;
  roarUsd: number;
  dailyPerNft: number;
  farmHearts: number;
  egldStakeApr: number;
  poolRoar: number;
}) {
  const held = heartsWallet + heartsStaked;
  const investedEgld = pnl?.investedEgld ?? 0;
  const boughtQty = pnl?.boughtQty ?? 0;
  const pendingRoar = Math.max(pending, pnl?.pendingRoar ?? 0);
  const rewardsRoar = (pnl?.claimedRoar ?? 0) + pendingRoar;
  const markEgld = held * markUnitEgld;
  const investedUsd = investedEgld * egldUsd;
  const markUsd = markEgld * egldUsd;
  const rewardsUsd = rewardsRoar * roarUsd;
  const earnHearts = heartsStaked > 0 ? heartsStaked : held;
  const remaining = poolRoar > 0 ? poolRoar : remainingFromDaily(dailyPerNft, farmHearts || COLLECTION.supply);
  const weeklyRoar = weeklyBuybackRoar(egldStakeApr, egldUsd, roarUsd);
  const next30Roar = simulateFarmDays({
    days: 30,
    remaining,
    farmHearts: farmHearts || COLLECTION.supply,
    earnHearts,
    weeklyRoar,
  }).totalRoar;
  const next30Usd = next30Roar * roarUsd;
  const farmDailyRoar = Math.max(0, earnHearts * dailyPerNft);
  const pnlUsd = markUsd + rewardsUsd - investedUsd;
  const pnlPct = investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : rewardsUsd > 0 || markUsd > 0 ? 100 : 0;
  const up = pnlUsd >= 0;
  const costKnown = boughtQty > 0 && investedEgld > 0;
  const usingUnstaked = heartsStaked <= 0 && held > 0 && farmDailyRoar > 0;

  return (
    <div>
      <header className="flex items-center gap-4">
        <img
          src="/heart-of-roar.jpg"
          alt=""
          className="size-16 rounded-lg object-cover sm:size-[4.5rem]"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.heartPnlKicker}</p>
          <h2 className="mt-1 font-display text-2xl font-medium leading-none">{t.heartPnlTitle}</h2>
          <p className="mt-2 text-sm text-muted">
            {formatNum(held, 0)} Heart
            {heartsStaked > 0 ? ` · ${formatNum(heartsStaked, 0)} ${t.onFarm.toLowerCase()}` : ""}
            {usingUnstaked ? ` · ${t.heartPaybackIfStake}` : ""}
          </p>
        </div>
        <Badge variant={up ? "volt" : "mute"}>{up ? t.heartPnlUp : t.heartPnlDown}</Badge>
      </header>

      <div className="mt-8">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.heartPnlNet}</p>
        <p
          className={cn(
            "mt-2 font-display text-4xl tabular leading-none sm:text-5xl",
            up ? "text-volt" : "text-ember",
          )}
        >
          {pnlUsd >= 0 ? "+" : "−"}
          {formatUsd(Math.abs(pnlUsd))}
        </p>
        <p className="mt-2 text-sm text-muted">
          {costKnown
            ? `${pnlPct >= 0 ? "+" : ""}${formatNum(pnlPct, 1)}% ${t.heartPnlVsCost}`
            : t.heartPnlNoCost}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 divide-x divide-y divide-border border-y border-border">
        <RoiCell
          label={t.heartPnlInvested}
          value={costKnown ? formatEgldAmount(investedEgld, 2) : "—"}
          hint={costKnown ? formatUsd(investedUsd) : t.heartPnlUnknown}
        />
        <RoiCell
          label={t.heartPnlMark}
          value={markUnitEgld > 0 ? formatEgldAmount(markEgld, 2) : "—"}
          hint={markUnitEgld > 0 ? formatUsd(markUsd) : t.heartPnlNoSales}
        />
        <RoiCell
          label={t.heartPnlRewards}
          value={moneyUsd(rewardsUsd)}
          hint={`${formatRoarClaim(rewardsRoar)} ROAR`}
        />
        <RoiCell
          label={t.heartPnlNext30}
          value={`${formatRoarClaim(next30Roar)} ROAR`}
          hint={`${formatEgld(egldUsd > 0 ? next30Usd / egldUsd : 0, 4)} · ${moneyUsd(next30Usd)}`}
        />
        <RoiCell
          label={t.heartDailyNft}
          value={`${formatRoarClaim(dailyPerNft)} ROAR`}
          hint={t.heartDailyNftHint}
        />
        <RoiCell
          label={t.heartDailyTotal}
          value={`${formatRoarClaim(farmDailyRoar)} ROAR`}
          hint={`${formatNum(earnHearts, 0)} Heart`}
        />
      </div>

      <WeekRoiChart
        t={t}
        lang={lang}
        remaining={remaining}
        farmHearts={farmHearts || COLLECTION.supply}
        earnHearts={earnHearts}
        weeklyRoar={weeklyRoar}
        egldUsd={egldUsd}
        roarUsd={roarUsd}
        costEgld={costKnown && investedEgld > 0 ? investedEgld : earnHearts * COLLECTION.mintPriceEgld}
        startRoar={rewardsRoar}
      />
    </div>
  );
}

function WeekRoiChart({
  t,
  lang,
  remaining,
  farmHearts,
  earnHearts,
  weeklyRoar,
  egldUsd,
  roarUsd,
  costEgld,
  startRoar,
}: {
  t: Copy;
  lang: Lang;
  remaining: number;
  farmHearts: number;
  earnHearts: number;
  weeklyRoar: number;
  egldUsd: number;
  roarUsd: number;
  costEgld: number;
  startRoar: number;
}) {
  const [unit, setUnit] = useState<WeekUnit>("USD");
  const [span, setSpan] = useState(100);
  const locale = lang === "fr" ? "fr-CA" : "en-US";
  const sim = useMemo(
    () =>
      simulateFarmDays({
        days: GLOBAL_DAYS,
        remaining,
        farmHearts,
        earnHearts,
        weeklyRoar,
      }),
    [remaining, farmHearts, earnHearts, weeklyRoar],
  );
  const apr = useMemo(() => {
    const toEgld = (roar: number) => (egldUsd > 0 ? (roar * roarUsd) / egldUsd : 0);
    const pct = (egld: number) => (costEgld > 0 ? (egld / costEgld) * 100 : 0);
    const d30 = sim.days.slice(0, 30).reduce((s, d) => s + d.userRoar, 0);
    const d365 = sim.days.slice(0, 365).reduce((s, d) => s + d.userRoar, 0);
    return {
      d30: pct(toEgld(d30)) * (365 / 30),
      y1: pct(toEgld(d365)),
    };
  }, [sim, egldUsd, roarUsd, costEgld]);
  const toUnit = (roar: number) => {
    if (unit === "ROAR") return roar;
    if (unit === "EGLD") return egldUsd > 0 ? (roar * roarUsd) / egldUsd : 0;
    return roar * roarUsd;
  };
  const costUnit =
    unit === "EGLD"
      ? costEgld
      : unit === "USD"
        ? costEgld * egldUsd
        : roarUsd > 0
          ? (costEgld * egldUsd) / roarUsd
          : 0;
  const roarPerEgld = egldUsd > 0 && roarUsd > 0 ? egldUsd / roarUsd : 0;
  const liveRoar = Math.max(0, startRoar);
  const paybackDay = useMemo(() => {
    if (!(costEgld > 0) || roarPerEgld <= 0) return 0;
    const need = costEgld * roarPerEgld;
    let acc = liveRoar;
    if (acc >= need) return 1;
    for (let i = 0; i < sim.days.length; i++) {
      acc += sim.days[i].userRoar;
      if (acc >= need) return i + 1;
    }
    return 0;
  }, [sim, costEgld, roarPerEgld, liveRoar]);
  const horizon = Math.min(
    GLOBAL_DAYS,
    Math.max(365 * 3, paybackDay > 0 ? Math.ceil(paybackDay * 1.12) : GLOBAL_DAYS),
  );
  const windowDays = sim.days.slice(0, horizon);
  const totalRoar = liveRoar + windowDays.reduce((s, d) => s + d.userRoar, 0);
  const total = toUnit(totalRoar);
  const series = useMemo(
    () => buildCumSeries(sim.days.slice(0, horizon), toUnit, costUnit, liveRoar),
    [sim, horizon, unit, costUnit, liveRoar],
  );
  const fromDate = series[0]?.at ?? Date.now();
  const viewEnd = Math.max(1, Math.round(((series.length - 1) * span) / 100));
  const view = series.slice(0, viewEnd + 1);
  const toDate = view.at(-1)?.at ?? Date.now();
  const viewHorizon = Math.max(1, Math.round((horizon * span) / 100));

  return (
    <div className="mt-8 border-t border-border pt-8">
      <div className="grid grid-cols-2 divide-x divide-border border-y border-border">
        <RoiCell
          label={t.heartApr30}
          value={Number.isFinite(apr.d30) ? `${formatNum(apr.d30, 1)}%` : "—"}
          hint={t.heartApr30Hint}
        />
        <RoiCell
          label={t.heartApr1y}
          value={Number.isFinite(apr.y1) ? `${formatNum(apr.y1, 1)}%` : "—"}
          hint={t.heartApr1yHint}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.heartWeekKicker}</p>
          <p className="mt-2 font-display text-3xl tabular leading-none">{fmtWeek(total, unit)}</p>
          <p className="mt-2 text-sm text-muted">{t.heartWeekTotal}</p>
        </div>
        <div className="flex rounded-full bg-bg p-0.5 shadow-[var(--shadow-border)]">
          {(["ROAR", "EGLD", "USD"] as WeekUnit[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setUnit(id)}
              className={cn(
                "h-11 min-w-12 rounded-full px-3 text-xs font-medium transition-[background-color,color] duration-150",
                unit === id ? "bg-volt text-bg" : "text-muted hover:text-fg",
              )}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-5 text-sm text-muted">
        {formatSpan(fromDate, toDate, locale)}
        {paybackDay > 0 ? ` · ${t.heartChartDone} ${formatDay(fromDate + paybackDay * 86_400_000, locale)}` : ""}
      </p>

      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={view} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgb(238 242 248 / 0.06)" vertical={false} />
            <XAxis
              dataKey="at"
              type="number"
              domain={["dataMin", "dataMax"]}
              scale="time"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{ fill: "var(--color-muted)", fontSize: 11 }}
              tickFormatter={(ts) => formatTick(Number(ts), locale, viewHorizon)}
            />
            <YAxis hide domain={[0, "auto"]} />
            <Tooltip
              cursor={{ stroke: "rgb(238 242 248 / 0.16)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as { at: number; earned: number };
                const earned = Number(row?.earned ?? 0);
                const left = Math.max(0, costUnit - earned);
                const done = costUnit > 0 && earned >= costUnit;
                return (
                  <div className="rounded-lg bg-surface px-3 py-2 text-xs shadow-[var(--shadow-border)]">
                    <p className="text-muted">{formatDay(row.at, locale)}</p>
                    <p className="mt-1 tabular text-ember">
                      {t.heartChartEarned} · {fmtWeek(earned, unit)}
                    </p>
                    {costUnit > 0 ? (
                      <p className="tabular text-volt">
                        {t.heartChartCost} · {fmtWeek(costUnit, unit)}
                      </p>
                    ) : null}
                    {costUnit > 0 ? (
                      <p className="mt-1 tabular font-medium">
                        {done ? t.heartChartDone : `${t.heartChartLeft} · ${fmtWeek(left, unit)}`}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="earned"
              stroke="var(--color-ember)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-ember)" }}
            />
            {costUnit > 0 ? (
              <Line
                type="monotone"
                dataKey="cost"
                stroke="var(--color-volt)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted shadow-[var(--shadow-border)] hover:text-fg"
          onClick={() => setSpan((n) => Math.max(15, n - 15))}
          aria-label="−"
        >
          −
        </button>
        <input
          type="range"
          min={15}
          max={100}
          step={1}
          value={span}
          onChange={(e) => setSpan(Number(e.target.value))}
          className="heart-zoom"
          aria-label={t.heartWeekKicker}
        />
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted shadow-[var(--shadow-border)] hover:text-fg"
          onClick={() => setSpan((n) => Math.min(100, n + 15))}
          aria-label="+"
        >
          +
        </button>
      </div>
      {costUnit > 0 ? (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-ember" />
            {t.heartChartEarned}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-3 bg-volt" />
            {t.heartChartCost}
          </span>
        </div>
      ) : null}
    </div>
  );
}

type WeekUnit = "ROAR" | "EGLD" | "USD";

const GLOBAL_DAYS = 365 * 8;
const GLOBAL_POINTS = 16;

function buildCumSeries(
  days: { userRoar: number }[],
  toUnit: (roar: number) => number,
  costUnit: number,
  startRoar: number,
) {
  const len = days.length;
  const n = Math.min(GLOBAL_POINTS, Math.max(8, len));
  const rows: { at: number; earned: number; cost: number }[] = [];
  let acc = Math.max(0, startRoar);
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  rows.push({
    at: now.getTime(),
    earned: toUnit(acc),
    cost: costUnit,
  });
  for (let i = 0; i < n; i++) {
    const from = Math.round((i * len) / n);
    const to = Math.round(((i + 1) * len) / n);
    for (let d = from; d < to; d++) acc += days[d]?.userRoar ?? 0;
    const start = new Date(now);
    start.setDate(start.getDate() + to);
    rows.push({ at: start.getTime(), earned: toUnit(acc), cost: costUnit });
  }
  return rows;
}

function formatTick(ts: number, locale: string, horizonDays: number) {
  const d = new Date(ts);
  if (horizonDays > 400) {
    return d.toLocaleDateString(locale, { month: "short", year: "2-digit" }).replace(/\.$/, "");
  }
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" }).replace(/\.$/, "");
}

function formatDay(ts: number, locale: string) {
  return new Date(ts).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).replace(/\.$/, "");
}

function formatSpan(from: number, to: number, locale: string) {
  return `${formatDay(from, locale)} → ${formatDay(to, locale)}`;
}

function fmtWeek(n: number, unit: WeekUnit) {
  if (!Number.isFinite(n) || n <= 0) {
    return unit === "USD" ? "$0.00" : unit === "EGLD" ? "0 EGLD" : "0 ROAR";
  }
  if (unit === "USD") return moneyUsd(n);
  if (unit === "EGLD") return `${formatFine(n)} EGLD`;
  return `${formatFine(n)} ROAR`;
}

function formatFine(n: number) {
  const abs = Math.abs(n);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function moneyUsd(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return formatUsd(n, digits);
}

function RoiCell({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="px-3 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 truncate font-display text-xl tabular leading-none">{value}</p>
      <p className="mt-1.5 truncate text-xs text-muted">{hint}</p>
    </div>
  );
}
