import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, Check, ChevronsUpDown, Lock, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LionRun } from "@/components/lion-run";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SLIPPAGE_PCTS, TOKEN, isHatomAsset, swapEgldKeep, type SlippagePct, type SwapDirection } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import {
  getSwapCatalog,
  getSwapPool,
  getSwapAggRate,
  type SwapCatalogToken,
} from "@/lib/mx.functions";
import { quoteFromAggRate, quoteFromPool, type PoolQuote } from "@/lib/swap-math";
import { useVaultStore } from "@/lib/store";
import { cn, formatEgld, formatNum, isTokenId } from "@/lib/utils";

export function SwapDesk({
  t,
  canSign,
  sessionLost,
  balances,
  roarUsd,
  busy,
  dustBusy = false,
  dustLoading = false,
  dustTokens = [],
  focusToken,
  onSwap,
  onDust,
  onConnect,
}: {
  t: Copy;
  canSign: boolean;
  sessionLost: boolean;
  balances: Record<string, number>;
  roarUsd: number;
  busy: boolean;
  dustBusy?: boolean;
  dustLoading?: boolean;
  dustTokens?: { id: string; ticker: string; amount: number; valueUsd: number; icon: string }[];
  focusToken?: string | null;
  onSwap: (tokenId: string, direction: SwapDirection, amount: number) => void;
  onDust?: (tokenIds: string[]) => void;
  onConnect: () => void;
}) {
  const [tokenId, setTokenId] = useState("EGLD");
  const [direction, setDirection] = useState<SwapDirection>("to-roar");
  const [raw, setRaw] = useState("1");
  const [pickOpen, setPickOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dustPicked, setDustPicked] = useState<string[]>([]);
  const [dustFilter, setDustFilter] = useState("");
  const queryClient = useQueryClient();

  const catalog = useQuery({
    queryKey: ["swap-catalog"],
    queryFn: () => getSwapCatalog(),
    staleTime: 20_000,
    refetchInterval: 45_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (!focusToken) return;
    if (focusToken === TOKEN.identifier || focusToken === "ROAR") {
      setDirection("from-roar");
      return;
    }
    setTokenId(focusToken);
    setDirection("to-roar");
  }, [focusToken]);

  const dustIds = useMemo(() => dustTokens.map((row) => row.id).join("|"), [dustTokens]);
  useEffect(() => {
    setDustPicked(dustIds ? dustIds.split("|") : []);
    setDustFilter("");
  }, [dustIds]);

  const dustPickedSet = useMemo(() => new Set(dustPicked), [dustPicked]);
  const dustVisible = useMemo(() => {
    const q = dustFilter.trim().toLowerCase();
    if (!q) return dustTokens;
    return dustTokens.filter(
      (row) => row.ticker.toLowerCase().includes(q) || row.id.toLowerCase().includes(q),
    );
  }, [dustTokens, dustFilter]);
  const dustSelected = useMemo(
    () => dustTokens.filter((row) => dustPickedSet.has(row.id)),
    [dustTokens, dustPickedSet],
  );
  const dustSelectedUsd = dustSelected.reduce((sum, row) => sum + row.valueUsd, 0);
  const dustSelectedRoar = roarUsd > 0 ? dustSelectedUsd / roarUsd : 0;
  const allDustOn = dustTokens.length > 0 && dustPicked.length === dustTokens.length;

  const tokens = useMemo(() => {
    const byId = new Map<string, SwapCatalogToken>();
    for (const row of catalog.data ?? []) byId.set(row.id, row);
    for (const [id, amt] of Object.entries(balances)) {
      if (!(amt > 0)) continue;
      if (id === TOKEN.identifier || id === "ROAR") continue;
      if (id !== "EGLD" && !isTokenId(id)) continue;
      if (byId.has(id)) continue;
      if (/LP/i.test(id) || /jexlp/i.test(id)) continue;
      byId.set(id, walletToken(id));
    }
    return [...byId.values()];
  }, [catalog.data, balances]);
  const token =
    tokens.find((row) => row.id === tokenId) ??
    tokens.find((row) => row.id === "EGLD") ??
    fallbackEgld();

  const amount = Number(raw);
  const valid = Number.isFinite(amount) && amount > 0;
  const toRoar = direction === "to-roar";
  const otherBal = balances[token.id] ?? 0;
  const roarBal = balances[TOKEN.identifier] ?? balances.ROAR ?? 0;
  const fromBal = toRoar ? otherBal : roarBal;
  const toBal = toRoar ? roarBal : otherBal;
  const maxFrom = toRoar && token.wrap ? Math.max(0, fromBal - swapEgldKeep()) : fromBal;
  const spend = valid ? (toRoar && token.wrap ? Math.min(amount, maxFrom) : amount) : 0;
  const spendOk = spend > 0 && Number.isFinite(spend);

  const locked = busy || dustBusy;
  const slippage = useVaultStore((s) => s.slippage);
  const usePool = token.id === "EGLD";

  const pool = useQuery({
    queryKey: ["swap-pool", "EGLD"],
    queryFn: () => getSwapPool({ data: { tokenId: "EGLD" } }),
    enabled: usePool,
    staleTime: 2_000,
    refetchInterval: locked ? false : 4_000,
    placeholderData: keepPreviousData,
  });

  const agg = useQuery({
    queryKey: ["swap-agg-rate", token.id, direction],
    queryFn: () => getSwapAggRate({ data: { tokenId: token.id, direction } }),
    enabled: !usePool && Boolean(token.id) && token.id !== TOKEN.identifier,
    staleTime: 4_000,
    refetchInterval: locked ? false : 6_000,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const ids = Object.entries(balances)
      .filter(([id, amt]) => amt > 0 && id !== "EGLD" && id !== TOKEN.identifier && isTokenId(id) && !/LP/i.test(id) && !isHatomAsset(id))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    for (const id of ids) {
      void queryClient.prefetchQuery({
        queryKey: ["swap-agg-rate", id, "to-roar"],
        queryFn: () => getSwapAggRate({ data: { tokenId: id, direction: "to-roar" } }),
        staleTime: 8_000,
      });
    }
  }, [balances, queryClient]);

  const q: PoolQuote | undefined = useMemo(() => {
    if (!spendOk) return undefined;
    if (usePool) {
      const row = pool.data;
      if (!row || row.tokenId !== "EGLD") return undefined;
      return quoteFromPool(row, direction, spend, slippage) ?? undefined;
    }
    const row = agg.data;
    if (!row || row.tokenId !== token.id) return undefined;
    return quoteFromAggRate(row, direction, spend, slippage) ?? undefined;
  }, [spendOk, usePool, pool.data, agg.data, token.id, direction, spend, slippage]);
  const quoteBusy = usePool ? pool.isFetching && !q : agg.isFetching && !q;
  const quoteErr = usePool ? pool.isError : agg.isError;
  const quoteErrMsg = usePool
    ? pool.error instanceof Error
      ? pool.error.message
      : t.swapError
    : agg.error instanceof Error
      ? agg.error.message
      : t.swapError;
  const enough = valid && amount <= fromBal + 1e-12 && (!toRoar || !token.wrap || maxFrom > 0);
  const fromDigits = toRoar ? (token.ticker === "USDC" ? 2 : 6) : 4;
  const toDigits = toRoar ? 2 : token.ticker === "USDC" ? 2 : 6;

  const rateLabel = useMemo(() => {
    if (!q || q.amountOut <= 0 || q.amountIn <= 0) return "—";
    if (toRoar) return `1 ${token.ticker} ≈ ${formatNum(q.amountOut / q.amountIn, 2)} ROAR`;
    return `1 ROAR ≈ ${formatNum(q.amountOut / q.amountIn, token.ticker === "USDC" ? 4 : 6)} ${token.ticker}`;
  }, [q, toRoar, token.ticker]);

  const cta = busy
    ? t.swapping
    : sessionLost
      ? t.reconnectXportal
      : canSign
        ? `${t.swap} ${token.ticker}`
        : t.connectXportal;

  const walletSet = useMemo(() => {
    const ids = new Set<string>();
    for (const [id, amt] of Object.entries(balances)) {
      if (amt > 0) ids.add(id);
    }
    return ids;
  }, [balances]);

  const filtered = useMemo(() => {
    const qn = query.trim().toLowerCase();
    const rows = tokens.filter((row) => row.id !== TOKEN.identifier);
    const matched = qn
      ? rows.filter(
          (row) =>
            row.ticker.toLowerCase().includes(qn) ||
            row.name.toLowerCase().includes(qn) ||
            row.id.toLowerCase().includes(qn),
        )
      : rows;
    const wallet = matched.filter((row) => walletSet.has(row.id) || (row.id === "EGLD" && walletSet.has("EGLD")));
    const rest = matched.filter((row) => !wallet.includes(row));
    wallet.sort((a, b) => (balances[b.id] ?? 0) - (balances[a.id] ?? 0));
    const visible = qn ? [...wallet, ...rest] : [...wallet, ...rest.slice(0, 80)];
    return { wallet, rest, visible };
  }, [tokens, query, walletSet, balances]);

  function pickToken(row: SwapCatalogToken) {
    setTokenId(row.id);
    setRaw(defaultAmt(row, balances[row.id] ?? 0));
    setPickOpen(false);
    setQuery("");
  }

  const routeLabel = !q
    ? "…"
    : q.route === "jex-agg"
      ? t.swapVenueAgg
      : q.route === "amm-hop"
        ? t.swapVenueHop
        : t.swapVenueAmm;

  return (
    <section id="swap" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-medium md:text-3xl">{t.swapTitle}</h2>
          <Badge variant="mute">{usePool ? t.swapVenueAmm : t.swapVenueAgg}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.swapLead}</p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <TokenField
            label={t.swapFrom}
            ticker={toRoar ? token.ticker : "ROAR"}
            icon={toRoar ? token.icon : "/nfts/roar-token.png"}
            value={raw}
            onChange={setRaw}
            balance={fromBal}
            onMax={() => setRaw(fromBal > 0 ? trimAmt(fromBal, Math.max(fromDigits, 6)) : "0")}
            maxLabel={t.swapMax}
            locked={!toRoar}
            lockedLabel={t.swapLocked}
            onPick={toRoar ? () => setPickOpen(true) : undefined}
          />
          <div className="relative my-1 flex justify-center">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t.swapFlip}
              className="z-10 size-11 rounded-full"
              onClick={() => {
                setDirection(toRoar ? "from-roar" : "to-roar");
                setRaw(toRoar ? "100" : defaultAmt(token, otherBal));
              }}
            >
              <ArrowDownUp className="size-4" />
            </Button>
          </div>
          <TokenField
            label={t.swapTo}
            ticker={toRoar ? "ROAR" : token.ticker}
            icon={toRoar ? "/nfts/roar-token.png" : token.icon}
            value={q && valid ? trimAmt(q.amountOut, toDigits) : quoteBusy ? "…" : "—"}
            readOnly
            balance={toBal}
            locked={toRoar}
            lockedLabel={t.swapLocked}
            onPick={!toRoar ? () => setPickOpen(true) : undefined}
          />

          <dl className="mt-4 grid gap-2 rounded-lg bg-surface-2 p-4 text-sm shadow-[var(--shadow-border)]">
            <Row label={t.swapRate} value={rateLabel} />
            <Row
              label={t.swapMinOut}
              value={
                q
                  ? toRoar
                    ? `${formatNum(q.minOut, 2)} ROAR`
                    : `${formatNum(q.minOut, toDigits)} ${token.ticker}`
                  : "—"
              }
            />
            <Row
              label={t.impact}
              value={q ? `${formatNum(Math.abs(q.priceImpact), 2)}%` : "—"}
            />
            <Row label={t.jexSource} value={routeLabel} />
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-muted">{t.swapSlippage}</span>
              <SlippageToggle t={t} />
            </div>
          </dl>

          {quoteErr ? (
            <p className="mt-3 text-sm text-ember">{quoteErrMsg}</p>
          ) : null}

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={locked || (canSign && (!valid || !enough || !spendOk || !q || quoteErr))}
            onClick={() => {
              if (!canSign) {
                onConnect();
                return;
              }
              if (!valid || !enough || !spendOk) return;
              onSwap(token.id, direction, spend);
            }}
          >
            {busy ? <LionRun size="sm" label={t.txRun} /> : null}
            {cta}
          </Button>
          {!enough && valid && canSign ? (
            <p className="mt-3 text-sm text-ember">{t.swapNotEnough}</p>
          ) : null}
        </article>

        <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h3 className="font-display text-xl font-medium">{t.buyOnOox}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.swapNote}</p>
          <dl className="mt-5 grid gap-2 text-sm">
            <Row label={t.pairsTitle} value={`ROAR / ${token.ticker}`} />
            <Row
              label="ROAR"
              value={q && q.route !== "jex-agg" ? `${formatNum(q.roarReserve, 0)} ROAR` : "—"}
            />
            <Row
              label={token.ticker}
              value={
                q && q.route !== "jex-agg"
                  ? token.ticker === "EGLD"
                    ? formatEgld(q.otherReserve, 2)
                    : `${formatNum(q.otherReserve, token.decimals <= 6 ? 2 : 0)} ${token.ticker}`
                  : "—"
              }
            />
            {valid && roarUsd > 0 && !toRoar ? (
              <Row label="USD" value={`$${formatNum(amount * roarUsd, 2)}`} />
            ) : null}
          </dl>
          <p className="mt-6 text-[11px] text-muted">{t.swapSlippageHint}</p>
        </article>
      </div>

      <article className="mt-4 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <div className="dual-bar h-0.5 w-full" />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-xl font-medium">{t.dustTitle}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t.dustLead}</p>
            </div>
            {dustTokens.length > 0 ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={allDustOn}
                  onClick={() => setDustPicked(dustTokens.map((row) => row.id))}
                >
                  {t.dustAll}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={dustPicked.length === 0}
                  onClick={() => setDustPicked([])}
                >
                  {t.dustClear}
                </Button>
              </div>
            ) : null}
          </div>
          {dustLoading ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" />
              {t.dustLoading}
            </p>
          ) : dustTokens.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t.dustNone}</p>
          ) : (
            <>
              {dustTokens.length > 6 ? (
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    value={dustFilter}
                    onChange={(e) => setDustFilter(e.target.value)}
                    placeholder={t.dustSearch}
                    className="h-9 pl-9 text-sm"
                  />
                </div>
              ) : null}
              <ul className="mt-3 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto overscroll-contain">
                {dustVisible.map((row) => {
                  const on = dustPickedSet.has(row.id);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setDustPicked((cur) =>
                            cur.includes(row.id) ? cur.filter((id) => id !== row.id) : [...cur, row.id],
                          )
                        }
                        className={cn(
                          "flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left transition-colors duration-150",
                          on ? "bg-volt/10 text-fg" : "bg-surface-2 text-muted hover:text-fg",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded-xs",
                            on ? "bg-volt text-bg" : "shadow-[var(--shadow-border)]",
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        <TokenIcon src={row.icon} ticker={row.ticker} className="size-5" />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.ticker}</span>
                        <span className="shrink-0 tabular text-[11px]">
                          {formatNum(row.valueUsd, 2)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {dustVisible.length === 0 ? (
                <p className="mt-2 text-xs text-muted">{t.swapNoMatch}</p>
              ) : null}
              <p className="mt-3 text-xs text-muted">
                {dustPicked.length}/{dustTokens.length} {t.dustPicked}
                {dustSelectedUsd > 0
                  ? ` · ${formatNum(dustSelectedUsd, 2)} USDC → ${formatNum(dustSelectedRoar, 2)} ROAR`
                  : ""}
              </p>
            </>
          )}
          <p className="mt-2 text-[11px] text-muted">{t.dustKeep}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{t.swapSlippage}</span>
            <SlippageToggle t={t} />
          </div>
          <Button
            size="lg"
            variant="volt"
            className="mt-4 w-full"
            disabled={locked || (canSign && (dustPicked.length === 0 || !onDust))}
            onClick={() => {
              if (!canSign) {
                onConnect();
                return;
              }
              if (dustPicked.length === 0) return;
              onDust?.(dustPicked);
            }}
          >
            {dustBusy ? <LionRun size="sm" label={t.txRun} /> : null}
            {dustBusy
              ? t.swapping
              : canSign
                ? `${t.dustCta} · ${dustPicked.length}`
                : t.connectXportal}
          </Button>
        </div>
      </article>

      <Dialog
        open={pickOpen}
        onOpenChange={(open) => {
          setPickOpen(open);
          if (!open) setQuery("");
        }}
      >
        <DialogContent className="max-h-[min(36rem,86dvh)] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t.swapSelect}</DialogTitle>
            <DialogDescription>{t.swapPick}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.swapSearch}
              className="h-11 pl-9"
              autoFocus
            />
          </div>
          <div className="min-h-0 max-h-[22rem] overflow-y-auto">
            {filtered.visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t.swapNoMatch}</p>
            ) : (
              <ul className="grid gap-1">
                {filtered.visible.map((row, i) => {
                  const active = row.id === token.id;
                  const bal = balances[row.id] ?? 0;
                  const showWalletHead =
                    i === 0 && filtered.wallet.length > 0 && filtered.wallet.includes(row);
                  const showAllHead =
                    filtered.wallet.length > 0 &&
                    row === filtered.rest[0] &&
                    filtered.visible.includes(row);
                  return (
                    <li key={row.id}>
                      {showWalletHead ? (
                        <p className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted">
                          {t.swapWalletOnly}
                        </p>
                      ) : null}
                      {showAllHead ? (
                        <p className="px-3 pb-1 pt-3 text-[11px] font-medium text-muted">
                          {t.swapAllTokens}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => pickToken(row)}
                        className={cn(
                          "flex h-14 w-full items-center gap-3 rounded-lg px-3 text-left transition-colors duration-150",
                          active ? "bg-ember/15" : "hover:bg-surface-2",
                        )}
                      >
                        <TokenIcon src={row.icon} ticker={row.ticker} className="size-8" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{row.ticker}</p>
                          <p className="truncate text-[11px] text-muted">
                            {row.id === "EGLD" ? row.name : t.swapVenueAgg}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="tabular text-sm font-medium">
                            {formatNum(bal, row.ticker === "USDC" ? 2 : 4)}
                          </p>
                          <p className="text-[11px] text-muted">{t.inWallet}</p>
                        </div>
                        {active ? <Check className="size-4 text-ember" /> : <span className="size-4" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="inline-flex items-center gap-2 text-[11px] text-muted">
            <Lock className="size-3.5" />
            ROAR {t.swapLocked.toLowerCase()}
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function SlippageToggle({ t }: { t: Copy }) {
  const slippage = useVaultStore((s) => s.slippage);
  const setSlippage = useVaultStore((s) => s.setSlippage);
  return (
    <div className="inline-flex rounded-md bg-surface-2 p-0.5 shadow-[var(--shadow-border)]">
      {SLIPPAGE_PCTS.map((pct) => {
        const on = slippage === pct;
        return (
          <button
            key={pct}
            type="button"
            aria-pressed={on}
            onClick={() => setSlippage(pct)}
            className={cn(
              "h-11 min-w-11 rounded-sm px-2.5 text-xs font-medium tabular transition-colors duration-150",
              on ? "bg-ember text-primary-foreground" : "text-muted hover:text-fg",
            )}
          >
            {slippageLabel(t, pct)}
          </button>
        );
      })}
    </div>
  );
}

function slippageLabel(t: Copy, pct: SlippagePct) {
  if (pct === 0.5) return t.swapSlippageHalf;
  if (pct === 2.5) return t.swapSlippageWide;
  return t.swapSlippageTight;
}

function fallbackEgld(): SwapCatalogToken {
  return {
    id: "EGLD",
    ticker: "EGLD",
    name: "eGold",
    decimals: 18,
    icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
    wrap: true,
    hops: 1,
    via: "direct",
    pair: "",
    pairToken: "WEGLD-bd4d79",
  };
}

function walletToken(id: string): SwapCatalogToken {
  const ticker = id === "EGLD" ? "EGLD" : id.split("-")[0] || id;
  return {
    id,
    ticker,
    name: ticker,
    decimals: 18,
    hops: 0,
    via: "agg",
    icon:
      id === "EGLD"
        ? "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png"
        : `https://tools.multiversx.com/assets-cdn/tokens/${id}/icon.png`,
    wrap: id === "EGLD",
    pair: "",
    pairToken: id,
  };
}

function defaultAmt(row: SwapCatalogToken, bal: number) {
  if (row.id === "EGLD" || row.ticker === "WEGLD") return "1";
  if (row.ticker === "USDC") return "10";
  if (bal > 0) {
    const pick = bal > 1000 ? Math.min(1000, bal) : bal > 10 ? Math.min(10, bal) : bal;
    return trimAmt(pick, row.decimals <= 6 ? 2 : 4);
  }
  return "1";
}

function TokenIcon({
  src,
  ticker,
  className,
}: {
  src?: string;
  ticker: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full bg-bg text-[9px]",
          className,
        )}
      >
        {ticker.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={cn("size-5 rounded-full object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}

function TokenField({
  label,
  ticker,
  icon,
  value,
  onChange,
  balance,
  onMax,
  maxLabel,
  readOnly,
  locked,
  lockedLabel,
  onPick,
}: {
  label: string;
  ticker: string;
  icon?: string;
  value: string;
  onChange?: (v: string) => void;
  balance: number;
  onMax?: () => void;
  maxLabel?: string;
  readOnly?: boolean;
  locked?: boolean;
  lockedLabel?: string;
  onPick?: () => void;
}) {
  const digits = ticker === "EGLD" ? 4 : ticker === "USDC" ? 2 : 2;
  const canMax = Boolean(onMax) && balance > 0;
  return (
    <div className="rounded-lg bg-surface-2 p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
        <span>{label}</span>
        {onMax ? (
          <button
            type="button"
            onClick={onMax}
            disabled={!canMax}
            className={cn(
              "tabular transition-colors duration-150",
              canMax ? "text-volt hover:text-fg" : "text-muted",
            )}
          >
            {formatNum(balance, digits)} {ticker}
          </button>
        ) : (
          <span className="tabular">
            {formatNum(balance, digits)} {ticker}
          </span>
        )}
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-3">
        <Input
          inputMode="decimal"
          readOnly={readOnly}
          value={value}
          aria-label={label}
          onChange={(e) => onChange?.(e.target.value.replace(",", "."))}
          className={cn(
            "relative z-0 block h-12 min-w-0 w-0 flex-1 bg-transparent text-2xl leading-none tabular whitespace-nowrap shadow-none",
            readOnly && "opacity-80",
          )}
        />
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {onMax ? (
            <button
              type="button"
              onClick={onMax}
              disabled={!canMax}
              aria-label={maxLabel}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-ember/20 px-3 text-xs font-medium text-ember transition-transform duration-150 ease-out hover:bg-ember/30 active:not-disabled:scale-[0.96] disabled:opacity-40"
            >
              {maxLabel}
            </button>
          ) : null}
          {onPick ? (
            <button
              type="button"
              onClick={onPick}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-bg pl-2 pr-3 text-sm font-medium shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]"
            >
              <TokenIcon src={icon} ticker={ticker} />
              {ticker}
              <ChevronsUpDown className="size-3.5 text-muted" />
            </button>
          ) : (
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-bg px-3 text-sm font-medium shadow-[var(--shadow-border)]">
              {locked ? <Lock className="size-3.5 text-muted" /> : null}
              <TokenIcon src={icon} ticker={ticker} />
              {ticker}
              {locked && lockedLabel ? (
                <span className="sr-only">{lockedLabel}</span>
              ) : null}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

function trimAmt(n: number, digits: number) {
  if (!Number.isFinite(n)) return "0";
  const f = n.toFixed(digits);
  return f.replace(/\.?0+$/, "") || "0";
}