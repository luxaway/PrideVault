import { create } from "zustand";
import { persist } from "zustand/middleware";
import { asSlippagePct, DEMO_ADDRESS, type SlippagePct } from "./config";
import type { Lang } from "./i18n";
import { accruePending } from "./vault";

export type WalletMode = "demo" | "live" | "xportal";

export type HistoryKind = "stake" | "unstake" | "claim";

export type HistoryItem = {
  id: string;
  kind: HistoryKind;
  amount: number;
  at: number;
};

export type HoldingsPatch = {
  heartsStaked?: number;
  pendingRoar?: number;
  lastTick?: number;
  history?: HistoryItem[];
};

export type Session = {
  mode: WalletMode;
  address: string;
  heartsWallet: number;
  heartsStaked: number;
  roarWallet: number;
  egldWallet: number;
  pendingRoar: number;
  lastTick: number;
  claimedTotal: number;
  history: HistoryItem[];
};

type VaultState = {
  lang: Lang;
  slippage: SlippagePct;
  hydrated: boolean;
  session: Session | null;
  setLang: (lang: Lang) => void;
  setSlippage: (pct: SlippagePct) => void;
  setHydrated: () => void;
  connectDemo: () => void;
  connectLive: (address: string, hearts: number, roar: number, egld?: number, patch?: HoldingsPatch) => void;
  connectXportal: (address: string, hearts: number, roar: number, egld?: number, patch?: HoldingsPatch) => void;
  refreshHoldings: (hearts: number, roar: number, egld: number, patch?: HoldingsPatch) => void;
  disconnect: () => void;
  tick: (vaultStaked: number) => void;
  stake: (n: number, vaultStaked: number) => boolean;
  unstake: (n: number, vaultStaked: number) => boolean;
  claim: (vaultStaked: number) => number;
};

const DEMO_ADDR = DEMO_ADDRESS;

function pushHistory(session: Session, kind: HistoryKind, amount: number): HistoryItem[] {
  return [
    { id: `${kind}-${Date.now()}`, kind, amount, at: Date.now() },
    ...session.history,
  ].slice(0, 12);
}

function reuse(prev: Session | null, address: string) {
  if (prev && prev.address === address && prev.mode !== "demo") return prev;
  return null;
}

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      lang: "en",
      slippage: 1,
      hydrated: false,
      session: null,
      setLang: (lang) => set({ lang }),
      setSlippage: (pct) => set({ slippage: asSlippagePct(pct) }),
      setHydrated: () => set({ hydrated: true }),
      connectDemo: () =>
        set({
          session: {
            mode: "demo",
            address: DEMO_ADDR,
            heartsWallet: 2,
            heartsStaked: 3,
            roarWallet: 42,
            egldWallet: 12,
            pendingRoar: 1.2,
            lastTick: Date.now(),
            claimedTotal: 0,
            history: [],
          },
        }),
      connectLive: (address, hearts, roar, egld = 0, patch) =>
        set((state) => {
          const prev = reuse(state.session, address);
          return {
            session: {
              mode: "live",
              address,
              heartsWallet: hearts,
              heartsStaked: patch?.heartsStaked ?? prev?.heartsStaked ?? 0,
              roarWallet: roar,
              egldWallet: egld,
              pendingRoar: patch?.pendingRoar ?? prev?.pendingRoar ?? 0,
              lastTick: typeof patch?.lastTick === "number" && patch.lastTick > 0 ? patch.lastTick : Date.now(),
              claimedTotal: prev?.claimedTotal ?? 0,
              history: patch?.history ?? prev?.history ?? [],
            },
          };
        }),
      connectXportal: (address, hearts, roar, egld = 0, patch) =>
        set((state) => {
          const prev = reuse(state.session, address);
          return {
            session: {
              mode: "xportal",
              address,
              heartsWallet: hearts,
              heartsStaked: patch?.heartsStaked ?? prev?.heartsStaked ?? 0,
              roarWallet: roar,
              egldWallet: egld,
              pendingRoar: patch?.pendingRoar ?? prev?.pendingRoar ?? 0,
              lastTick: typeof patch?.lastTick === "number" && patch.lastTick > 0 ? patch.lastTick : Date.now(),
              claimedTotal: prev?.claimedTotal ?? 0,
              history: patch?.history ?? prev?.history ?? [],
            },
          };
        }),
      refreshHoldings: (hearts, roar, egld, patch) =>
        set((state) => {
          const session = state.session;
          if (!session || session.mode === "demo") return {};
          return {
            session: {
              ...session,
              heartsWallet: hearts,
              roarWallet: roar,
              egldWallet: egld,
              heartsStaked: typeof patch?.heartsStaked === "number" ? patch.heartsStaked : session.heartsStaked,
              pendingRoar: typeof patch?.pendingRoar === "number" ? patch.pendingRoar : session.pendingRoar,
              lastTick: typeof patch?.lastTick === "number" && patch.lastTick > 0 ? patch.lastTick : Date.now(),
              history: patch?.history ?? session.history,
            },
          };
        }),
      disconnect: () => set({ session: null }),
      tick: (vaultStaked) => {
        const { session } = get();
        if (!session || session.mode !== "demo") return;
        const next = accruePending(
          session.heartsStaked,
          vaultStaked,
          session.lastTick,
          session.pendingRoar,
        );
        set({ session: { ...session, ...next } });
      },
      stake: (n, vaultStaked) => {
        const { session } = get();
        if (!session || n <= 0 || n > session.heartsWallet) return false;
        const accrued = accruePending(
          session.heartsStaked,
          vaultStaked,
          session.lastTick,
          session.pendingRoar,
        );
        set({
          session: {
            ...session,
            ...accrued,
            heartsWallet: session.heartsWallet - n,
            heartsStaked: session.heartsStaked + n,
            history: pushHistory(session, "stake", n),
          },
        });
        return true;
      },
      unstake: (n, vaultStaked) => {
        const { session } = get();
        if (!session || n <= 0 || n > session.heartsStaked) return false;
        const accrued = accruePending(
          session.heartsStaked,
          vaultStaked,
          session.lastTick,
          session.pendingRoar,
        );
        set({
          session: {
            ...session,
            ...accrued,
            heartsWallet: session.heartsWallet + n,
            heartsStaked: session.heartsStaked - n,
            history: pushHistory(session, "unstake", n),
          },
        });
        return true;
      },
      claim: (vaultStaked) => {
        const { session } = get();
        if (!session) return 0;
        const accrued = accruePending(
          session.heartsStaked,
          vaultStaked,
          session.lastTick,
          session.pendingRoar,
        );
        const amount = accrued.pending;
        if (amount <= 0) return 0;
        set({
          session: {
            ...session,
            lastTick: accrued.lastTick,
            pendingRoar: 0,
            roarWallet: session.roarWallet + amount,
            claimedTotal: session.claimedTotal + amount,
            history: pushHistory(session, "claim", amount),
          },
        });
        return amount;
      },
    }),
    {
      name: "pridevault-v6",
      skipHydration: true,
      partialize: (s) => ({ lang: s.lang, session: s.session, slippage: s.slippage }),
    },
  ),
);
