import { memo, useEffect, useMemo, useState } from "react";
import { Activity, Minus, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LionRun } from "@/components/lion-run";
import { COLLECTION, CHAIN, LINKS, explorerTxUrl } from "@/lib/config";
import type { Copy, Lang } from "@/lib/i18n";
import type { HeartActivity, MarketListing, MarketSnapshot } from "@/lib/mx.functions";
import {
  cn,
  formatEgld,
  formatNum,
  formatPct,
  formatUsd,
  shortAddr,
  timeAgo,
} from "@/lib/utils";

type Tick = { t: number; roar: number; floor: number };

export function MarketBoard({
  t,
  lang,
  market,
  now,
  fetching,
  updatedAt,
  canSign,
  sessionLost,
  buyingId,
  buyingStake = false,
  egldWallet,
  onBuy,
  onBuyStake,
  onConnect,
  onNeedSwap,
  pane = "buy",
}: {
  t: Copy;
  lang: Lang;
  market: MarketSnapshot | undefined;
  now: number;
  fetching: boolean;
  updatedAt: number;
  canSign: boolean;
  sessionLost: boolean;
  buyingId: number | null;
  buyingStake?: boolean;
  egldWallet: number;
  onBuy: (listing: MarketListing, quantity: number) => void;
  onBuyStake?: (listing: MarketListing, quantity: number) => void;
  onConnect: () => void;
  onNeedSwap: () => void;
  pane?: "buy" | "stats";
}) {
  const [ticks, setTicks] = useState<Tick[]>([]);

  useEffect(() => {
    if (!market) return;
    setTicks((prev) => {
      const last = prev[prev.length - 1];
      if (
        last &&
        last.roar === market.roarPriceUsd &&
        last.floor === market.floorEgld
      ) {
        return prev;
      }
      return [
        ...prev,
        { t: market.fetchedAt, roar: market.roarPriceUsd, floor: market.floorEgld },
      ].slice(-36);
    });
  }, [market]);

  const spark = useMemo(() => {
    if (!market) return [];
    const seed = market.roarPrev24h > 0 ? [market.roarPrev24h] : [];
    const live = ticks.map((x) => x.roar).filter((n) => n > 0);
    const current = market.roarPriceUsd > 0 ? [market.roarPriceUsd] : [];
    const values = [...seed, ...live, ...current];
    const out: number[] = [];
    for (const v of values) {
      if (out[out.length - 1] !== v) out.push(v);
    }
    return out;
  }, [market, ticks]);

  const listings = market?.listings ?? [];
  const featured = listings[0];
  const rest = listings.slice(1);

  const sale = market?.listedForSale ?? 0;
  const ooxStaked = market?.ooxStaked ?? 0;
  const wallets = market?.inWallets ?? 0;

  return (
    <section id={pane === "buy" ? "buy" : "stats-market"} className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-medium md:text-3xl">
              {pane === "buy" ? t.marketTitle : t.statsTitle}
            </h2>
            <LiveBadge t={t} fetching={fetching} />
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            {pane === "buy" ? t.marketLead : t.statsLead}
          </p>
        </div>
        <p className="text-[11px] text-muted tabular">
          {t.marketUpdating} {timeAgo(updatedAt || market?.fetchedAt || 0, lang, now)}
        </p>
      </div>

      {!market ? (
        <p className="mt-6 text-sm text-muted">{t.loadingMarket}</p>
      ) : (
        <>
          {pane === "buy" ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              {featured ? (
                <ListingCard
                  key={featured.auctionId}
                  t={t}
                  listing={featured}
                  featured
                  canSign={canSign}
                  sessionLost={sessionLost}
                  buying={buyingId === featured.auctionId}
                  buyingStake={buyingStake}
                  egldWallet={egldWallet}
                  onBuy={onBuy}
                  onBuyStake={onBuyStake}
                  onConnect={onConnect}
                  onNeedSwap={onNeedSwap}
                />
              ) : (
                <EmptyListings t={t} />
              )}
              <div className="grid gap-4">
                {rest.map((row) => (
                  <ListingCard
                    key={row.auctionId}
                    t={t}
                    listing={row}
                    canSign={canSign}
                    sessionLost={sessionLost}
                    buying={buyingId === row.auctionId}
                    buyingStake={buyingStake}
                    egldWallet={egldWallet}
                    onBuy={onBuy}
                    onBuyStake={onBuyStake}
                    onConnect={onConnect}
                    onNeedSwap={onNeedSwap}
                  />
                ))}
              </div>
            </div>
          ) : (
            <>
              <HeartStats t={t} lang={lang} market={market} now={now} />
              <RoarStats t={t} market={market} spark={spark} />
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <PairsPanel t={t} market={market} />
                <ActivityPanel t={t} lang={lang} market={market} now={now} />
              </div>
              <div className="mt-4">
                <SupplySplit t={t} sale={sale} ooxStaked={ooxStaked} wallets={wallets} />
              </div>
            </>
          )}
          {pane === "buy" ? <p className="mt-4 text-[11px] text-muted">{t.buyNote}</p> : null}
        </>
      )}
    </section>
  );
}

function LiveBadge({ t, fetching }: { t: Copy; fetching: boolean }) {
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
      {t.marketLive}
      {fetching ? <RefreshCw className="size-3 animate-spin" /> : null}
    </span>
  );
}

const ListingCard = memo(function ListingCard({
  t,
  listing,
  featured = false,
  canSign,
  sessionLost,
  buying,
  buyingStake = false,
  egldWallet,
  onBuy,
  onBuyStake,
  onConnect,
  onNeedSwap,
}: {
  t: Copy;
  listing: MarketListing;
  featured?: boolean;
  canSign: boolean;
  sessionLost: boolean;
  buying: boolean;
  buyingStake?: boolean;
  egldWallet: number;
  onBuy: (listing: MarketListing, quantity: number) => void;
  onBuyStake?: (listing: MarketListing, quantity: number) => void;
  onConnect: () => void;
  onNeedSwap: () => void;
}) {
  const unit = listing.auctionType === "SftOnePerPayment";
  const [qty, setQty] = useState(1);
  useEffect(() => {
    setQty(1);
  }, [listing.auctionId]);
  const max = Math.max(1, listing.amount);
  const amount = unit ? Math.min(max, Math.max(1, qty)) : 1;
  const total = listing.priceEgld * amount;
  const shortEgld = canSign && egldWallet + 1e-12 < total;
  const shortEgldStake = canSign && egldWallet + 1e-12 < total + CHAIN.buyStakeKeepEgld;
  const busyBuy = buying && !buyingStake;
  const busyStake = buying && buyingStake;
  const buyCta = busyBuy
    ? t.buying
    : sessionLost
      ? t.reconnectXportal
      : canSign && shortEgld
        ? t.navSwap
        : t.buyNow;
  const stakeCta = busyStake
    ? t.buyingStake
    : sessionLost
      ? t.reconnectXportal
      : canSign && shortEgldStake
        ? t.navSwap
        : t.buyAndStake;

  function go(kind: "buy" | "stake") {
    if (!canSign) {
      onConnect();
      return;
    }
    if (kind === "stake" ? shortEgldStake : shortEgld) {
      onNeedSwap();
      return;
    }
    if (kind === "stake") onBuyStake?.(listing, amount);
    else onBuy(listing, amount);
  }

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-5",
        featured ? "flex-col sm:flex-row sm:items-stretch" : "flex-row items-start",
      )}
    >
      {featured ? <span className="dual-bar absolute inset-x-0 top-0 h-0.5" /> : null}
      <img
        src="/heart-of-roar.jpg"
        alt={listing.name}
        className={cn(
          "rounded-lg object-cover",
          featured ? "aspect-square w-full sm:w-44" : "size-24 sm:size-28",
        )}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{unit ? t.unitBuy : t.uniqueLot}</Badge>
          <Badge variant="mute">#{listing.auctionId}</Badge>
        </div>
        <h3 className="mt-2 font-display text-xl font-medium leading-tight">{listing.name}</h3>
        <p className="mt-1 text-sm text-muted">
          {formatNum(listing.amount, 0)} {t.available}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
          <p className="font-display text-3xl tabular leading-none">{formatEgld(listing.priceEgld, 2)}</p>
          <p className="text-sm text-muted tabular">
            {formatUsd(listing.priceUsd, 2)} · {t.unit}
          </p>
        </div>
        {unit ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{t.buyQty}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                aria-label={t.qtyMinus}
              >
                <Minus />
              </Button>
              <span className="tabular w-10 text-center text-lg font-medium">{amount}</span>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                onClick={() => setQty((n) => Math.min(max, n + 1))}
                aria-label={t.qtyPlus}
              >
                <Plus />
              </Button>
            </div>
          </div>
        ) : null}
        <p className="mt-2 text-sm text-muted tabular">
          {t.buyTotal} {formatEgld(total, 2)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-auto">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            disabled={buying}
            onClick={() => go("buy")}
          >
            {busyBuy ? <LionRun size="sm" label={t.txRun} /> : null}
            {buyCta}
          </Button>
          <Button
            size="lg"
            variant={featured ? "default" : "volt"}
            className="w-full"
            disabled={buying || !onBuyStake}
            onClick={() => go("stake")}
          >
            {busyStake ? <LionRun size="sm" label={t.txRun} /> : null}
            {stakeCta}
          </Button>
        </div>
        {shortEgld ? <p className="mt-2 text-[11px] text-ember">{t.needEgld}</p> : null}
      </div>
    </article>
  );
});

function EmptyListings({ t }: { t: Copy }) {
  return (
    <article className="rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
      <h3 className="font-display text-xl font-medium">{t.noListings}</h3>
      <Button className="mt-4" variant="outline" asChild>
        <a href={LINKS.ooxCollection} target="_blank" rel="noreferrer">
          {t.seeCollection}
        </a>
      </Button>
    </article>
  );
}

function SupplySplit({
  t,
  sale,
  ooxStaked,
  wallets,
}: {
  t: Copy;
  sale: number;
  ooxStaked: number;
  wallets: number;
}) {
  const total = COLLECTION.supply || 1;
  const rows = [
    { label: t.splitSale, n: sale, color: "bg-volt" },
    { label: t.splitOoxStake, n: ooxStaked, color: "bg-ember" },
    { label: t.splitWallets, n: wallets, color: "bg-fg/20" },
  ];
  return (
    <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <h3 className="font-display text-lg font-medium">{t.supplySplit}</h3>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full">
        {rows.map((row) => (
          <div
            key={row.label}
            className={row.color}
            style={{ width: `${Math.max(0, (row.n / total) * 100)}%` }}
          />
        ))}
      </div>
      <ul className="mt-4 grid gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span className={`size-2 rounded-full ${row.color}`} />
              {row.label}
            </span>
            <span className="tabular font-medium">{formatNum(row.n, 0)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-muted">
        {COLLECTION.supply} Heart · {t.onchain}
      </p>
    </article>
  );
}

function HeartStats({
  t,
  lang,
  market,
  now,
}: {
  t: Copy;
  lang: Lang;
  market: MarketSnapshot;
  now: number;
}) {
  const saleHint =
    market.lastSaleQty > 1
      ? `${formatNum(market.lastSaleQty, 0)} Heart`
      : "Heart";
  const items = [
    { label: t.floor, value: formatEgld(market.floorEgld, 2), hint: formatUsd(market.floorUsd, 2) },
    { label: t.listedSale, value: formatNum(market.listedForSale, 0), hint: "Heart" },
    {
      label: t.lastSale,
      value: formatEgld(market.lastSaleEgld, 2),
      hint: `${saleHint} · ${timeAgo(market.lastSaleAt, lang, now)}`,
    },
    { label: t.heartHolders, value: formatNum(market.heartHolders, 0), hint: t.statsHolders },
    { label: t.heartTransfers, value: formatNum(market.heartTransfers, 0), hint: t.onchain },
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <StatCell key={item.label} {...item} />
      ))}
    </div>
  );
}

function RoarStats({
  t,
  market,
  spark,
}: {
  t: Copy;
  market: MarketSnapshot;
  spark: number[];
}) {
  const up = market.roarChange24h >= 0;
  const items = [
    { label: t.roarPrice, value: formatUsd(market.roarPriceUsd, 4), hint: "ROAR-e5185d" },
    { label: t.change24h, value: formatPct(market.roarChange24h, 1), hint: t.vs24h, up },
    { label: t.roarVol, value: formatUsd(market.roarVolume24h, 0), hint: t.change24h },
    { label: t.roarMcap, value: formatUsd(market.roarMcap, 0), hint: formatNum(market.roarCirculating, 0) },
    { label: t.roarHolders, value: formatNum(market.roarHolders, 0), hint: t.statsHolders },
    { label: t.tvl, value: formatUsd(market.tvlUsd, 0), hint: "xExchange" },
  ];
  return (
    <div className="mt-4 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)]">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((item) => (
          <StatCell key={item.label} {...item} />
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 pb-3 pt-1">
        <p className="shrink-0 text-[11px] text-muted">{t.evolution}</p>
        <Sparkline values={spark} up={up} />
        <p className="shrink-0 text-[11px] text-muted tabular">
          {formatUsd(market.roarPrev24h, 4)} → {formatUsd(market.roarPriceUsd, 4)}
        </p>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  hint,
  up,
}: {
  label: string;
  value: string;
  hint: string;
  up?: boolean;
}) {
  return (
    <div className="rounded-lg px-3 py-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-xl tabular leading-none",
          up === true && "text-volt",
          up === false && "text-ember",
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function Sparkline({ values, up }: { values: number[]; up: boolean }) {
  if (values.length < 2) {
    return <div className="h-8 w-full" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 160;
  const h = 40;
  const pad = 2;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full min-w-0 overflow-visible" aria-hidden preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={up ? "var(--color-volt)" : "var(--color-ember)"}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
}

function PairsPanel({ t, market }: { t: Copy; market: MarketSnapshot }) {
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-medium">{t.pairsTitle}</h3>
        <a
          href="#swap"
          className="inline-flex h-11 items-center gap-1 text-xs text-muted hover:text-fg"
        >
          {t.swap}
        </a>
      </div>
      <ul className="mt-4 grid gap-1">
        {market.pairs.map((p) => (
          <li key={p.id}>
            <a
              href={p.swapUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {p.baseSymbol} / {p.quoteSymbol}
                </p>
                <p className="text-[11px] text-muted">
                  {t.pairTvl} {formatUsd(p.tvlUsd, 0)} · {t.pairTrades} {formatNum(p.trades24h, 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="tabular text-sm font-medium">{formatUsd(p.volume24h, 0)}</p>
                <p className="text-[11px] text-muted">{t.pairVol}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityPanel({
  t,
  lang,
  market,
  now,
}: {
  t: Copy;
  lang: Lang;
  market: MarketSnapshot;
  now: number;
}) {
  const labels: Record<HeartActivity["kind"], string> = {
    ooxStake: t.kindOoxStake,
    unstake: t.kindUnstake,
    sale: t.kindSale,
    list: t.kindList,
    transfer: t.kindTransfer,
  };
  return (
    <section className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-medium">{t.activityTitle}</h3>
        <Activity className="size-4 text-muted" />
      </div>
      <ul className="mt-4 grid gap-1">
        {market.activity.length === 0 ? (
          <li className="px-2 py-2 text-sm text-muted">{t.noHistory}</li>
        ) : (
          market.activity.map((row) => (
            <li key={row.hash}>
              <a
                href={explorerTxUrl(row.hash)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className={row.kind === "sale" ? "text-volt" : "text-fg"}>{labels[row.kind]}</span>
                    <span className="text-muted">
                      {" "}
                      · {formatNum(row.quantity, 0)} Heart
                      {row.kind === "sale" && row.valueEgld > 0
                        ? ` · ${formatEgld(row.valueEgld, 2)}`
                        : ""}
                    </span>
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted">
                    {shortAddr(row.sender, 6, 4)} → {shortAddr(row.receiver, 6, 4)}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted tabular">
                  {timeAgo(row.timestamp, lang, now)}
                </span>
              </a>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
