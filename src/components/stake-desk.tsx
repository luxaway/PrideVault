import { useState, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Minus, Plus, Repeat2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LionRun } from "@/components/lion-run";
import { COLLECTION, explorerTxUrl, LINKS } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import type { HistoryKind, Session } from "@/lib/store";
import { useVaultStore } from "@/lib/store";
import { cn, fillAmt, formatNum, formatRoarClaim } from "@/lib/utils";
import { dailyFromPool } from "@/lib/vault";

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
      <section id="heart" className="scroll-mt-32 mx-auto max-w-xl px-4 py-6">
        <DeskShell t={t}>
          <Button className="mt-6 h-12 w-full" size="lg" onClick={onConnect}>
            {t.connectXportal}
          </Button>
          <p className="mt-3 text-center text-sm leading-relaxed text-muted">{t.deskLead}</p>
          <p className="mt-2 text-center text-xs text-muted">{t.needSign}</p>
        </DeskShell>
      </section>
    );
  }

  const onChain = session.mode !== "demo";
  const maxStake = session.heartsWallet;
  const maxUnstake = session.heartsStaked;
  const perHeart = dailyPerNft > 0 ? dailyPerNft : dailyFromPool(poolRoar, vaultStaked);
  const dailyYou = session.heartsStaked * perHeart;
  const share = vaultStaked > 0 ? session.heartsStaked / vaultStaked : 0;
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
    <section id="heart" className="scroll-mt-32 mx-auto max-w-xl px-4 py-6">
      <DeskShell t={t}>
        <p className="mt-2 text-sm leading-relaxed text-muted">{t.deskLead}</p>
        <p className="mt-1 text-xs text-muted">
          {session.mode === "demo" ? t.demoNote : session.mode === "xportal" ? t.xportalNote : t.liveNote}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <Metric label={t.inWallet} value={formatNum(session.heartsWallet, 0)} />
          <Metric label={t.onFarm} value={formatNum(session.heartsStaked, 0)} accent />
          <Metric
            label={t.claimable}
            value={formatRoarClaim(pending)}
            hint={onChain ? t.estimated : undefined}
          />
        </div>

        {empty ? (
          <div className="mt-6 rounded-lg bg-surface-2 p-4">
            <p className="font-medium">{t.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted">{t.emptyLead}</p>
            <Button className="mt-4 w-full" asChild>
              <a href="#buy">{t.deskEmptyCta}</a>
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <span className="text-sm text-muted">{t.amount}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  onClick={() => setAmount((n) => clampAmount(n - 1, Math.max(maxStake, maxUnstake, 1)))}
                  disabled={signing}
                  aria-label={t.qtyMinus}
                >
                  <Minus />
                </Button>
                <span className="tabular w-10 text-center text-lg font-medium">{amount}</span>
                <Button
                  variant="outline"
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
            <Button
              className="h-12 w-full"
              size="lg"
              onClick={handleRestake}
              disabled={pending <= 0 || signing}
            >
              {busy === "restake" ? <LionRun size="sm" label={t.txRun} /> : <Repeat2 />}
              {pending > 0
                ? `${t.restake} ${formatRoarClaim(pending)} ROAR`
                : t.restake}
            </Button>
            <p className="text-center text-xs text-muted">{t.restakeLead}</p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmount(Math.max(1, maxStake))}
                disabled={maxStake <= 0 || signing}
              >
                {t.max} {t.stake.toLowerCase()}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAmount(Math.max(1, maxUnstake))}
                disabled={maxUnstake <= 0 || signing}
              >
                {t.max} {t.unstake.toLowerCase()}
              </Button>
            </div>
          </div>
        )}

        <dl className="mt-6 grid gap-2 text-sm">
          <Row label={t.yourShare} value={`${formatNum(share * 100, 1)}%`} />
          <Row label={t.dailyYou} value={`${formatNum(dailyYou, 5)} ROAR`} />
          <Row label={t.projected} value={`${formatNum(dailyYou * 30, 2)} ROAR`} />
        </dl>

        {!canAct && session.mode !== "demo" ? (
          <Button className="mt-5 w-full" variant="outline" onClick={onConnect}>
            {sessionLost ? t.reconnectXportal : t.connectXportal}
          </Button>
        ) : null}

        <History t={t} items={session.history} />
      </DeskShell>
    </section>
  );
}

function DeskShell({ t, children }: { t: Copy; children: ReactNode }) {
  return (
    <article className="relative overflow-hidden rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 dual-bar" />
      <div className="flex items-center gap-4">
        <img
          src="/heart-of-roar.jpg"
          alt="Heart of ROAR"
          className="size-16 rounded-lg object-cover sm:size-20"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-medium">{t.deskTitle}</h2>
            <Badge variant="volt">{t.deskFarm}</Badge>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted">
            {COLLECTION.sftId} · farm 0x41
          </p>
        </div>
      </div>
      {children}
      <p className="mt-5 text-center text-xs">
        <a
          href={LINKS.explorerStaking}
          target="_blank"
          rel="noreferrer"
          className="text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          {t.seeFarm}
        </a>
      </p>
    </article>
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
    <div className="rounded-lg bg-surface-2 px-2 py-3 text-center">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-lg tabular leading-none sm:text-xl", accent && "text-ember")}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
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

function History({ t, items }: { t: Copy; items: Session["history"] }) {
  const label: Record<HistoryKind, string> = {
    stake: t.stake,
    unstake: t.unstake,
    claim: t.claim,
  };
  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-xs uppercase tracking-widest text-muted">{t.history}</p>
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
