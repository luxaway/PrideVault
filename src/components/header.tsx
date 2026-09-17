import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { PrideChat } from "@/components/pride-chat";
import { RoarMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import type { Copy, Lang } from "@/lib/i18n";
import { useVaultStore } from "@/lib/store";
import { formatEgld, formatNum, shortAddr } from "@/lib/utils";
import { disconnectWallet } from "@/lib/wallet";

export function Header({
  t,
  onConnect,
  signerReady,
  sessionLost,
  onSendRoar,
}: {
  t: Copy;
  onConnect: () => void;
  signerReady: boolean;
  sessionLost: boolean;
  onSendRoar: (to: string, amount: number) => Promise<string | null>;
}) {
  const lang = useVaultStore((s) => s.lang);
  const setLang = useVaultStore((s) => s.setLang);
  const session = useVaultStore((s) => s.session);
  const disconnect = useVaultStore((s) => s.disconnect);

  function copyAddress() {
    if (!session) return;
    void navigator.clipboard.writeText(session.address).then(
      () => toast.success(t.copied),
      () => undefined,
    );
  }

  function handleDisconnect() {
    void disconnectWallet();
    disconnect();
  }

  return (
    <header className="bg-bg/85 backdrop-blur-md">
      <div className="dual-bar h-0.5 w-full" />
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3">
        <a href="#heart" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <RoarMark className="size-8 shrink-0 sm:size-9" />
          <div className="min-w-0 leading-tight">
            <p className="font-display text-sm font-medium tracking-wide">{t.brand}</p>
            <p className="hidden truncate text-[11px] text-muted sm:block">{t.kicker}</p>
          </div>
        </a>
        <PrideChat t={t} session={session} onConnect={onConnect} onSendRoar={onSendRoar} />
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <LangToggle lang={lang} setLang={setLang} t={t} />
          {session ? (
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              {session.mode === "xportal" ? (
                <div className="hidden items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 text-[11px] tabular shadow-[var(--shadow-border)] lg:flex">
                  <span>{formatEgld(session.egldWallet, 3)}</span>
                  <span className="text-muted">·</span>
                  <span>{formatNum(session.roarWallet, 1)} ROAR</span>
                </div>
              ) : null}
              {sessionLost ? (
                <Button size="sm" onClick={onConnect}>
                  {t.reconnectXportal}
                </Button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={copyAddress}
                    title={session.address}
                    className="inline-flex h-9 max-w-[9.5rem] min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium shadow-[var(--shadow-border)] hover:bg-surface-2 sm:h-11 sm:max-w-[16rem] sm:gap-2 sm:px-3"
                  >
                    {session.mode === "xportal" ? (
                      <span
                        className={`size-2 shrink-0 rounded-full ${signerReady ? "bg-volt" : "bg-ember/70"}`}
                      />
                    ) : null}
                    <span className="truncate">
                      {session.mode === "demo"
                        ? t.connectedDemo
                        : shortAddr(session.address, 4, 3)}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 sm:size-11"
                    onClick={handleDisconnect}
                    aria-label={t.disconnect}
                    title={t.disconnect}
                  >
                    <LogOut className="size-4" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <Button size="sm" className="h-9 sm:h-11" onClick={onConnect}>
              {t.connect}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function LangToggle({
  lang,
  setLang,
  t,
}: {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Copy;
}) {
  return (
    <div className="flex shrink-0 rounded-full bg-surface-2 p-0.5 shadow-[var(--shadow-border)]">
      {(["en", "fr"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`h-8 min-w-8 rounded-full px-2 text-[11px] font-medium transition-[background-color,color] duration-150 sm:h-11 sm:min-w-11 sm:px-2.5 ${
            lang === l ? "bg-ember text-primary-foreground" : "text-muted hover:text-fg"
          }`}
        >
          {l === "fr" ? t.langFr : t.langEn}
        </button>
      ))}
    </div>
  );
}
