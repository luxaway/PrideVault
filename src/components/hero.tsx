import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Copy } from "@/lib/i18n";
import { formatNum } from "@/lib/utils";

export function Hero({
  t,
  listed,
  ooxStaked,
  inWallets,
  onConnect,
  connected,
}: {
  t: Copy;
  listed: number;
  ooxStaked: number;
  inWallets: number;
  onConnect: () => void;
  connected: boolean;
}) {
  return (
    <section id="hero" className="relative overflow-hidden">
      <img
        src="/roar-crest.jpg"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20 outline-none"
      />
      <div className="absolute inset-0 dual-wash" />
      <div className="absolute inset-0 bg-linear-to-b from-bg/40 via-bg/80 to-bg" />
      <div className="relative mx-auto flex max-w-6xl items-center gap-8 px-4 py-8 md:py-10">
        <div className="stagger-in flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted">
            {t.powered}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="volt">{t.supply}</Badge>
            <Badge variant="mute">{t.node}</Badge>
          </div>
          <h1 className="font-display text-3xl font-medium leading-[1.08] tracking-tight text-fg md:text-4xl">
            {t.heroTitle}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted">{t.heroLead}</p>
          <div className="flex flex-wrap gap-3">
            {!connected ? (
              <Button size="lg" onClick={onConnect}>
                {t.connectXportal}
              </Button>
            ) : (
              <Button size="lg" asChild>
                <a href="#buy">{t.buy}</a>
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            {formatNum(listed, 0)} {t.statsListed.toLowerCase()} · {formatNum(ooxStaked, 0)}{" "}
            {t.statsOoxStake.toLowerCase()} · {formatNum(inWallets, 0)} {t.statsWallets.toLowerCase()}
          </p>
        </div>
        <div className="relative hidden w-36 shrink-0 md:block lg:w-44">
          <div className="pointer-events-none absolute -left-4 top-4 size-20 rounded-full bg-ember/25 blur-2xl" />
          <div className="pointer-events-none absolute -right-2 bottom-4 size-20 rounded-full bg-volt/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-xl shadow-[var(--shadow-border)]">
            <img
              src="/roar-crest.jpg"
              alt="ROAR"
              className="aspect-square w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-bg/70 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] backdrop-blur-sm">
              <span className="text-volt">{t.volt}</span>
              <span className="text-ember">{t.fire}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
