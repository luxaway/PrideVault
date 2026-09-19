import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LionTrack } from "@/components/lion-run";
import type { Copy } from "@/lib/i18n";
import {
  dismissSignUi,
  subscribeSignUi,
  xportalSignHref,
  type SignUi,
} from "@/lib/wallet";
import { subscribeTxLane } from "@/lib/tx-lane";

export function SignSheet({ t }: { t: Copy }) {
  const [req, setReq] = useState<SignUi>(null);
  const [laneDone, setLaneDone] = useState(false);

  useEffect(() => subscribeSignUi(setReq), []);
  useEffect(() => subscribeTxLane((s) => setLaneDone(s.done)), []);

  if (!req) return null;

  const wc = req.mode === "wc";

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-bg/80"
        aria-hidden
        tabIndex={-1}
      />
      <aside className="relative w-full max-w-md animate-[rise_250ms_var(--ease-smooth-out)] rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-11 items-center justify-center rounded-lg bg-volt/15 text-volt">
            <Smartphone className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-xl font-medium leading-tight">{t.signTitle}</h2>
            <p className="text-xs text-muted">{req.title}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {wc ? t.signLeadWc : t.signLeadWebview}
        </p>
        <ol className="mt-5 grid gap-2">
          {req.steps.map((step, i) => (
            <li
              key={`${step}-${i}`}
              className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2.5 shadow-[var(--shadow-border)]"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-bg text-xs tabular text-muted">
                {i + 1}
              </span>
              <span className="text-sm">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 overflow-hidden rounded-lg bg-bg px-3 pt-4 pb-3">
          <LionTrack done={laneDone} size="lg" label={t.txRun} hint={t.txLaneHint} />
          <p className="mt-1 text-center text-sm text-volt">{t.signWaiting}</p>
        </div>
        {wc ? (
          <Button asChild size="lg" variant="volt" className="mt-5 w-full">
            <a
              href={xportalSignHref()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Smartphone className="size-4" />
              {t.openXportal}
            </a>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          className="mt-2 w-full"
          onClick={() => dismissSignUi()}
        >
          {t.signHide}
        </Button>
        <p className="mt-3 text-center text-[11px] text-muted">{t.signHint}</p>
      </aside>
    </div>
  );
}