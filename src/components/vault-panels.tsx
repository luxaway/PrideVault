import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COLLECTION, LINKS, VAULT, explorerAddrUrl } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import type { HolderRow } from "@/lib/mx.functions";
import { formatNum, formatUsd, shortAddr } from "@/lib/utils";
import { daysLeft, occupancy } from "@/lib/vault";

function dash(n: number, digits: number) {
  return n > 0 ? formatNum(n, digits) : "—";
}

export function StatsStrip({
  t,
  staked,
  listed,
  ooxStaked,
  inWallets,
  holderCount,
  pool,
  daily,
  apr,
}: {
  t: Copy;
  staked: number;
  listed: number;
  ooxStaked: number;
  inWallets: number;
  holderCount: number;
  pool: number;
  daily: number;
  apr: number;
}) {
  const days = daysLeft();
  const items = [
    { label: t.statsPool, value: dash(pool, 0), hint: `${days} ${t.statsDaysShort}` },
    { label: t.statsOoxStake, value: dash(ooxStaked, 0), hint: `${formatNum(staked, 0)} / ${COLLECTION.supply}` },
    { label: t.statsListed, value: dash(listed, 0), hint: "OOX" },
    { label: t.statsWallets, value: formatNum(inWallets, 0), hint: `${holderCount} ${t.statsHolders.toLowerCase()}` },
    { label: t.statsDaily, value: dash(daily, 5), hint: t.statsDailyLive },
    { label: t.statsApr, value: apr > 0 ? `${formatNum(apr, 1)}%` : "—", hint: t.aprHint },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-lg px-3 py-3">
            <p className="text-[11px] text-muted">{item.label}</p>
            <p className="mt-1 font-display text-xl tabular leading-none">{item.value}</p>
            <p className="mt-1 truncate text-[11px] text-muted">{item.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BoostPanel({ t, staked, daily }: { t: Copy; staked: number; daily: number }) {
  const occ = occupancy(staked) * 100;
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">{t.boostTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t.boostLead}</p>
        </div>
        <Badge variant="volt">{dash(daily, 5)} / d</Badge>
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs text-muted">
          <span>{t.boostNow}</span>
          <span className="tabular">
            {formatNum(staked, 0)} / {COLLECTION.supply}
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-fg/8">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${occ}%`,
              background:
                "linear-gradient(90deg, var(--color-ember) 0%, var(--color-volt) 100%)",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{t.boostLive}</span>
          <span>{t.boostTarget}</span>
        </div>
      </div>
    </section>
  );
}

export function TokenomicsPanel({ t }: { t: Copy }) {
  const rows = [
    { label: t.tokVault, pct: VAULT.splitVault, color: "bg-ember" },
    { label: t.tokBurn, pct: VAULT.splitBurn, color: "bg-fg/40" },
    { label: t.tokLiq, pct: VAULT.splitLiquidity, color: "bg-volt" },
  ];
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
      <h2 className="font-display text-xl font-medium">{t.tokenomics}</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">{t.tokLead}</p>
      <div className="mt-5 flex h-3 overflow-hidden rounded-full">
        {rows.map((row) => (
          <div key={row.label} className={row.color} style={{ width: `${row.pct * 100}%` }} />
        ))}
      </div>
      <ul className="mt-4 grid gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span className={`size-2 rounded-full ${row.color}`} />
              {row.label}
            </span>
            <span className="tabular font-medium">{Math.round(row.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function holderLabel(t: Copy, h: HolderRow) {
  if (h.kind === "market") return t.market;
  if (h.kind === "ooxStake") return t.ooxStakeLabel;
  return shortAddr(h.address, 8, 6);
}

export function PridePanel({
  t,
  holders,
  heartUsd,
}: {
  t: Copy;
  holders: HolderRow[];
  heartUsd: number;
}) {
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-medium">{t.pride}</h2>
          <p className="mt-1 text-sm text-muted">{t.prideLead}</p>
        </div>
        <a
          href={LINKS.explorerCollection}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-1 text-xs text-muted hover:text-fg"
        >
          {t.explorer}
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
      <ul className="mt-5 grid gap-2">
        {holders.slice(0, 8).map((h) => (
          <li key={h.address} className="flex items-center justify-between gap-3 text-sm">
            <a
              href={explorerAddrUrl(h.address)}
              target="_blank"
              rel="noreferrer"
              className="truncate text-muted hover:text-fg"
            >
              {holderLabel(t, h)}
            </a>
            <span className="tabular font-medium">
              {formatNum(h.balance, 0)}
              <span className="ml-1 text-[11px] font-normal text-muted">
                {formatUsd(h.balance * heartUsd, 0)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Footer({ t }: { t: Copy }) {
  return (
    <footer className="border-t border-fg/8 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <p className="mx-auto max-w-6xl px-4 text-center text-xs text-muted">{t.footer}</p>
    </footer>
  );
}
