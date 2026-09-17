import { ArrowLeftRight, Coins, Heart, LineChart, ShoppingBag, Trophy, Wallet } from "lucide-react";
import type { AppSection } from "@/lib/config";
import { SECTIONS } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const ICONS = {
  heart: Heart,
  wallet: Wallet,
  buy: ShoppingBag,
  swap: ArrowLeftRight,
  roar: Coins,
  board: Trophy,
  stats: LineChart,
} as const;

export function SectionNav({
  t,
  section,
}: {
  t: Copy;
  section: AppSection;
}) {
  const labels: Record<AppSection, string> = {
    heart: t.navHeart,
    wallet: t.navWallet,
    buy: t.navBuy,
    swap: t.navSwap,
    roar: t.navRoar,
    board: t.navBoard,
    stats: t.navStats,
  };

  return (
    <nav id="section-nav" className="bg-bg" aria-label={t.brand}>
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((row) => {
          const Icon = ICONS[row.id];
          const active = section === row.id;
          return (
            <a
              key={row.id}
              href={`#${row.hash}`}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
              }}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-[background-color,color] duration-150",
                active
                  ? "bg-ember text-primary-foreground"
                  : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
              {labels[row.id]}
            </a>
          );
        })}
      </div>
      <div className="dual-bar h-px w-full" />
    </nav>
  );
}
