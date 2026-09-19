import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConnectDialog } from "@/components/connect-dialog";
import { Header } from "@/components/header";
import { HeartGate, HeartPnlCard } from "@/components/heart-pnl";
import { MarketBoard } from "@/components/market";
import { RoarChart } from "@/components/roar-chart";
import { RoarFarm } from "@/components/roar-farm";
import { SectionNav } from "@/components/section-nav";
import { SignSheet } from "@/components/sign-sheet";
import { TxLaneHost } from "@/components/lion-run";
import { StakeDesk } from "@/components/stake-desk";
import { SwapDesk } from "@/components/swap-desk";
import { WalletBoardView, demoWalletBoard } from "@/components/wallet-board";
import { RoarBoardView } from "@/components/roar-board";
import {
  BoostPanel,
  Footer,
  PridePanel,
  TokenomicsPanel,
} from "@/components/vault-panels";
import {
  explorerTxUrl,
  BURNIFY,
  CHAIN,
  PAIRS,
  sectionFromHash,
  TOKEN,
  DUST,
  isDustConvertible,
  type AppSection,
  type SwapDirection,
} from "@/lib/config";
import { copy, type Copy } from "@/lib/i18n";
import {
  broadcastTx,
  getChainSnapshot,
  getMarketSnapshot,
  getRoarFarm,
  getWalletHoldings,
  getHeartBalance,
  prepareBuyTx,
  prepareBuyStakeTx,
  prepareClaimTx,
  prepareHeartRestakeTx,
  prepareDelegationTx,
  prepareBurnifyTx,
  prepareFarmTx,
  prepareEgldStakeTx,
  prepareDustConvertTx,
  prepareStakeTx,
  prepareSwapTx,
  prepareSendTx,
  prepareUnstakeTx,
  getTxStatus,
  type FarmAction,
  type FarmPosition,
  type BurnifyAction,
  type DelegationAction,
  type MarketListing,
  getWalletBoard,
  getDustPreview,
  getSwapCatalog,
  getRoarLeaderboard,
  type WalletBoard,
} from "@/lib/mx.functions";
import { useVaultStore } from "@/lib/store";
import { formatEgld, formatNum, formatRoarClaim, isErdAddress } from "@/lib/utils";
import { accruePending, aprPct, dailyFromPool } from "@/lib/vault";
import {
  onWalletLogout,
  restoreWallet,
  signPreparedTx,
  signPreparedTxs,
  subscribeWalletReady,
} from "@/lib/wallet";
import { beginTxLane, finishTxLane, hideTxLane } from "@/lib/tx-lane";

let livePaused = false;

const LIVE = {
  staleTime: 8_000,
  refetchInterval: () => (livePaused ? false : 12_000),
  refetchOnWindowFocus: () => !livePaused,
  placeholderData: keepPreviousData,
} as const;

const EMPTY_FARM: FarmPosition = { staked: 0, pending: 0, unlocking: 0, slots: [] };

function useEvent<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

function collectDustFromBoard(board?: WalletBoard | null) {
  if (!board) return [];
  const seen = new Set<string>();
  const out: { id: string; ticker: string; amount: number; valueUsd: number; icon: string }[] = [];
  const push = (id: string, ticker: string, amount: number, valueUsd: number, icon: string) => {
    if (!id || seen.has(id) || amount <= 0) return;
    if (!isDustConvertible(id, ticker, valueUsd)) return;
    seen.add(id);
    out.push({ id, ticker, amount, valueUsd, icon });
  };
  for (const row of board.tokens) {
    push(row.id, row.ticker, row.amount, row.valueUsd, row.icon);
  }
  return out.sort((a, b) => b.valueUsd - a.valueUsd).slice(0, DUST.maxTokens);
}

async function waitForTx(txHash: string) {
  const started = Date.now();
  let delay = 400;
  while (Date.now() - started < 18_000) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const done = await getTxStatus({ data: { txHash } });
      if (done.status === "success" || done.status === "fail" || done.status === "invalid") {
        return done;
      }
    } catch {
      /* indexer lag / 429 — keep polling */
    }
    delay = Math.min(Math.round(delay * 1.25), 2_000);
  }
  return { txHash, status: "pending" as const, message: "Still pending on-chain" };
}

async function waitForHearts(address: string, minQty: number) {
  const started = Date.now();
  let delay = 700;
  while (Date.now() - started < 50_000) {
    await new Promise((r) => setTimeout(r, delay));
    try {
      const { hearts } = await getHeartBalance({ data: { address } });
      if (hearts >= minQty) return;
    } catch {
      /* indexer lag */
    }
    delay = Math.min(Math.round(delay * 1.2), 2_500);
  }
  throw new Error("HEART_NOT_ARRIVED");
}

function txError(err: unknown, fallback: string, t: Copy) {
  const raw = err instanceof Error ? err.message : "";
  if (raw === "HEART_NOT_ARRIVED") return t.buyOkStakeLater;
  if (/\b429\b/i.test(raw) || /too many requests/i.test(raw) || /rate.?limit/i.test(raw) || /network is busy/i.test(raw)) {
    return t.rateLimited;
  }
  return raw || fallback;
}

function explorerAction(hash: string, label: string) {
  return {
    label,
    onClick: () => window.open(explorerTxUrl(hash), "_blank", "noreferrer"),
  };
}

function throwIfTxFailed(
  done: { status: string; message?: string },
  fallback: string,
) {
  if (done.status === "fail" || done.status === "invalid") {
    throw new Error(done.message || fallback);
  }
}

function throwIfTxUnconfirmed(
  done: { status: string; message?: string },
  pendingMsg: string,
  fallback: string,
) {
  throwIfTxFailed(done, fallback);
  if (done.status !== "success") throw new Error(pendingMsg);
}

async function toastTxResult(
  done: { txHash: string; status: string },
  loading: string | number,
  ok: string,
  t: Copy,
) {
  finishTxLane();
  await new Promise((r) => setTimeout(r, 380));
  toast.success(done.status === "pending" ? t.txPending : ok, {
    id: loading,
    action: done.txHash ? explorerAction(done.txHash, t.explorer) : undefined,
  });
  window.setTimeout(() => hideTxLane(), 280);
}

function stepLabel(data: string, t: (typeof copy)["fr"]) {
  const fn = data.split("@")[0] ?? "tx";
  if (fn === "xo" || data.includes("@xo@") || data.includes("@xo")) return t.swapStepAgg;
  if (fn === "reDelegateRewards") return t.delegationStepRestake;
  if (fn === "claimRewards") return t.delegationStepClaim;
  if (fn === "delegate") return t.delegationStepStake;
  if (fn === "unDelegate") return t.delegationStepUnstake;
  if (fn === "withdraw" && !data.includes("@")) return t.delegationStepWithdraw;
  if (data.includes("compoundRewards")) return t.farmStepCompound;
  if (data.includes("claimRewards")) return t.farmStepClaim;
  if (data.includes("unstakeFarm")) return t.farmStepUnstake;
  if (data.includes("unbondFarm")) return t.farmStepUnbond;
  if (fn === "ESDTTransfer" && data.includes("stakeFarm")) return t.farmStepStake;
  if (fn === "MultiESDTNFTTransfer") return t.farmStepStake;
  if (fn === "buy") return t.buyNow;
  if (fn === "wrapEgld") return t.wrapStep;
  if (fn === "unstake") return t.unstakeStep;
  if (fn === "claim") return t.claimStep;
  if (fn === "ESDTNFTTransfer" && data.includes("stake")) return t.stakeStep;
  if (fn === "ESDTTransfer" && data.includes("unwrapEgld")) return t.unwrapStep;
  if (fn === "ESDTTransfer" && data.includes("createOrder")) return t.swapStep;
  if (fn === "ESDTTransfer" && data.includes("multiPairSwap")) return t.swapStep;
  if (fn === "ESDTTransfer" && data.includes("swapTokensFixedInput")) return t.swapStep;
  return fn;
}

function readSection(): AppSection {
  if (typeof window === "undefined") return "heart";
  return sectionFromHash(window.location.hash);
}

export function PrideApp() {
  const lang = useVaultStore((s) => s.lang);
  const session = useVaultStore((s) => s.session);
  const slippage = useVaultStore((s) => s.slippage);
  const setHydrated = useVaultStore((s) => s.setHydrated);
  const connectXportal = useVaultStore((s) => s.connectXportal);
  const refreshHoldings = useVaultStore((s) => s.refreshHoldings);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [buyingStake, setBuyingStake] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [staking, setStaking] = useState<"stake" | "unstake" | "claim" | "restake" | null>(null);
  const [farming, setFarming] = useState<FarmAction | null>(null);
  const [swapStaking, setSwapStaking] = useState(false);
  const [dusting, setDusting] = useState(false);
  const [delegating, setDelegating] = useState<DelegationAction | null>(null);
  const [burnifying, setBurnifying] = useState<BurnifyAction | null>(null);
  const [sending, setSending] = useState(false);
  const [signerReady, setSignerReady] = useState(false);
  const [walletChecked, setWalletChecked] = useState(false);
  const [section, setSection] = useState<AppSection>("heart");
  const [heartPass, setHeartPass] = useState(false);
  const [heartGate, setHeartGate] = useState<"locked" | "checking" | "denied">("locked");
  const [swapFocus, setSwapFocus] = useState<string | null>(null);

  useEffect(() => {
    void Promise.resolve(useVaultStore.persist.rehydrate()).finally(() => {
      setHydrated();
    });
  }, [setHydrated]);

  useEffect(() => {
    const sync = () => setSection(readSection());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [section]);

  useEffect(() => {
    onWalletLogout(() => {
      setSignerReady(false);
    });
    const unsub = subscribeWalletReady((state) => {
      setSignerReady(state.kind === "wc" || state.kind === "webview");
    });
    let cancelled = false;
    void (async () => {
      try {
        const address = await restoreWallet();
        if (!address || cancelled) return;
        const holdings = await getWalletHoldings({ data: { address } });
        if (!cancelled) {
          connectXportal(holdings.address, holdings.hearts, holdings.roar, holdings.egld, {
            heartsStaked: holdings.heartsStaked,
            pendingRoar: holdings.pendingRoar,
            lastTick: holdings.lastTick,
            history: holdings.history,
          });
        }
      } catch {
        /* keep persisted session */
      } finally {
        if (!cancelled) setWalletChecked(true);
      }
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [connectXportal]);

  const snapshot = useQuery({
    queryKey: ["chain-snapshot"],
    queryFn: () => getChainSnapshot(),
    ...LIVE,
  });

  const market = useQuery({
    queryKey: ["market-snapshot"],
    queryFn: () => getMarketSnapshot(),
    ...LIVE,
  });

  const roarFarm = useQuery({
    queryKey: ["roar-farm"],
    queryFn: () => getRoarFarm(),
    ...LIVE,
  });

  const roarBoard = useQuery({
    queryKey: ["roar-board", session?.address],
    queryFn: () =>
      getRoarLeaderboard({
        data: {
          address:
            session && session.mode !== "demo" && isErdAddress(session.address)
              ? session.address
              : "",
        },
      }),
    enabled: section === "board",
    staleTime: 60_000,
    refetchInterval: (query) => (query.state.data ? 90_000 : false),
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    retry: 1,
  });

  const walletLive = useQuery({
    queryKey: ["wallet-holdings", session?.address, session?.mode],
    queryFn: () => getWalletHoldings({ data: { address: session!.address } }),
    enabled: Boolean(session && session.mode !== "demo" && session.address),
    ...LIVE,
  });

  const walletBoard = useQuery({
    queryKey: ["wallet-board", session?.address, session?.mode],
    queryFn: () => getWalletBoard({ data: { address: session!.address } }),
    enabled: Boolean(session && session.mode !== "demo" && session.address),
    staleTime: 10_000,
    refetchInterval: () => (livePaused ? false : 20_000),
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const dustPreview = useQuery({
    queryKey: ["dust-preview", session?.address, session?.mode],
    queryFn: () => getDustPreview({ data: { address: session!.address } }),
    enabled: Boolean(session && session.mode !== "demo" && session.address),
    staleTime: 10_000,
    refetchInterval: () => (livePaused ? false : 20_000),
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  useQuery({
    queryKey: ["swap-catalog"],
    queryFn: () => getSwapCatalog(),
    staleTime: 60_000,
    enabled: Boolean(session),
  });

  useEffect(() => {
    const h = walletLive.data;
    if (!h) return;
    const current = useVaultStore.getState().session;
    if (!current || current.mode === "demo") return;
    refreshHoldings(h.hearts, h.roar, h.egld, {
      heartsStaked: h.heartsStaked,
      pendingRoar: h.pendingRoar,
      lastTick: h.lastTick,
      history: h.history,
    });
  }, [walletLive.data, refreshHoldings]);

  const listed = market.data?.listedForSale ?? snapshot.data?.listedForSale ?? 0;
  const ooxStaked = market.data?.ooxStaked ?? snapshot.data?.ooxStaked ?? 0;
  const inWallets = market.data?.inWallets ?? snapshot.data?.inWallets ?? 0;
  const walletHolders = snapshot.data?.walletHolderCount ?? market.data?.heartHolders ?? 0;
  const prideVaultStaked = ooxStaked;
  const pool = market.data?.poolRoar ?? snapshot.data?.poolRoar ?? 0;
  const t = copy[lang];
  const daily =
    market.data?.dailyPerNft || snapshot.data?.dailyPerNft || dailyFromPool(pool, ooxStaked);

  const pending = useMemo(() => {
    if (!session) return 0;
    return accruePending(
      session.heartsStaked,
      prideVaultStaked,
      session.lastTick,
      session.pendingRoar,
      now,
      pool,
      daily,
    ).pending;
  }, [session, prideVaultStaked, now, pool, daily]);

  const heartsHeld = (session?.heartsWallet ?? 0) + (session?.heartsStaked ?? 0);
  const heartPnl =
    session?.mode === "demo"
      ? {
          boughtQty: 5,
          investedEgld: 5,
          avgCostEgld: 1,
          claimedRoar: session.claimedTotal,
          pendingRoar: pending,
          lots: [
            { qty: 3, unitEgld: 1, costEgld: 3, at: Date.now() - 86400000 * 12, hash: "" },
            { qty: 2, unitEgld: 1, costEgld: 2, at: Date.now() - 86400000 * 4, hash: "" },
          ],
        }
      : walletLive.data?.pnl;

  useEffect(() => {
    setHeartPass(false);
    setHeartGate("locked");
  }, [session?.address]);

  useEffect(() => {
    if (section !== "heart" && section !== "buy" && section !== "stats") return;
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [section]);

  const verifyHeartPass = useCallback(async () => {
    const sess = useVaultStore.getState().session;
    if (!sess) {
      setOpen(true);
      return;
    }
    const held = (row?: { hearts?: number; heartsStaked?: number } | null) => {
      const fromSess = (sess.heartsWallet ?? 0) + (sess.heartsStaked ?? 0);
      const fromRow = row ? Number(row.hearts || 0) + Number(row.heartsStaked || 0) : 0;
      return Math.max(fromSess, fromRow);
    };
    if (sess.mode === "demo" || held(walletLive.data) > 0) {
      setHeartPass(true);
      setHeartGate("locked");
      return;
    }
    setHeartGate("checking");
    try {
      const fresh = await Promise.race([
        walletLive.refetch(),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), 2_000)),
      ]);
      if (held(fresh.data) > 0) {
        setHeartPass(true);
        setHeartGate("locked");
        return;
      }
      setHeartPass(false);
      setHeartGate("denied");
    } catch {
      if (held(walletLive.data) > 0) {
        setHeartPass(true);
        setHeartGate("locked");
      } else {
        setHeartPass(false);
        setHeartGate("denied");
      }
    }
  }, [walletLive]);

  const roarUsd = market.data?.roarPriceUsd || snapshot.data?.roarPriceUsd || 0.015;
  const egldUsd = market.data?.egldPriceUsd || snapshot.data?.egldPriceUsd || 4.15;
  const apr = aprPct(daily, roarUsd, egldUsd);
  const canSign = session?.mode === "xportal" && signerReady;
  const sessionLost = session?.mode === "xportal" && walletChecked && !signerReady;
  const inFlight = Boolean(
    buyingId !== null ||
      swapping ||
      staking ||
      farming ||
      swapStaking ||
      dusting ||
      delegating ||
      burnifying ||
      sending,
  );

  useEffect(() => {
    if (inFlight) {
      beginTxLane();
      return;
    }
    const hide = window.setTimeout(() => hideTxLane(), 900);
    return () => window.clearTimeout(hide);
  }, [inFlight]);
  useEffect(() => {
    livePaused = inFlight;
    return () => {
      livePaused = false;
    };
  }, [inFlight]);
  const farmPosition = walletLive.data?.farm ?? EMPTY_FARM;
  const lastGoodBoard = useRef(walletBoard.data);
  const collapseSince = useRef<number | null>(null);
  const [stableBoard, setStableBoard] = useState(walletBoard.data);
  useEffect(() => {
    const next = walletBoard.data;
    if (!next) return;
    setStableBoard((prev) => {
      if (!prev || prev.address !== next.address) {
        collapseSince.current = null;
        lastGoodBoard.current = next;
        return next;
      }
      const collapsed = prev.totalUsd > 25 && next.totalUsd < prev.totalUsd * 0.4;
      const thinner =
        (next.tokens?.length ?? 0) + (next.pools?.length ?? 0) <
        ((prev.tokens?.length ?? 0) + (prev.pools?.length ?? 0)) * 0.5;
      if (collapsed || (prev.totalUsd > 25 && thinner && next.totalUsd < prev.totalUsd * 0.7)) {
        if (collapseSince.current == null) collapseSince.current = Date.now();
        if (Date.now() - collapseSince.current > 40_000) {
          collapseSince.current = null;
          lastGoodBoard.current = next;
          return next;
        }
        return prev;
      }
      collapseSince.current = null;
      lastGoodBoard.current = next;
      return next;
    });
  }, [walletBoard.data]);
  const boardView =
    session?.mode === "demo"
      ? demoWalletBoard(session, roarUsd, egldUsd, market.data?.floorEgld || 1)
      : (stableBoard ?? walletBoard.data);

  const swapBalances = useMemo(() => {
    const next: Record<string, number> = {
      EGLD: session?.egldWallet ?? 0,
      [TOKEN.identifier]: session?.roarWallet ?? 0,
      [PAIRS.usdc]: walletLive.data?.usdc ?? 0,
      [PAIRS.mex]: walletLive.data?.mex ?? 0,
      [PAIRS.wegld]: walletLive.data?.wegld ?? 0,
    };
    for (const row of boardView?.tokens ?? []) next[row.id] = row.amount;
    return next;
  }, [
    session?.egldWallet,
    session?.roarWallet,
    walletLive.data?.usdc,
    walletLive.data?.mex,
    walletLive.data?.wegld,
    boardView?.tokens,
  ]);

  const dustTokens = useMemo(
    () =>
      session?.mode === "demo"
        ? collectDustFromBoard(boardView)
        : (dustPreview.data?.tokens ?? collectDustFromBoard(boardView)),
    [session?.mode, boardView, dustPreview.data?.tokens],
  );

  const spendableEgld =
    (session?.egldWallet ?? 0) + (session?.mode === "demo" ? 0 : (walletLive.data?.wegld ?? 0));

  const goSwap = useCallback((tokenId?: string) => {
    if (tokenId) setSwapFocus(tokenId);
    window.location.hash = "swap";
  }, []);

  const openConnect = useCallback(() => setOpen(true), []);
  const goHeart = useCallback(() => {
    window.location.hash = "heart";
  }, []);
  const goFarm = useCallback(() => {
    window.location.hash = "roar";
  }, []);

  async function handleBuy(listing: MarketListing, quantity: number) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needXportal);
      setOpen(true);
      return;
    }
    const total = listing.priceEgld * quantity;
    if (session && spendableEgld + 1e-12 < total) {
      toast.error(t.needEgld, {
        action: { label: t.navSwap, onClick: () => goSwap() },
      });
      return;
    }
    setBuyingId(listing.auctionId);
    setBuyingStake(false);
    const loading = toast.loading(t.buying);
    try {
      const prepared = await prepareBuyTx({
        data: {
          address: session!.address,
          auctionId: listing.auctionId,
          quantity,
          priceWei: listing.priceWei,
          listingAmount: listing.amount,
          priceEgld: listing.priceEgld,
        },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signBuy,
        steps: prepared.txs.map((tx) => stepLabel(tx.data, t)),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (const tx of signed) {
        const { txHash } = await broadcastTx({ data: { tx } });
        lastHash = txHash;
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.buyError);
      void refreshLive();
      await toastTxResult(
        done,
        loading,
        `${t.buySuccess} · ${formatNum(quantity, 0)} Heart · ${formatEgld(prepared.totalEgld, 2)}`,
        t,
      );
    } catch (err) {
      hideTxLane();
      toast.error(txError(err, t.buyError, t), { id: loading });
    } finally {
      setBuyingId(null);
      setBuyingStake(false);
    }
  }

  async function handleBuyStake(listing: MarketListing, quantity: number) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needXportal);
      setOpen(true);
      return;
    }
    const total = listing.priceEgld * quantity;
    if (session && spendableEgld + 1e-12 < total + CHAIN.buyStakeKeepEgld) {
      toast.error(t.needEgld, {
        action: { label: t.navSwap, onClick: () => goSwap() },
      });
      return;
    }
    setBuyingId(listing.auctionId);
    setBuyingStake(true);
    const loading = toast.loading(t.buyingStake);
    try {
      const prepared = await prepareBuyStakeTx({
        data: {
          address: session!.address,
          auctionId: listing.auctionId,
          quantity,
          priceWei: listing.priceWei,
          listingAmount: listing.amount,
          priceEgld: listing.priceEgld,
        },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signBuyStake,
        steps: prepared.txs.map((tx) => stepLabel(tx.data, t)),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      let buyHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        const fn = String(prepared.txs[i]?.data ?? "").split("@")[0] ?? "";
        if (fn === "buy") buyHash = txHash;
        if (i === signed.length - 1) break;
        toast.loading(t.waitingTx, { id: loading });
        const mid = await waitForTx(txHash);
        if (fn === "buy") {
          throwIfTxFailed(mid, t.buyError);
          toast.loading(t.waitingHeart, { id: loading });
          try {
            await waitForHearts(session!.address, quantity);
          } catch (err) {
            if (err instanceof Error && err.message === "HEART_NOT_ARRIVED") {
              hideTxLane();
              toast.success(t.buyOkStakeLater, {
                id: loading,
                action: buyHash ? explorerAction(buyHash, t.explorer) : undefined,
              });
              void refreshLive();
              return;
            }
            throw err;
          }
        } else {
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.buyError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.buyError);
      void refreshLive();
      await toastTxResult(
        done,
        loading,
        `${t.buyAndStakeSuccess} · ${formatNum(quantity, 0)} Heart · ${formatEgld(prepared.totalEgld, 2)}`,
        t,
      );
    } catch (err) {
      hideTxLane();
      toast.error(txError(err, t.buyError, t), { id: loading });
    } finally {
      setBuyingId(null);
      setBuyingStake(false);
    }
  }

  async function handleSwap(tokenId: string, direction: SwapDirection, amount: number) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needXportal);
      setOpen(true);
      return;
    }
    setSwapping(true);
    const loading = toast.loading(t.swapping);
    try {
      const prepared = await prepareSwapTx({
        data: { address: session!.address, tokenId, direction, amount, slippage },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signSwap,
        steps: prepared.txs.map((tx) => stepLabel(tx.data, t)),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (const tx of signed) {
        const { txHash } = await broadcastTx({ data: { tx } });
        lastHash = txHash;
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.swapError);
      const outTicker = direction === "to-roar" ? "ROAR" : prepared.ticker;
      const inTicker = direction === "to-roar" ? prepared.ticker : "ROAR";
      void refreshLive();
      await toastTxResult(
        done,
        loading,
        `${t.swapSuccess} · ${formatNum(prepared.amountIn, 4)} ${inTicker} → ${formatNum(prepared.amountOut, 4)} ${outTicker}`,
        t,
      );
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.swapError;
      toast.error(message, { id: loading });
    } finally {
      setSwapping(false);
    }
  }

  async function handleHeartFarm(kind: "stake" | "unstake" | "claim", quantity: number) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needSign);
      setOpen(true);
      return;
    }
    setStaking(kind);
    const loading = toast.loading(t.staking);
    const roarBefore = session?.roarWallet ?? 0;
    try {
      const address = session!.address;
      const prepared =
        kind === "stake"
          ? await prepareStakeTx({ data: { address, quantity } })
          : kind === "unstake"
            ? await prepareUnstakeTx({ data: { address, quantity } })
            : await prepareClaimTx({ data: { address } });
      const title =
        kind === "stake" ? t.signStake : kind === "unstake" ? t.signUnstake : t.signClaim;
      const step =
        kind === "stake" ? t.stakeStep : kind === "unstake" ? t.unstakeStep : t.claimStep;
      const signed = await signPreparedTx(prepared, { title, steps: [step] });
      toast.loading(t.broadcasting, { id: loading });
      const { txHash } = await broadcastTx({ data: { tx: signed } });
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(txHash);
      throwIfTxFailed(done, t.stakeError);
      const holdings = await getWalletHoldings({ data: { address } });
      refreshHoldings(holdings.hearts, holdings.roar, holdings.egld, {
        heartsStaked: holdings.heartsStaked,
        pendingRoar: holdings.pendingRoar,
        lastTick: holdings.lastTick,
        history: holdings.history,
      });
      void market.refetch();
      void snapshot.refetch();
      void walletLive.refetch();
      const ok =
        kind === "stake"
          ? `${t.stakeSuccess} · ${formatNum(quantity, 0)} Heart`
          : kind === "unstake"
            ? `${t.unstakeSuccess} · ${formatNum(quantity, 0)} Heart`
            : `${t.claimSuccess} · ${formatNum(Math.max(0, holdings.roar - roarBefore), 4)} ROAR`;
      await toastTxResult(done, loading, ok, t);
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.stakeError;
      toast.error(message, { id: loading });
    } finally {
      setStaking(null);
    }
  }

  async function handleHeartRestake() {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needSign);
      setOpen(true);
      return;
    }
    setStaking("restake");
    const loading = toast.loading(t.restaking);
    try {
      const prepared = await prepareHeartRestakeTx({ data: { address: session!.address } });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signRestake,
        steps: [t.claimStep, t.farmStepStake],
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        if (i < signed.length - 1) {
          const mid = await waitForTx(txHash);
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.restakeError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.restakeError);
      void refreshLive();
      void roarFarm.refetch();
      await toastTxResult(
        done,
        loading,
        `${t.restakeSuccess} · ${formatRoarClaim(prepared.amount)} ROAR`,
        t,
      );
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.restakeError;
      toast.error(message, { id: loading });
    } finally {
      setStaking(null);
    }
  }

  async function handleRoarFarm(kind: FarmAction, amount: number) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needSign);
      setOpen(true);
      return;
    }
    setFarming(kind);
    const loading = toast.loading(t.staking);
    const titles: Record<FarmAction, string> = {
      stake: t.signFarmStake,
      claim: t.signFarmClaim,
      compound: t.signFarmCompound,
      unstake: t.signFarmUnstake,
      unbond: t.signFarmUnbond,
    };
    const steps: Record<FarmAction, string> = {
      stake: t.farmStepStake,
      claim: t.farmStepClaim,
      compound: t.farmStepCompound,
      unstake: t.farmStepUnstake,
      unbond: t.farmStepUnbond,
    };
    try {
      const prepared = await prepareFarmTx({
        data: { address: session!.address, kind, amount },
      });
      const signed = await signPreparedTx(prepared, {
        title: titles[kind],
        steps: [steps[kind]],
      });
      toast.loading(t.broadcasting, { id: loading });
      const { txHash } = await broadcastTx({ data: { tx: signed } });
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(txHash);
      throwIfTxFailed(done, t.farmError);
      void refreshLive();
      void roarFarm.refetch();
      await toastTxResult(done, loading, t.farmSuccess, t);
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.farmError;
      toast.error(message, { id: loading });
    } finally {
      setFarming(null);
    }
  }

  async function handleSwapStake(amount: number) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needXportal);
      setOpen(true);
      return;
    }
    setSwapStaking(true);
    const loading = toast.loading(t.staking);
    try {
      const prepared = await prepareEgldStakeTx({
        data: { address: session!.address, amount, slippage },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signFarmSwapStake,
        steps: prepared.txs.map((tx) => stepLabel(tx.data, t)),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        if (i < signed.length - 1) {
          const mid = await waitForTx(txHash);
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.farmError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.farmError);
      void refreshLive();
      void roarFarm.refetch();
      await toastTxResult(
        done,
        loading,
        `${t.farmSwapStakeSuccess} · ${formatEgld(prepared.amountIn, 4)} → ${formatNum(prepared.minOut, 2)} ROAR`,
        t,
      );
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.farmError;
      toast.error(message, { id: loading });
    } finally {
      setSwapStaking(false);
    }
  }

  async function handleDustConvert(tokenIds: string[]) {
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needXportal);
      setOpen(true);
      return;
    }
    if (tokenIds.length === 0) {
      toast.error(t.dustNeedPick);
      return;
    }
    setDusting(true);
    const loading = toast.loading(t.swapping);
    try {
      const prepared = await prepareDustConvertTx({
        data: { address: session!.address, tokenIds, slippage },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signDust,
        steps: prepared.txs.map((tx) => stepLabel(tx.data, t)),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        if (i < signed.length - 1) {
          const mid = await waitForTx(txHash);
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.dustError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.dustError);
      void refreshLive();
      await toastTxResult(
        done,
        loading,
        `${t.dustSuccess} · ${formatNum(prepared.totalOut, 2)} ROAR`,
        t,
      );
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.dustError;
      toast.error(message, { id: loading });
    } finally {
      setDusting(false);
    }
  }

  async function handleDelegation(kind: DelegationAction, contract?: string, amount?: number) {
    if (session?.mode === "demo") {
      const ok =
        kind === "stake"
          ? t.walletStakeOk
          : kind === "unstake"
            ? t.walletUnstakeOk
            : kind === "withdraw"
              ? t.walletWithdrawOk
              : t.delegationSuccess;
      toast.success(
        amount && amount > 0 && (kind === "stake" || kind === "unstake")
          ? `${ok} · ${formatNum(amount, 4)} EGLD`
          : ok,
      );
      return;
    }
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needSign);
      setOpen(true);
      return;
    }
    setDelegating(kind);
    const loading = toast.loading(t.preparing);
    try {
      const prepared = await prepareDelegationTx({
        data: {
          address: session!.address,
          kind,
          contract: contract ?? "",
          amount: amount ?? 0,
        },
      });
      const title =
        kind === "claim"
          ? t.signDelegationClaim
          : kind === "restake"
            ? t.signDelegationRestake
            : kind === "stake"
              ? t.signDelegationStake
              : kind === "unstake"
                ? t.signDelegationUnstake
                : t.signDelegationWithdraw;
      toast.loading(t.staking, { id: loading });
      const signed = await signPreparedTxs(prepared.txs, {
        title,
        steps: prepared.txs.map((tx) => stepLabel(tx.data, t)),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        if (i < signed.length - 1) {
          const mid = await waitForTx(txHash);
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.delegationError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.delegationError);
      void refreshLive();
      await toastTxResult(
        done,
        loading,
        `${kind === "stake" ? t.walletStakeOk : kind === "unstake" ? t.walletUnstakeOk : kind === "withdraw" ? t.walletWithdrawOk : t.delegationSuccess}${prepared.amount ? ` · ${formatNum(prepared.amount, 4)} EGLD` : ""}`,
        t,
      );
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.delegationError;
      toast.error(message, { id: loading });
    } finally {
      setDelegating(null);
    }
  }

  async function handleSend(tokenId: string, to: string, amount: number): Promise<string | null> {
    if (session?.mode === "demo") {
      toast.success(`${t.walletSendOk} · ${formatNum(amount, 4)}`);
      return "demo";
    }
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needSign);
      setOpen(true);
      return null;
    }
    setSending(true);
    const loading = toast.loading(t.walletSend);
    try {
      const prepared = await prepareSendTx({
        data: { address: session!.address, tokenId, to, amount },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title: t.signSend,
        steps: prepared.txs.map((tx) => t.walletSend),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        if (i < signed.length - 1) {
          const mid = await waitForTx(txHash);
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.walletSendError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.walletSendError);
      void refreshLive();
      await toastTxResult(
        done,
        loading,
        `${t.walletSendOk} · ${formatNum(prepared.amount, 4)} ${prepared.ticker}`,
        t,
      );
      return done.status === "success" ? lastHash : null;
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.walletSendError;
      toast.error(message, { id: loading });
      return null;
    } finally {
      setSending(false);
    }
  }

  async function handleBurnify(kind: BurnifyAction, amount?: number) {
    const ok =
      kind === "stakeBfy"
        ? t.burnifyStakeOk
        : kind === "unstakeBfy"
          ? t.burnifyUnstakeOk
          : kind === "claimBfy" || kind === "claimAll"
            ? t.burnifyClaimOk
            : kind === "stakeBufu"
              ? t.burnifyBufuStakeOk
              : kind === "unstakeBufu"
                ? t.burnifyBufuUnstakeOk
                : t.burnifyBufuClaimOk;
    const title =
      kind === "stakeBfy"
        ? t.signBurnifyStake
        : kind === "unstakeBfy"
          ? t.signBurnifyUnstake
          : kind === "claimAll"
            ? t.signBurnifyClaimAll
            : kind === "claimBfy"
              ? t.signBurnifyClaim
              : kind === "stakeBufu"
                ? t.signBurnifyStakeBufu
                : kind === "unstakeBufu"
                  ? t.signBurnifyUnstakeBufu
                  : t.signBurnifyClaimBufu;
    if (session?.mode === "demo") {
      toast.success(ok);
      return;
    }
    if (!canSign) {
      toast.error(sessionLost ? t.sessionLost : t.needSign);
      setOpen(true);
      return;
    }
    setBurnifying(kind);
    const loading = toast.loading(t.staking);
    try {
      const prepared = await prepareBurnifyTx({
        data: { address: session!.address, kind, amount: amount ?? 0 },
      });
      const signed = await signPreparedTxs(prepared.txs, {
        title,
        steps: prepared.txs.map((tx) =>
          tx.data === "claimRewards"
            ? tx.receiver === BURNIFY.nftStaking
              ? t.signBurnifyClaimBufu
              : t.signBurnifyClaim
            : stepLabel(tx.data, t),
        ),
      });
      toast.loading(t.broadcasting, { id: loading });
      let lastHash = "";
      for (let i = 0; i < signed.length; i++) {
        const { txHash } = await broadcastTx({ data: { tx: signed[i] } });
        lastHash = txHash;
        if (i < signed.length - 1) {
          const mid = await waitForTx(txHash);
          throwIfTxUnconfirmed(mid, t.txPendingMid, t.burnifyError);
        }
      }
      toast.loading(t.waitingTx, { id: loading });
      const done = await waitForTx(lastHash);
      throwIfTxFailed(done, t.burnifyError);
      void refreshLive();
      const qty =
        prepared.ticker === "EGLD"
          ? `${formatNum(prepared.amount, 4)} EGLD`
          : `${formatNum(prepared.amount, prepared.ticker === "BUFU" ? 0 : 2)} ${prepared.ticker}`;
      await toastTxResult(done, loading, `${ok} · ${qty}`, t);
    } catch (err) {
      hideTxLane();
      const message = err instanceof Error ? err.message : t.burnifyError;
      toast.error(message, { id: loading });
    } finally {
      setBurnifying(null);
    }
  }

  const sendFn = useRef(handleSend);
  sendFn.current = handleSend;
  const sendRoar = useCallback((to: string, amount: number) => {
    return sendFn.current(TOKEN.identifier, to, amount);
  }, []);
  const onSwapDesk = useEvent(handleSwap);
  const onDustConvert = useEvent(handleDustConvert);
  const onWalletSend = useEvent(handleSend);
  const onDelegationAct = useEvent(handleDelegation);
  const onBurnifyAct = useEvent(handleBurnify);
  const onRoarFarmAct = useEvent(handleRoarFarm);
  const onSwapStakeAct = useEvent(handleSwapStake);
  const onHeartStake = useEvent((n: number) => handleHeartFarm("stake", n));
  const onHeartUnstake = useEvent((n: number) => handleHeartFarm("unstake", n));
  const onHeartClaim = useEvent(() => handleHeartFarm("claim", 0));
  const onHeartRestake = useEvent(handleHeartRestake);
  const onBuyAct = useEvent(handleBuy);
  const onBuyStakeAct = useEvent(handleBuyStake);
  const retryBoard = useCallback(() => {
    void walletBoard.refetch();
  }, [walletBoard.refetch]);

  async function refreshLive() {
    if (!session?.address || session.mode === "demo") return;
    const holdings = await getWalletHoldings({ data: { address: session.address } });
    refreshHoldings(holdings.hearts, holdings.roar, holdings.egld, {
      heartsStaked: holdings.heartsStaked,
      pendingRoar: holdings.pendingRoar,
      lastTick: holdings.lastTick,
      history: holdings.history,
    });
    void market.refetch();
    void snapshot.refetch();
    void walletLive.refetch();
    void walletBoard.refetch();
    void dustPreview.refetch();
  }

  const marketBoard = (
    pane: "buy" | "stats",
  ) => (
    <MarketBoard
      t={t}
      lang={lang}
      market={market.data}
      now={now}
      fetching={market.isFetching || snapshot.isFetching}
      updatedAt={market.dataUpdatedAt}
      canSign={canSign}
      sessionLost={sessionLost}
      buyingId={buyingId}
      buyingStake={buyingStake}
      egldWallet={spendableEgld}
      onBuy={onBuyAct}
      onBuyStake={onBuyStakeAct}
      onConnect={openConnect}
      onNeedSwap={goSwap}
      pane={pane}
    />
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-bg text-fg">
      <div className="sticky top-0 z-40 bg-bg pt-[env(safe-area-inset-top)]">
        <Header
          t={t}
          onConnect={openConnect}
          signerReady={signerReady}
          sessionLost={sessionLost}
          onSendRoar={sendRoar}
        />
        <SectionNav t={t} section={section} />
      </div>
      <main className="min-h-[calc(100dvh-9rem)]">
        {section === "heart" ? (
          heartPass && session ? (
            <section className="mx-auto max-w-xl px-4 py-10">
              <article className="relative overflow-hidden rounded-xl bg-surface p-6 shadow-[var(--shadow-border)] sm:p-10">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 dual-bar" />
                <HeartPnlCard
                  t={t}
                  lang={lang}
                  pnl={heartPnl}
                  heartsWallet={session.heartsWallet}
                  heartsStaked={session.heartsStaked}
                  pending={pending}
                  markEgld={market.data?.avgSaleEgld || market.data?.lastSaleEgld || 0}
                  egldUsd={egldUsd}
                  roarUsd={roarUsd}
                  dailyPerNft={daily}
                  farmHearts={ooxStaked}
                  egldStakeApr={market.data?.egldStakeApr || 7}
                  poolRoar={pool}
                />
                <StakeDesk
                  t={t}
                  session={session}
                  vaultStaked={prideVaultStaked}
                  pending={pending}
                  poolRoar={pool}
                  dailyPerNft={daily}
                  canSign={canSign}
                  sessionLost={sessionLost}
                  busy={staking}
                  onConnect={openConnect}
                  onStake={onHeartStake}
                  onUnstake={onHeartUnstake}
                  onClaim={onHeartClaim}
                  onRestake={onHeartRestake}
                />
              </article>
            </section>
          ) : (
            <HeartGate
              t={t}
              status={heartGate}
              connected={Boolean(session)}
              onVerify={() => void verifyHeartPass()}
              onConnect={openConnect}
            />
          )
        ) : null}

        {section === "buy" ? marketBoard("buy") : null}

        {section === "wallet" ? (
          <WalletBoardView
            t={t}
            session={session}
            board={boardView}
            fetching={walletBoard.isFetching}
            loading={!boardView && walletBoard.isFetching}
            error={walletBoard.isError && !boardView}
            onRetry={retryBoard}
            onConnect={openConnect}
            onSwap={goSwap}
            onSend={onWalletSend}
            onHeart={goHeart}
            onFarm={goFarm}
            canSign={canSign}
            busy={delegating ?? burnifying}
            onDelegation={onDelegationAct}
            onBurnify={onBurnifyAct}
            egldUsd={egldUsd}
          />
        ) : null}

        {section === "swap" ? (
          <SwapDesk
            t={t}
            canSign={canSign}
            sessionLost={sessionLost}
            balances={swapBalances}
            roarUsd={roarUsd}
            busy={swapping}
            dustBusy={dusting}
            dustLoading={session?.mode !== "demo" && dustPreview.isPending && !dustPreview.data}
            dustTokens={dustTokens}
            focusToken={swapFocus}
            onSwap={onSwapDesk}
            onDust={onDustConvert}
            onConnect={openConnect}
          />
        ) : null}

        {section === "roar" ? (
          <RoarFarm
            t={t}
            farm={roarFarm.data}
            position={farmPosition}
            roarWallet={session?.roarWallet ?? 0}
            egldWallet={session?.egldWallet ?? 0}
            canSign={canSign}
            sessionLost={sessionLost}
            busy={farming}
            swapStakeBusy={swapStaking}
            onFarm={onRoarFarmAct}
            onSwapStake={onSwapStakeAct}
            onConnect={openConnect}
          />
        ) : null}

        {section === "board" ? (
          <RoarBoardView
            t={t}
            board={roarBoard.data}
            loading={roarBoard.isPending && !roarBoard.data}
            address={session?.address}
          />
        ) : null}

        {section === "stats" ? (
          <div id="stats" className="scroll-mt-32">
            <RoarChart
              t={t}
              roarUsd={roarUsd}
              change24h={market.data?.roarChange24h ?? 0}
            />
            {marketBoard("stats")}
            <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 lg:grid-cols-3">
              <BoostPanel t={t} staked={prideVaultStaked} daily={daily} />
              <TokenomicsPanel t={t} />
              <PridePanel
                t={t}
                holders={snapshot.data?.holders ?? []}
                heartUsd={market.data?.floorUsd || (market.data?.floorEgld || 1) * egldUsd}
              />
            </div>
          </div>
        ) : null}
      </main>
      <Footer t={t} />
      <ConnectDialog open={open} onOpenChange={setOpen} t={t} />
      <SignSheet t={t} />
      <TxLaneHost t={t} />
    </div>
  );
}
