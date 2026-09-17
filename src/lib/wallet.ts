import "@/lib/polyfill";
import { APP_NAME, CHAIN, WALLETCONNECT, xportalOpenLink, xportalSignLink, xportalWcLink } from "./config";
import type { UnsignedTx } from "./tx";
import type { IPlainTransactionObject } from "@multiversx/sdk-core";

type WalletKind = "wc" | "webview";

export type { UnsignedTx };

export type SignUi = {
  title: string;
  steps: string[];
  mode: WalletKind;
} | null;

export type WalletReady = {
  kind: WalletKind | null;
  address: string | null;
};

type RnWindow = Window & {
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};

type WcSession = {
  topic?: string;
  namespaces?: Record<string, { accounts?: string[] }>;
};

type WcClient = {
  session?: {
    keys?: string[];
    length?: number;
    get: (key: string) => WcSession;
  };
  request: (args: {
    chainId: string;
    topic: string;
    request: { method: string; params: unknown };
  }) => Promise<unknown>;
};

type WcHandle = {
  walletConnector?: WcClient;
  session?: WcSession | undefined;
  onClientConnect?: {
    onClientLogin: () => void;
    onClientLogout: () => void;
    onClientEvent: (event?: unknown) => void;
  };
  isInitializing?: boolean;
  init: () => Promise<boolean>;
  isInitialized: () => boolean;
  isConnected: () => boolean;
  getAccount: () => { address?: string; signature?: string } | null;
  setAccount: (account: { address: string; signature?: string }) => void;
  getAddress: () => string;
  connect: () => Promise<{ uri?: string; approval: () => Promise<WcSession> }>;
  login: (options?: { approval?: () => Promise<WcSession>; token?: string }) => Promise<{ address?: string } | null>;
  logout: (options?: { topic?: string }) => Promise<boolean>;
};

const KIND_KEY = "pv.walletKind";
const ADDR_KEY = "pv.walletAddr";
const TOPIC_KEY = "pv.wcTopic";
const SIGN_HOLD_MS = 12_000;
const WC_CORE_NAME = "pridevault";

let kind: WalletKind | null = null;
let wcProvider: WcHandle | null = null;
let logoutHandler: (() => void) | null = null;
let lastPairingUri = "";
let signUi: SignUi = null;
let ready: WalletReady = { kind: null, address: null };
let signingInFlight = false;
let signHoldUntil = 0;
let deferredLogout = false;
let connectLock: Promise<string> | null = null;
let connectUri = "";
let pairAbort: ((reason?: Error) => void) | null = null;

const signListeners = new Set<(s: SignUi) => void>();
const readyListeners = new Set<(s: WalletReady) => void>();

const g = globalThis as typeof globalThis & {
  __pvWc?: WcHandle;
  __pvClient?: WcClient;
  __pvWcInit?: Promise<WcHandle> | null;
};

const wcCallbacks = {
  onClientLogin: () => undefined,
  onClientLogout: () => handleClientLogout(),
  onClientEvent: () => undefined,
};

export function onWalletLogout(fn: () => void) {
  logoutHandler = fn;
}

export function subscribeSignUi(fn: (s: SignUi) => void) {
  signListeners.add(fn);
  fn(signUi);
  return () => {
    signListeners.delete(fn);
  };
}

export function subscribeWalletReady(fn: (s: WalletReady) => void) {
  readyListeners.add(fn);
  fn(ready);
  return () => {
    readyListeners.delete(fn);
  };
}

function setSignUi(next: SignUi) {
  signUi = next;
  signListeners.forEach((fn) => fn(next));
}

/** Hide the sign overlay without aborting the in-flight WalletConnect request. */
export function dismissSignUi() {
  setSignUi(null);
}

function setReady(next: WalletReady) {
  ready = next;
  readyListeners.forEach((fn) => fn(next));
}

function persistKind(next: WalletKind | null, address?: string | null) {
  kind = next;
  const addr = address ?? (next ? ready.address : null);
  try {
    if (next) sessionStorage.setItem(KIND_KEY, next);
    else sessionStorage.removeItem(KIND_KEY);
    if (addr) sessionStorage.setItem(ADDR_KEY, addr);
    else sessionStorage.removeItem(ADDR_KEY);
  } catch {
    /* ignore */
  }
  setReady({ kind: next, address: addr });
}

function persistTopic(topic: string | null | undefined) {
  try {
    if (topic) sessionStorage.setItem(TOPIC_KEY, topic);
    else sessionStorage.removeItem(TOPIC_KEY);
  } catch {
    /* ignore */
  }
}

function readPersistedKind(): WalletKind | null {
  try {
    const value = sessionStorage.getItem(KIND_KEY);
    return value === "wc" || value === "webview" ? value : null;
  } catch {
    return null;
  }
}

function readPersistedAddress(): string | null {
  try {
    return sessionStorage.getItem(ADDR_KEY);
  } catch {
    return null;
  }
}

function readPersistedTopic(): string | null {
  try {
    return sessionStorage.getItem(TOPIC_KEY);
  } catch {
    return null;
  }
}

export function hasReactNativeWebView() {
  if (typeof window === "undefined") return false;
  return Boolean((window as RnWindow).ReactNativeWebView);
}

export function isXPortalWebview() {
  return hasReactNativeWebView();
}

export function isMobileBrowser() {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function rnPost(message: object) {
  const rn = (window as RnWindow).ReactNativeWebView;
  if (!rn?.postMessage) throw new Error("xPortal webview is not available");
  rn.postMessage(JSON.stringify(message));
}

type PortalMsg = {
  type?: string;
  payload?: { data?: unknown; error?: string };
};

function parsePortalEvent(event: Event): PortalMsg | null {
  const raw = "data" in event ? (event as MessageEvent).data : event;
  try {
    if (typeof raw === "string") return JSON.parse(raw) as PortalMsg;
    if (raw && typeof raw === "object") {
      const obj = raw as PortalMsg & { nativeEvent?: { data?: string } };
      if (typeof obj.nativeEvent?.data === "string") {
        return JSON.parse(obj.nativeEvent.data) as PortalMsg;
      }
      return obj;
    }
  } catch {
    return null;
  }
  return null;
}

function waitForPortal(types: string[], timeoutMs: number): Promise<PortalMsg> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("xPortal did not respond. Open PrideVault inside xPortal and retry."));
    }, timeoutMs);
    const onMessage = (event: Event) => {
      const msg = parsePortalEvent(event);
      if (!msg?.type) return;
      if (types.includes(msg.type) || msg.type === "CANCEL_RESPONSE") {
        cleanup();
        resolve(msg);
      }
    };
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      document.removeEventListener("message", onMessage);
    };
    window.addEventListener("message", onMessage);
    document.addEventListener("message", onMessage);
  });
}

async function handshakeWebview() {
  try {
    const pending = waitForPortal(["FINALIZE_HANDSHAKE_RESPONSE"], 1800);
    rnPost({ type: "FINALIZE_HANDSHAKE_REQUEST" });
    await pending;
  } catch {
    /* xPortal still accepts later requests without handshake */
  }
}

function originOf() {
  return typeof window !== "undefined" ? window.location.origin : "https://pridevault.app";
}

function addressFromSession(session: WcSession | undefined) {
  const account = session?.namespaces?.mvx?.accounts?.[0] ?? "";
  const parts = account.split(":");
  return parts.length >= 3 ? parts.slice(2).join(":") : "";
}

function sessionTopicOf(provider: WcHandle | null): string | null {
  return provider?.session?.topic || readPersistedTopic();
}

function clientOf(provider: WcHandle | null | undefined): WcClient | undefined {
  return g.__pvClient || provider?.walletConnector;
}

function restoreClient(provider: WcHandle | null | undefined, client: WcClient | undefined) {
  if (!provider || !client) return;
  provider.walletConnector = client;
  provider.onClientConnect = wcCallbacks;
  g.__pvClient = client;
  g.__pvWc = provider;
  wcProvider = provider;
}

/**
 * WalletConnect session_delete during/after a signature is often a false alarm
 * (xPortal ping, guardian 2FA, or the wallet going to background). Never wipe
 * the connected address here — the user must tap Disconnect themselves.
 *
 * The SDK calls disconnect() *after* this handler, which nulls walletConnector.
 * Re-attach the SignClient on a microtask so the next pairing/sign still works.
 */
function handleClientLogout() {
  const provider = wcProvider || g.__pvWc || null;
  const client = clientOf(provider);
  queueMicrotask(() => {
    restoreClient(provider, client);
  });
  if (signingInFlight || Date.now() < signHoldUntil) {
    deferredLogout = true;
    return;
  }
  if (rebindSession(provider)) return;
  try {
    if (provider?.isConnected?.()) return;
  } catch {
    /* keep going */
  }
  const keys = clientOf(provider)?.session?.keys ?? [];
  if (keys.length) return;
  const address = ready.address || readPersistedAddress();
  persistKind(null, address);
  logoutHandler?.();
}

function rebindSession(provider: WcHandle | null): boolean {
  if (!provider) return false;
  const client = clientOf(provider);
  restoreClient(provider, client);
  if (!client) return false;
  try {
    const keys = client.session?.keys ?? [];
    if (!keys.length) return false;
    const session = client.session!.get(keys[keys.length - 1]);
    if (!session) return false;
    provider.session = session;
    const address =
      addressFromSession(session) ||
      provider.getAccount()?.address ||
      readPersistedAddress();
    if (!address) return false;
    provider.setAccount({ address, signature: provider.getAccount()?.signature || "" });
    persistKind("wc", address);
    persistTopic(session.topic);
    deferredLogout = false;
    return true;
  } catch {
    return false;
  }
}

function beginSign() {
  signingInFlight = true;
  deferredLogout = false;
  signHoldUntil = Date.now() + 120_000;
}

function endSign() {
  signingInFlight = false;
  signHoldUntil = Date.now() + SIGN_HOLD_MS;
  setSignUi(null);
  if (!deferredLogout) return;
  deferredLogout = false;
  window.setTimeout(() => {
    if (signingInFlight) return;
    const provider = wcProvider || g.__pvWc || null;
    restoreClient(provider, clientOf(provider));
    if (rebindSession(provider)) return;
    try {
      if (provider?.isConnected?.()) return;
    } catch {
      /* keep going */
    }
    const keys = clientOf(provider)?.session?.keys ?? [];
    if (keys.length) return;
    // Deferred session_delete confirmed: drop kind and notify the app store.
    persistKind(null, null);
    persistTopic(null);
    logoutHandler?.();
  }, SIGN_HOLD_MS);
}

function providerHasClient(
  provider: WcHandle | null | undefined,
): provider is WcHandle & { walletConnector: WcClient } {
  return Boolean(provider && clientOf(provider));
}

async function getWc() {
  if (providerHasClient(wcProvider)) {
    restoreClient(wcProvider, clientOf(wcProvider));
    return wcProvider;
  }
  if (providerHasClient(g.__pvWc)) {
    restoreClient(g.__pvWc, clientOf(g.__pvWc));
    return g.__pvWc;
  }
  if (g.__pvWcInit) {
    try {
      const provider = await g.__pvWcInit;
      if (providerHasClient(provider)) {
        restoreClient(provider, clientOf(provider));
        return provider;
      }
    } catch {
      g.__pvWcInit = null;
    }
  }
  g.__pvWcInit = initWc();
  try {
    const provider = await g.__pvWcInit;
    if (!providerHasClient(provider)) {
      g.__pvWcInit = null;
      throw new Error("xPortal WalletConnect failed to start");
    }
    return provider;
  } catch (err) {
    g.__pvWcInit = null;
    throw err;
  }
}

function makeProvider(
  WalletConnectV2Provider: typeof import("@multiversx/sdk-wallet-connect-provider").WalletConnectV2Provider,
): WcHandle {
  const origin = originOf();
  return new WalletConnectV2Provider(
    wcCallbacks,
    CHAIN.id,
    WALLETCONNECT.relay,
    WALLETCONNECT.projectId,
    {
      projectId: WALLETCONNECT.projectId,
      name: WC_CORE_NAME,
      logger: "error",
      metadata: {
        name: APP_NAME,
        description: "Heart of ROAR · ROARHighSpeX on MultiversX",
        url: origin,
        icons: [`${origin}/heart-of-roar.jpg`],
      },
    },
  ) as unknown as WcHandle;
}

async function initWc() {
  const { WalletConnectV2Provider } = await import("@multiversx/sdk-wallet-connect-provider");

  if (providerHasClient(g.__pvWc)) {
    restoreClient(g.__pvWc, clientOf(g.__pvWc));
    return g.__pvWc;
  }

  const provider = g.__pvWc && !g.__pvWc.walletConnector ? g.__pvWc : makeProvider(WalletConnectV2Provider);

  if (!provider.walletConnector && g.__pvClient) {
    restoreClient(provider, g.__pvClient);
    return provider;
  }

  // SDK init() has `return isInitialized()` in finally, so a thrown SignClient.init
  // becomes `false` instead of an exception. Never treat that as success.
  let initError: unknown;
  try {
    await provider.init();
  } catch (err) {
    initError = err;
  }

  if (provider.walletConnector) {
    restoreClient(provider, provider.walletConnector);
    return provider;
  }
  if (g.__pvClient) {
    restoreClient(provider, g.__pvClient);
    return provider;
  }

  throw initError instanceof Error
    ? initError
    : new Error("xPortal WalletConnect failed to start");
}

async function dropSessionKeepClient(provider: WcHandle) {
  const client = clientOf(provider);
  const topic = provider.session?.topic;
  if (client && topic) {
    try {
      await provider.logout({ topic });
    } catch {
      /* stale session */
    }
  }
  restoreClient(provider, client);
  provider.session = undefined;
}

export async function restoreWallet(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  if (hasReactNativeWebView()) {
    try {
      await handshakeWebview();
      const pending = waitForPortal(["LOGIN_RESPONSE"], 8000);
      rnPost({ type: "LOGIN_REQUEST" });
      const res = await pending;
      const data = res.payload?.data as { address?: string } | undefined;
      if (data?.address) {
        persistKind("webview", data.address);
        return data.address;
      }
    } catch {
      /* fall through to WC */
    }
  }

  try {
    const provider = await getWc();
    restoreClient(provider, clientOf(provider));
    if (rebindSession(provider) || provider.isConnected()) {
      const address =
        provider.getAddress() || provider.getAccount()?.address || readPersistedAddress();
      if (address) {
        persistKind("wc", address);
        persistTopic(sessionTopicOf(provider));
        return address;
      }
    }
  } catch {
    /* no persisted WC session */
  }

  const persisted = readPersistedKind();
  const address = readPersistedAddress();
  if (persisted) persistKind(null, address);
  return null;
}

async function pairXportal(onUri: (uri: string) => void): Promise<string> {
  const provider = await getWc();
  restoreClient(provider, clientOf(provider));
  if (!provider.walletConnector) {
    throw new Error("xPortal WalletConnect failed to start");
  }

  await dropSessionKeepClient(provider);
  if (!provider.walletConnector) {
    restoreClient(provider, g.__pvClient);
  }
  if (!provider.walletConnector) {
    throw new Error("xPortal WalletConnect failed to start");
  }

  const client = provider.walletConnector;
  let uri = "";
  let approval: () => Promise<WcSession>;
  try {
    const response = await provider.connect();
    uri = response.uri ?? "";
    approval = response.approval as () => Promise<WcSession>;
  } catch {
    restoreClient(provider, client);
    try {
      const response = await provider.connect();
      uri = response.uri ?? "";
      approval = response.approval as () => Promise<WcSession>;
    } catch {
      restoreClient(provider, client);
      throw new Error("xPortal did not start a pairing");
    }
  }
  restoreClient(provider, client);
  if (!uri) throw new Error("xPortal did not start a pairing");

  lastPairingUri = uri;
  connectUri = uri;
  onUri(uri);

  // Do NOT call provider.login() — it sets isInitializing and the SDK's
  // session_delete handler then disconnect()s the SignClient (killing Connect).
  const session = await new Promise<WcSession>((resolve, reject) => {
    pairAbort = (reason) => reject(reason ?? new Error("Pairing cancelled"));
    approval().then(resolve, reject);
  }).finally(() => {
    pairAbort = null;
  });
  restoreClient(provider, client);
  if (!session) throw new Error("xPortal did not return an address");
  provider.session = session;
  const address = addressFromSession(session) || provider.getAccount()?.address;
  if (!address) throw new Error("xPortal did not return an address");
  provider.setAccount({ address, signature: provider.getAccount()?.signature || "" });
  // Keep topic for deep-links; defer kind/address persist until Zustand sync
  // (commitWalletSession) so Cancel / early session_delete cannot orphan a WC session.
  persistTopic(session.topic);
  deferredLogout = false;
  setReady({ kind: "wc", address });
  kind = "wc";
  return address;
}

export function prepareWalletConnect() {
  if (typeof window === "undefined") return;
  void getWc().catch(() => undefined);
}

export async function connectWalletConnect(onUri: (uri: string) => void): Promise<string> {
  if (connectLock) {
    if (connectUri) onUri(connectUri);
    return connectLock;
  }
  connectLock = (async () => {
    try {
      return await pairXportal(onUri);
    } finally {
      connectLock = null;
      connectUri = "";
    }
  })();
  return connectLock;
}

/** Abort an in-flight WC pairing (Connect dialog Cancel). No-op if already paired. */
export function abortWalletConnect() {
  const abort = pairAbort;
  if (!abort && !connectLock) return;
  pairAbort = null;
  connectLock = null;
  connectUri = "";
  lastPairingUri = "";
  if (abort) abort(new Error("Pairing cancelled"));
  const provider = wcProvider || g.__pvWc || null;
  // Only drop an unfinished pairing session — never a committed WC session.
  if (abort && provider && !provider.isConnected?.()) {
    void dropSessionKeepClient(provider).catch(() => undefined);
  }
}

/** Persist WC kind/address only after the app store has the live session. */
export function commitWalletSession(address: string, next: "wc" | "webview" = "wc") {
  persistKind(next, address);
  persistTopic(sessionTopicOf(wcProvider || g.__pvWc || null));
  deferredLogout = false;
}

export async function connectWebview(): Promise<string> {
  if (!hasReactNativeWebView()) throw new Error("Open PrideVault inside xPortal");
  await handshakeWebview();
  const pending = waitForPortal(["LOGIN_RESPONSE", "CANCEL_RESPONSE"], 120_000);
  rnPost({ type: "LOGIN_REQUEST" });
  const res = await pending;
  if (res.type === "CANCEL_RESPONSE") throw new Error("Login cancelled");
  const data = res.payload?.data as { address?: string } | undefined;
  const address = data?.address;
  if (!address) throw new Error("xPortal webview login failed");
  persistKind("webview", address);
  return address;
}

export async function disconnectWallet() {
  signingInFlight = false;
  deferredLogout = false;
  signHoldUntil = 0;
  connectLock = null;
  connectUri = "";
  try {
    if (kind === "webview") {
      try {
        rnPost({ type: "LOGOUT_REQUEST" });
      } catch {
        /* ignore */
      }
    }
    if (kind === "wc") {
      const provider = wcProvider || g.__pvWc;
      const client = clientOf(provider);
      try {
        const topic = provider?.session?.topic;
        if (topic) await provider?.logout({ topic });
        else await provider?.logout();
      } catch {
        /* ignore */
      }
      restoreClient(provider, client);
      if (provider) provider.session = undefined;
    }
  } catch {
    /* ignore */
  }
  persistKind(null, null);
  persistTopic(null);
  lastPairingUri = "";
}

function toWalletPlain(tx: UnsignedTx): IPlainTransactionObject {
  const plain: IPlainTransactionObject = {
    nonce: tx.nonce,
    value: String(tx.value ?? "0"),
    receiver: tx.receiver,
    sender: tx.sender,
    gasPrice: tx.gasPrice,
    gasLimit: tx.gasLimit,
    chainID: String(tx.chainID),
    version: tx.version ?? CHAIN.txVersion,
  };
  if (tx.data) plain.data = bytesToBase64(new TextEncoder().encode(tx.data));
  return plain;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type SignResponse = {
  signature?: string;
  guardianSignature?: string;
  guardian?: string;
  version?: number;
  options?: number;
};

function mergeSignature(plain: IPlainTransactionObject, response: unknown): IPlainTransactionObject {
  const data =
    typeof response === "string"
      ? { signature: response }
      : ((response ?? {}) as SignResponse);
  if (!data.signature) throw new Error("xPortal returned an unsigned transaction");
  const signed: IPlainTransactionObject = { ...plain, signature: data.signature };
  if (data.guardianSignature) signed.guardianSignature = data.guardianSignature;
  if (data.guardian) signed.guardian = data.guardian;
  if (data.options != null) signed.options = data.options;
  if (data.version) signed.version = data.version;
  return signed;
}

function signError(err: unknown): Error {
  if (err instanceof Error && err.message && !/transactionError|unableToSign|sessionNotConnected|process is not defined/i.test(err.message)) {
    return err;
  }
  const text = err instanceof Error ? err.message : String(err ?? "");
  if (/cancel|reject|denied/i.test(text)) return new Error("Signature cancelled in xPortal");
  if (/session/i.test(text)) return new Error("xPortal session expired. Reconnect and try again.");
  if (/process is not defined/i.test(text)) {
    return new Error("xPortal signature failed. Refresh PrideVault and reconnect.");
  }
  return new Error("xPortal signature failed. Open xPortal and try again.");
}

function openUrl(url: string) {
  try {
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (popup) return;
  } catch {
    /* fall through */
  }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Pairing deep-link — connect flow only. */
export function openXPortalToPair(uri: string) {
  if (typeof window === "undefined") return;
  lastPairingUri = uri;
  openUrl(xportalWcLink(uri));
}

/**
 * Wake xPortal for a pending signature using the live session topic.
 * Never reuse a pairing URI: xPortal would drop the WalletConnect session.
 * Never navigate this page (window.location) — that unloads the dApp.
 */
export function openXPortalForSign() {
  if (typeof window === "undefined") return;
  if (hasReactNativeWebView()) return;
  openUrl(xportalSignHref());
}

export function xportalSignHref() {
  const topic = sessionTopicOf(wcProvider || g.__pvWc || null);
  return topic ? xportalSignLink(topic) : xportalOpenLink();
}

export function pairingUri() {
  return lastPairingUri;
}

async function ensureReady(): Promise<WalletKind> {
  if (kind === "webview" && hasReactNativeWebView()) return "webview";

  try {
    const provider = await getWc();
    restoreClient(provider, clientOf(provider));
    if (provider.isConnected() || rebindSession(provider)) {
      const address =
        provider.getAddress() || provider.getAccount()?.address || readPersistedAddress();
      if (address) persistKind("wc", address);
      persistTopic(sessionTopicOf(provider));
      return "wc";
    }
  } catch {
    /* continue */
  }

  if (hasReactNativeWebView()) {
    persistKind("webview", ready.address || readPersistedAddress());
    return "webview";
  }

  throw new Error("Connect xPortal to sign");
}

async function signViaWebview(plains: IPlainTransactionObject[]): Promise<IPlainTransactionObject[]> {
  const pending = waitForPortal(["SIGN_TRANSACTIONS_RESPONSE", "CANCEL_RESPONSE"], 180_000);
  rnPost({
    type: "SIGN_TRANSACTIONS_REQUEST",
    payload: plains,
  });
  const res = await pending;
  if (res.type === "CANCEL_RESPONSE") throw new Error("Signature cancelled in xPortal");
  const signed = res.payload?.data;
  if (!Array.isArray(signed) || signed.length !== plains.length) {
    throw new Error("xPortal did not return signed transactions");
  }
  return signed as IPlainTransactionObject[];
}

async function signViaWc(plains: IPlainTransactionObject[]): Promise<IPlainTransactionObject[]> {
  const provider = await getWc();
  restoreClient(provider, clientOf(provider));
  if (!provider.isConnected() && !rebindSession(provider)) {
    throw new Error("xPortal session expired. Reconnect and try again.");
  }
  const client = clientOf(provider);
  const topic = sessionTopicOf(provider);
  if (!client?.request || !topic) {
    throw new Error("xPortal session expired. Reconnect and try again.");
  }
  persistTopic(topic);

  const wakeTimer = window.setTimeout(() => {
    if (isMobileBrowser()) openXPortalForSign();
  }, 40);

  const chainId = `mvx:${CHAIN.id}`;
  try {
    if (plains.length === 1) {
      const response = await client.request({
        chainId,
        topic,
        request: {
          method: "mvx_signTransaction",
          params: { transaction: plains[0] },
        },
      });
      return [mergeSignature(plains[0], response)];
    }
    const response = (await client.request({
      chainId,
      topic,
      request: {
        method: "mvx_signTransactions",
        params: { transactions: plains },
      },
    })) as { signatures?: unknown[] };
    const signatures = response?.signatures;
    if (!Array.isArray(signatures) || signatures.length !== plains.length) {
      throw new Error("xPortal did not return signed transactions");
    }
    return plains.map((plain, i) => mergeSignature(plain, signatures[i]));
  } finally {
    window.clearTimeout(wakeTimer);
    restoreClient(provider, client);
  }
}

export async function signPreparedTx(
  unsigned: UnsignedTx,
  ui?: { title: string; steps: string[] },
): Promise<IPlainTransactionObject> {
  const [signed] = await signPreparedTxs([unsigned], ui);
  return signed;
}

export async function signPreparedTxs(
  unsigneds: UnsignedTx[],
  ui?: { title: string; steps: string[] },
): Promise<IPlainTransactionObject[]> {
  if (unsigneds.length === 0) throw new Error("Nothing to sign");
  beginSign();
  try {
    const mode = await ensureReady();
    const walletAddr = ready.address || readPersistedAddress();
    for (const tx of unsigneds) {
      if (walletAddr && tx.sender && tx.sender !== walletAddr) {
        throw new Error("Wallet address mismatch — reconnect xPortal");
      }
    }
    setSignUi({
      title: ui?.title ?? "xPortal",
      steps: ui?.steps ?? unsigneds.map((tx) => tx.data.split("@")[0] || "tx"),
      mode,
    });
    const plains = unsigneds.map(toWalletPlain);
    const signed = mode === "webview" ? await signViaWebview(plains) : await signViaWc(plains);
    for (const tx of signed) {
      if (!tx.signature) throw new Error("xPortal returned an unsigned transaction");
    }
    return signed;
  } catch (err) {
    throw signError(err);
  } finally {
    endSign();
  }
}

export function walletKind() {
  return kind;
}

export function walletReady() {
  return ready;
}
