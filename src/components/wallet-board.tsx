import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Droplets,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Info,
  Landmark,
  Layers,
  Loader2,
  Lock,
  Plus,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LionRun } from "@/components/lion-run";
import {
  explorerAddrUrl,
  LINKS,
  isBurnifyAsset,
} from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import type {
  BoardDelegation,
  BoardPool,
  BoardPosition,
  BoardProvider,
  BoardToken,
  BoardVenue,
  BurnifyAction,
  BurnifyBoard,
  DelegationAction,
  HatomBoard,
  ProtocolRow,
  WalletBoard,
} from "@/lib/mx.functions";
import type { Session } from "@/lib/store";
import { cn, fillAmt, formatEgld, formatEgldAmount, formatNum, formatPct, formatRoarClaim, formatUsdc, isErdAddress, shortAddr } from "@/lib/utils";

const HIDE_NFTS_KEY = "pv-hide-nfts";
const HIDE_VALIDATORS_KEY = "pv-hide-validators";
const HIDE_DUST_KEY = "pv-hide-dust";
const QUOTE_KEY = "pv-wallet-quote";
const SHOW_EMPTY_PREFIX = "pv-show-empty:";
const HIST_PREFIX = "pv-wallet-hist:";
const SNAP_MS = 216e5;
const KEEP_MS = 3456e7;
const DUST_USD = 0.05;
const UNBOND_MS = 10 * 24 * 60 * 60 * 1000;
const DEMO_UNLOCK_AT = Date.now() + 2 * 86400000 + 14 * 3600000;
const KEEP_TICKERS = new Set([
  "EGLD",
  "ROAR",
  "USDC",
  "HTM",
  "USH",
  "BFY",
  "SEGLD",
  "XEGLD",
  "VOXEGLD",
  "XMEX",
  "BFUEL",
  "WTAO",
  "SWTAO",
  "LKHTM",
  "HEGLD",
  "HSEGLD",
  "HUSDC",
  "HUSDT",
  "HHTM",
  "HUTK",
  "HWTAO",
  "HSWTAO",
  "HMEX",
  "HWETH",
  "HWBTC",
  "HUSH",
  "BUFU",
  "BUFUOH",
]);

type WalletQuote = "egld" | "usdc";
type MoneyFn = (usd: number, digits?: number) => string;
type HistPoint = { t: number; usd: number };
type Slice = { id: string; label: string; value: number; tone: "ember" | "volt" | "fg" };

export function WalletBoardView({
  t,
  session,
  board,
  fetching,
  loading = false,
  error = false,
  onRetry,
  onConnect,
  onSwap,
  onSend,
  onHeart,
  onFarm,
  canSign = false,
  busy = null,
  onClaimDelegation,
  onRestakeDelegation,
  onDelegation,
  onBurnify,
  egldUsd = 0,
}: {
  t: Copy;
  session: Session | null;
  board: WalletBoard | undefined;
  fetching: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onConnect: () => void;
  onSwap: (tokenId?: string) => void;
  onSend?: (tokenId: string, to: string, amount: number) => void;
  onHeart: () => void;
  onFarm: () => void;
  canSign?: boolean;
  busy?: DelegationAction | BurnifyAction | null;
  onClaimDelegation?: (contract?: string) => void;
  onRestakeDelegation?: (contract?: string) => void;
  onDelegation?: (kind: DelegationAction, contract?: string, amount?: number) => void;
  onBurnify?: (kind: BurnifyAction, amount?: number) => void;
  egldUsd?: number;
}) {
  const [hideNfts, setHideNfts] = useState(false);
  const [hideDust, setHideDust] = useState(true);
  const [quote, setQuote] = useState<WalletQuote>("usdc");
  const [history, setHistory] = useState<HistPoint[]>([]);
  const [sendAsset, setSendAsset] = useState<{
    id: string;
    ticker: string;
    amount: number;
    icon: string;
  } | null>(null);
  useEffect(() => {
    try {
      setHideNfts(localStorage.getItem(HIDE_NFTS_KEY) === "1");
      setHideDust(localStorage.getItem(HIDE_DUST_KEY) !== "0");
      const saved = localStorage.getItem(QUOTE_KEY);
      if (saved === "egld" || saved === "usdc") setQuote(saved);
    } catch {}
  }, []);
  useEffect(() => {
    if (!session || !board || board.totalUsd <= 0) return;
    setHistory(recordSnapshot(session.address, board.totalUsd, session.mode === "demo"));
  }, [session?.address, session?.mode, board?.totalUsd, board?.fetchedAt]);
  function toggleNfts() {
    setHideNfts((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDE_NFTS_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  function toggleDust() {
    setHideDust((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HIDE_DUST_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  function changeQuote(next: WalletQuote) {
    setQuote(next);
    try {
      localStorage.setItem(QUOTE_KEY, next);
    } catch {}
  }
  function money(usd: number, digits?: number) {
    if (quote === "egld") {
      const egld = egldUsd > 0 ? usd / egldUsd : 0;
      return formatEgld(egld, digits ?? (Math.abs(egld) >= 100 ? 2 : Math.abs(egld) >= 1 ? 3 : 4));
    }
    return formatUsdc(usd, digits ?? (Math.abs(usd) >= 1e3 ? 0 : 2));
  }
  if (!session)
    return (
      <section id="wallet" className="scroll-mt-32 mx-auto max-w-xl px-4 py-10">
        <article className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <div className="dual-bar h-0.5 w-full" />
          <div className="p-6 sm:p-8">
            <span className="inline-flex size-12 items-center justify-center rounded-lg bg-ember/15 text-ember">
              <Wallet className="size-5" />
            </span>

            <h2 className="mt-4 font-display text-3xl font-medium">{t.walletTitle}</h2>

            <p className="mt-2 text-sm leading-relaxed text-muted">{t.walletEmpty}</p>

            <Button className="mt-6 h-12 w-full" size="lg" onClick={onConnect}>
              {t.connectXportal}
            </Button>
          </div>
        </article>
      </section>
    );
  const data = board;
  const total = data?.totalUsd ?? 0;
  const tokens = data?.tokens ?? [];
  const nfts = data?.nfts ?? [];
  const pools = data?.pools ?? [];
  const positions = data?.positions ?? [];
  const delegations = data?.delegations ?? [];
  const burnify = data?.burnify;
  const lpPools = pools.filter((p) => p.kind === "lp" || p.kind === "order" || p.kind === "stakedLp");
  const farmPools = pools.filter((p) => p.kind === "farm");
  const xmexPools = pools.filter((p) => p.kind === "xmex");
  const rewardsUsd =
    positions.reduce((s, p) => s + p.pendingUsd, 0) +
    delegations.reduce((s, d) => s + d.pendingUsd, 0) +
    (burnify?.pendingUsd ?? 0);
  const liquidUsd = data?.tokensUsd ?? 0;
  const lpUsd = lpPools.reduce((s, p) => s + p.valueUsd, 0);
  const farmValueUsd =
    positions.reduce((s, p) => s + p.valueUsd, 0) + farmPools.reduce((s, p) => s + p.valueUsd, 0);
  const xmexUsd = xmexPools.reduce((s, p) => s + p.valueUsd, 0);
  const validatorUsd = delegations.reduce((s, d) => s + d.valueUsd, 0);
  const burnifyUsd =
    (burnify?.liquidUsd ?? 0) +
    (burnify?.stakedUsd ?? 0) +
    (burnify?.nftUsd ?? 0) +
    (burnify?.pendingUsd ?? 0);
  const lockedUsd = lpUsd + farmValueUsd + xmexUsd + validatorUsd + (burnify?.stakedUsd ?? 0);
  const nftsUsd = data?.nftsUsd ?? 0;
  const shownTokens = hideDust ? tokens.filter((row) => !isDust(row.valueUsd, row.ticker)) : tokens;
  const shownLp = hideDust ? lpPools.filter((row) => !isDust(row.valueUsd)) : lpPools;
  const shownFarms = hideDust ? farmPools.filter((row) => !isDust(row.valueUsd)) : farmPools;
  const shownXmex = hideDust ? xmexPools.filter((row) => !isDust(row.valueUsd)) : xmexPools;
  const shownNfts = nfts.filter((row) => row.amount > 0);
  const assetItems = shownTokens.map((row) => ({
    key: `t:${row.id}`,
    usd: row.valueUsd,
    kind: "token" as const,
    token: row,
  }));
  const assetsUsd = liquidUsd;
  const burnifyEmpty =
    !burnify ||
    (burnify.rows.length === 0 &&
      burnify.stakedUsd <= 0 &&
      burnify.pendingUsd <= 0 &&
      burnify.liquidUsd <= 0 &&
      burnify.nftUsd <= 0);
  const shownPositions = hideDust
    ? positions.filter((row) => !isDust(row.valueUsd + row.pendingUsd))
    : positions;
  const hiddenCount =
    tokens.length -
    shownTokens.length +
    (lpPools.length - shownLp.length) +
    (farmPools.length - shownFarms.length) +
    (xmexPools.length - shownXmex.length) +
    (positions.length - shownPositions.length);
  const heartNft = shownNfts.find((n) => n.isHeart);
  const heartPos = positions.find((p) => p.id === "heart");
  const farmPos = positions.find((p) => p.id === "sroar");
  const heartCount = (heartNft?.amount ?? 0) + (heartPos?.amount ?? 0);
  const listedPositions =
    heartCount > 0 ? shownPositions.filter((p) => p.id !== "heart") : shownPositions;
  const farmSectionCount = listedPositions.length + shownFarms.length;
  const delRewards = delegations.reduce((s, d) => s + d.rewards, 0);
  const burnifyPendingEgld = (burnify?.pendingEgld ?? 0) + (burnify?.nftPendingEgld ?? 0);
  const hasClaim =
    (heartPos?.pending ?? 0) > 0 ||
    (farmPos?.pending ?? 0) > 0 ||
    delRewards > 0 ||
    burnifyPendingEgld > 0;
  const slices: Slice[] = [
    {
      id: "liq",
      label: t.walletLiquidMacro,
      value: liquidUsd,
      tone: "ember" as const,
    },
    {
      id: "lock",
      label: t.walletLocked,
      value: lockedUsd,
      tone: "volt" as const,
    },
    {
      id: "nft",
      label: t.walletNfts,
      value: nftsUsd,
      tone: "fg" as const,
    },
    {
      id: "rew",
      label: t.walletClaimable,
      value: rewardsUsd,
      tone: "ember" as const,
    },
  ].filter((s) => s.value > 0.001);
  const jumps = [
    {
      id: "wallet-assets",
      label: t.walletAssets,
      count: shownTokens.length,
      value: liquidUsd,
    },
    {
      id: "wallet-lp",
      label: t.walletLiquidity,
      count: shownLp.length,
      value: lpUsd,
    },
    {
      id: "wallet-farms",
      label: t.walletFarms,
      count: farmSectionCount,
      value: farmValueUsd + rewardsUsd - delegations.reduce((s, d) => s + d.pendingUsd, 0),
    },
    {
      id: "wallet-xmex",
      label: t.walletXmex,
      count: shownXmex.length,
      value: xmexUsd,
    },
    {
      id: "wallet-validators",
      label: t.walletValidators,
      count: delegations.length,
      value: validatorUsd + delegations.reduce((s, d) => s + d.pendingUsd, 0),
    },
    {
      id: "wallet-burnify",
      label: t.burnifyTitle,
      count: burnify?.rows.length ?? 0,
      value: burnifyUsd,
    },
    {
      id: "wallet-nfts",
      label: t.walletNfts,
      count: shownNfts.length,
      value: nftsUsd,
    },
  ];
  if (loading && !data)
    return (
      <section id="wallet" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-2xl font-medium md:text-3xl">{t.walletTitle}</h2>

          <LiveDot fetching label={t.walletLoading} />
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
          <div className="h-64 animate-pulse rounded-xl bg-surface" />
        </div>
        <div className="mt-4 h-12 animate-pulse rounded-full bg-surface" />
        <div className="mt-4 h-48 animate-pulse rounded-xl bg-surface" />
      </section>
    );
  if (error && !data)
    return (
      <section id="wallet" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
        <h2 className="font-display text-2xl font-medium md:text-3xl">{t.walletTitle}</h2>

        <article className="mt-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="font-medium">{t.walletError}</p>
          {onRetry ? (
            <Button className="mt-4" onClick={onRetry}>
              {t.lookup}
            </Button>
          ) : null}
        </article>
      </section>
    );
  return (
    <section id="wallet" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-medium md:text-3xl">{t.walletTitle}</h2>

            <LiveDot fetching={fetching} label={t.walletLive} />
          </div>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t.walletLead}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={explorerAddrUrl(session.address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center font-mono text-xs text-muted hover:text-fg"
          >
            {shortAddr(session.address, 8, 6)}
          </a>

          <QuoteToggle t={t} quote={quote} onChange={changeQuote} />
        </div>
      </div>
      {session.mode === "demo" ? <p className="mt-3 text-xs text-ember">{t.walletDemo}</p> : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
        <article className="relative overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <div className="dual-bar h-0.5 w-full" />
          <div className="p-5 sm:p-6">
            <p className="text-[11px] text-muted">{t.walletNet}</p>
            <p className="mt-2 font-display text-4xl tabular leading-none tracking-tight md:text-5xl">
              {money(total, 2)}
            </p>
            <WorthMeta t={t} points={history} />
            <p className="mt-2 max-w-sm text-[11px] text-volt">{t.walletFullHoldings}</p>
          </div>

          <WorthSpark points={history} quote={quote} egldUsd={egldUsd} money={money} />
        </article>

        <article className="flex flex-col justify-between rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <div className="flex items-center gap-5">
            <AllocRing slices={slices} total={total} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">{t.walletAllocation}</p>
              <ul className="mt-3 grid gap-2">
                {(slices.length
                  ? slices
                  : [
                      {
                        id: "empty",
                        label: t.walletNone,
                        value: 0,
                        tone: "fg" as const,
                      },
                    ]
                ).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex min-w-0 items-center gap-2 text-muted">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          s.tone === "ember" && "bg-ember",
                          s.tone === "volt" && "bg-volt",
                          s.tone === "fg" && "bg-fg/40",
                        )}
                      />
                      <span className="truncate">{s.label}</span>
                    </span>

                    <span className="tabular text-fg">
                      {total > 0 ? `${Math.round((s.value / total) * 100)}%` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Macro label={t.walletLiquidMacro} value={money(liquidUsd, quote === "egld" ? 2 : 0)} />

            <Macro
              label={t.walletLocked}
              value={money(lockedUsd, quote === "egld" ? 2 : 0)}
              accent="volt"
            />

            <Macro
              label={t.walletClaimable}
              value={money(rewardsUsd, quote === "egld" ? 3 : 2)}
              accent="ember"
            />
          </div>
        </article>
      </div>
      {hasClaim ? (
        <article className="mt-3 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
          <div className="h-0.5 w-full bg-volt" />
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <p className="text-[11px] text-volt">{t.walletClaimable}</p>
              <p className="mt-1 font-display text-2xl tabular leading-none">
                {money(rewardsUsd, 2)}
              </p>
              <p className="mt-1 text-[11px] text-muted">{t.walletRewardsHint}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(heartPos?.pending ?? 0) > 0 ? (
                <Button size="sm" onClick={onHeart}>
                  <Heart className="size-3.5" />
                  {claimRoarLabel(t, heartPos?.pending ?? 0)}
                </Button>
              ) : null}
              {(farmPos?.pending ?? 0) > 0 ? (
                <Button size="sm" variant="volt" onClick={onFarm}>
                  <Coins className="size-3.5" />
                  {fillAmt(t.farmCompound, formatRoarClaim(farmPos?.pending ?? 0))}
                </Button>
              ) : null}
              {delRewards > 0 ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(!canSign && session.mode !== "demo") || busy !== null}
                    onClick={() => (onDelegation ?? ((k, c) => onClaimDelegation?.(c)))("claim")}
                  >
                    {busy === "claim" ? <LionRun size="sm" label={t.txRun} /> : null}
                    {claimEgldLabel(t, delRewards)}
                  </Button>

                  <Button
                    size="sm"
                    variant="volt"
                    disabled={(!canSign && session.mode !== "demo") || busy !== null}
                    onClick={() => (onDelegation ?? ((k, c) => onRestakeDelegation?.(c)))("restake")}
                  >
                    {busy === "restake" ? <LionRun size="sm" label={t.txRun} /> : null}
                    {fillAmt(t.walletRestakeAll, formatEgldAmount(delRewards, 4))}
                  </Button>
                </>
              ) : null}
              {burnifyPendingEgld > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={session.mode !== "demo" && (!canSign || busy !== null)}
                  onClick={() => {
                    document.getElementById("wallet-burnify")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                    if (session.mode === "demo") return;
                    onBurnify?.("claimAll");
                  }}
                >
                  {busy === "claimAll" || busy === "claimBfy" || busy === "claimBufu" ? (
                    <LionRun size="sm" label={t.txRun} />
                  ) : (
                    <Flame className="size-3.5" />
                  )}
                  {claimEgldLabel(t, burnifyPendingEgld)}
                </Button>
              ) : null}
            </div>
          </div>
        </article>
      ) : null}
      {jumps.length > 0 ? (
        <nav
          aria-label={t.walletJump}
          className="sticky top-28 z-30 -mx-4 mt-4 bg-bg/90 px-4 py-2 backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {jumps.map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() =>
                    document.getElementById(j.id)?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface-2 px-3.5 text-xs font-medium shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                    j.count === 0 && "text-muted",
                  )}
                >
                  {j.label}
                  <span className="tabular text-muted">{j.count}</span>
                </button>
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 shrink-0"
              onClick={toggleDust}
            >
              {hideDust ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}

              <span className="hidden sm:inline">
                {hideDust ? t.walletShowDust : t.walletHideDust}
              </span>
            </Button>
          </div>
          {hiddenCount > 0 ? (
            <p className="mt-1 text-[11px] text-muted">
              {hiddenCount} {t.walletDustHidden}
            </p>
          ) : null}
        </nav>
      ) : null}
      <div className="mt-4 grid gap-3">
          {heartCount > 0 ? (
            <button
              type="button"
              onClick={onHeart}
              className="flex w-full items-center gap-4 overflow-hidden rounded-xl bg-surface p-4 text-left shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)] sm:p-5"
            >
              <img
                src="/heart-of-roar.jpg"
                alt=""
                className="size-16 rounded-lg object-cover sm:size-20"
              />

              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-ember">{t.walletHeartHeld}</p>
                <p className="mt-1 font-display text-xl font-medium leading-none">
                  {t.walletHeartFarm}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {formatNum(heartNft?.amount ?? 0, 0)} {t.walletInWallet}
                  {heartPos ? ` · ${t.walletStaked} ${formatNum(heartPos.amount, 0)}` : ""}
                  {(heartPos?.pending ?? 0) > 0
                    ? ` · ${t.walletPending} ${formatNum(heartPos?.pending ?? 0, 2)} ROAR`
                    : ""}
                </p>
              </div>

              <div className="text-right">
                <p className="tabular text-sm font-medium">
                  {money(
                    (heartNft?.valueUsd ?? 0) +
                      (heartPos?.valueUsd ?? 0) +
                      (heartPos?.pendingUsd ?? 0),
                    0,
                  )}
                </p>

                <p className="mt-2 text-[11px] text-ember">{t.walletOpenHeart}</p>
              </div>
            </button>
          ) : null}

          <SoftSection
            id="wallet-assets"
            icon={<Wallet className="size-4 text-ember" />}
            title={t.walletAssets}
            count={assetItems.length}
            value={money(assetsUsd, 2)}
            empty={assetItems.length === 0}
            idle={t.walletSectionIdle}
            t={t}
          >
            <p className="px-2 pb-2 text-[11px] text-muted">{t.walletAssetsHint}</p>
            {shownTokens.length === 0 ? (
              <div className="px-2 py-3">
                <p className="text-sm text-muted">{t.walletEmptyAssets}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => onSwap()}>
                    {t.walletGoSwap}
                  </Button>
                  <Button size="sm" variant="outline" onClick={onHeart}>
                    {t.buy}
                  </Button>
                </div>
              </div>
            ) : (
              <ul>
                {shownTokens.map((row) => (
                  <li key={row.id} className="border-t border-fg/8 first:border-t-0">
                    <TokenRow
                      t={t}
                      token={row}
                      money={money}
                      share={total > 0 ? row.valueUsd / total : 0}
                      onSwap={onSwap}
                      onSend={
                        onSend
                          ? () =>
                              setSendAsset({
                                id: row.id,
                                ticker: row.ticker,
                                amount: row.amount,
                                icon: row.icon,
                              })
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </SoftSection>
          <SoftSection
            id="wallet-lp"
            icon={<Droplets className="size-4 text-volt" />}
            title={t.walletLiquidity}
            count={shownLp.length}
            value={money(lpUsd, 2)}
            empty={shownLp.length === 0}
            idle={t.walletSectionIdle}
            t={t}
          >
            <p className="px-2 pb-2 text-[11px] text-muted">{t.walletLpHint}</p>
            {shownLp.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">{t.walletEmptyLp}</p>
            ) : (
              <ul>
                {shownLp.map((row) => (
                  <li key={row.id} className="border-t border-fg/8 first:border-t-0">
                    <PoolRow
                      t={t}
                      pool={row}
                      money={money}
                      share={total > 0 ? row.valueUsd / total : 0}
                      onSwap={onSwap}
                      onSend={
                        onSend
                          ? () =>
                              setSendAsset({
                                id: row.id,
                                ticker: row.amountTicker,
                                amount: row.amount,
                                icon: row.icon,
                              })
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </SoftSection>
          <SoftSection
            id="wallet-farms"
            icon={<Coins className="size-4 text-ember" />}
            title={t.walletFarms}
            count={farmSectionCount}
            value={money(
              farmValueUsd + (farmPos?.pendingUsd ?? 0) + (heartPos?.pendingUsd ?? 0),
              2,
            )}
            empty={farmSectionCount === 0}
            idle={t.walletSectionIdle}
            t={t}
          >
            {farmSectionCount === 0 ? (
              <div className="px-2 py-3">
                <p className="text-sm text-muted">{t.walletEmptyFarms}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={onHeart}>
                    <Heart className="size-3.5" />
                    {t.navHeart}
                  </Button>
                  <Button variant="outline" size="sm" onClick={onFarm}>
                    <Coins className="size-3.5" />
                    {t.navRoar}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ul className="grid gap-2 px-1">
                  {listedPositions.map((row) => (
                    <li key={row.id}>
                      <PositionRow t={t} row={row} money={money} onHeart={onHeart} onFarm={onFarm} />
                    </li>
                  ))}
                  {shownFarms.map((row) => (
                    <li key={row.id}>
                      <PoolRow
                        t={t}
                        pool={row}
                        money={money}
                        share={total > 0 ? row.valueUsd / total : 0}
                        onSwap={onSwap}
                        onSend={
                          onSend
                            ? () =>
                                setSendAsset({
                                  id: row.id,
                                  ticker: row.amountTicker,
                                  amount: row.amount,
                                  icon: row.icon,
                                })
                            : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2 px-2 pb-1">
                  <Button variant="outline" size="sm" onClick={onHeart}>
                    <Heart className="size-3.5" />
                    {t.navHeart}
                  </Button>
                  <Button variant="outline" size="sm" onClick={onFarm}>
                    <Coins className="size-3.5" />
                    {t.navRoar}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onSwap()}>
                    <ArrowLeftRight className="size-3.5" />
                    {t.navSwap}
                  </Button>
                </div>
              </>
            )}
          </SoftSection>
          <SoftSection
            id="wallet-xmex"
            icon={<Lock className="size-4 text-volt" />}
            title={t.walletXmex}
            count={shownXmex.length}
            value={money(xmexUsd, 2)}
            empty={shownXmex.length === 0}
            idle={t.walletSectionIdle}
            t={t}
          >
            {shownXmex.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">{t.walletEmptyXmex}</p>
            ) : (
              <ul>
                {shownXmex.map((row) => (
                  <li key={row.id} className="border-t border-fg/8 first:border-t-0">
                    <PoolRow
                      t={t}
                      pool={row}
                      money={money}
                      share={total > 0 ? row.valueUsd / total : 0}
                      onSwap={onSwap}
                      onSend={
                        onSend
                          ? () =>
                              setSendAsset({
                                id: row.id,
                                ticker: row.amountTicker,
                                amount: row.amount,
                                icon: row.icon,
                              })
                          : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </SoftSection>
          {burnify ? (
            <BurnifyCard
              t={t}
              burnify={burnify}
              money={money}
              total={total}
              egldUsd={egldUsd}
              demo={session?.mode === "demo"}
              canSign={canSign}
              busy={busy}
              onConnect={onConnect}
              onAction={onBurnify}
              empty={burnifyEmpty}
            />
          ) : (
            <SoftSection
              id="wallet-burnify"
              icon={<Flame className="size-4 text-ember" />}
              title={t.burnifyTitle}
              count={0}
              value={money(0, 2)}
              empty
              idle={t.walletSectionIdle}
              t={t}
            >
              <p className="px-2 py-3 text-sm text-muted">{t.burnifyEmpty}</p>
            </SoftSection>
          )}
          <ValidatorsCard
            t={t}
            rows={delegations}
            providers={board?.providers ?? []}
            egldWallet={session?.egldWallet ?? 0}
            egldUsd={egldUsd}
            demo={session?.mode === "demo"}
            canSign={canSign}
            busy={busy}
            money={money}
            onConnect={onConnect}
            onAction={(kind, contract, amount) => {
              if (onDelegation) {
                onDelegation(kind, contract, amount);
                return;
              }
              if (kind === "claim") onClaimDelegation?.(contract);
              if (kind === "restake") onRestakeDelegation?.(contract);
            }}
          />
          <SoftSection
            id="wallet-nfts"
            icon={<Layers className="size-4 text-ember" />}
            title={t.walletNfts}
            count={shownNfts.length}
            value={money(nftsUsd, 0)}
            empty={shownNfts.length === 0}
            idle={t.walletSectionIdle}
            t={t}
            extra={
              shownNfts.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11"
                  onClick={toggleNfts}
                >
                  {hideNfts ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  {hideNfts ? t.walletShowNfts : t.walletHideNfts}
                </Button>
              ) : null
            }
          >
            {shownNfts.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">{t.walletEmptyNfts}</p>
            ) : hideNfts ? (
              <button
                type="button"
                onClick={toggleNfts}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-3 text-left"
              >
                <span className="flex -space-x-3">
                  {shownNfts.slice(0, 5).map((row) => (
                    <img
                      key={row.identifier}
                      src={row.thumbnail}
                      alt=""
                      className="size-10 rounded-lg object-cover shadow-[var(--shadow-border)]"
                    />
                  ))}
                </span>
                <span className="text-sm text-muted">
                  {shownNfts.length} {t.walletNftsPeek} ·{money(nftsUsd, 0)}
                </span>
              </button>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shownNfts.map((row) => (
                  <li key={row.identifier}>
                    <button
                      type="button"
                      onClick={row.isHeart ? onHeart : undefined}
                      className="w-full overflow-hidden rounded-lg bg-surface-2 text-left shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]"
                    >
                      <img
                        src={row.thumbnail}
                        alt=""
                        className="aspect-square w-full object-cover"
                      />
                      <div className="px-3 py-2.5">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span>
                            {formatNum(row.amount, 0)} · {row.ticker}
                          </span>
                          <span className="tabular text-fg">{money(row.valueUsd, 0)}</span>
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SoftSection>
        </div>
      <SendSheet
        t={t}
        asset={sendAsset}
        onClose={() => setSendAsset(null)}
        onSend={(to, amount) => {
          if (!sendAsset || !onSend) return;
          onSend(sendAsset.id, to, amount);
          setSendAsset(null);
        }}
      />
    </section>
  );
}
function isDust(valueUsd: number, ticker?: string) {
  if (ticker && KEEP_TICKERS.has(ticker)) return false;
  return valueUsd < DUST_USD;
}
function claimEgldLabel(t: Copy, amount: number) {
  return fillAmt(t.claimEgld, formatEgldAmount(amount, amount >= 1 ? 3 : 4));
}
function claimRoarLabel(t: Copy, amount: number) {
  return fillAmt(t.claimRoar, formatRoarClaim(amount));
}
function looksLikeGlitch(prevUsd: number, nextUsd: number) {
  if (!(prevUsd > 25) || !Number.isFinite(nextUsd)) return nextUsd <= 0;
  if (!(nextUsd > 0)) return true;
  return nextUsd < prevUsd * 0.4;
}
function sanitizeHistory(points: HistPoint[]) {
  const ok = points.filter((p) => p.usd > 0 && Number.isFinite(p.usd));
  if (ok.length < 2) return ok;
  const peak = Math.max(...ok.map((p) => p.usd));
  return ok.filter((p) => !looksLikeGlitch(peak, p.usd));
}
function histKey(address: string) {
  return `${HIST_PREFIX}${address}`;
}
function loadHistory(address: string): HistPoint[] {
  try {
    const raw = localStorage.getItem(histKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sanitizeHistory(
      parsed.filter(
        (p) =>
          Boolean(p) &&
          typeof p.t === "number" &&
          typeof p.usd === "number" &&
          Number.isFinite(p.usd),
      ),
    );
  } catch {
    return [];
  }
}
function saveHistory(address: string, points: HistPoint[]) {
  try {
    localStorage.setItem(histKey(address), JSON.stringify(points));
  } catch {}
}
function seedDemoHistory(totalUsd: number): HistPoint[] {
  const now = Date.now();
  const points = [];
  for (let i = 52; i >= 0; i--) {
    const t = now - i * 7 * 864e5;
    const growth = 1 - i * 0.008;
    const wave = 1 + Math.sin(i / 3.2) * 0.07;
    points.push({
      t,
      usd: Math.max(8, totalUsd * growth * wave),
    });
  }
  return points;
}
function recordSnapshot(address: string, usd: number, demo: boolean): HistPoint[] {
  const now = Date.now();
  let points = loadHistory(address);
  if (demo && points.length < 8) {
    points = seedDemoHistory(usd);
    saveHistory(address, points);
    return points;
  }
  const last = points[points.length - 1];
  const peak = points.reduce((m, p) => Math.max(m, p.usd), last?.usd ?? 0);
  if (looksLikeGlitch(peak, usd) || (last && looksLikeGlitch(last.usd, usd))) return points;
  if (!last || now - last.t >= SNAP_MS)
    points = [
      ...points,
      {
        t: now,
        usd,
      },
    ].filter((p) => now - p.t <= KEEP_MS);
  else
    points = [
      ...points.slice(0, -1),
      {
        ...last,
        usd,
      },
    ];
  saveHistory(address, points);
  return points;
}
function WorthMeta({ t, points }: { t: Copy; points: HistPoint[] }) {
  if (points.length < 2) return <p className="mt-3 text-xs text-muted">{t.walletChartEmpty}</p>;
  const first = points[0];
  const last = points[points.length - 1];
  const change = first.usd > 0 ? ((last.usd - first.usd) / first.usd) * 100 : 0;
  const up = change >= 0;
  return (
    <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
      {up ? (
        <TrendingUp className="size-3.5 text-volt" />
      ) : (
        <TrendingDown className="size-3.5 text-ember" />
      )}

      <span className={cn("tabular", up ? "text-volt" : "text-ember")}>{formatPct(change, 1)}</span>

      <span className="text-[11px] font-normal text-muted">{t.walletPeriod}</span>
    </p>
  );
}
function WorthSpark({
  points,
  quote,
  egldUsd,
  money,
}: {
  points: HistPoint[];
  quote: WalletQuote;
  egldUsd: number;
  money: MoneyFn;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const series = useMemo(() => {
    const clean = points.filter((p) => p.usd > 0 && Number.isFinite(p.usd));
    return clean.map((p) => ({
      t: p.t,
      v: quote === "egld" && egldUsd > 0 ? p.usd / egldUsd : p.usd,
      usd: p.usd,
    }));
  }, [points, quote, egldUsd]);
  if (series.length < 2) return <div className="h-28" />;
  const w = 720;
  const h = 128;
  const padX = 12;
  const padT = 12;
  const ys = series.map((p) => p.v);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || Math.abs(max) * 0.04 || 1;
  const yOf = (v: number) => padT + ((max - v) / span) * 106;
  const xOf = (i: number) => padX + (i / Math.max(1, series.length - 1)) * 696;
  const d = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.v).toFixed(1)}`)
    .join(" ");
  const area = `${d} L${xOf(series.length - 1).toFixed(1)},${h} L${xOf(0).toFixed(1)},${h} Z`;
  const first = series[0];
  const last = series[series.length - 1];
  const up = last.usd >= first.usd;
  const active = hover ?? series.length - 1;
  const point = series[active];
  function onMove(event: MouseEvent<SVGSVGElement> | TouchEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const clientX = "touches" in event ? event.touches[0]?.clientX : event.clientX;
    if (clientX == null) return;
    const x = ((clientX - rect.left) / rect.width) * w;
    const i = Math.min(
      series.length - 1,
      Math.max(0, Math.round(((x - padX) / 696) * (series.length - 1))),
    );
    setHover(i);
  }
  return (
    <div className="relative px-2 pb-3">
      {hover != null && point ? (
        <p className="pointer-events-none absolute top-1 right-4 z-10 rounded-md bg-bg/80 px-2 py-1 text-[11px] tabular text-fg shadow-[var(--shadow-border)]">
          {new Date(point.t).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
          · {money(point.usd, 2)}
        </p>
      ) : null}

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-28 w-full"
        role="img"
        aria-hidden="true"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onTouchStart={onMove}
        onTouchMove={onMove}
      >
        <path d={area} className={up ? "fill-volt/15" : "fill-ember/15"} />
        <path
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className={up ? "text-volt" : "text-ember"}
        />
        <circle
          cx={xOf(active)}
          cy={yOf(point.v)}
          r="3.5"
          className={up ? "fill-volt" : "fill-ember"}
        />
      </svg>

      <div className="flex justify-between px-2 text-[11px] text-muted">
        <span>
          {new Date(first.t).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>

        <span>
          {new Date(last.t).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
    </div>
  );
}
function AllocRing({ slices, total }: { slices: Slice[]; total: number }) {
  const size = 108;
  const r = 36;
  const c = 2 * Math.PI * r;
  let acc = 0;
  const usable = slices.filter((s) => s.value > 0);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-fg/10"
        strokeWidth="9"
      />
      {usable.map((s) => {
        const share = total > 0 ? s.value / total : 0;
        const dash = Math.max(0, share * c);
        const gap = c - dash;
        const rot = acc * 360 - 90;
        acc += share;
        const tone =
          s.tone === "ember" ? "text-ember" : s.tone === "volt" ? "text-volt" : "text-fg/45";
        return (
          <circle
            key={s.id}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            className={tone}
            strokeWidth="9"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="butt"
            transform={`rotate(${rot} ${size / 2} ${size / 2})`}
          />
        );
      })}
    </svg>
  );
}
function Macro({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "ember" | "volt";
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-2.5">
      <p className="truncate text-[11px] text-muted">{label}</p>

      <p
        className={cn(
          "mt-1 break-all font-display text-sm tabular leading-snug",
          accent === "volt" && "text-volt",
          accent === "ember" && "text-ember",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 truncate text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}
function ShareBar({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(1, share));
  if (pct < 0.005) return <span className="text-[11px] text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-fg/10">
        <span
          className="block h-full bg-ember"
          style={{
            width: `${Math.max(6, pct * 100)}%`,
          }}
        />
      </span>

      <span className="tabular text-[11px] text-muted">{Math.round(pct * 100)}%</span>
    </span>
  );
}
function SoftSection({
  id,
  icon,
  title,
  count,
  value,
  empty,
  idle,
  t,
  extra,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  count: number;
  value: string;
  empty: boolean;
  idle: string;
  t: Copy;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(`${SHOW_EMPTY_PREFIX}${id}`) === "1");
    } catch {}
  }, [id]);
  const open = !empty || show;
  function toggle() {
    setShow((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`${SHOW_EMPTY_PREFIX}${id}`, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  return (
    <article
      id={id}
      className={cn(
        "scroll-mt-40 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]",
        empty && !open && "opacity-55",
      )}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <h3 className={cn("font-display text-xl font-medium", empty && "text-muted")}>{title}</h3>
          <Badge variant="mute">{count}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {!empty ? <p className="tabular text-sm font-medium">{value}</p> : null}
          {extra}
          {empty ? (
            <Button type="button" variant="ghost" size="sm" className="h-11" onClick={toggle}>
              {open ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {open ? t.walletCamouflage : t.walletRevealSection}
            </Button>
          ) : null}
        </div>
      </div>
      {open ? <div className="px-3 pb-3">{children}</div> : <p className="px-5 pb-4 text-[11px] text-muted">{idle}</p>}
    </article>
  );
}
function formatEta(ms: number, t: Copy) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}${t.walletEtaDay} ${h}${t.walletEtaHour}`;
  if (h > 0) return `${h}${t.walletEtaHour} ${m}${t.walletEtaMin}`;
  if (m > 0) return `${m}${t.walletEtaMin} ${sec}${t.walletEtaSec}`;
  return `${sec}${t.walletEtaSec}`;
}
function unlockState(row: BoardDelegation | undefined, now: number) {
  const total = row?.unlocking ?? 0;
  if (!row || total <= 0) return { ready: 0, waitMs: 0 };
  const waitMs = row.unlockEndsAt && row.unlockEndsAt > now ? row.unlockEndsAt - now : 0;
  if (waitMs > 0) return { ready: row.unlockReady ?? 0, waitMs };
  if (row.unlockEndsAt && row.unlockEndsAt <= now) return { ready: total, waitMs: 0 };
  return { ready: row.unlockReady ?? 0, waitMs: 0 };
}
function ValidatorsCard({
  t,
  rows,
  providers,
  egldWallet,
  egldUsd,
  demo,
  canSign,
  busy,
  money,
  onConnect,
  onAction,
}: {
  t: Copy;
  rows: BoardDelegation[];
  providers: BoardProvider[];
  egldWallet: number;
  egldUsd: number;
  demo?: boolean;
  canSign: boolean;
  busy: DelegationAction | BurnifyAction | null;
  money: MoneyFn;
  onConnect?: () => void;
  onAction?: (kind: DelegationAction, contract?: string, amount?: number) => void;
}) {
  const [hidden, setHidden] = useState(false);
  const [qty, setQty] = useState("");
  const [openId, setOpenId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openPick, setOpenPick] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState("");
  const [localEgld, setLocalEgld] = useState(egldWallet);
  const [localRows, setLocalRows] = useState(rows);
  const [now, setNow] = useState(() => Date.now());
  const rowsSig = rows.map((r) => `${r.contract}:${r.staked}:${r.rewards}:${r.unlocking}:${r.unlockReady}:${r.unlockEndsAt}`).join("|");
  const emptyStake = rows.length === 0;
  useEffect(() => {
    try {
      if (emptyStake) {
        setHidden(localStorage.getItem(`${SHOW_EMPTY_PREFIX}wallet-validators`) !== "1");
      } else {
        setHidden(localStorage.getItem(HIDE_VALIDATORS_KEY) === "1");
      }
    } catch {}
  }, [emptyStake]);
  useEffect(() => {
    setLocalRows(rows);
    setLocalEgld(egldWallet);
  }, [rowsSig, egldWallet]);
  useEffect(() => {
    const waiting = localRows.some((r) => r.unlockEndsAt && r.unlockEndsAt > Date.now());
    if (!waiting) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rowsSig, localRows]);
  useEffect(() => {
    if (picked) return;
    const first =
      providers.find(
        (p) => isErdAddressSafe(p.contract) && !rows.some((r) => r.contract === p.contract),
      )?.contract ||
      providers.find((p) => isErdAddressSafe(p.contract))?.contract ||
      "";
    if (first) setPicked(first);
  }, [rows, providers, picked]);
  useEffect(() => {
    if (emptyStake) setAddOpen(true);
  }, [emptyStake]);
  useEffect(() => {
    function onDoc(e: Event) {
      if (!pickRef.current?.contains(e.target as Node)) setOpenPick(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);
  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      try {
        if (emptyStake) localStorage.setItem(`${SHOW_EMPTY_PREFIX}wallet-validators`, next ? "0" : "1");
        else localStorage.setItem(HIDE_VALIDATORS_KEY, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  const keep = 0.08;
  const maxStake = Math.max(0, localEgld - keep);
  const parsed = Number(qty.replace(",", "."));
  const qtyOk = Number.isFinite(parsed) && parsed > 0;
  const stakeAmt = qtyOk ? Math.min(parsed, maxStake) : maxStake;
  const gated = !demo && (!canSign || busy !== null);
  const catalog = useMemo(() => {
    const map = new Map<string, BoardProvider>();
    for (const p of providers) if (isErdAddressSafe(p.contract)) map.set(p.contract, p);
    for (const row of localRows) {
      if (!isErdAddressSafe(row.contract) || map.has(row.contract)) continue;
      map.set(row.contract, {
        contract: row.contract,
        name: row.name,
        identity: row.identity,
        avatar: row.avatar,
        apr: row.apr,
      });
    }
    return [...map.values()];
  }, [providers, localRows]);
  const selected = catalog.find((p) => p.contract === picked);
  const mine = localRows.filter((r) => isErdAddressSafe(r.contract));
  const mineSet = new Set(mine.map((r) => r.contract));
  const choices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle
      ? catalog.filter(
          (p) =>
            p.name.toLowerCase().includes(needle) ||
            (p.identity ?? "").toLowerCase().includes(needle) ||
            p.contract.toLowerCase().includes(needle),
        )
      : catalog.filter((p) => !mineSet.has(p.contract));
    const pool = list.length ? list : catalog;
    const ranked = [...pool].sort((a, b) => {
      const am = mineSet.has(a.contract) ? 1 : 0;
      const bm = mineSet.has(b.contract) ? 1 : 0;
      if (am !== bm) return am - bm;
      const af = a.featured ? 0 : 1;
      const bf = b.featured ? 0 : 1;
      if (af !== bf) return af - bf;
      return (b.apr ?? 0) - (a.apr ?? 0);
    });
    return ranked.slice(0, needle ? 80 : 28);
  }, [catalog, query, localRows]);
  const staked = localRows.reduce((s, r) => s + r.staked, 0);
  const rewards = localRows.reduce((s, r) => s + r.rewards, 0);
  const unlocking = localRows.reduce((s, r) => s + r.unlocking, 0);
  const usd = localRows.reduce(
    (s, r) => s + r.staked * egldUsd + r.unlocking * egldUsd + r.rewards * egldUsd,
    0,
  );
  const nextWaitMs = localRows.reduce((min, r) => {
    if (!r.unlockEndsAt || r.unlockEndsAt <= now) return min;
    return Math.min(min, r.unlockEndsAt - now);
  }, Infinity);
  const hasRewards = rewards > 0;
  const claimable = localRows.filter((r) => r.rewards > 0 && isErdAddressSafe(r.contract));
  const run =
    busy && ["claim", "restake", "stake", "unstake", "withdraw"].includes(busy) ? (busy as DelegationAction) : null;

  function applyLocal(kind: DelegationAction, contract: string | undefined, amount?: number) {
    if (kind === "claim") {
      setLocalRows((prev) =>
        prev.map((row) => {
          if (contract && row.contract !== contract) return row;
          return { ...row, rewards: 0, pendingUsd: 0 };
        }),
      );
      return;
    }
    if (kind === "restake") {
      setLocalRows((prev) =>
        prev.map((row) => {
          if (contract && row.contract !== contract) return row;
          const add = row.rewards;
          return {
            ...row,
            staked: row.staked + add,
            rewards: 0,
            valueUsd: (row.staked + add + row.unlocking) * egldUsd,
            pendingUsd: 0,
          };
        }),
      );
      return;
    }
    if (!contract) return;
    if (kind === "stake") {
      const n = amount && amount > 0 ? amount : 0;
      if (n <= 0) return;
      setLocalEgld((v) => Math.max(0, v - n));
      setLocalRows((prev) => {
        const i = prev.findIndex((r) => r.contract === contract);
        if (i >= 0) {
          const next = [...prev];
          const row = next[i]!;
          next[i] = {
            ...row,
            staked: row.staked + n,
            valueUsd: (row.staked + n + row.unlocking) * egldUsd,
          };
          return next;
        }
        const p = catalog.find((x) => x.contract === contract);
        return [
          ...prev,
          {
            contract,
            name: p?.name ?? "Validator",
            identity: p?.identity,
            avatar: p?.avatar,
            staked: n,
            rewards: 0,
            unlocking: 0,
            apr: p?.apr,
            valueUsd: n * egldUsd,
            pendingUsd: 0,
          },
        ];
      });
      setQty("");
      return;
    }
    if (kind === "unstake") {
      const n = amount && amount > 0 ? amount : 0;
      if (n <= 0) return;
      setLocalRows((prev) =>
        prev.map((row) => {
          if (row.contract !== contract) return row;
          const take = Math.min(n, row.staked);
          const stillWaiting = row.unlockEndsAt && row.unlockEndsAt > Date.now();
          return {
            ...row,
            staked: row.staked - take,
            unlocking: row.unlocking + take,
            unlockReady: row.unlockReady ?? 0,
            unlockEndsAt: stillWaiting ? row.unlockEndsAt : Date.now() + UNBOND_MS,
            valueUsd: (row.staked + row.unlocking) * egldUsd,
          };
        }),
      );
      setQty("");
      return;
    }
    if (kind === "withdraw") {
      const row = localRows.find((r) => r.contract === contract);
      const n = unlockState(row, Date.now()).ready;
      if (n <= 0) return;
      setLocalEgld((v) => v + n);
      setLocalRows((prev) =>
        prev.map((r) => {
          if (r.contract !== contract) return r;
          const left = Math.max(0, r.unlocking - n);
          return {
            ...r,
            unlocking: left,
            unlockReady: 0,
            unlockEndsAt: left > 1e-8 ? r.unlockEndsAt : undefined,
            valueUsd: r.staked * egldUsd,
          };
        }),
      );
    }
  }

  function go(kind: DelegationAction, contract?: string, amount?: number) {
    if (demo) {
      applyLocal(kind, contract, amount);
      onAction?.(kind, contract, amount);
      return;
    }
    if (!canSign) {
      onConnect?.();
      return;
    }
    onAction?.(kind, contract, amount);
  }

  function toggleRow(contract: string) {
    setOpenId((id) => {
      const next = id === contract ? "" : contract;
      if (next) {
        setQty("");
        setAddOpen(false);
        setOpenPick(false);
      }
      return next;
    });
  }

  function unstakeAmtFor(stakedAmt: number) {
    return qtyOk ? Math.min(parsed, stakedAmt) : stakedAmt;
  }

  return (
    <article
      id="wallet-validators"
      className={cn(
        "scroll-mt-40 rounded-xl bg-surface shadow-[var(--shadow-border)]",
        emptyStake && hidden && "opacity-55",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Landmark className="size-4 shrink-0 text-volt" />
          <h3 className={cn("font-display text-xl font-medium", emptyStake && "text-muted")}>
            {t.walletValidators}
          </h3>
          <Badge variant="mute">{localRows.length}</Badge>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={toggle}>
          {hidden ? (
            emptyStake ? <Eye className="size-3.5" /> : <ChevronDown className="size-3.5" />
          ) : emptyStake ? (
            <EyeOff className="size-3.5" />
          ) : (
            <ChevronUp className="size-3.5" />
          )}
          {hidden
            ? emptyStake
              ? t.walletRevealSection
              : t.walletShowValidators
            : emptyStake
              ? t.walletCamouflage
              : t.walletHideValidators}
        </Button>
      </div>
      {hidden && emptyStake ? (
        <p className="px-4 pb-3 pt-2 text-xs text-muted">{t.walletSectionIdle}</p>
      ) : (
        <>
      <div className="flex flex-wrap items-end justify-between gap-2 px-4 pt-2 pb-2">
        <div className="min-w-0">
          <p className="tabular font-display text-2xl leading-none">{money(usd, 2)}</p>
          <p className="mt-1 truncate text-xs text-muted">
            {formatNum(staked, 4)} EGLD
            {rewards > 0 ? ` · ${t.walletPending} ${formatNum(rewards, 4)}` : ""}
            {unlocking > 0
              ? ` · ${t.walletUnlocking} ${formatNum(unlocking, 4)}${
                  Number.isFinite(nextWaitMs) ? ` · ${formatEta(nextWaitMs, t)}` : ""
                }`
              : ""}
          </p>
        </div>
        {hasRewards ? (
          <div className="flex shrink-0 gap-1.5">
            <Button type="button" size="sm" disabled={gated || Boolean(run)} onClick={() => go("claim")}>
              {run === "claim" ? <LionRun size="sm" label={t.txRun} /> : null}
              {claimEgldLabel(t, rewards)}
            </Button>
            <Button
              type="button"
              variant="volt"
              size="sm"
              disabled={gated || Boolean(run)}
              onClick={() => go("restake")}
            >
              {run === "restake" ? <LionRun size="sm" label={t.txRun} /> : null}
              {fillAmt(claimable.length > 1 ? t.walletRestakeAll : t.walletRestake, formatEgldAmount(rewards, 4))}
            </Button>
          </div>
        ) : null}
      </div>
      {hidden ? (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={toggle}
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-3 text-left"
          >
            <span className="text-sm text-muted">
              {localRows.length} · {formatNum(staked, 2)} EGLD · {t.walletValidatorsHidden}
            </span>
            <ChevronDown className="size-4 shrink-0 text-volt" />
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3">
          {mine.length === 0 ? (
            <p className="px-1 pb-2 text-xs text-muted">{t.walletEmptyValidators}</p>
          ) : (
            <ul className="overflow-hidden rounded-lg bg-surface-2">
              {mine.map((row) => (
                <li key={row.contract} className="border-b border-fg/6 last:border-0">
                  <ValidatorRow
                    t={t}
                    row={row}
                    money={money}
                    open={openId === row.contract}
                    gated={gated}
                    run={run}
                    qty={openId === row.contract ? qty : ""}
                    maxStake={maxStake}
                    now={now}
                    onToggle={() => toggleRow(row.contract)}
                    onQty={setQty}
                    onMax={() => setQty(maxStake > 0 ? String(Number(maxStake.toFixed(4))) : "")}
                    onStake={() => go("stake", row.contract, stakeAmt)}
                    onUnstake={() => go("unstake", row.contract, unstakeAmtFor(row.staked))}
                    onWithdraw={() => {
                      if (unlockState(row, now).ready <= 0) return;
                      go("withdraw", row.contract);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 overflow-hidden rounded-lg bg-surface-2">
            <button
              type="button"
              className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm"
              onClick={() => {
                setAddOpen((v) => !v);
                if (!addOpen) {
                  setOpenId("");
                  setQty("");
                }
              }}
            >
              <Plus className="size-3.5 shrink-0 text-volt" />
              <span className="flex-1 font-medium">{t.walletStakeOther}</span>
              {addOpen ? <ChevronUp className="size-4 text-muted" /> : <ChevronDown className="size-4 text-muted" />}
            </button>
            {addOpen ? (
              <div className="px-3 pb-3">
                <div className="relative" ref={pickRef}>
                  <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    value={openPick ? query : (selected?.name ?? query)}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setOpenPick(true);
                    }}
                    onFocus={() => {
                      setQuery("");
                      setOpenPick(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setOpenPick(false);
                        return;
                      }
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const first = choices[0];
                        if (first) {
                          if (mineSet.has(first.contract)) {
                            setOpenId(first.contract);
                            setQty("");
                            setAddOpen(false);
                          } else {
                            setPicked(first.contract);
                          }
                          setQuery("");
                          setOpenPick(false);
                        }
                      }
                    }}
                    placeholder={t.walletSearchValidator}
                    className="h-10 pr-11 pl-9"
                    aria-label={t.walletSearchValidator}
                    aria-expanded={openPick}
                    aria-autocomplete="list"
                    role="combobox"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-fg"
                    aria-label={t.walletPickValidator}
                    onClick={() => {
                      setQuery("");
                      setOpenPick((v) => !v);
                    }}
                  >
                    {openPick ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {openPick ? (
                    <ul
                      role="listbox"
                      className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg bg-bg py-1 shadow-[0_16px_40px_rgb(0_0_0_/_0.65)] ring-1 ring-fg/12"
                    >
                      {choices.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-muted">{t.walletNoValidatorMatch}</li>
                      ) : (
                        choices.map((p) => {
                          const yours = mineSet.has(p.contract);
                          const active = picked === p.contract;
                          return (
                            <li key={p.contract}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                className={cn(
                                  "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface",
                                  active && "bg-surface",
                                )}
                                onClick={() => {
                                  setQuery("");
                                  setOpenPick(false);
                                  if (yours) {
                                    setOpenId(p.contract);
                                    setQty("");
                                    setAddOpen(false);
                                    return;
                                  }
                                  setPicked(p.contract);
                                }}
                              >
                                {p.avatar ? (
                                  <img src={p.avatar} alt="" className="size-7 rounded-full object-cover" />
                                ) : (
                                  <span className="inline-flex size-7 items-center justify-center rounded-full bg-volt/15 text-volt">
                                    <Landmark className="size-3.5" />
                                  </span>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{p.name}</p>
                                  <p className="truncate text-xs text-muted">
                                    {p.apr ? `${formatNum(p.apr, 1)}% APR` : t.walletPickValidator}
                                    {p.fee != null
                                      ? ` · ${formatNum(p.fee <= 1 ? p.fee * 100 : p.fee, 1)}% fee`
                                      : ""}
                                  </p>
                                </div>
                                {active ? <Check className="size-4 shrink-0 text-volt" /> : null}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  ) : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    inputMode="decimal"
                    value={openId ? "" : qty}
                    onChange={(e) => {
                      setOpenId("");
                      setQty(e.target.value);
                    }}
                    placeholder={t.walletStakeAmount}
                    className="h-10 flex-1"
                    aria-label={t.walletStakeAmount}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10"
                    onClick={() => {
                      setOpenId("");
                      setQty(maxStake > 0 ? String(Number(maxStake.toFixed(4))) : "");
                    }}
                  >
                    {t.max}
                  </Button>
                </div>
                <p className="mt-1.5 truncate text-xs text-muted">
                  {t.walletAvailable} {formatNum(maxStake, 4)} EGLD
                  {selected ? ` · ${selected.name}` : ""}
                </p>
                {selected && mineSet.has(selected.contract) ? null : (
                  <p className="mt-1 text-xs text-muted">{t.walletMinStake}</p>
                )}
                <Button
                  type="button"
                  className="mt-2 h-10 w-full"
                  disabled={gated || !picked || stakeAmt <= 0 || Boolean(run) || mineSet.has(picked)}
                  onClick={() => go("stake", picked, stakeAmt)}
                >
                  {run === "stake" && !openId ? <LionRun size="sm" label={t.txRun} /> : null}
                  {t.walletStakeEgld}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}
        </>
      )}
    </article>
  );
}
function UnbondAction({
  t,
  row,
  now,
  gated,
  run,
  onWithdraw,
}: {
  t: Copy;
  row: BoardDelegation;
  now: number;
  gated: boolean;
  run: DelegationAction | null;
  onWithdraw: () => void;
}) {
  if (row.unlocking <= 0) return null;
  const { ready, waitMs } = unlockState(row, now);
  return (
    <div className="flex flex-wrap gap-1.5">
      {waitMs > 0 ? (
        <Button type="button" variant="outline" size="sm" disabled className="pointer-events-none">
          <Clock className="size-3.5" />
          {t.walletWithdrawIn.replace("{time}", formatEta(waitMs, t))}
        </Button>
      ) : null}
      {ready > 0 ? (
        <Button
          type="button"
          size="sm"
          disabled={gated || Boolean(run)}
          onClick={onWithdraw}
        >
          {run === "withdraw" ? <LionRun size="sm" label={t.txRun} /> : null}
          {t.walletWithdrawEgld}
        </Button>
      ) : null}
      {waitMs <= 0 && ready <= 0 ? (
        <Button type="button" variant="outline" size="sm" disabled className="pointer-events-none">
          <Clock className="size-3.5" />
          {t.walletUnbonding}
        </Button>
      ) : null}
    </div>
  );
}
function ValidatorRow({
  t,
  row,
  money,
  open,
  gated,
  run,
  qty,
  maxStake,
  now,
  onToggle,
  onQty,
  onMax,
  onStake,
  onUnstake,
  onWithdraw,
}: {
  t: Copy;
  row: BoardDelegation;
  money: MoneyFn;
  open: boolean;
  gated: boolean;
  run: DelegationAction | null;
  qty: string;
  maxStake: number;
  now: number;
  onToggle: () => void;
  onQty: (value: string) => void;
  onMax: () => void;
  onStake: () => void;
  onUnstake: () => void;
  onWithdraw: () => void;
}) {
  const canStake = maxStake > 0;
  const canUnstake = row.staked > 0;
  const { waitMs } = unlockState(row, now);
  return (
    <div className={cn("px-3 py-2 transition-[background-color] duration-150", open && "bg-volt/10")}>
      <button type="button" onClick={onToggle} className="flex min-h-11 w-full items-center gap-2.5 text-left">
        {row.avatar ? (
          <img src={row.avatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-volt/15 text-volt">
            <Landmark className="size-3.5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted">
            {formatNum(row.staked, 4)} EGLD
            {row.apr ? ` · ${formatNum(row.apr, 1)}% APR` : ""}
            {row.rewards > 0 ? ` · ${t.walletPending} ${formatNum(row.rewards, 4)}` : ""}
            {row.unlocking > 0
              ? ` · ${t.walletUnlocking} ${formatNum(row.unlocking, 4)}${
                  waitMs > 0 ? ` · ${formatEta(waitMs, t)}` : ""
                }`
              : ""}
          </p>
        </div>
        <p className="tabular shrink-0 text-sm font-medium">{money(row.valueUsd + row.pendingUsd, 2)}</p>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted" />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted" />
        )}
      </button>
      {!open && row.unlocking > 0 ? (
        <div className="pb-1 pl-9">
          <UnbondAction t={t} row={row} now={now} gated={gated} run={run} onWithdraw={onWithdraw} />
        </div>
      ) : null}
      {open ? (
        <div className="grid gap-2 pt-1 pb-1">
          {row.unlocking > 0 ? (
            <UnbondAction t={t} row={row} now={now} gated={gated} run={run} onWithdraw={onWithdraw} />
          ) : null}
          <div className="flex gap-2">
            <Input
              inputMode="decimal"
              value={qty}
              onChange={(e) => onQty(e.target.value)}
              placeholder={t.walletStakeAmount}
              className="h-10 flex-1"
              aria-label={t.walletStakeAmount}
            />
            <Button type="button" variant="outline" size="sm" className="h-10" onClick={onMax}>
              {t.max}
            </Button>
          </div>
          <p className="truncate text-xs text-muted">
            {t.walletAvailable} {formatNum(maxStake, 4)} EGLD
            {canUnstake ? ` · ${t.walletStaked} ${formatNum(row.staked, 4)}` : ""}
          </p>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-10 flex-1"
              disabled={gated || !canStake || Boolean(run)}
              onClick={onStake}
            >
              {run === "stake" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.walletStakeEgld}
            </Button>
            {canUnstake ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 flex-1"
                disabled={gated || Boolean(run)}
                onClick={onUnstake}
              >
                {run === "unstake" ? <LionRun size="sm" label={t.txRun} /> : null}
                {t.walletUnstakeEgld}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
function isErdAddressSafe(value: string) {
  return value.startsWith("erd1") && value.length >= 62;
}
function positionTitle(t: Copy, row: BoardPosition) {
  if (row.titleKey) return t[row.titleKey];
  return row.title ?? "";
}
function PositionRow({
  t,
  row,
  money,
  onHeart,
  onFarm,
}: {
  t: Copy;
  row: BoardPosition;
  money: MoneyFn;
  onHeart: () => void;
  onFarm: () => void;
}) {
  const clickable = row.id === "heart" || row.id === "sroar";
  const Icon = row.id === "heart" ? Heart : row.id === "egld-stake" ? Landmark : Coins;
  const iconClass =
    row.id === "heart" ? "text-ember" : row.id === "egld-stake" ? "text-volt" : "text-volt";
  return (
    <button
      type="button"
      onClick={row.id === "heart" ? onHeart : row.id === "sroar" ? onFarm : undefined}
      disabled={!clickable}
      className={cn(
        "w-full rounded-lg bg-surface-2 p-3 text-left",
        clickable && "hover:shadow-[var(--shadow-border-hover)]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Icon className={cn("size-4", iconClass)} />
          {positionTitle(t, row)}
        </span>

        <span className="tabular text-sm font-medium">
          {money(row.valueUsd + row.pendingUsd, 2)}
        </span>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {t.walletStaked} {formatNum(row.amount, row.id === "heart" ? 0 : 2)}
        {row.amountTicker}
        {row.pending > 0
          ? ` · ${t.walletPending} ${formatNum(row.pending, row.id === "egld-stake" ? 4 : 3)} ${row.id === "egld-stake" ? "EGLD" : "ROAR"}`
          : ""}
        {row.unlocking > 0 ? ` · ${t.walletUnlocking} ${formatNum(row.unlocking, 2)}` : ""}
      </p>
    </button>
  );
}
function venueLabel(t: Copy, venue: BoardVenue) {
  if (venue === "xexchange") return t.venueXex;
  if (venue === "onedex") return t.venueOnedex;
  if (venue === "jexchange") return t.venueJex;
  return t.venueOther;
}
function PairMark({ icon, icon2 }: { icon: string; icon2?: string }) {
  if (!icon2) {
    return <img src={icon} alt="" className="size-9 rounded-full object-cover" />;
  }
  return (
    <span className="relative inline-flex size-10 shrink-0" aria-hidden>
      <img
        src={icon}
        alt=""
        className="absolute top-0 left-0 z-10 size-7 rounded-full object-cover shadow-[var(--shadow-border)]"
      />
      <img
        src={icon2}
        alt=""
        className="absolute right-0 bottom-0 size-7 rounded-full object-cover shadow-[var(--shadow-border)]"
      />
    </span>
  );
}
function PeekTip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(ev: Event) {
      if (box.current && !box.current.contains(ev.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);
  return (
    <span ref={box} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
      >
        <Info className="size-3.5" />
      </button>
      {open ? (
        <span
          role="tooltip"
          className="absolute right-0 top-full z-40 mt-1 w-max min-w-36 max-w-56 rounded-sm bg-surface-2 px-2.5 py-1.5 text-xs text-fg shadow-[var(--shadow-border)]"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

function peekDigits(n: number) {
  if (n >= 1e3) return 2;
  if (n >= 1) return 4;
  if (n >= 0.01) return 4;
  return 6;
}

function TokenRow({
  t,
  token,
  money,
  share,
  onSwap,
  onSend,
}: {
  t: Copy;
  token: BoardToken;
  money: MoneyFn;
  share: number;
  onSwap: (id?: string) => void;
  onSend?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const eq = token.equivalent;
  return (
    <div>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left hover:bg-surface-2"
        >
          <img src={token.icon} alt="" className="size-9 rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{token.ticker}</p>
              {token.valueUsd > 0 ? (
                <p className="tabular text-sm font-medium">{money(token.valueUsd, 2)}</p>
              ) : null}
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="truncate text-[11px] text-muted">
                {formatNum(token.amount, token.ticker === "EGLD" ? 4 : token.amount >= 1e3 ? 2 : 4)}{" "}
                {token.ticker}
              </p>
              {open ? (
                <ChevronUp className="size-4 shrink-0 text-muted" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted" />
              )}
            </div>
          </div>
        </button>
        {eq && eq.amount > 0 ? (
          <PeekTip label={t.walletPeekLst}>
            <span className="tabular">
              {formatNum(eq.amount, peekDigits(eq.amount))} {eq.ticker}
            </span>
          </PeekTip>
        ) : null}
      </div>
      {open ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-3">
          <p className="min-w-0 text-[11px] text-muted">
            {token.name}
            {token.priceUsd > 0
              ? ` · ${formatUsdc(token.priceUsd, token.priceUsd < 0.01 ? 4 : 2)}`
              : ""}
            {share > 0.005 ? ` · ${Math.round(share * 100)}%` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {onSend ? (
              <Button type="button" size="sm" variant="outline" className="h-11" onClick={onSend}>
                <Send className="size-3.5" />
                {t.walletSend}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11"
              onClick={() => onSwap(token.id)}
            >
              <ArrowLeftRight className="size-3.5" />
              {t.walletOpenPair}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
function PoolRow({
  t,
  pool,
  money,
  share,
  onSwap,
  onSend,
}: {
  t: Copy;
  pool: BoardPool;
  money: MoneyFn;
  share: number;
  onSwap?: (id?: string) => void;
  onSend?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const kind =
    pool.kind === "farm"
      ? t.walletFarmPos
      : pool.kind === "order"
        ? t.walletOrder
        : pool.kind === "stakedLp"
          ? t.walletStakedLp
          : pool.kind === "xmex"
            ? t.walletXmex
            : t.walletLpTokens;
  const under = (pool.under ?? []).filter((u) => u.amount > 0 || u.valueUsd > 0);
  const eq = pool.equivalent;
  const peekLp = under.length > 0;
  const peekEq = Boolean(eq && eq.amount > 0);
  return (
    <div>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left hover:bg-surface-2"
        >
          {pool.icon ? (
            <PairMark icon={pool.icon} icon2={pool.icon2 || under[1]?.icon} />
          ) : (
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-volt/15 text-volt">
              <Droplets className="size-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{pool.title}</p>
              {pool.valueUsd > 0 ? (
                <p className="tabular text-sm font-medium">{money(pool.valueUsd, 2)}</p>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {formatNum(pool.amount, pool.amount >= 1e3 ? 2 : pool.amount < 0.01 ? 6 : 4)}{" "}
              {pool.amountTicker}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <p className="truncate text-[11px] text-muted">
                {venueLabel(t, pool.venue)} · {kind}
              </p>
              {open ? (
                <ChevronUp className="size-4 shrink-0 text-muted" />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted" />
              )}
            </div>
          </div>
        </button>
        {peekLp || peekEq ? (
          <PeekTip label={peekLp ? t.walletPeekLp : t.walletPeekLst}>
            {peekLp ? (
              <ul className="grid gap-1">
                {under.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3">
                    <span>{u.ticker}</span>
                    <span className="tabular">
                      {u.amount > 0 ? formatNum(u.amount, peekDigits(u.amount)) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : eq ? (
              <span className="tabular">
                {formatNum(eq.amount, peekDigits(eq.amount))} {eq.ticker}
              </span>
            ) : null}
          </PeekTip>
        ) : null}
      </div>
      {open ? (
        <div className="px-2 pb-3">
          {under.length > 0 ? (
            <ul className="rounded-lg bg-surface-2 p-2">
              {under.map((u) => (
                <li key={u.id} className="flex min-h-11 items-center gap-3 px-2 py-1.5">
                  <img src={u.icon} alt="" className="size-8 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{u.ticker}</p>
                    <p className="text-[11px] text-muted">
                      {u.amount > 0
                        ? `${formatNum(u.amount, u.amount >= 1e3 ? 2 : 4)} ${u.ticker}`
                        : t.walletUnder}
                    </p>
                  </div>
                  {u.valueUsd > 0 ? (
                    <p className="tabular text-sm">{money(u.valueUsd, 2)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-muted">
              {pool.pairLabel}
              {share > 0.005 ? ` · ${Math.round(share * 100)}%` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {onSend ? (
              <Button type="button" size="sm" variant="outline" className="h-11" onClick={onSend}>
                <Send className="size-3.5" />
                {t.walletSend}
              </Button>
            ) : null}
            {onSwap ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11"
                onClick={() => onSwap(under[0]?.id || pool.id)}
              >
                <ArrowLeftRight className="size-3.5" />
                {t.walletOpenPair}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SendSheet({
  t,
  asset,
  onClose,
  onSend,
}: {
  t: Copy;
  asset: { id: string; ticker: string; amount: number; icon: string } | null;
  onClose: () => void;
  onSend: (to: string, amount: number) => void;
}) {
  const [to, setTo] = useState("");
  const [raw, setRaw] = useState("");
  useEffect(() => {
    setTo("");
    setRaw("");
  }, [asset?.id]);
  if (!asset) return null;
  const amount = Number(raw);
  const addrOk = isErdAddress(to.trim());
  const amtOk = Number.isFinite(amount) && amount > 0 && amount <= asset.amount + 1e-12;
  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.walletSend}</DialogTitle>
          <DialogDescription>{t.walletSendLead}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
          <img src={asset.icon} alt="" className="size-9 rounded-full object-cover" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{asset.ticker}</p>
            <p className="text-[11px] text-muted">
              {t.walletAvailable} {formatNum(asset.amount, peekDigits(asset.amount))}
            </p>
          </div>
        </div>
        <label className="grid gap-1.5 text-xs font-medium">
          {t.walletSendTo}
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="erd1…"
            className="h-11 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">
          {t.walletSendAmount}
          <div className="flex gap-2">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="decimal"
              className="h-11"
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => setRaw(String(asset.amount))}
            >
              {t.max}
            </Button>
          </div>
        </label>
        <Button
          type="button"
          className="h-12 w-full"
          disabled={!addrOk || !amtOk}
          onClick={() => onSend(to.trim(), amount)}
        >
          <Send className="size-3.5" />
          {t.walletSend} {asset.ticker}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function QuoteToggle({
  t,
  quote,
  onChange,
}: {
  t: Copy;
  quote: WalletQuote;
  onChange: (q: WalletQuote) => void;
}) {
  return (
    <div
      role="group"
      aria-label={t.walletQuote}
      className="flex rounded-full bg-surface-2 p-0.5 shadow-[var(--shadow-border)]"
    >
      {(["egld", "usdc"] as const).map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onChange(q)}
          className={cn(
            "h-11 min-w-14 rounded-full px-3 text-xs font-medium transition-[background-color,color] duration-150",
            quote === q ? "bg-volt text-bg" : "text-muted hover:text-fg",
          )}
        >
          {q === "egld" ? t.walletQuoteEgld : t.walletQuoteUsdc}
        </button>
      ))}
    </div>
  );
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
      {fetching ? <Loader2 className="size-3 animate-spin" /> : null}
    </span>
  );
}

function roleLabel(t: Copy, role: ProtocolRow["role"]) {
  if (role === "supply") return t.hatomSupply;
  if (role === "borrow") return t.hatomBorrow;
  if (role === "booster") return t.hatomBooster;
  if (role === "lst") return t.hatomLst;
  if (role === "ushStake") return t.hatomUshStake;
  if (role === "isolated") return t.hatomIsolated;
  if (role === "lp") return t.walletLp;
  if (role === "staked") return t.burnifyStaked;
  if (role === "nft") return t.burnifyNfts;
  if (role === "fuel") return t.burnifyFuel;
  return t.hatomLiquid;
}

function ProtocolLine({
  row,
  t,
  money,
  share,
}: {
  row: ProtocolRow;
  t: Copy;
  money: MoneyFn;
  share: number;
}) {
  return (
    <li className="flex min-h-14 items-center gap-3 rounded-md px-2 py-2">
      <img src={row.icon} alt="" className="size-9 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium">{row.name}</p>
          <p className="tabular text-sm font-medium">{money(row.valueUsd, 2)}</p>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="truncate text-[11px] text-muted">
            {roleLabel(t, row.role)}
            {row.underlying ? ` · ${row.underlying}` : ""}
            {` · ${formatNum(row.amount, row.amount >= 1000 ? 2 : 4)} ${row.amountTicker}`}
          </p>
          <ShareBar share={share} />
        </div>
      </div>
    </li>
  );
}

function BurnifyCard({
  t,
  burnify,
  money,
  total,
  egldUsd = 0,
  demo = false,
  canSign = false,
  busy = null,
  onConnect,
  onAction,
  empty = false,
}: {
  t: Copy;
  burnify: BurnifyBoard;
  money: MoneyFn;
  total: number;
  egldUsd?: number;
  demo?: boolean;
  canSign?: boolean;
  busy?: DelegationAction | BurnifyAction | null;
  onConnect?: () => void;
  onAction?: (kind: BurnifyAction, amount?: number) => void;
  empty?: boolean;
}) {
  const [showEmpty, setShowEmpty] = useState(false);
  useEffect(() => {
    try {
      setShowEmpty(localStorage.getItem(`${SHOW_EMPTY_PREFIX}wallet-burnify`) === "1");
    } catch {}
  }, []);
  const camouflaged = empty && !showEmpty;
  const [qty, setQty] = useState("");
  const [local, setLocal] = useState({
    liquidBfy: burnify.liquidBfy,
    stakedBfy: burnify.stakedBfy,
    pendingEgld: burnify.pendingEgld,
    nftPendingEgld: burnify.nftPendingEgld,
    walletBufu: burnify.walletBufu.length,
    stakedBufu: burnify.stakedBufu.length,
  });
  useEffect(() => {
    setLocal({
      liquidBfy: burnify.liquidBfy,
      stakedBfy: burnify.stakedBfy,
      pendingEgld: burnify.pendingEgld,
      nftPendingEgld: burnify.nftPendingEgld,
      walletBufu: burnify.walletBufu.length,
      stakedBufu: burnify.stakedBufu.length,
    });
  }, [
    burnify.liquidBfy,
    burnify.stakedBfy,
    burnify.pendingEgld,
    burnify.nftPendingEgld,
    burnify.walletBufu.length,
    burnify.stakedBufu.length,
  ]);
  const bfyPx =
    burnify.bfyPriceUsd ||
    (burnify.stakedBfy > 0 && burnify.stakedUsd > 0 ? burnify.stakedUsd / burnify.stakedBfy : 0);
  const pendingEgld = local.pendingEgld + local.nftPendingEgld;
  const stakedUsd = local.stakedBfy * bfyPx;
  const liquidUsd = local.liquidBfy * bfyPx;
  const pendingUsd = pendingEgld * egldUsd;
  const net = liquidUsd + stakedUsd + burnify.nftUsd + pendingUsd;
  const parsed = Number(qty.replace(",", "."));
  const stakeAmt = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, local.liquidBfy) : local.liquidBfy;
  const unstakeAmt = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, local.stakedBfy) : local.stakedBfy;
  const run = busy && busy !== "claim" && busy !== "restake" && busy !== "stake" && busy !== "unstake" && busy !== "withdraw" ? busy : null;
  function go(kind: BurnifyAction, amount?: number) {
    if (demo) {
      if (kind === "stakeBfy") {
        const n = amount && amount > 0 ? Math.min(amount, local.liquidBfy) : local.liquidBfy;
        if (n <= 0) return;
        setLocal((s) => ({ ...s, liquidBfy: s.liquidBfy - n, stakedBfy: s.stakedBfy + n }));
        setQty("");
      } else if (kind === "unstakeBfy") {
        const n = amount && amount > 0 ? Math.min(amount, local.stakedBfy) : local.stakedBfy;
        if (n <= 0) return;
        setLocal((s) => ({ ...s, liquidBfy: s.liquidBfy + n, stakedBfy: s.stakedBfy - n }));
        setQty("");
      } else if (kind === "claimBfy") {
        setLocal((s) => ({ ...s, pendingEgld: 0 }));
      } else if (kind === "stakeBufu") {
        if (local.walletBufu <= 0) return;
        setLocal((s) => ({ ...s, walletBufu: 0, stakedBufu: s.stakedBufu + s.walletBufu }));
      } else if (kind === "unstakeBufu") {
        if (local.stakedBufu <= 0) return;
        setLocal((s) => ({ ...s, walletBufu: s.walletBufu + s.stakedBufu, stakedBufu: 0 }));
      } else if (kind === "claimBufu") {
        setLocal((s) => ({ ...s, nftPendingEgld: 0 }));
      } else if (kind === "claimAll") {
        setLocal((s) => ({ ...s, pendingEgld: 0, nftPendingEgld: 0 }));
      }
      onAction?.(kind, amount);
      return;
    }
    if (!canSign) {
      onConnect?.();
      return;
    }
    onAction?.(kind, amount);
  }
  const gated = !demo && (!canSign || busy !== null);
  const canClaimBfy = local.pendingEgld > 0 || local.stakedBfy > 0;
  const canClaimBufu = local.nftPendingEgld > 0 || local.stakedBufu > 0;
  const extraRows = burnify.rows.filter(
    (row) =>
      row.id !== "burnify-stake" &&
      row.id !== "burnify-bufu-staked" &&
      row.ticker !== "BFY" &&
      row.ticker !== "BUFU" &&
      row.ticker !== "BUFUOH",
  );
  function toggleEmpty() {
    setShowEmpty((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`${SHOW_EMPTY_PREFIX}wallet-burnify`, next ? "1" : "0");
      } catch {}
      return next;
    });
  }
  if (camouflaged) {
    return (
      <article
        id="wallet-burnify"
        className="scroll-mt-40 overflow-hidden rounded-xl bg-surface opacity-55 shadow-[var(--shadow-border)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
          <div className="flex min-w-0 items-center gap-2">
            <Flame className="size-4 shrink-0 text-ember" />
            <h3 className="font-display text-xl font-medium text-muted">{t.burnifyTitle}</h3>
            <Badge variant="mute">0</Badge>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-11" onClick={toggleEmpty}>
            <Eye className="size-3.5" />
            {t.walletRevealSection}
          </Button>
        </div>
        <p className="px-5 pb-4 pt-2 text-[11px] text-muted">{t.walletSectionIdle}</p>
      </article>
    );
  }
  return (
    <article id="wallet-burnify" className="scroll-mt-40 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <Flame className="size-4 shrink-0 text-ember" />
          <h3 className="font-display text-xl font-medium">{t.burnifyTitle}</h3>
          <Badge variant="mute">{Math.max(burnify.rows.length, empty ? 0 : 1)}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {empty ? (
            <Button type="button" variant="ghost" size="sm" className="h-11" onClick={toggleEmpty}>
              <EyeOff className="size-3.5" />
              {t.walletCamouflage}
            </Button>
          ) : (
            <a
              href={LINKS.burnify}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-1 text-xs text-muted hover:text-fg"
            >
              {t.burnifyOpen}
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>
      </div>
      <p className="px-5 pt-2 pb-3 text-xs leading-relaxed text-muted">{t.burnifyLead}</p>

      <div className="flex flex-col gap-3 px-5 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="tabular font-display text-2xl leading-none">{money(net, 2)}</p>
          <p className="mt-1 text-[11px] text-muted">
            {local.stakedBfy > 0
              ? `${formatNum(local.stakedBfy, 2)} BFY · ${money(stakedUsd, 2)}`
              : t.burnifyStakedBfy}
            {` · ${formatEgld(pendingEgld)}`}
            {pendingUsd >= 0.01 ? ` · ${money(pendingUsd, 2)}` : ""}
            {local.stakedBufu > 0 ? ` · ${local.stakedBufu} BUFU` : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="volt"
          className="h-11 min-w-[9rem]"
          disabled={gated || (!canClaimBfy && !canClaimBufu) || Boolean(run)}
          onClick={() => go("claimAll")}
        >
          {run === "claimAll" ? <LionRun size="sm" label={t.txRun} /> : null}
          {fillAmt(t.burnifyClaimAll, formatEgldAmount(pendingEgld, pendingEgld >= 1 ? 3 : 4))}
        </Button>
      </div>

      <div className="grid gap-3 px-3">
        <div className="rounded-lg px-3 py-3 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">BFY</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t.burnifyBfyLead}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Macro label={`${t.burnifyWalletBfy} · ${formatNum(local.liquidBfy, 2)}`} value={money(liquidUsd, 2)} />
            <Macro
              label={`${t.burnifyStakedBfy} · ${formatNum(local.stakedBfy, 2)}`}
              value={money(stakedUsd, 2)}
              hint={bfyPx > 0 ? `${money(bfyPx, 4)} / BFY` : undefined}
              accent="ember"
            />
            <Macro
              label={t.burnifyRewards}
              value={formatEgld(local.pendingEgld)}
              hint={local.pendingEgld > 0 ? money(local.pendingEgld * egldUsd, 2) : undefined}
              accent="volt"
            />
          </div>
          {burnify.lockedUntilEpoch > 0 ? (
            <p className="mt-2 text-[11px] text-muted">
              {t.burnifyLocked} {burnify.lockedUntilEpoch}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Input
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={t.burnifyAmount}
              className="h-11 flex-1"
              aria-label={t.burnifyAmount}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11"
              onClick={() => setQty(String((local.liquidBfy > 0 ? local.liquidBfy : local.stakedBfy) || ""))}
            >
              {t.max}
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 min-w-[7.5rem] flex-1"
              disabled={gated || local.liquidBfy <= 0 || Boolean(run)}
              onClick={() => go("stakeBfy", stakeAmt)}
            >
              {run === "stakeBfy" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.burnifyStakeBfy}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-[7.5rem] flex-1"
              disabled={gated || local.stakedBfy <= 0 || Boolean(run)}
              onClick={() => go("unstakeBfy", unstakeAmt)}
            >
              {run === "unstakeBfy" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.burnifyUnstakeBfy}
            </Button>
            <Button
              type="button"
              variant="volt"
              className="h-11 min-w-[7.5rem] flex-1"
              disabled={gated || !canClaimBfy || Boolean(run)}
              onClick={() => go("claimBfy")}
            >
              {run === "claimBfy" ? <LionRun size="sm" label={t.txRun} /> : null}
              {fillAmt(t.burnifyClaimBfy, formatEgldAmount(local.pendingEgld, local.pendingEgld >= 1 ? 3 : 4))}
            </Button>
          </div>
        </div>

        <div className="rounded-lg px-3 py-3 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">BUFU</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t.burnifyBufuLead}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Macro label={t.burnifyWalletBufu} value={String(local.walletBufu)} />
            <Macro label={t.burnifyStakedBufu} value={String(local.stakedBufu)} accent="ember" />
            <Macro
              label={t.burnifyRewards}
              value={formatEgld(local.nftPendingEgld)}
              hint={local.nftPendingEgld > 0 ? money(local.nftPendingEgld * egldUsd, 2) : undefined}
              accent="volt"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 min-w-[7.5rem] flex-1"
              disabled={gated || local.walletBufu <= 0 || Boolean(run)}
              onClick={() => go("stakeBufu")}
            >
              {run === "stakeBufu" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.burnifyStakeBufu}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 min-w-[7.5rem] flex-1"
              disabled={gated || local.stakedBufu <= 0 || Boolean(run)}
              onClick={() => go("unstakeBufu")}
            >
              {run === "unstakeBufu" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.burnifyUnstakeBufu}
            </Button>
            <Button
              type="button"
              variant="volt"
              className="h-11 min-w-[7.5rem] flex-1"
              disabled={gated || !canClaimBufu || Boolean(run)}
              onClick={() => go("claimBufu")}
            >
              {run === "claimBufu" ? <LionRun size="sm" label={t.txRun} /> : null}
              {fillAmt(t.burnifyClaimBufu, formatEgldAmount(local.nftPendingEgld, local.nftPendingEgld >= 1 ? 3 : 4))}
            </Button>
          </div>
        </div>
      </div>

      {extraRows.length > 0 ? (
        <ul className="mt-3 px-3 pb-3">
          {extraRows.map((row) => (
            <ProtocolLine key={row.id} row={row} t={t} money={money} share={total > 0 ? row.valueUsd / total : 0} />
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-4 text-right text-sm font-medium tabular">{money(net, 2)}</p>
      )}
    </article>
  );
}

export function demoWalletBoard(
  session: Session,
  roarUsd: number,
  egldUsd: number,
  floorEgld: number,
): WalletBoard {
  const heartUsd = floorEgld * egldUsd;
  const tokens: WalletBoard["tokens"] = [
    {
      id: "EGLD",
      ticker: "EGLD",
      name: "eGold",
      amount: session.egldWallet,
      priceUsd: egldUsd,
      valueUsd: session.egldWallet * egldUsd,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
    },
    {
      id: "ROAR-e5185d",
      ticker: "ROAR",
      name: "ROAR",
      amount: session.roarWallet,
      priceUsd: roarUsd,
      valueUsd: session.roarWallet * roarUsd,
      icon: "/nfts/roar-token.png",
    },
    {
      id: "USDC-c76f1f",
      ticker: "USDC",
      name: "USDC",
      amount: 25,
      priceUsd: 1,
      valueUsd: 25,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/USDC-c76f1f/icon.png",
    },
    {
      id: "HTM-f51d55",
      ticker: "HTM",
      name: "Hatom",
      amount: 420,
      priceUsd: 0.029,
      valueUsd: 12.18,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HTM-f51d55/icon.png",
    },
    {
      id: "USH-111e09",
      ticker: "USH",
      name: "HatomUSD",
      amount: 18,
      priceUsd: 1,
      valueUsd: 18,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/USH-111e09/icon.png",
    },
    {
      id: "SEGLD-3ad2d0",
      ticker: "SEGLD",
      name: "StakedEGLD",
      amount: 0.8,
      priceUsd: egldUsd * 1.12,
      valueUsd: 0.8 * egldUsd * 1.12,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/SEGLD-3ad2d0/icon.png",
      equivalent: { ticker: "EGLD", amount: 0.8 * 1.12 },
    },
    {
      id: "XEGLD-e413ed",
      ticker: "XEGLD",
      name: "StakedEGLD",
      amount: 251.5,
      priceUsd: egldUsd * 1.126,
      valueUsd: 251.5 * egldUsd * 1.126,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/XEGLD-e413ed/icon.png",
      equivalent: { ticker: "EGLD", amount: 283.2 },
    },
    {
      id: "VOXEGLD-5872e5",
      ticker: "VOXEGLD",
      name: "VoxEGLD",
      amount: 4.2,
      priceUsd: egldUsd * 1.04,
      valueUsd: 4.2 * egldUsd * 1.04,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/VOXEGLD-5872e5/icon.png",
      equivalent: { ticker: "EGLD", amount: 4.368 },
    },
    {
      id: "HEGLD-d61095",
      ticker: "HEGLD",
      name: "HatomEGLD",
      amount: 2.4,
      priceUsd: egldUsd,
      valueUsd: 2.4 * egldUsd,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HEGLD-d61095/icon.png",
    },
    {
      id: "HSEGLD-c13a4e",
      ticker: "HSEGLD",
      name: "HatomSEGLD",
      amount: 1.1,
      priceUsd: egldUsd * 1.12,
      valueUsd: 1.1 * egldUsd * 1.12,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HSEGLD-c13a4e/icon.png",
    },
    {
      id: "HUSDC-d80042",
      ticker: "HUSDC",
      name: "HatomUSDC",
      amount: 40,
      priceUsd: 1,
      valueUsd: 40,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HUSDC-d80042/icon.png",
    },
    {
      id: "HUSDT-6f0914",
      ticker: "HUSDT",
      name: "HatomUSDT",
      amount: 15,
      priceUsd: 1,
      valueUsd: 15,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HUSDT-6f0914/icon.png",
    },
    {
      id: "HHTM-e03ba5",
      ticker: "HHTM",
      name: "HatomHTM",
      amount: 90,
      priceUsd: 0.029,
      valueUsd: 2.61,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HHTM-e03ba5/icon.png",
    },
    {
      id: "HUTK-4fa4b2",
      ticker: "HUTK",
      name: "HatomUTK",
      amount: 40,
      priceUsd: 0.12,
      valueUsd: 4.8,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HUTK-4fa4b2/icon.png",
    },
    {
      id: "HWTAO-2e9136",
      ticker: "HWTAO",
      name: "HatomwTAO",
      amount: 0.04,
      priceUsd: 320,
      valueUsd: 12.8,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HWTAO-2e9136/icon.png",
    },
    {
      id: "HUSH-d2996f",
      ticker: "HUSH",
      name: "HatomUSH",
      amount: 8,
      priceUsd: 1,
      valueUsd: 8,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HUSH-d2996f/icon.png",
    },
    {
      id: "HMEX-df6df7",
      ticker: "HMEX",
      name: "HatomMEX",
      amount: 2400,
      priceUsd: 0.00012,
      valueUsd: 0.29,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HMEX-df6df7/icon.png",
    },
    {
      id: "WTAO-4f5363",
      ticker: "WTAO",
      name: "Wrapped TAO",
      amount: 0.01,
      priceUsd: 320,
      valueUsd: 3.2,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WTAO-4f5363/icon.png",
    },
    {
      id: "LKHTM-cbb969",
      ticker: "LKHTM",
      name: "Locked HTM",
      amount: 220,
      priceUsd: 0.029,
      valueUsd: 6.38,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/HTM-f51d55/icon.png",
    },
    {
      id: "BFY-8344ff",
      ticker: "BFY",
      name: "Burnify",
      amount: 86,
      priceUsd: 0.014,
      valueUsd: 1.2,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/BFY-8344ff/icon.png",
    },
    {
      id: "BFUEL-361c73",
      ticker: "BFUEL",
      name: "BurnifyFuel",
      amount: 210,
      priceUsd: 0,
      valueUsd: 0,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/BFUEL-361c73/icon.png",
    },
    {
      id: "DUST-000000",
      ticker: "DUST",
      name: "Dust token",
      amount: 12,
      priceUsd: 0.035,
      valueUsd: 0.42,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
    },
    {
      id: "SCRAP-000000",
      ticker: "SCRAP",
      name: "Unpriced scrap",
      amount: 88,
      priceUsd: 0,
      valueUsd: 0,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
    },
    {
      id: "ASH-a742f0",
      ticker: "ASH",
      name: "AshSwap",
      amount: 3.2,
      priceUsd: 0.04,
      valueUsd: 0.13,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/ASH-a742f0/icon.png",
    },
    {
      id: "UTK-2f80e9",
      ticker: "UTK",
      name: "Utrust",
      amount: 7,
      priceUsd: 0.12,
      valueUsd: 0.84,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/UTK-2f80e9/icon.png",
    },
    {
      id: "RIDE-7d18e9",
      ticker: "RIDE",
      name: "Holoride",
      amount: 20,
      priceUsd: 0.01,
      valueUsd: 0.2,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/RIDE-7d18e9/icon.png",
    },
    {
      id: "ZPAY-247875",
      ticker: "ZPAY",
      name: "zPay",
      amount: 40,
      priceUsd: 0.02,
      valueUsd: 0.8,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/ZPAY-247875/icon.png",
    },
    {
      id: "CRT-52dec7",
      ticker: "CRT",
      name: "CantinaRoyale",
      amount: 15,
      priceUsd: 0.03,
      valueUsd: 0.45,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/CRT-52dec7/icon.png",
    },
    {
      id: "BHAT-c1fde3",
      ticker: "BHAT",
      name: "BhNetwork",
      amount: 50,
      priceUsd: 0.01,
      valueUsd: 0.5,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/BHAT-c1fde3/icon.png",
    },
    {
      id: "CHECK-000001",
      ticker: "CHECK",
      name: "Zero quote",
      amount: 1,
      priceUsd: 0,
      valueUsd: 0,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
    },
  ].filter((row) => row.amount > 0);
  const nfts: WalletBoard["nfts"] = [
    ...(session.heartsWallet > 0
      ? [
          {
            collection: "HORVSN-a3fd09",
            identifier: "HORVSN-a3fd09-01",
            name: "Heart of ROAR",
            ticker: "HORVSN",
            amount: session.heartsWallet,
            thumbnail: "/heart-of-roar.jpg",
            valueUsd: session.heartsWallet * heartUsd,
            isHeart: true,
          },
        ]
      : []),
    {
      collection: "BUFU-4890a9",
      identifier: "BUFU-4890a9-01",
      name: "BUFU",
      ticker: "BUFU",
      amount: 2,
      thumbnail: "https://tools.multiversx.com/assets-cdn/tokens/BFY-8344ff/icon.png",
      valueUsd: 14,
      isHeart: false,
    },
    {
      collection: "EBUDZ-d1dc2e",
      identifier: "EBUDZ-d1dc2e-01",
      name: "eBudz",
      ticker: "EBUDZ",
      amount: 12,
      thumbnail: "/heart-of-roar.jpg",
      valueUsd: 18,
      isHeart: false,
    },
    {
      collection: "GSPACEAPE-08bc2b",
      identifier: "GSPACEAPE-08bc2b-01",
      name: "Space Ape",
      ticker: "GSPACEAPE",
      amount: 3,
      thumbnail: "/heart-of-roar.jpg",
      valueUsd: 42,
      isHeart: false,
    },
    {
      collection: "EMPTY-000000",
      identifier: "EMPTY-000000-01",
      name: "Worthless",
      ticker: "EMPTY",
      amount: 40,
      thumbnail: "/heart-of-roar.jpg",
      valueUsd: 0,
      isHeart: false,
    },
  ];
  const positions: WalletBoard["positions"] = [
    ...(session.heartsStaked > 0 || session.pendingRoar > 0
      ? [
          {
            id: "heart",
            titleKey: "walletHeartFarm" as const,
            amount: session.heartsStaked,
            amountTicker: "Heart",
            pending: session.pendingRoar,
            unlocking: 0,
            valueUsd: session.heartsStaked * heartUsd,
            pendingUsd: session.pendingRoar * roarUsd,
          },
        ]
      : []),
    {
      id: "sroar",
      titleKey: "walletRoarFarm" as const,
      amount: 18018,
      amountTicker: "ROAR",
      pending: 69.9,
      unlocking: 0,
      valueUsd: 18018 * roarUsd,
      pendingUsd: 69.9 * roarUsd,
    },
  ];
  const delegations: WalletBoard["delegations"] = [
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhllllsajxzat",
      name: "Staking Agency",
      identity: "stakingagency",
      avatar: "https://tools.multiversx.com/assets-cdn/identities/stakingagency/icon.png",
      staked: 1.5,
      rewards: 0.008,
      unlocking: 0,
      apr: 8,
      valueUsd: 1.5 * egldUsd,
      pendingUsd: 0.008 * egldUsd,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqc0llllsayxegu",
      name: "Binance Staking",
      identity: "binance_staking",
      avatar: "https://tools.multiversx.com/assets-cdn/identities/binance_staking/icon.png",
      staked: 1,
      rewards: 0.004,
      unlocking: 0,
      apr: 7.15,
      valueUsd: 1 * egldUsd,
      pendingUsd: 0.004 * egldUsd,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq8lllllsz6l6jr",
      name: "The Cobra",
      identity: "thecobra",
      avatar: "https://tools.multiversx.com/assets-cdn/identities/thecobra/icon.png",
      staked: 0,
      rewards: 0,
      unlocking: 2.4,
      unlockReady: 0,
      unlockEndsAt: DEMO_UNLOCK_AT,
      apr: 8.2,
      valueUsd: 2.4 * egldUsd,
      pendingUsd: 0,
    },
  ];
  const cdnId = (id: string) => `https://tools.multiversx.com/assets-cdn/identities/${id}/icon.png`;
  const providers: BoardProvider[] = [
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqhllllsajxzat",
      name: "Staking Agency",
      identity: "stakingagency",
      avatar: cdnId("stakingagency"),
      apr: 8,
      featured: true,
      nodes: 80,
      users: 2400,
      fee: 0.07,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqc0llllsayxegu",
      name: "Binance Staking",
      identity: "binance_staking",
      avatar: cdnId("binance_staking"),
      apr: 7.15,
      featured: true,
      nodes: 120,
      users: 9800,
      fee: 0.1,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq8lllllsz6l6jr",
      name: "The Cobra",
      identity: "thecobra",
      avatar: cdnId("thecobra"),
      apr: 8.2,
      featured: true,
      nodes: 40,
      users: 900,
      fee: 0.07,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqy8lllls57a66a",
      name: "PeerMe",
      identity: "peerme",
      avatar: cdnId("peerme"),
      apr: 8.1,
      featured: true,
      nodes: 25,
      users: 640,
      fee: 0.08,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqrhlllls0626l7",
      name: "Everstake",
      identity: "everstake",
      avatar: cdnId("everstake"),
      apr: 7.8,
      featured: true,
      nodes: 60,
      users: 1500,
      fee: 0.09,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9lllllsf3mp40",
      name: "Trust Staking",
      identity: "truststaking",
      avatar: cdnId("truststaking"),
      apr: 8.05,
      featured: true,
      nodes: 35,
      users: 1100,
      fee: 0.07,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqtllllls403l59",
      name: "ValidBlocks",
      identity: "validblocks",
      avatar: cdnId("validblocks"),
      apr: 8.3,
      featured: false,
      nodes: 18,
      users: 420,
      fee: 0.06,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqyllllls53luwm",
      name: "Helios Staking",
      identity: "heliosstaking",
      avatar: cdnId("heliosstaking"),
      apr: 7.9,
      featured: false,
      nodes: 22,
      users: 380,
      fee: 0.08,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq0llllls2qj2e4",
      name: "Just Mining",
      identity: "justmining",
      avatar: cdnId("justmining"),
      apr: 8.0,
      featured: true,
      nodes: 30,
      users: 700,
      fee: 0.08,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq2llllls9k2n7q",
      name: "Isengard",
      identity: "isengard",
      avatar: cdnId("isengard"),
      apr: 8.15,
      featured: true,
      nodes: 28,
      users: 520,
      fee: 0.07,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq4llllls7v3p0w",
      name: "Frontier",
      identity: "frontier",
      avatar: cdnId("frontier"),
      apr: 7.95,
      featured: false,
      nodes: 16,
      users: 310,
      fee: 0.08,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq5llllls1m8k2a",
      name: "Odyssey",
      identity: "odyssey",
      avatar: cdnId("odyssey"),
      apr: 8.25,
      featured: false,
      nodes: 14,
      users: 260,
      fee: 0.06,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6llllls4cx91e",
      name: "Middle Staking",
      identity: "middlestaking",
      avatar: cdnId("middlestaking"),
      apr: 8.05,
      featured: false,
      nodes: 20,
      users: 410,
      fee: 0.07,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqq7llllls0wq3k8",
      name: "ARC Stake",
      identity: "arcstake",
      avatar: cdnId("arcstake"),
      apr: 7.85,
      featured: false,
      nodes: 12,
      users: 190,
      fee: 0.09,
    },
    {
      contract: "erd1qqqqqqqqqqqqqqqpqqqqqqqqqqqqqqqqqqqqqqqqqqqqqallllls8tn54b",
      name: "Knight",
      identity: "knight",
      avatar: cdnId("knight"),
      apr: 8.1,
      featured: false,
      nodes: 18,
      users: 340,
      fee: 0.07,
    },
  ];
  const roarIcon = "/nfts/roar-token.png";
  const wegldIcon = "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png";
  const jexIcon = "https://tools.multiversx.com/assets-cdn/tokens/JEX-9040ca/icon.png";
  const rareIcon = "https://tools.multiversx.com/assets-cdn/tokens/RARE-99e8b0/icon.png";
  const xmnIcon = "https://tools.multiversx.com/assets-cdn/tokens/XMN-c20adb/icon.png";
  const oneIcon = "https://tools.multiversx.com/assets-cdn/tokens/ONE-f9954f/icon.png";
  const pools: BoardPool[] = [
    {
      id: "ROARWEGLD-745847",
      venue: "xexchange",
      kind: "lp",
      title: "ROAR-wEGLD",
      pairLabel: "ROAR / wEGLD",
      amount: 0.0001032,
      amountTicker: "ROARWEGLD",
      valueUsd: 184.2,
      icon: roarIcon,
      icon2: wegldIcon,
      under: [
        { id: "ROAR-e5185d", ticker: "ROAR", amount: 6405, icon: roarIcon, valueUsd: 96.1 },
        { id: "WEGLD-bd4d79", ticker: "wEGLD", amount: 24.05, icon: wegldIcon, valueUsd: 88.1 },
      ],
    },
    {
      id: "LP-roarjex",
      venue: "jexchange",
      kind: "lp",
      title: "ROAR-JEX",
      pairLabel: "ROAR / JEX",
      amount: 24.78,
      amountTicker: "ROAR-JEX",
      valueUsd: 211.9,
      icon: roarIcon,
      icon2: jexIcon,
      under: [
        { id: "ROAR-e5185d", ticker: "ROAR", amount: 5200, icon: roarIcon, valueUsd: 78 },
        { id: "JEX-9040ca", ticker: "JEX", amount: 410, icon: jexIcon, valueUsd: 133.9 },
      ],
    },
    {
      id: "ROARRARE-onedex",
      venue: "onedex",
      kind: "lp",
      title: "ROAR-RARE",
      pairLabel: "ROAR / RARE",
      amount: 1.977,
      amountTicker: "ROAR-RARE",
      valueUsd: 200.3,
      icon: roarIcon,
      icon2: rareIcon,
      under: [
        { id: "ROAR-e5185d", ticker: "ROAR", amount: 4800, icon: roarIcon, valueUsd: 72 },
        { id: "RARE-99e8b0", ticker: "RARE", amount: 18.4, icon: rareIcon, valueUsd: 128.3 },
      ],
    },
    {
      id: "LP-roarxmn",
      venue: "jexchange",
      kind: "lp",
      title: "ROAR-XMN",
      pairLabel: "ROAR / XMN",
      amount: 3.038,
      amountTicker: "ROAR-XMN",
      valueUsd: 136.2,
      icon: roarIcon,
      icon2: xmnIcon,
      under: [
        { id: "ROAR-e5185d", ticker: "ROAR", amount: 3900, icon: roarIcon, valueUsd: 58.5 },
        { id: "XMN-c20adb", ticker: "XMN", amount: 210, icon: xmnIcon, valueUsd: 77.7 },
      ],
    },
    {
      id: "EGLDMEXF-a4d81e",
      venue: "xexchange",
      kind: "stakedLp",
      title: "EGLD-MEX",
      pairLabel: "EGLD / MEX LP staked",
      amount: 1.2,
      amountTicker: "EGLDMEXF",
      valueUsd: 5.6,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
      icon2: "https://tools.multiversx.com/assets-cdn/tokens/MEX-455c57/icon.png",
      under: [
        {
          id: "WEGLD-bd4d79",
          ticker: "wEGLD",
          amount: 0.68,
          icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
          valueUsd: 2.8,
        },
        {
          id: "MEX-455c57",
          ticker: "MEX",
          amount: 2.3e6,
          icon: "https://tools.multiversx.com/assets-cdn/tokens/MEX-455c57/icon.png",
          valueUsd: 2.8,
        },
      ],
    },
    {
      id: "XMEX-fda355",
      venue: "xexchange",
      kind: "xmex",
      title: "xMEX",
      pairLabel: "xMEX · xExchange",
      amount: 125e3,
      amountTicker: "XMEX",
      valueUsd: 0.39,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/MEX-455c57/icon.png",
      equivalent: { ticker: "MEX", amount: 125e3 },
    },
    {
      id: "ONEWEGLD-892244",
      venue: "onedex",
      kind: "lp",
      title: "ONE-wEGLD",
      pairLabel: "ONE / wEGLD",
      amount: 3.2,
      amountTicker: "ONEWEGLD",
      valueUsd: 8.4,
      icon: oneIcon,
      icon2: wegldIcon,
      under: [
        { id: "ONE-f9954f", ticker: "ONE", amount: 120, icon: oneIcon, valueUsd: 4.2 },
        { id: "WEGLD-bd4d79", ticker: "wEGLD", amount: 1.01, icon: wegldIcon, valueUsd: 4.2 },
      ],
    },
    {
      id: "ZERO-lp",
      venue: "other",
      kind: "lp",
      title: "DUSTLP",
      pairLabel: "dust LP",
      amount: 1e-4,
      amountTicker: "LP",
      valueUsd: 0.001,
      icon: "https://tools.multiversx.com/assets-cdn/tokens/WEGLD-bd4d79/icon.png",
    },
  ];
  const boardTokens = tokens.filter(
    (row) => !isBurnifyAsset(row.id, row.ticker, row.name),
  );
  const boardNfts = nfts.filter(
    (row) => !isBurnifyAsset(row.identifier, row.ticker, row.name, row.collection),
  );
  const cdn = (id: string) => `https://tools.multiversx.com/assets-cdn/tokens/${id}/icon.png`;
  const hatom: HatomBoard = {
    suppliedUsd: 0,
    borrowedUsd: 0,
    boosterUsd: 0,
    lstUsd: 0,
    ushStakeUsd: 0,
    liquidUsd: 0,
    isolatedUsd: 0,
    borrowLimitUsd: 0,
    rows: [],
  };
  const burnifyRows: ProtocolRow[] = [];
  for (const tok of tokens) {
    if (!isBurnifyAsset(tok.id, tok.ticker, tok.name)) continue;
    burnifyRows.push({
      id: tok.id,
      protocol: "burnify",
      role: tok.ticker === "BFUEL" ? "fuel" : "liquid",
      ticker: tok.ticker,
      name: tok.name,
      amount: tok.amount,
      amountTicker: tok.ticker,
      valueUsd: tok.valueUsd,
      icon: tok.icon,
    });
  }
  for (const nft of nfts) {
    if (!isBurnifyAsset(nft.identifier, nft.ticker, nft.name, nft.collection)) continue;
    burnifyRows.push({
      id: nft.collection,
      protocol: "burnify",
      role: "nft",
      ticker: nft.ticker,
      name: nft.name,
      amount: nft.amount,
      amountTicker: nft.ticker,
      valueUsd: nft.valueUsd,
      icon: nft.thumbnail,
    });
  }
  burnifyRows.push({
    id: "burnify-stake",
    protocol: "burnify",
    role: "staked",
    ticker: "BFY",
    name: "Staked BFY",
    amount: 400,
    amountTicker: "BFY",
    valueUsd: 5.6,
    icon: cdn("BFY-8344ff"),
  });
  burnifyRows.push({
    id: "burnify-bufu-staked",
    protocol: "burnify",
    role: "nft",
    ticker: "BUFU",
    name: "Staked BUFU",
    amount: 1,
    amountTicker: "BUFU",
    valueUsd: 7,
    icon: cdn("BFY-8344ff"),
  });
  burnifyRows.sort((a, b) => b.valueUsd - a.valueUsd);
  const burnify: BurnifyBoard = {
    liquidUsd: burnifyRows.filter((row) => row.role === "liquid" || row.role === "fuel").reduce((s, row) => s + row.valueUsd, 0),
    stakedUsd: 400 * 0.014,
    nftUsd: burnifyRows.filter((row) => row.role === "nft").reduce((s, row) => s + row.valueUsd, 0),
    pendingUsd: 0.052 * egldUsd,
    pendingEgld: 0.04,
    nftPendingEgld: 0.012,
    liquidBfy: tokens.find((row) => row.ticker === "BFY")?.amount ?? 0,
    stakedBfy: 400,
    bfyPriceUsd: 0.014,
    lockedUntilEpoch: 0,
    walletBufu: [
      { collection: "BUFU-4890a9", nonce: 1 },
      { collection: "BUFU-4890a9", nonce: 2 },
    ],
    stakedBufu: [{ collection: "BUFU-4890a9", nonce: 3, index: 1 }],
    rows: burnifyRows,
  };
  const tokensUsd = boardTokens.reduce((s, row) => s + row.valueUsd, 0);
  const nftsUsd = boardNfts.reduce((s, n) => s + n.valueUsd, 0);
  const poolsUsd = pools.reduce((s, p) => s + p.valueUsd, 0);
  const stakingUsd =
    positions.reduce((s, p) => s + p.valueUsd + p.pendingUsd, 0) +
    delegations.reduce((s, d) => s + d.valueUsd + d.pendingUsd, 0);
  const burnifyNet = burnify.liquidUsd + burnify.stakedUsd + burnify.nftUsd + burnify.pendingUsd;
  return {
    address: session.address,
    totalUsd: tokensUsd + nftsUsd + poolsUsd + stakingUsd + burnifyNet,
    tokensUsd,
    nftsUsd,
    poolsUsd,
    stakingUsd,
    tokens: boardTokens,
    nfts: boardNfts,
    pools,
    positions,
    delegations,
    providers,
    hatom,
    burnify,
    fetchedAt: Date.now(),
  };
}
