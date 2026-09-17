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
  cancelPendingPairing,
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
  const pairedOk = useRef(false);

  useEffect(() => {
    if (!open) {
      gen.current += 1;
      setQrSvg("");
      setWcUri("");
      setWaiting(false);
      setBusy(false);
      setError("");
      return;
    }
    pairedOk.current = false;
    prepareWalletConnect();
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (!pairedOk.current) cancelPendingPairing();
      pairedOk.current = false;
    }
    onOpenChange(next);
  }

  async function loadHoldings(address: string, mode: "xportal" | "live") {
    const holdings = await getWalletHoldings({ data: { address } });
    if (mode === "xportal") {
      connectXportal(holdings.address, holdings.hearts, holdings.roar, holdings.egld, {
        heartsStaked: holdings.heartsStaked,
        pendingRoar: holdings.pendingRoar,
        lastTick: holdings.lastTick,
        history: holdings.history,
      });
    } else {
      connectLive(holdings.address, holdings.hearts, holdings.roar, holdings.egld, {
        heartsStaked: holdings.heartsStaked,
        pendingRoar: holdings.pendingRoar,
        lastTick: holdings.lastTick,
        history: holdings.history,
      });
    }
    pairedOk.current = true;
    onOpenChange(false);
  }

  async function startXportal() {
    const mine = ++gen.current;
    setBusy(true);
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
          if (typeof svg === "string" && svg.includes("\u003csvg")) setQrSvg(svg);
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
    \u003cDialog open={open} onOpenChange={handleOpenChange}>
      \u003cDialogContent>
        \u003cDialogHeader>
          \u003cDialogTitle>{t.connect}\u003c/DialogTitle>
          \u003cDialogDescription>{t.xportalLead}\u003c/DialogDescription>
        \u003c/DialogHeader>

        {waiting ? (
          \u003cdiv className="grid gap-3">
            \u003cp className="text-sm text-muted">{t.scanXportal}\u003c/p>
            {qrSvg ? (
              \u003cdiv
                className="mx-auto w-full max-w-[220px] rounded-lg bg-bg p-3"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              \u003cdiv className="mx-auto flex h-24 w-full items-center rounded-lg bg-bg px-2 pt-2">
                \u003cLionTrack size="md" label={t.waitingXportal} />
              \u003c/div>
            )}
            {wcUri ? (
              \u003cButton asChild variant="volt" className="w-full">
                \u003ca href={xportalWcLink(wcUri)} target="_blank" rel="noopener noreferrer">
                  \u003cSmartphone className="size-4" />
                  {t.openXportal}
                \u003c/a>
              \u003c/Button>
            ) : null}
            \u003cp className="text-center text-xs text-muted">{t.waitingXportal}\u003c/p>
            \u003cButton
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => handleOpenChange(false)}
            >
              {t.cancel}
            \u003c/Button>
          \u003c/div>
        ) : (
          \u003c>
            \u003cButton
              type="button"
              className="h-12 w-full justify-start gap-3"
              variant="volt"
              disabled={busy}
              onClick={() => void startXportal()}
            >
              {busy ? \u003cLionRun size="sm" label={t.connecting} /> : \u003cQrCode className="size-4" />}
              {t.connectXportal}
            \u003c/Button>
            {error ? \u003cp className="text-center text-xs text-ember">{error}\u003c/p> : null}
            \u003cButton
              className="h-12 w-full justify-start gap-3"
              onClick={() => {
                connectDemo();
                onOpenChange(false);
              }}
            >
              \u003cWallet className="size-4" />
              {t.demo}
            \u003c/Button>
            \u003cdiv className="grid gap-2">
              \u003clabel className="text-xs font-medium text-muted" htmlFor="erd-addr">
                {t.pasteReadonly}
              \u003c/label>
              \u003cInput
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
              \u003cButton
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void loadAddress()}
              >
                {busy ? \u003cLionRun size="sm" label={t.connecting} /> : null}
                {busy ? t.connecting : t.lookup}
              \u003c/Button>
            \u003c/div>
            \u003ca
              href={LINKS.xportal}
              target="_blank"
              rel="noreferrer"
              className="text-center text-[11px] text-muted hover:text-fg"
            >
              xPortal
            \u003c/a>
          \u003c/>
        )}
      \u003c/DialogContent>
    \u003c/Dialog>
  );
}
