import { memo, useMemo, useState } from "react";
import { ArrowUpRight, Loader2, Trophy } from "lucide-react";
import { RoarFlowChart } from "@/components/roar-flow-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { explorerAddrUrl, LINKS } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import type { RoarBoardRow, RoarBoardSnapshot } from "@/lib/mx.functions";
import { cn, formatNum, formatUsd, shortAddr } from "@/lib/utils";

const TOP_DEFAULT = 100;

function roarDigits(n: number) {
  if (n >= 100) return 0;
  if (n >= 10) return 1;
  return 2;
}

function RankMark({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? "bg-ember text-primary-foreground" : rank === 2 ? "bg-volt text-bg" : rank === 3 ? "bg-fg/15 text-fg" : "bg-surface-2 text-muted";
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm tabular",
        tone,
      )}
    >
      {rank}
    </span>
  );
}

const HolderRow = memo(function HolderRow({
  row,
  t,
  peak,
  mine,
}: {
  row: RoarBoardRow;
  t: Copy;
  peak: number;
  mine: boolean;
}) {
  const width = peak > 0 ? Math.max(2, Math.min(100, (row.total / peak) * 100)) : 0;
  const label = row.herotag ? `@${row.herotag}` : shortAddr(row.address, 8, 6);
  return (
    <li
      className={cn(
        "content-auto relative overflow-hidden rounded-lg px-3 py-3 shadow-[var(--shadow-border)]",
        mine ? "bg-ember/12" : "bg-surface-2",
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 bg-ember/10"
        style={{ width: `${width}%` }}
      />
      <div className="relative flex items-center gap-3">
        <span className="flex w-8 shrink-0 justify-center">
          <RankMark rank={row.rank} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <a
              href={explorerAddrUrl(row.address)}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 truncate font-medium text-fg hover:text-ember"
              title={row.herotag ? `${label} · ${row.address}` : row.address}
            >
              {row.herotag ? <span className="text-ember">{label}</span> : label}
            </a>
            {mine ? <Badge>{t.boardYou}</Badge> : null}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted sm:truncate">
            {row.herotag ? <span>{shortAddr(row.address, 6, 4)}</span> : null}
            {row.herotag && row.heldDays >= 0 ? " · " : null}
            {row.heldDays >= 0 ? (
              <span>
                {formatNum(row.heldDays, 0)} {t.boardDays}
              </span>
            ) : null}
            <span className="sm:hidden">
              {(row.herotag || row.heldDays >= 0) ? " · " : null}
              {formatNum(row.wallet, roarDigits(row.wallet))} ·{" "}
              {formatNum(row.staked, roarDigits(row.staked))} {t.boardStaked.toLowerCase()}
            </span>
          </p>
        </div>
        <p className="hidden w-24 shrink-0 text-right text-sm tabular text-muted sm:block">
          {formatNum(row.wallet, roarDigits(row.wallet))}
        </p>
        <p className="hidden w-24 shrink-0 text-right text-sm tabular text-volt sm:block">
          {formatNum(row.staked, roarDigits(row.staked))}
        </p>
        <div className="w-28 shrink-0 text-right">
          <p className="font-display text-lg tabular leading-none">{formatNum(row.total, roarDigits(row.total))}</p>
          <p className="mt-1 text-[11px] tabular text-muted">{formatUsd(row.valueUsd, 0)}</p>
        </div>
      </div>
    </li>
  );
});

export function RoarBoardView({
  t,
  board,
  loading,
  address,
}: {
  t: Copy;
  board: RoarBoardSnapshot | undefined;
  loading: boolean;
  address?: string;
}) {
  const [query, setQuery] = useState("");
  const [wide, setWide] = useState(false);
  const q = query.trim().toLowerCase();
  const mine = address?.toLowerCase() ?? "";
  const peak = board?.rows[0]?.total ?? 0;
  const visible = useMemo(() => {
    const rows = board?.rows ?? [];
    const filtered = q
      ? rows.filter((row) => {
          const tag = row.herotag.toLowerCase();
          return (
            row.address.toLowerCase().includes(q) ||
            tag.includes(q.replace(/^@/, "")) ||
            `@${tag}`.includes(q) ||
            shortAddr(row.address, 8, 6).toLowerCase().includes(q)
          );
        })
      : rows;
    return q || wide ? filtered : filtered.slice(0, TOP_DEFAULT);
  }, [board?.rows, q, wide]);
  const you = board?.you;
  const youInList = Boolean(you && visible.some((row) => row.address === you.address));

  return (
    <section id="board" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-medium md:text-3xl">{t.boardTitle}</h2>
            <Badge variant="volt">{t.boardLive}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.boardLead}</p>
        </div>
        <a
          href={LINKS.explorerToken}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1 text-xs text-muted transition-colors duration-150 hover:text-fg"
        >
          {t.explorer}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]">
        <Stat label={t.boardSupply} value={board ? formatNum(board.supply, 0) : "—"} hint="ROAR" />
        <Stat
          label={t.boardBurned}
          value={board ? formatNum(board.burned, 0) : "—"}
          hint={t.boardBurnedHint}
        />
        <Stat
          label={t.boardLiq}
          value={board ? formatNum(board.liquidity, 0) : "—"}
          hint={t.boardLiqHint}
          accent
        />
      </div>

      <RoarFlowChart t={t} />

      <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t.boardHolders} value={board ? formatNum(board.holders, 0) : "—"} hint={t.onchain} />
        <Stat
          label={t.boardRanked}
          value={board ? formatNum(board.rankedRoar, 0) : "—"}
          hint="ROAR"
        />
        <Stat
          label={t.boardLiquid}
          value={board ? formatNum(board.liquidRoar, 0) : "—"}
          hint="ROAR"
        />
        <Stat
          label={t.boardStaked}
          value={board ? formatNum(board.stakedRoar, 0) : "—"}
          hint={t.farmSroar}
          accent
        />
        <Stat
          label={t.boardUsd}
          value={board ? formatUsd(board.rankedRoar * board.roarUsd, 0) : "—"}
          hint={board ? `${formatUsd(board.roarUsd, 4)} / ROAR` : t.boardPrice}
        />
        <Stat
          label={t.farmStakers}
          value={board ? formatNum(board.stakers, 0) : "—"}
          hint={t.farmSroar}
        />
      </div>

      {you ? (
        <article className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-ember" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">{t.boardYou}</p>
              <p className="truncate font-medium">
                {you.herotag ? <span className="text-ember">@{you.herotag}</span> : shortAddr(you.address, 10, 6)}
              </p>
              {you.herotag ? (
                <p className="truncate text-[11px] text-muted">{shortAddr(you.address, 8, 6)}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="font-display text-2xl tabular leading-none">#{you.rank}</p>
              <p className="mt-1 text-sm tabular text-muted">
                {formatNum(you.total, roarDigits(you.total))} ROAR
              </p>
              <p className="text-[11px] tabular text-muted">{formatUsd(you.valueUsd, 0)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 px-2 py-2">
              <p className="text-[11px] text-muted">{t.boardLiquid}</p>
              <p className="mt-1 font-display tabular">{formatNum(you.wallet, roarDigits(you.wallet))}</p>
            </div>
            <div className="rounded-lg bg-surface-2 px-2 py-2">
              <p className="text-[11px] text-muted">{t.boardStaked}</p>
              <p className="mt-1 font-display tabular text-volt">{formatNum(you.staked, roarDigits(you.staked))}</p>
            </div>
            <div className="rounded-lg bg-surface-2 px-2 py-2">
              <p className="text-[11px] text-muted">{you.heldDays >= 0 ? t.boardDays : t.boardShare}</p>
              <p className="mt-1 font-display tabular">
                {you.heldDays >= 0 ? formatNum(you.heldDays, 0) : `${formatNum(you.sharePct, 2)}%`}
              </p>
            </div>
          </div>
        </article>
      ) : null}

      <div className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.boardSearch}
          aria-label={t.boardSearch}
          className="sm:max-w-sm"
        />
        <div className="mt-4 hidden items-center gap-3 px-3 text-[11px] text-muted sm:flex">
          <span className="w-8">{t.boardRank}</span>
          <span className="min-w-0 flex-1">erd1…</span>
          <span className="w-24 text-right">{t.boardLiquid}</span>
          <span className="w-24 text-right">{t.boardStaked}</span>
          <span className="w-28 text-right">{t.boardTotal}</span>
        </div>

        {loading && !board ? (
          <div className="mt-8 flex items-center justify-center gap-2 py-12 text-sm text-muted">
            <Loader2 className="size-4 animate-spin" />
            {t.boardLoading}
          </div>
        ) : !board ? (
          <p className="mt-8 py-8 text-center text-sm text-muted">{t.boardError}</p>
        ) : visible.length === 0 ? (
          <p className="mt-8 py-8 text-center text-sm text-muted">{t.boardEmpty}</p>
        ) : (
          <ol className="mt-4 grid gap-2">
            {visible.map((row) => (
              <HolderRow
                key={row.address}
                row={row}
                t={t}
                peak={peak}
                mine={mine !== "" && row.address.toLowerCase() === mine}
              />
            ))}
          </ol>
        )}

        {you && !youInList && !q ? (
          <div className="mt-2">
            <HolderRow row={you} t={t} peak={peak} mine />
          </div>
        ) : null}

        {!q && board && board.rows.length > TOP_DEFAULT ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={() => setWide((v) => !v)}
          >
            {wide ? t.boardLess : t.boardMore}
          </Button>
        ) : null}

        <p className="mt-4 text-[11px] leading-relaxed text-muted">{t.boardHint}</p>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg px-3 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-xl tabular leading-none", accent && "text-volt")}>
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
    </div>
  );
}
