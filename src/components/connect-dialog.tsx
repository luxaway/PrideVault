import { useEffect, useRef, useState } from "react";
import { QrCode, Smartphone, Wallet } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LionRun, LionTrack } from "@/components/lion-run";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LINKS, xportalWcLink } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { getWalletHoldings } from "@/lib/mx.functions";
import { useVaultStore } from "@/lib/store";
import { isErdAddress } from "@/lib/utils";
import {
  abortWalletConnect,
  commitWalletSession,
  connectWalletConnect,
  connectWebview,
  isMobileBrowser,
  isXPortalWebview,
  openXPortalToPair,
  prepareWalletConnect,
} from "@/lib/wallet";

export function ConnectDialog({
  open,
  onOpenChange,
  t,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  t: Copy;
}) {
  const connectDemo = useVaultStore((s) => s.connectDemo);
  const connectLive = useVaultStore((s) => s.connectLive);
  const connectXportal = useVaultStore((s) => s.connectXportal);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState(false);
  const [qrSvg, setQrSvg] = useState("");
  const [wcUri, setWcUri] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const gen = useRef(0);
  const waitingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      gen.current += 1;
      if (waitingRef.current) abortWalletConnect();
      waitingRef.current = false;
      setQrSvg("");
      setWcUri("");
      setWaiting(false);
      setBusy(false);
      setError("");
      return;
    }
    prepareWalletConnect();
  }, [open]);

  async function loadHoldings(address: string, mode: "xportal" | "live") {
    const holdings = await getWalletHoldings({ data: { address } });
    if (mode === "xportal") {
      connectXportal(holdings.address, holdings.hearts, holdings.roar, holdings.egld, {
        heartsStaked: holdings.heartsStaked,
        pendingRoar: holdings.pendingRoar,
        lastTick: holdings.lastTick,
        history: holdings.history,
      });
      // Persist WC only after Zustand has the live session.
      commitWalletSession(holdings.address, isXPortalWebview() ? "webview" : "wc");
    } else {
      connectLive(holdings.address, holdings.hearts, holdings.roar, holdings.egld, {
        heartsStaked: holdings.heartsStaked,
        pendingRoar: holdings.pendingRoar,
        lastTick: holdings.lastTick,
        history: holdings.history,
      });
    }
    waitingRef.current = false;
    setWaiting(false);
    onOpenChange(false);
  }

  async function startXportal() {
    const mine = ++gen.current;
    setBusy(true);
    waitingRef.current = true;
    setWaiting(true);
    setError("");
    try {
      if (isXPortalWebview()) {
        const address = await connectWebview();
        if (mine !== gen.current) return;
        await loadHoldings(address, "xportal");
        return;
      }
      const address = await connectWalletConnect(async (uri) => {
        if (mine !== gen.current) return;
        setWcUri(uri);
        try {
          const svg = await QRCode.toString(uri, {
            type: "svg",
            margin: 1,
            color: { dark: "#f4ebe0", light: "#080706" },
          });
          if (mine !== gen.current) return;
          if (typeof svg === "string" && svg.includes("<svg")) setQrSvg(svg);
        } catch {
          /* Open xPortal still works without the QR */
        }
        if (isMobileBrowser()) openXPortalToPair(uri);
      });
      if (mine !== gen.current) return;
      await loadHoldings(address, "xportal");
    } catch (err) {
      if (mine !== gen.current) return;
      const message = err instanceof Error ? err.message : t.buyError;
      setError(message);
      toast.error(message);
      waitingRef.current = false;
      setWaiting(false);
      setQrSvg("");
      setWcUri("");
    } finally {
      if (mine === gen.current) setBusy(false);
    }
  }

  async function loadAddress() {
    const value = addr.trim();
    if (!isErdAddress(value)) {
      toast.error(t.invalidAddr);
      return;
    }
    setBusy(true);
    try {
      await loadHoldings(value, "live");
    } catch {
      toast.error(t.invalidAddr);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.connect}</DialogTitle>
          <DialogDescription>{t.xportalLead}</DialogDescription>
        </DialogHeader>

        {waiting ? (
          <div className="grid gap-3">
            <p className="text-sm text-muted">{t.scanXportal}</p>
            {qrSvg ? (
              <div
                className="mx-auto w-full max-w-[220px] rounded-lg bg-bg p-3"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <div className="mx-auto flex h-24 w-full items-center rounded-lg bg-bg px-2 pt-2">
                <LionTrack size="md" label={t.waitingXportal} />
              </div>
            )}
            {wcUri ? (
              <Button asChild variant="volt" className="w-full">
                <a href={xportalWcLink(wcUri)} target="_blank" rel="noopener noreferrer">
                  <Smartphone className="size-4" />
                  {t.openXportal}
                </a>
              </Button>
            ) : null}
            <p className="text-center text-xs text-muted">{t.waitingXportal}</p>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                abortWalletConnect();
                onOpenChange(false);
              }}
            >
              {t.cancel}
            </Button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              className="h-12 w-full justify-start gap-3"
              variant="volt"
              disabled={busy}
              onClick={() => void startXportal()}
            >
              {busy ? <LionRun size="sm" label={t.connecting} /> : <QrCode className="size-4" />}
              {t.connectXportal}
            </Button>
            {error ? <p className="text-center text-xs text-ember">{error}</p> : null}
            <Button
              className="h-12 w-full justify-start gap-3"
              onClick={() => {
                connectDemo();
                onOpenChange(false);
              }}
            >
              <Wallet className="size-4" />
              {t.demo}
            </Button>
            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted" htmlFor="erd-addr">
                {t.pasteReadonly}
              </label>
              <Input
                id="erd-addr"
                value={addr}
                onChange={(e) => setAddr(e.target.value.toLowerCase())}
                placeholder={t.pasteHint}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void loadAddress();
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void loadAddress()}
              >
                {busy ? <LionRun size="sm" label={t.connecting} /> : null}
                {busy ? t.connecting : t.lookup}
              </Button>
            </div>
            <a
              href={LINKS.xportal}
              target="_blank"
              rel="noreferrer"
              className="text-center text-[11px] text-muted hover:text-fg"
            >
              xPortal
            </a>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
