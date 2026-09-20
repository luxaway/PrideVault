import { useEffect, useRef, useState } from "react";
import { Dices, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LionRun } from "@/components/lion-run";
import { GAMES } from "@/lib/config";
import {
  clampUnder,
  diceCap,
  diceChance,
  diceMin,
  diceMultiplier,
  diceNet,
  dicePayout,
  diceRake,
  diceRoll,
  freshSeed,
  type DiceToken,
} from "@/lib/dice";
import type { Copy } from "@/lib/i18n";
import type { Session } from "@/lib/store";
import { useVaultStore } from "@/lib/store";
import { cn, formatEgld, formatNum, formatRoarClaim } from "@/lib/utils";

type TableSnap = {
  live: boolean;
  paused: boolean;
  roundOpen: boolean;
  minEgld: number;
  capEgld: number;
  maxEgld: number;
  minRoar: number;
  capRoar: number;
  maxRoar: number;
  freeEgld: number;
  freeRoar: number;
  rakeEgld: number;
  rakeRoar: number;
  claimEgld: number;
  claimRoar: number;
  sc?: string;
};

type DemoRow = {
  id: string;
  token: DiceToken;
  amount: number;
  under: number;
  roll: number;
  won: boolean;
  payout: number;
  rake: number;
  at: number;
};

const DEMO_KEY = "pv.dice.table";

type DemoTable = {
  bankEgld: number;
  bankRoar: number;
  treasuryEgld: number;
  treasuryRoar: number;
  claimEgld: number;
  claimRoar: number;
  history: DemoRow[];
};

function emptyDemo(): DemoTable {
  return {
    bankEgld: GAMES.seedEgld,
    bankRoar: GAMES.seedRoar,
    treasuryEgld: 0,
    treasuryRoar: 0,
    claimEgld: 0,
    claimRoar: 0,
    history: [],
  };
}

function loadDemo(): DemoTable {
  try {
    const raw = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
    if (!raw || typeof raw !== "object") return emptyDemo();
    return { ...emptyDemo(), ...raw, history: Array.isArray(raw.history) ? raw.history.slice(0, 12) : [] };
  } catch {
    return emptyDemo();
  }
}

function saveDemo(row: DemoTable) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(row));
}

export function DiceDesk({
  t,
  session,
  table,
  canSign,
  sessionLost,
  busy,
  onConnect,
  onBet,
  onClaim,
  onResolve,
  onStart,
  onOpen,
}: {
  t: Copy;
  session: Session | null;
  table: TableSnap | null;
  canSign: boolean;
  sessionLost: boolean;
  busy: "bet" | "claim" | "resolve" | "open" | "start" | null;
  onConnect: () => void;
  onBet: (token: DiceToken, amount: number, under: number) => void;
  onClaim: () => void;
  onResolve: () => void;
  onStart: () => void;
  onOpen: (seedEgld: number, seedRoar: number) => void;
}) {
  const refreshHoldings = useVaultStore((s) => s.refreshHoldings);
  const [token, setToken] = useState<DiceToken>("EGLD");
  const [under, setUnder] = useState(50);
  const [amount, setAmount] = useState<number>(GAMES.minBetEgld);
  const [demo, setDemo] = useState<DemoTable>(emptyDemo);
  const [rolling, setRolling] = useState<number | null>(null);
  const [last, setLast] = useState<DemoRow | null>(null);
  const [seedEgld, setSeedEgld] = useState(2);
  const [seedRoar, setSeedRoar] = useState(200);
  const anim = useRef(0);

  useEffect(() => {
    setDemo(loadDemo());
  }, []);

  const live = Boolean(table?.live);
  const min = live ? (token === "ROAR" ? table!.minRoar : table!.minEgld) : diceMin(token);
  const cap = live
    ? token === "ROAR"
      ? Math.min(table!.maxRoar, table!.capRoar)
      : Math.min(table!.maxEgld, table!.capEgld)
    : diceCap(token);
  const net = diceNet(amount, token);
  const payout = dicePayout(net, under);
  const rake = diceRake(amount, token);
  const chance = diceChance(under);
  const multi = diceMultiplier(under);
  const wallet = token === "ROAR" ? session?.roarWallet ?? 0 : session?.egldWallet ?? 0;
  const claimEgld = live ? table?.claimEgld ?? 0 : demo.claimEgld;
  const claimRoar = live ? table?.claimRoar ?? 0 : demo.claimRoar;
  const bankEgld = live ? table?.freeEgld ?? 0 : demo.bankEgld;
  const bankRoar = live ? table?.freeRoar ?? 0 : demo.bankRoar;
  const treEgld = live ? table?.rakeEgld ?? 0 : demo.treasuryEgld;
  const treRoar = live ? table?.rakeRoar ?? 0 : demo.treasuryRoar;

  useEffect(() => {
    setAmount(min);
  }, [token, min]);

  const display = rolling !== null ? rolling : last ? last.roll : null;

  const playDemo = () => {
    if (!session) {
      onConnect();
      return;
    }
    if (amount < min || amount > cap) {
      toast.error(t.diceNeedFunds);
      return;
    }
    if (amount > wallet) {
      toast.error(t.diceNeedFunds);
      return;
    }
    const seed = Number(freshSeed() % 100_000_003n);
    const start = performance.now();
    cancelAnimationFrame(anim.current);
    const tick = (now: number) => {
      const elapsed = now - start;
      setRolling(Math.floor(Math.random() * 100));
      if (elapsed < 900) {
        anim.current = requestAnimationFrame(tick);
        return;
      }
      const roll = diceRoll(seed, 1);
      const won = roll < under;
      const pay = won ? payout : 0;
      const row: DemoRow = {
        id: `${Date.now()}`,
        token,
        amount,
        under,
        roll,
        won,
        payout: pay,
        rake,
        at: Date.now(),
      };
      setRolling(null);
      setLast(row);
      setDemo((prev) => {
        const next: DemoTable = {
          bankEgld: token === "EGLD" ? prev.bankEgld + amount - pay - rake : prev.bankEgld,
          bankRoar: token === "ROAR" ? prev.bankRoar + amount - pay - rake : prev.bankRoar,
          treasuryEgld: token === "EGLD" ? prev.treasuryEgld + rake : prev.treasuryEgld,
          treasuryRoar: token === "ROAR" ? prev.treasuryRoar + rake : prev.treasuryRoar,
          claimEgld: token === "EGLD" ? prev.claimEgld + pay : prev.claimEgld,
          claimRoar: token === "ROAR" ? prev.claimRoar + pay : prev.claimRoar,
          history: [row, ...prev.history].slice(0, 12),
        };
        saveDemo(next);
        return next;
      });
      if (session.mode === "demo") {
        refreshHoldings(
          session.heartsWallet,
          token === "ROAR" ? Math.max(0, session.roarWallet - amount) : session.roarWallet,
          token === "EGLD" ? Math.max(0, session.egldWallet - amount) : session.egldWallet,
        );
      }
      toast.success(won ? t.diceWin : t.diceLose);
    };
    anim.current = requestAnimationFrame(tick);
  };

  const claimDemo = () => {
    if (demo.claimEgld <= 0 && demo.claimRoar <= 0) return;
    if (session?.mode === "demo") {
      refreshHoldings(
        session.heartsWallet,
        session.roarWallet + demo.claimRoar,
        session.egldWallet + demo.claimEgld,
      );
    }
    setDemo((prev) => {
      const next = { ...prev, claimEgld: 0, claimRoar: 0 };
      saveDemo(next);
      return next;
    });
    toast.success(t.diceClaimOk);
  };

  const handleBet = () => {
    if (!session) return onConnect();
    if (live) {
      if (!canSign) {
        toast.error(sessionLost ? t.sessionLost : t.needSign);
        onConnect();
        return;
      }
      if (!table?.roundOpen) {
        toast.error(t.diceStart);
        return;
      }
      onBet(token, amount, under);
      return;
    }
    playDemo();
  };

  const fmtAmt = (n: number, tok: DiceToken) =>
    tok === "ROAR" ? `${formatRoarClaim(n)} ROAR` : formatEgld(n, 4);

  return (
    <section className="mx-auto max-w-xl px-4 py-10">
      <article className="relative overflow-hidden rounded-xl bg-surface p-6 shadow-[var(--shadow-border)] sm:p-10">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 dual-bar" />
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.diceKicker}</p>
            <h2 className="mt-1 font-display text-2xl font-medium">{t.diceTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.diceLead}</p>
          </div>
          <Badge variant={live ? "volt" : "mute"}>{live ? t.diceLive : t.diceDemo}</Badge>
        </header>

        {!live ? <p className="mt-4 text-sm text-muted">{t.diceOffchain}</p> : null}

        {!live ? (
          <div className="mt-6 border-y border-border py-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{t.diceOpenKicker}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t.diceOpenLead}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-muted">
                {t.diceSeedEgld}
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={seedEgld}
                  onChange={(e) => setSeedEgld(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 h-11 w-full rounded-lg bg-bg px-3 text-sm tabular text-fg shadow-[var(--shadow-border)]"
                />
              </label>
              <label className="text-xs text-muted">
                {t.diceSeedRoar}
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={seedRoar}
                  onChange={(e) => setSeedRoar(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 h-11 w-full rounded-lg bg-bg px-3 text-sm tabular text-fg shadow-[var(--shadow-border)]"
                />
              </label>
            </div>
            <Button
              className="mt-4 h-12 w-full"
              onClick={() => (session && canSign ? onOpen(seedEgld, seedRoar) : onConnect())}
              disabled={busy !== null}
            >
              {busy === "open" ? <LionRun size="sm" label={t.diceOpening} /> : t.diceOpen}
            </Button>
          </div>
        ) : table?.sc ? (
          <p className="mt-4 truncate text-xs text-muted">{table.sc}</p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 divide-x divide-y divide-border border-y border-border">
          <Stat label={t.diceBank} value={formatEgld(bankEgld, 2)} hint={`${formatRoarClaim(bankRoar)} ROAR`} />
          <Stat label={t.diceTreasury} value={formatEgld(treEgld, 4)} hint={`${formatRoarClaim(treRoar)} ROAR`} />
        </div>

        <div className="mt-6 flex rounded-full bg-bg p-0.5 shadow-[var(--shadow-border)]">
          {(["EGLD", "ROAR"] as DiceToken[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setToken(id)}
              className={cn(
                "h-11 flex-1 rounded-full text-sm font-medium transition-[background-color,color] duration-150",
                token === id ? "bg-volt text-bg" : "text-muted hover:text-fg",
              )}
            >
              {id}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex items-end justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{t.diceAmount}</p>
            <p className="text-xs text-muted">
              {t.inWallet} {fmtAmt(wallet, token)}
            </p>
          </div>
          <div className="mt-2 flex gap-2">
            {[min, (min + cap) / 2, cap].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(Number(n.toFixed(token === "ROAR" ? 0 : 3)))}
                className="h-11 flex-1 rounded-full bg-bg text-xs font-medium text-muted shadow-[var(--shadow-border)] hover:text-fg"
              >
                {fmtAmt(n, token)}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={min}
            max={Math.max(min, cap)}
            step={token === "ROAR" ? 1 : 0.01}
            value={Math.min(cap, Math.max(min, amount))}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="heart-zoom mt-2"
            aria-label={t.diceAmount}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-end justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">
              {t.diceUnder} {under}
            </p>
            <p className="text-sm tabular text-muted">
              {chance}% · ×{formatNum(multi, 2)}
            </p>
          </div>
          <input
            type="range"
            min={GAMES.minUnder}
            max={GAMES.maxUnder}
            step={1}
            value={under}
            onChange={(e) => setUnder(clampUnder(Number(e.target.value)))}
            className="heart-zoom mt-2"
            aria-label={t.diceUnder}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border">
          <Stat label={t.diceChance} value={`${chance}%`} hint={t.diceUnder} />
          <Stat label={t.dicePayout} value={fmtAmt(payout, token)} hint={`×${formatNum(multi, 2)}`} />
          <Stat label={t.diceRake} value={fmtAmt(rake, token)} hint={token === "EGLD" ? "4%" : "2%"} />
        </div>

        <div className="mt-8 text-center">
          <p className="font-display text-6xl tabular leading-none">
            {display === null ? "—" : String(display).padStart(2, "0")}
          </p>
          <p className="mt-2 text-sm text-muted">
            {last ? (last.won ? t.diceWin : t.diceLose) : t.diceRollHint}
          </p>
        </div>

        <Button className="mt-6 h-12 w-full" size="lg" onClick={handleBet} disabled={busy !== null || rolling !== null}>
          {busy === "bet" || rolling !== null ? <LionRun size="sm" label={t.diceRolling} /> : <Dices />}
          {t.diceRoll} · {fmtAmt(amount, token)}
        </Button>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            variant="volt"
            className="h-12"
            disabled={(claimEgld <= 0 && claimRoar <= 0) || busy !== null}
            onClick={() => (live ? onClaim() : claimDemo())}
          >
            {busy === "claim" ? <LionRun size="sm" label={t.txRun} /> : <Wallet />}
            {t.diceClaim}
          </Button>
          {live ? (
            <Button
              variant="outline"
              className="h-12"
              disabled={busy !== null}
              onClick={() => (table?.roundOpen ? onResolve() : onStart())}
            >
              {busy === "resolve" || busy === "start" ? (
                <LionRun size="sm" label={t.txRun} />
              ) : table?.roundOpen ? (
                t.diceResolve
              ) : (
                t.diceStart
              )}
            </Button>
          ) : (
            <div className="flex h-12 items-center justify-center text-xs text-muted">
              {t.diceClaimable} {formatEgld(claimEgld, 4)} · {formatRoarClaim(claimRoar)} ROAR
            </div>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted">{t.diceDisclaimer}</p>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">{t.diceHistory}</p>
          {demo.history.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t.diceEmpty}</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {demo.history.map((row) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    {row.token} · {t.diceUnder} {row.under} · {String(row.roll).padStart(2, "0")}
                  </span>
                  <span className={cn("tabular", row.won ? "text-volt" : "text-ember")}>
                    {row.won ? "+" : "−"}
                    {fmtAmt(row.won ? row.payout : row.amount, row.token)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-3 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 truncate font-display text-xl tabular leading-none">{value}</p>
      {hint ? <p className="mt-1.5 truncate text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
