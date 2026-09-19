import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Minus, Plus, Repeat2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LionRun } from "@/components/lion-run";
import { explorerTxUrl, LINKS } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import type { HistoryKind, Session } from "@/lib/store";
import { useVaultStore } from "@/lib/store";
import { cn, fillAmt, formatNum, formatRoarClaim } from "@/lib/utils";

export function StakeDesk({
  t,
  session,
  vaultStaked,
  pending,
  poolRoar,
  dailyPerNft,
  canSign,
  sessionLost,
  busy,
  onConnect,
  onStake,
  onUnstake,
  onClaim,
  onRestake,
}: {
  t: Copy;
  session: Session | null;
  vaultStaked: number;
  pending: number;
  poolRoar: number;
  dailyPerNft: number;
  canSign: boolean;
  sessionLost: boolean;
  busy: "stake" | "unstake" | "claim" | "restake" | null;
  onConnect: () => void;
  onStake: (n: number) => void;
  onUnstake: (n: number) => void;
  onClaim: () => void;
  onRestake: () => void;
}) {
  const stakeLocal = useVaultStore((s) => s.stake);
  const unstakeLocal = useVaultStore((s) => s.unstake);
  const claimLocal = useVaultStore((s) => s.claim);
  const [amount, setAmount] = useState(1);

  if (!session) {
    return (
      <div className="mt-8 border-t border-border pt-6">
        <p className="text-sm leading-relaxed text-muted">{t.deskLead}</p>
        <Button className="mt-6 h-12 w-full" size="lg" onClick={onConnect}>
          {t.connectXportal}
        </Button>
      </div>
    );
  }

  const onChain = session.mode !== "demo";
  const maxStake = session.heartsWallet;
  const maxUnstake = session.heartsStaked;
  const empty = session.heartsWallet + session.heartsStaked === 0 && pending <= 0;
  const signing = Boolean(busy);
  const canAct = session.mode === "demo" || canSign;

  function clampAmount(n: number, max: number) {
    if (max <= 0) return 1;
    return Math.min(max, Math.max(1, n));
  }

  function needSigner() {
    toast.error(sessionLost ? t.sessionLost : t.needSign);
    onConnect();
  }

  function handleStake() {
    const n = clampAmount(amount, maxStake);
    if (onChain) {
      if (!canAct) return needSigner();
      onStake(n);
      return;
    }
    if (stakeLocal(n, vaultStaked)) toast.success(t.toastStake);
    else toast.error(t.toastNoHearts);
  }

  function handleUnstake() {
    const n = clampAmount(amount, maxUnstake);
    if (onChain) {
      if (!canAct) return needSigner();
      onUnstake(n);
      return;
    }
    if (unstakeLocal(n, vaultStaked)) toast.success(t.toastUnstake);
    else toast.error(t.toastNoHearts);
  }

  function handleClaim() {
    if (onChain) {
      if (!canAct) return needSigner();
      onClaim();
      return;
    }
    const got = claimLocal(vaultStaked);
    if (got > 0) toast.success(`${t.toastClaim} ${formatNum(got, 4)} ROAR`);
    else toast.error(t.toastNone);
  }

  function handleRestake() {
    if (onChain) {
      if (!canAct) return needSigner();
      onRestake();
      return;
    }
    toast.error(t.restakeDemo);
    onConnect();
  }

  return (
    <div id="heart" className="mt-8 scroll-mt-32 border-t border-border pt-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.deskFarm}</p>
          <h3 className="mt-1 font-display text-xl font-medium">{t.deskTitle}</h3>
        </div>
        <a
          href={LINKS.explorerStaking}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t.seeFarm}
        </a>
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-border border-y border-border">
        <Metric label={t.inWallet} value={formatNum(session.heartsWallet, 0)} />
        <Metric label={t.onFarm} value={formatNum(session.heartsStaked, 0)} accent />
        <Metric
          label={t.claimable}
          value={formatRoarClaim(pending)}
          hint={onChain ? t.estimated : undefined}
        />
      </div>

      {empty ? (
        <div className="mt-6">
          <p className="font-medium">{t.emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">{t.emptyLead}</p>
          <Button className="mt-4 w-full" asChild>
            <a href="#buy">{t.deskEmptyCta}</a>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">{t.amount}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={() => setAmount((n) => clampAmount(n - 1, Math.max(maxStake, maxUnstake, 1)))}
                disabled={signing}
                aria-label={t.qtyMinus}
              >
                <Minus />
              </Button>
              <span className="tabular w-10 text-center font-display text-2xl leading-none">{amount}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                onClick={() => setAmount((n) => clampAmount(n + 1, Math.max(maxStake, maxUnstake, 1)))}
                disabled={signing}
                aria-label={t.qtyPlus}
              >
                <Plus />
              </Button>
            </div>
          </div>

          <Button
            className="h-12 w-full"
            size="lg"
            onClick={handleStake}
            disabled={maxStake <= 0 || signing}
          >
            {busy === "stake" ? <LionRun size="sm" label={t.txRun} /> : <ArrowDownToLine />}
            {t.stake} {amount}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              className="h-12"
              onClick={handleUnstake}
              disabled={maxUnstake <= 0 || signing}
            >
              {busy === "unstake" ? <LionRun size="sm" label={t.txRun} /> : <ArrowUpFromLine />}
              {t.unstake}
            </Button>
            <Button
              variant="volt"
              className="h-12"
              onClick={handleClaim}
              disabled={pending <= 0 || signing}
            >
              {busy === "claim" ? <LionRun size="sm" label={t.txRun} /> : <Wallet />}
              {fillAmt(t.claimRoar, formatRoarClaim(pending))}
            </Button>
          </div>
          {pending > 0 ? (
            <Button
              variant="ghost"
              className="h-11 w-full"
              onClick={handleRestake}
              disabled={signing}
            >
              {busy === "restake" ? <LionRun size="sm" label={t.txRun} /> : <Repeat2 />}
              {t.restake} {formatRoarClaim(pending)} ROAR
            </Button>
          ) : null}
        </div>
      )}

      {!canAct && session.mode !== "demo" ? (
        <Button className="mt-5 w-full" variant="outline" onClick={onConnect}>
          {sessionLost ? t.reconnectXportal : t.connectXportal}
        </Button>
      ) : null}

      <History t={t} items={session.history} />
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="px-3 py-4 first:pl-0 last:pr-0">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={cn("mt-2 font-display text-xl tabular leading-none", accent && "text-ember")}>{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function History({ t, items }: { t: Copy; items: Session["history"] }) {
  const label: Record<HistoryKind, string> = {
    stake: t.stake,
    unstake: t.unstake,
    claim: t.claim,
  };
  return (
    <div className="mt-8 border-t border-border pt-6">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.history}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.noHistory}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {items.map((item) => {
            const href = /^[a-fA-F0-9]{64}$/.test(item.id) ? explorerTxUrl(item.id) : null;
            const inner = (
              <>
                <span className="text-muted">{label[item.kind]}</span>
                <span className="tabular">
                  {item.kind === "claim"
                    ? item.amount > 0
                      ? `${formatNum(item.amount, 4)} ROAR`
                      : "ROAR"
                    : `${formatNum(item.amount, 0)} HOR`}
                </span>
              </>
            );
            return (
              <li key={item.id}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between text-sm hover:text-ember"
                  >
                    {inner}
                  </a>
                ) : (
                  <div className="flex items-center justify-between text-sm">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
