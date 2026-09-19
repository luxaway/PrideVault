import { memo, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LionRun } from "@/components/lion-run";
import { SlippageToggle } from "@/components/swap-desk";
import { LINKS, swapEgldKeep } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { getSwapPool, type FarmAction, type FarmPosition, type RoarFarmSnapshot } from "@/lib/mx.functions";
import { quoteFromPool } from "@/lib/swap-math";
import { useVaultStore } from "@/lib/store";
import { cn, fillAmt, formatEgld, formatNum, formatRoarClaim, formatUsd } from "@/lib/utils";

export const RoarFarm = memo(function RoarFarm({
  t,
  farm,
  position,
  roarWallet,
  egldWallet = 0,
  canSign,
  sessionLost,
  busy,
  swapStakeBusy = false,
  onFarm,
  onSwapStake,
  onConnect,
}: {
  t: Copy;
  farm: RoarFarmSnapshot | undefined;
  position: FarmPosition;
  roarWallet: number;
  egldWallet?: number;
  canSign: boolean;
  sessionLost: boolean;
  busy: FarmAction | null;
  swapStakeBusy?: boolean;
  onFarm: (kind: FarmAction, amount: number) => void;
  onSwapStake?: (amount: number) => void;
  onConnect: () => void;
}) {
  const [raw, setRaw] = useState("100");
  const [egldRaw, setEgldRaw] = useState("1");
  const amount = Number(raw);
  const valid = Number.isFinite(amount) && amount > 0;
  const enough = valid && amount <= roarWallet + 1e-12;
  const signing = Boolean(busy) || swapStakeBusy;
  const staked = position.staked;
  const pending = position.pending;
  const unlocking = position.unlocking;
  const unlockingSlots = position.slots.filter((s) => s.kind === "unbonding");
  const epoch = farm?.epoch ?? 0;
  const unlockingSlot = unlockingSlots.find((s) => s.unlockEpoch > 0 && s.unlockEpoch <= epoch);
  const nextUnlock = unlockingSlots
    .filter((s) => s.unlockEpoch > epoch)
    .sort((a, b) => a.unlockEpoch - b.unlockEpoch)[0];
  const epochsLeft = unlockingSlot
    ? 0
    : nextUnlock
      ? Math.max(0, nextUnlock.unlockEpoch - epoch)
      : 0;
  const unbondReady = Boolean(unlockingSlot);

  const egldAmt = Number(egldRaw);
  const egldValid = Number.isFinite(egldAmt) && egldAmt > 0;
  const egldMax = Math.max(0, egldWallet - swapEgldKeep());
  const egldEnough = egldValid && egldAmt <= egldMax + 1e-12;
  const slippage = useVaultStore((s) => s.slippage);
  const egldPool = useQuery({
    queryKey: ["swap-pool", "EGLD"],
    queryFn: () => getSwapPool({ data: { tokenId: "EGLD" } }),
    staleTime: 2_000,
    refetchInterval: signing ? false : 4_000,
    placeholderData: keepPreviousData,
  });
  const q = useMemo(() => {
    if (!egldValid || !egldPool.data) return undefined;
    return quoteFromPool(egldPool.data, "to-roar", egldAmt, slippage) ?? undefined;
  }, [egldPool.data, egldValid, egldAmt, slippage]);

  const cta = signing
    ? t.staking
    : sessionLost
      ? t.reconnectXportal
      : canSign
        ? t.farmStake
        : t.connectXportal;

  return (
    <section id="roar" className="scroll-mt-32 mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-medium md:text-3xl">{t.farmTitle}</h2>
            <Badge variant="volt">{t.farmLive}</Badge>
            {farm ? (
              <Badge variant={farm.state === "active" ? "default" : "mute"}>
                {farm.state === "active" ? t.farmActive : t.farmPaused}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{t.farmLead}</p>
        </div>
        <a
          href={LINKS.xFarm}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center text-xs text-muted transition-colors duration-150 hover:text-fg"
        >
          {t.openFarm}
        </a>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-surface p-2 shadow-[var(--shadow-border)] sm:grid-cols-3 lg:grid-cols-6">
        <Stat label={t.farmTvl} value={farm ? formatUsd(farm.tvlUsd, 0) : "—"} hint="ROAR" />
        <Stat
          label={t.farmStaked}
          value={farm ? formatNum(farm.staked, 0) : "—"}
          hint={t.farmSroar}
        />
        <Stat
          label={t.farmRewards}
          value={farm ? formatNum(farm.rewards, 0) : "—"}
          hint="ROAR"
        />
        <Stat
          label={t.farmApr}
          value={farm ? `${formatNum(farm.aprPct, 2)}%` : "—"}
          hint={t.onchain}
          accent
        />
        <Stat
          label={t.farmStakers}
          value={farm ? formatNum(farm.stakers, 0) : "—"}
          hint={t.statsHolders}
        />
        <Stat
          label={t.farmUnbond}
          value={farm ? `${farm.unbondEpochs} ${t.statsDaysShort}` : t.farmUnbondDays}
          hint={farm ? `${t.farmEpoch} ${farm.epoch}` : t.onchain}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <div className="grid grid-cols-3 gap-2">
            <Metric label={t.farmWallet} value={formatNum(roarWallet, 2)} />
            <Metric label={t.farmYourStake} value={formatNum(staked, 2)} accent />
            <Metric label={t.farmPending} value={formatNum(pending, 3)} />
          </div>

          {unlocking > 0 ? (
            <div className="mt-4 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-3 text-sm shadow-[var(--shadow-border)]">
              <span className="text-muted">{t.farmUnlocking}</span>
              <span className="tabular font-medium">
                {formatNum(unlocking, 2)} ROAR
                <span className="ml-2 text-xs text-muted">
                  {unbondReady ? t.farmReady : `${t.farmUnlockIn} ${epochsLeft} ${t.statsDaysShort}`}
                </span>
              </span>
            </div>
          ) : null}

          <div className="mt-5 rounded-lg bg-surface-2 p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
              <span>{t.farmAmount}</span>
              <span className="tabular">
                {formatNum(roarWallet, 2)} ROAR
              </span>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <Input
                inputMode="decimal"
                value={raw}
                onChange={(e) => setRaw(e.target.value.replace(",", "."))}
                className="block h-12 min-w-0 w-0 flex-1 bg-transparent text-2xl leading-none tabular whitespace-nowrap shadow-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setRaw(trimAmt(roarWallet, 2))}
              >
                {t.farmMax}
              </Button>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-bg px-2.5 py-1 text-xs font-medium shadow-[var(--shadow-border)]">
                <img src="/nfts/roar-token.png" alt="" className="size-5 rounded-full object-cover" />
                ROAR
              </span>
            </div>
          </div>

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={signing || (canSign && (!valid || !enough))}
            onClick={() => {
              if (!canSign) {
                onConnect();
                return;
              }
              if (!valid || !enough) return;
              onFarm("stake", amount);
            }}
          >
            {busy === "stake" ? <LionRun size="sm" label={t.txRun} /> : null}
            {cta}
          </Button>
          {!enough && valid && canSign ? (
            <p className="mt-3 text-sm text-ember">{t.farmNeedRoar}</p>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12"
              disabled={signing || staked <= 0}
              onClick={() => {
                if (!canSign) {
                  onConnect();
                  return;
                }
                onFarm("unstake", staked);
              }}
            >
              {busy === "unstake" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.unstake}
            </Button>
            <Button
              variant="volt"
              className="h-12"
              disabled={signing || pending <= 0}
              onClick={() => {
                if (!canSign) {
                  onConnect();
                  return;
                }
                onFarm("claim", 0);
              }}
            >
              {busy === "claim" ? <LionRun size="sm" label={t.txRun} /> : null}
              {fillAmt(t.farmClaim, formatRoarClaim(pending))}
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="h-12"
              disabled={signing || staked <= 0}
              onClick={() => {
                if (!canSign) {
                  onConnect();
                  return;
                }
                onFarm("compound", 0);
              }}
            >
              {busy === "compound" ? <LionRun size="sm" label={t.txRun} /> : null}
              {fillAmt(t.farmCompound, formatRoarClaim(pending))}
            </Button>
            <Button
              variant="ghost"
              className="h-12"
              disabled={signing || !unbondReady}
              onClick={() => {
                if (!canSign) {
                  onConnect();
                  return;
                }
                onFarm("unbond", 0);
              }}
            >
              {busy === "unbond" ? <LionRun size="sm" label={t.txRun} /> : null}
              {t.farmUnbondAction}
            </Button>
          </div>
        </article>

        <article className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h3 className="font-display text-xl font-medium">{t.farmSroar}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{t.farmNote}</p>
          {staked <= 0 && unlocking <= 0 ? (
            <p className="mt-6 text-sm text-muted">{t.farmEmpty}</p>
          ) : (
            <ul className="mt-5 grid gap-2">
              {position.slots.map((slot) => (
                <li
                  key={`${slot.kind}-${slot.nonce}`}
                  className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-sm shadow-[var(--shadow-border)]"
                >
                  <span className="text-muted">
                    {slot.kind === "unbonding" ? t.farmUnlocking : t.farmYourStake}
                    <span className="ml-2 font-mono text-[11px]">#{slot.nonce}</span>
                  </span>
                  <span className="tabular font-medium">{formatNum(slot.amount, 2)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-[11px] text-muted">
            <a
              href={LINKS.explorerFarm}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:text-fg hover:underline"
            >
              {t.explorer}
            </a>
            {" · "}
            SROAR-b33f8a
          </p>
        </article>
      </div>

      <article className="mt-4 overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <div className="dual-bar h-0.5 w-full" />
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-medium">{t.farmSwapStake}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{t.farmSwapStakeLead}</p>
            </div>
            <p className="text-[11px] text-muted">
              {t.farmEgldWallet} {formatEgld(egldWallet, 4)}
            </p>
          </div>
          <div className="mt-5 rounded-lg bg-surface-2 p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
              <span>EGLD</span>
              <span className="tabular">{formatEgld(egldWallet, 4)}</span>
            </div>
            <div className="mt-2 flex min-w-0 items-center gap-3">
              <Input
                inputMode="decimal"
                value={egldRaw}
                onChange={(e) => setEgldRaw(e.target.value.replace(",", "."))}
                className="block h-12 min-w-0 w-0 flex-1 bg-transparent text-2xl leading-none tabular whitespace-nowrap shadow-none"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => setEgldRaw(trimAmt(egldMax, 4))}
              >
                {t.farmMax}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted">
              {q && egldValid
                ? `${formatNum(q.amountOut, 2)} ROAR · ${t.swapMinOut} ${formatNum(q.minOut, 2)}`
                : egldPool.isFetching
                  ? "…"
                  : "—"}
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-muted">{t.swapSlippage}</span>
              <SlippageToggle t={t} />
            </div>
          </div>
          {egldPool.isError ? (
            <p className="mt-3 text-sm text-ember">
              {egldPool.error instanceof Error ? egldPool.error.message : t.swapError}
            </p>
          ) : null}
          <Button
            size="lg"
            variant="volt"
            className="mt-5 w-full"
            disabled={
              signing ||
              (canSign && (!egldValid || !egldEnough || !q || egldPool.isError || !onSwapStake))
            }
            onClick={() => {
              if (!canSign) {
                onConnect();
                return;
              }
              if (!egldValid || !egldEnough) return;
              onSwapStake?.(egldAmt);
            }}
          >
            {swapStakeBusy ? <LionRun size="sm" label={t.txRun} /> : null}
            {swapStakeBusy ? t.staking : canSign ? t.farmSwapStakeCta : t.connectXportal}
          </Button>
          {!egldEnough && egldValid && canSign ? (
            <p className="mt-3 text-sm text-ember">{t.farmSwapStakeNeed}</p>
          ) : null}
          <p className="mt-3 text-[11px] text-muted">{t.swapSlippageHint}</p>
        </div>
      </article>
    </section>
  );
});

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

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-xl tabular", accent && "text-ember")}>{value}</p>
    </div>
  );
}

function trimAmt(n: number, digits: number) {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const f = n.toFixed(digits);
  return f.replace(/\.?0+$/, "") || "0";
}
