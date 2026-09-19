import { useMemo, useState } from "react";
import { Dices } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GAMES } from "@/lib/sections";
import type { Copy } from "@/lib/i18n";
import type { Session } from "@/lib/store";
import { useVaultStore } from "@/lib/store";
import { cn, formatNum } from "@/lib/utils";

const EDGE = 0.05;
const RAKE_EGLD = 0.04;
const RAKE_ROAR = 0.02;

const TXT = {
  fr: {
    title: "ROAR Dice",
    v1: "v1",
    lead: "Dés on-chain. Mises lockées avant le tirage. Rake 2% en ROAR, 4% en EGLD. Edge maison 5%.",
    under: "Gagner si le dé est sous…",
    chance: (n: number) => `${n}% de chance`,
    stake: "Mise",
    winPay: "Payout si win",
    rake: "Rake",
    play: "Miser (devnet)",
    soon: "Contrat pas encore déployé — desk prêt",
    legal: "Jeu d’argent. Pas audité. Devnet d’abord.",
  },
  en: {
    title: "ROAR Dice",
    v1: "v1",
    lead: "On-chain dice. Bets lock before the roll. 2% rake on ROAR, 4% on EGLD. 5% house edge.",
    under: "Win if the roll is under…",
    chance: (n: number) => `${n}% chance`,
    stake: "Stake",
    winPay: "Payout if win",
    rake: "Rake",
    play: "Bet (devnet)",
    soon: "Contract not deployed yet — desk is ready",
    legal: "Gambling product. Not audited. Devnet first.",
  },
} as const;

function payout(stake: number, under: number, rake: number) {
  const net = stake * (1 - rake);
  return net * (100 / under) * (1 - EDGE);
}

export function GamesDesk({
  session,
  onConnect,
  t,
}: {
  session: Session | null;
  onConnect: () => void;
  t: Copy;
}) {
  const lang = useVaultStore((s) => s.lang);
  const g = TXT[lang] ?? TXT.en;
  const [token, setToken] = useState<"EGLD" | "ROAR">("ROAR");
  const [under, setUnder] = useState(50);
  const [stake, setStake] = useState("1");
  const rake = token === "ROAR" ? RAKE_ROAR : RAKE_EGLD;
  const amount = Number(stake) || 0;
  const winPay = useMemo(() => payout(amount, under, rake), [amount, under, rake]);
  const live = Boolean(GAMES.roarDice);

  return (
    <section id="games" className="scroll-mt-32 mx-auto max-w-xl px-4 py-6">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-2">
          <Dices className="size-5 text-ember" />
          <h2 className="text-lg font-semibold">{g.title}</h2>
          <Badge variant="mute">{g.v1}</Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">{g.lead}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["ROAR", "EGLD"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setToken(id)}
              className={cn(
                "h-11 rounded-full text-sm font-medium",
                token === id ? "bg-ember text-primary-foreground" : "bg-surface-2 text-muted",
              )}
            >
              {id} · {id === "ROAR" ? "2%" : "4%"} rake
            </button>
          ))}
        </div>

        <label className="mt-5 block text-xs text-muted">{g.under}</label>
        <input
          type="range"
          min={2}
          max={96}
          value={under}
          onChange={(e) => setUnder(Number(e.target.value))}
          className="mt-2 w-full accent-[hsl(var(--ember))]"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>2</span>
          <span className="text-fg font-medium">{under}</span>
          <span>96</span>
        </div>
        <p className="mt-1 text-sm text-muted">{g.chance(under)}</p>

        <label className="mt-4 block text-xs text-muted">{g.stake}</label>
        <Input
          value={stake}
          inputMode="decimal"
          onChange={(e) => setStake(e.target.value)}
          className="mt-1 h-12"
        />

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{g.winPay}</dt>
            <dd className="mt-1 font-medium">
              {formatNum(winPay)} {token}
            </dd>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <dt className="text-xs text-muted">{g.rake}</dt>
            <dd className="mt-1 font-medium">{token === "ROAR" ? "2%" : "4%"}</dd>
          </div>
        </dl>

        {!session ? (
          <Button className="mt-5 h-12 w-full" size="lg" onClick={onConnect}>
            {t.connectXportal}
          </Button>
        ) : (
          <Button
            className="mt-5 h-12 w-full"
            size="lg"
            disabled={!live}
            onClick={() => {
              if (!live) toast.message(g.soon);
            }}
          >
            {live ? g.play : g.soon}
          </Button>
        )}
        <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">{g.legal}</p>
      </div>
    </section>
  );
}
