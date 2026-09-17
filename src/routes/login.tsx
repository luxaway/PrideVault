import { createFileRoute, Link } from "@tanstack/react-router";
import { RoarMark } from "@/components/mark";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { copy } from "@/lib/i18n";
import { useVaultStore } from "@/lib/store";
import { cn, fillAmt } from "@/lib/utils";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const lang = useVaultStore((s) => s.lang);
  const t = copy[lang];
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm space-y-5">
        <div className="dual-bar h-0.5 w-full rounded-full" />
        <div className="flex items-center gap-3">
          <RoarMark className="size-11" />
          <div className="min-w-0">
            <h1 className="font-display text-xl tracking-wide">{t.loginTitle}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t.loginLead}</p>
          </div>
        </div>
        {authEnabled ? (
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.slice()
              .sort((a, b) => Number(b.providerId === "grok-x") - Number(a.providerId === "grok-x"))
              .map((p) => {
              const x = p.providerId === "grok-x";
              return (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
                  className={cn(
                    "flex h-12 w-full items-center justify-center gap-2 rounded-md text-sm font-medium",
                    x
                      ? "bg-ember text-primary-foreground hover:bg-ember/90"
                      : "bg-surface-2 text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]",
                  )}
                >
                  {x ? <XMark className="size-4" /> : null}
                  {fillAmt(t.loginWith, p.label)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">{t.loginOff}</p>
        )}
        <Link to="/" className="inline-flex h-11 items-center text-sm text-muted hover:text-fg">
          {t.loginBack}
        </Link>
      </div>
    </main>
  );
}

function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.726-8.835L1.254 2.25H8.08l4.25 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}
