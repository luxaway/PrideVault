import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Check, Coins, Copy as CopyIcon, ExternalLink, ImagePlus, MessageCircle, Moon, MoreHorizontal, Pencil, Reply, Send, SmilePlus, Sun, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { RoarMark, HeartMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  CHAT_EDIT_MS,
  CHAT_MAX_BODY,
  CHAT_REACT_EMOJI,
  CHAT_REACTS,
  CHAT_SALE_ADDRESS,
  claimChatXFromSession,
  deletePrideChat,
  editPrideChat,
  getChatSnapshot,
  getXPost,
  joinPrideChat,
  pingPrideChat,
  postPrideChat,
  setChatNick,
  setChatXHandle,
  toggleChatReaction,
  type ChatMessage,
  type ChatName,
  type ChatReactKind,
  type ChatReaction,
  type ChatReply,
} from "@/lib/chat.functions";
import { COLLECTION, DEMO_ADDRESS, explorerAddrUrl, explorerTxUrl, LINKS, ooxBuyUrl } from "@/lib/config";
import type { Copy } from "@/lib/i18n";
import { getChatHolder } from "@/lib/mx.functions";
import type { Session } from "@/lib/store";
import { cn, fillAmt, formatEgld, formatEgldAmount, formatNum, formatRoarClaim, isErdAddress, shortAddr } from "@/lib/utils";

const TOKEN_KEY = "pv.chatToken";
const THEME_KEY = "pv.chatTheme";
const X_LINK_KEY = "pv.chatLinkX";
const X_STATUS_RE =
  /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/(?:[A-Za-z0-9_]+|i\/web)\/status(?:es)?\/(\d{1,25})(?:[?#]\S*)?/gi;

function extractXPosts(text: string) {
  const posts: { id: string; url: string }[] = [];
  const seen = new Set<string>();
  const stripped = text
    .replace(X_STATUS_RE, (_full, id: string) => {
      if (!seen.has(id) && posts.length < 2) {
        seen.add(id);
        posts.push({ id, url: `https://x.com/i/status/${id}` });
      }
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { text: stripped, posts };
}

function readTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function writeTheme(theme: "dark" | "light") {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

function tokenKey(address: string) {
  return `${TOKEN_KEY}.${address}`;
}

function readToken(address: string) {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(tokenKey(address)) ?? "";
  } catch {
    return "";
  }
}

function writeToken(address: string, token: string) {
  try {
    sessionStorage.setItem(tokenKey(address), token);
  } catch {
    /* private mode */
  }
}

function clearToken(address: string) {
  try {
    sessionStorage.removeItem(tokenKey(address));
  } catch {
    /* ignore */
  }
}

function fmtTime(at: number) {
  if (!at) return "";
  return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(at: number) {
  const d = new Date(at);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function displayName(
  addr: string,
  names: Record<string, ChatName> | undefined,
  t: Copy,
  mine: boolean,
) {
  if (addr === CHAT_SALE_ADDRESS) return t.chatSaleOn;
  const name = names?.[addr];
  if (name?.herotag) return `@${name.herotag}`;
  if (name?.nick) return name.nick;
  if (mine) return t.chatYou;
  return shortAddr(addr, 4, 4);
}

function isHerotag(addr: string, names: Record<string, ChatName> | undefined) {
  return Boolean(names?.[addr]?.herotag);
}

function mentionName(addr: string, names: Record<string, ChatName> | undefined) {
  const name = names?.[addr];
  if (name?.herotag) return `@${name.herotag}`;
  if (name?.nick) return `@${name.nick}`;
  if (name?.xHandle) return `@${name.xHandle}`;
  return "";
}

function xHandleOf(addr: string, names: Record<string, ChatName> | undefined) {
  const handle = names?.[addr]?.xHandle;
  return handle ? `@${handle}` : "";
}

function canRevise(row: ChatMessage, address: string, now = Date.now()) {
  if (!address || row.address !== address || row.sale) return false;
  return now - row.at <= CHAT_EDIT_MS;
}

function packReply(row: ChatMessage) {
  const preview = (
    row.body ||
    (row.sale ? `${row.sale.qty} Heart · ${row.sale.egld} EGLD` : "") ||
    (row.tip ? `${row.tip.amount} ROAR` : "")
  )
    .replace(/[|\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${row.id}|${row.address}|${preview}`;
}

function replyPreview(reply: ChatReply, messages: ChatMessage[], t: Copy) {
  if (reply.preview) return reply.preview;
  const origin = messages.find((row) => row.id === reply.id);
  if (origin?.body) return origin.body;
  if (origin?.sale) return `${origin.sale.qty} Heart · ${origin.sale.egld} EGLD`;
  if (origin?.tip) return `${formatNum(origin.tip.amount, 2)} ROAR`;
  if (origin?.image || !origin) return t.chatPhoto;
  return "";
}

function saleHref(sale: NonNullable<ChatMessage["sale"]>) {
  return sale.auctionId > 0 ? ooxBuyUrl(sale.auctionId) : LINKS.ooxCollection;
}

function MessageBody({
  text,
  className,
  onEmber,
}: {
  text: string;
  className?: string;
  onEmber?: boolean;
}) {
  const parts = text.split(/(@[a-zA-Z0-9._-]{1,32})/g);
  return (
    <p className={cn("max-w-full [overflow-wrap:anywhere]", className)}>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span
            key={i}
            className={
              onEmber
                ? "font-medium underline decoration-primary-foreground/60 underline-offset-2"
                : "font-medium text-volt"
            }
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

function chatErr(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();
  if (lower.includes("taken")) return "taken";
  if (lower === "unauthorized") return "oauth-need";
  if (lower.includes("pop-up") || lower.includes("popup") || lower.includes("cancelled") || lower.includes("canceled")) {
    return "oauth";
  }
  if (lower === "bio") return "bio";
  if (lower === "missing") return "missing";
  if (lower === "mismatch" || lower.includes("mismatch")) return "mismatch";
  if (lower === "late" || lower.includes("too late")) return "late";
  if (lower.includes("bad-name") || lower.includes("bad name")) return "bad-name";
  if (lower.includes("slow")) return "slow";
  if (lower.includes("expired") || lower.includes("invalid session") || lower.includes("invalid")) {
    return "expired";
  }
  return raw || "error";
}

function initialsOf(addr: string, names: Record<string, ChatName> | undefined, t: Copy, mine: boolean) {
  const label = displayName(addr, names, t, mine);
  const chars = label.replace(/[^a-z0-9]/gi, "");
  return (chars.slice(0, 2) || "PV").toUpperCase();
}

function toneOf(address: string): "volt" | "ember" {
  let n = 0;
  for (let i = 0; i < address.length; i++) n = (n + address.charCodeAt(i) * (i + 1)) % 2;
  return n ? "volt" : "ember";
}

function safeImageSrc(src: string | null | undefined) {
  if (!src) return "";
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(src)) return "";
  if (src.length > 160_000) return "";
  return src;
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/") || /svg|xml|html/i.test(file.type)) {
    throw new Error("bad");
  }
  const bitmap = await createImageBitmap(file);
  const max = 720;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("bad");
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let quality = 0.72;
  let url = canvas.toDataURL("image/jpeg", quality);
  while (url.length > 90_000 && quality > 0.38) {
    quality -= 0.12;
    url = canvas.toDataURL("image/jpeg", quality);
  }
  if (url.length > 118_000) throw new Error("heavy");
  return url;
}

function SaleCard({
  row,
  t,
  names,
  address,
}: {
  row: ChatMessage;
  t: Copy;
  names: Record<string, ChatName>;
  address: string;
}) {
  const sale = row.sale;
  if (!sale) return null;
  const buyerMine = Boolean(address && sale.buyer === address);
  return (
    <article className="w-full overflow-hidden rounded-xl bg-surface-2 shadow-[var(--shadow-border-hover)]">
      <div className="dual-bar h-0.5 w-full" />
      <div className="flex items-start gap-3 p-3">
        <img
          src="/nfts/heart-thumb.jpg"
          alt=""
          className="size-14 shrink-0 rounded-lg object-cover outline outline-1 -outline-offset-1 outline-fg/15"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm leading-none tracking-wide">{t.chatSale}</p>
          <p className="mt-1.5 text-base font-medium text-chat-in-fg">
            {formatNum(sale.qty, 0)} Heart · {formatEgld(sale.egld, 2)}
          </p>
          {sale.qty > 1 ? (
            <p className="mt-0.5 text-xs text-chat-meta">
              {formatEgld(sale.egld / sale.qty, 2)} / Heart
            </p>
          ) : null}
          <p className="mt-1.5 truncate text-xs text-chat-meta">
            {t.chatSaleBuyer}{" "}
            <span
              className={
                isHerotag(sale.buyer, names) ? "font-medium text-volt" : "font-medium text-ember"
              }
            >
              {displayName(sale.buyer, names, t, buyerMine)}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={saleHref(sale)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ember/20 px-3 text-xs font-medium text-ember hover:bg-ember/30"
            >
              {t.chatSaleOpen}
              <ExternalLink className="size-3.5" />
            </a>
            <a
              href={explorerTxUrl(sale.hash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-volt hover:bg-chat-in"
            >
              {t.chatSaleTx}
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function HolderStat({
  label,
  icon,
  hold,
  stake,
  unlocking,
  pending,
  digits,
  t,
}: {
  label: string;
  icon: ReactNode;
  hold: number;
  stake: number;
  unlocking?: number;
  pending?: number;
  digits: number;
  t: Copy;
}) {
  const total = hold + stake;
  return (
    <div className="rounded-lg bg-chat-in p-3 text-chat-in-fg">
      <p className="flex items-center gap-2 font-display text-sm tracking-wide">
        {icon}
        {label}
      </p>
      <div className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-chat-meta">{t.chatHolderHold}</span>
          <span className="tabular font-medium">{formatNum(hold, digits)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-chat-meta">{t.chatHolderStake}</span>
          <span className="tabular font-medium">{formatNum(stake, digits)}</span>
        </div>
        {unlocking && unlocking > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-chat-meta">{t.chatHolderUnlock}</span>
            <span className="tabular">{formatNum(unlocking, digits)}</span>
          </div>
        ) : null}
        {pending && pending > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-chat-meta">{t.chatHolderPending}</span>
            <span className="tabular text-volt">{formatRoarClaim(pending)} ROAR</span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3 border-t border-fg/10 pt-1.5">
          <span className="font-medium">{t.chatHolderTotal}</span>
          <span className="tabular font-medium">{formatNum(total, digits)}</span>
        </div>
      </div>
    </div>
  );
}

function HolderPopup({
  address,
  names,
  t,
  mine,
  onClose,
}: {
  address: string;
  names: Record<string, ChatName>;
  t: Copy;
  mine: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const query = useQuery({
    queryKey: ["chat-holder", address],
    queryFn: () => getChatHolder({ data: { address } }),
    enabled: isErdAddress(address),
    staleTime: 60_000,
    retry: 1,
  });
  const data = query.data;
  const tone = toneOf(address);
  const x = xHandleOf(address, names);
  const handle = names[address]?.xHandle || "";
  const title = displayName(address, names, t, mine);
  const herotag = names[address]?.herotag || data?.herotag || "";

  function copyAddr() {
    void navigator.clipboard.writeText(address).then(
      () => {
        setCopied(true);
        toast.success(t.copied);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => undefined,
    );
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.chatHolder}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-xl bg-surface shadow-[var(--shadow-border-hover)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dual-bar h-0.5 w-full" />
        <div className="flex items-start gap-3 p-4">
          {mine ? (
            <RoarMark className="size-12 shrink-0" />
          ) : (
            <span
              className={cn(
                "inline-flex size-12 shrink-0 items-center justify-center rounded-lg font-display text-base",
                tone === "volt" ? "bg-volt/25 text-volt" : "bg-ember/25 text-ember",
              )}
            >
              {initialsOf(address, names, t, mine)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base leading-tight tracking-wide">{title}</p>
            {herotag && title !== `@${herotag}` ? (
              <p className="mt-0.5 truncate text-xs font-medium text-volt">@{herotag}</p>
            ) : null}
            {x ? (
              <a
                href={`https://x.com/${encodeURIComponent(handle)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-sm font-medium text-volt"
              >
                {x}
                <BadgeCheck className="size-3.5" />
              </a>
            ) : (
              <p className="mt-0.5 text-xs text-chat-meta">{t.chatHolderXNone}</p>
            )}
            <p className="mt-1 truncate font-mono text-xs text-chat-meta">{shortAddr(address, 8, 6)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-chat-meta hover:bg-chat-in hover:text-fg"
            aria-label={t.close}
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2 px-4 pb-3">
          {query.isPending ? (
            <>
              <div className="h-28 animate-pulse rounded-lg bg-chat-in" />
              <div className="h-28 animate-pulse rounded-lg bg-chat-in" />
            </>
          ) : query.isError || !data ? (
            <p className="rounded-lg bg-chat-in px-3 py-6 text-center text-sm text-chat-meta">
              {t.chatHolderFail}
            </p>
          ) : (
            <>
              <HolderStat
                label={t.chatRoar}
                icon={
                  <img
                    src="/nfts/roar-token.png"
                    alt=""
                    className="size-5 rounded-full object-cover"
                  />
                }
                hold={data.roar}
                stake={data.roarStaked}
                unlocking={data.roarUnlocking}
                pending={data.roarPending}
                digits={2}
                t={t}
              />
              <HolderStat
                label={COLLECTION.name}
                icon={<HeartMark className="size-5" />}
                hold={data.hearts}
                stake={data.heartsStaked}
                pending={data.heartPending}
                digits={0}
                t={t}
              />
              <div className="flex items-center justify-between gap-3 rounded-lg bg-chat-in px-3 py-2 text-sm text-chat-in-fg">
                <span className="text-chat-meta">{t.chatHolderEgld}</span>
                <span className="tabular font-medium">{formatEgldAmount(data.egld, 4)}</span>
              </div>
              {data.txCount > 0 ? (
                <p className="px-1 text-xs text-chat-meta">
                  {fillAmt(t.chatHolderTxs, formatNum(data.txCount, 0))}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={copyAddr}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-chat-in px-3 text-xs font-medium text-chat-in-fg hover:bg-surface-2"
          >
            {copied ? <Check className="size-3.5 text-volt" /> : <CopyIcon className="size-3.5" />}
            {t.chatHolderCopy}
          </button>
          <a
            href={explorerAddrUrl(address)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium text-volt hover:bg-chat-in"
          >
            {t.chatHolderExplorer}
            <ExternalLink className="size-3.5" />
          </a>
          {handle ? (
            <a
              href={`https://x.com/${encodeURIComponent(handle)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-ember/20 px-3 text-xs font-medium text-ember hover:bg-ember/30"
            >
              {t.chatXOpen}
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </div>
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

function XPostBox({ url, t }: { url: string; t: Copy }) {
  const query = useQuery({
    queryKey: ["x-post", url],
    queryFn: () => getXPost({ data: { url } }),
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const post = query.data;
  const id = post?.id || /status(?:es)?\/(\d+)/i.exec(url)?.[1] || "";
  const href = post?.handle && id
    ? `https://x.com/${encodeURIComponent(post.handle)}/status/${id}`
    : id
      ? `https://x.com/i/status/${id}`
      : url.startsWith("http")
        ? url
        : `https://x.com/i/status/${id}`;

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-xl bg-surface-2 text-fg shadow-[var(--shadow-border-hover)]">
      <div className="flex w-full min-w-0 items-start gap-2.5 p-3">
        {post?.avatar ? (
          <img
            src={post.avatar}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-chat-in text-fg">
            <XMark className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{post?.name || t.chatXPost}</span>
            <XMark className="size-3.5 shrink-0 text-chat-meta" />
          </p>
          {post?.handle ? (
            <p className="truncate text-xs text-volt">@{post.handle}</p>
          ) : (
            <p className="truncate text-xs text-chat-meta">{t.chatXStay}</p>
          )}
          {post?.text ? (
            <p className="mt-1.5 text-sm leading-relaxed [overflow-wrap:anywhere]">{post.text}</p>
          ) : query.isPending ? (
            <p className="mt-1.5 text-sm text-chat-meta">{t.chatLoading}</p>
          ) : null}
        </div>
      </div>
      {post?.image ? (
        <div className="w-full px-3 pb-2">
          <img
            src={post.image}
            alt=""
            className="max-h-48 w-full max-w-full rounded-lg object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : null}
      <div className="px-3 pb-3">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 min-w-11 items-center gap-1.5 rounded-full bg-ember/20 px-4 text-sm font-medium text-ember hover:bg-ember/30"
        >
          {t.chatXOpen}
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </article>
  );
}

function keepChatRow(row: ChatMessage, saleSince: number) {
  if (!row.sale) return true;
  return saleSince <= 0 || row.at >= saleSince;
}

export function PrideChat({
  t,
  session,
  onConnect,
  onSendRoar,
}: {
  t: Copy;
  session: Session | null;
  onConnect: () => void;
  onSendRoar: (to: string, amount: number) => Promise<string | null>;
}) {
  const [view, setView] = useState<"off" | "full" | "dock">("off");
  const [chatTheme, setChatTheme] = useState<"dark" | "light">("dark");
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [token, setToken] = useState("");
  const [unread, setUnread] = useState(0);
  const lastRead = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const queryClient = useQueryClient();
  const address = session?.address ?? "";
  const connected = Boolean(session);
  const { user: authUserRaw, isPending: authPending } = useCurrentUserState();
  const authUser = authUserRaw && !authUserRaw.isDevFallback ? authUserRaw : null;
  const signedIn = Boolean(authUser);
  const claimOnce = useRef("");

  useEffect(() => {
    if (!address) {
      setToken("");
      return;
    }
    setToken(readToken(address));
  }, [address]);

  const join = useMutation({
    mutationFn: () =>
      joinPrideChat({
        data: { address, mode: session?.mode ?? "live" },
      }),
    onSuccess: (data) => {
      writeToken(address, data.token);
      setToken(data.token);
    },
  });

  useEffect(() => {
    if (view === "off" || !address) return;
    let cancelled = false;
    const existing = readToken(address);
    void (async () => {
      if (existing) {
        try {
          await pingPrideChat({ data: { address, token: existing } });
          if (!cancelled) setToken(existing);
          return;
        } catch {
          clearToken(address);
        }
      }
      try {
        const data = await joinPrideChat({
          data: { address, mode: session?.mode ?? "live" },
        });
        if (cancelled) return;
        writeToken(address, data.token);
        setToken(data.token);
        if (data.me) {
          queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) =>
            prev ? { ...prev, me: data.me, names: { ...prev.names, [address]: data.me } } : prev,
          );
        }
      } catch {
        if (!cancelled) toast.error(t.chatError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, address, session?.mode, t.chatError]);

  const snapshot = useQuery({
    queryKey: ["pride-chat"],
    queryFn: async () => {
      const prev = queryClient.getQueryData<{
        messages: ChatMessage[];
        names: Record<string, ChatName>;
        reactions: Record<string, ChatReaction[]>;
        me: ChatName | null;
        online: number;
        fetchedAt: number;
        saleSince: number;
        gone: number[];
        edited: ChatMessage[];
      }>(["pride-chat"]);
      const afterId = prev?.messages.at(-1)?.id ?? 0;
      const snap = await getChatSnapshot({ data: { afterId, viewer: address } });
      const saleSince = snap.saleSince ?? prev?.saleSince ?? 0;
      const gone = new Set([...(prev?.gone ?? []), ...(snap.gone ?? [])]);
      const edited = new Map<number, ChatMessage>();
      for (const row of [...(prev?.edited ?? []), ...(snap.edited ?? [])]) edited.set(row.id, row);
      const apply = (list: ChatMessage[]) =>
        list
          .filter((row) => !gone.has(row.id) && keepChatRow(row, saleSince))
          .map((row) => edited.get(row.id) ?? row);
      if (!prev || afterId <= 0) {
        return {
          ...snap,
          messages: apply(snap.messages),
          gone: [...gone],
          edited: [...edited.values()],
        };
      }
      const seen = new Set(prev.messages.map((row) => row.id));
      const extra = snap.messages.filter((row) => !seen.has(row.id));
      const snapMe = snap.me;
      const keepMe = Boolean(prev.me?.herotag || prev.me?.nick || prev.me?.xHandle || prev.me?.xPending);
      const freshMe = Boolean(snapMe?.herotag || snapMe?.nick || snapMe?.xHandle || snapMe?.xPending);
      return {
        messages: apply([...prev.messages, ...extra]).slice(-80),
        names: { ...prev.names, ...snap.names },
        reactions: { ...prev.reactions, ...snap.reactions },
        me: freshMe ? snapMe : keepMe ? prev.me : (snapMe ?? prev.me),
        online: snap.online,
        fetchedAt: snap.fetchedAt,
        saleSince,
        gone: [...gone].slice(-80),
        edited: [...edited.values()].slice(-40),
      };
    },
    staleTime: 1_500,
    refetchInterval: view === "full" ? 2_000 : view === "dock" ? 4_000 : 8_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!token || !address || view === "off") return;
    const beat = () => {
      void pingPrideChat({ data: { address, token } }).catch(() => {
        clearToken(address);
        setToken("");
      });
    };
    beat();
    const id = window.setInterval(beat, 12_000);
    return () => window.clearInterval(id);
  }, [token, address, view]);

  const messages = snapshot.data?.messages ?? [];
  const names = snapshot.data?.names ?? {};
  const reactions = snapshot.data?.reactions ?? {};
  const me = snapshot.data?.me ?? null;
  const online = snapshot.data?.online ?? 0;

  useEffect(() => {
    const last = messages.at(-1);
    if (!last) return;
    if (view === "full") {
      lastRead.current = last.id;
      setUnread(0);
      return;
    }
    if (last.id <= lastRead.current) return;
    const extra = messages.filter((row) => row.id > lastRead.current && row.address !== address).length;
    setUnread(extra);
  }, [messages, view, address]);

  useEffect(() => {
    if (view !== "full") return;
    const el = scroller.current;
    if (!el) return;
    const id = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(id);
  }, [view]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !stick.current || view !== "full") return;
    const id = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(id);
  }, [messages.length, view]);

  useEffect(() => {
    if (view !== "full") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView("dock");
    };
    window.addEventListener("keydown", onKey);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 220);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
    };
  }, [view]);

  useEffect(() => {
    setChatTheme(readTheme());
  }, []);

  useEffect(() => {
    setReplyTo(null);
  }, [address]);

  const send = useMutation({
    mutationFn: (payload: { body: string; image: string | null; tip?: string; reply?: string }) =>
      postPrideChat({
        data: {
          address,
          token: token || readToken(address),
          body: payload.body,
          image: payload.image ?? undefined,
          tip: payload.tip,
          reply: payload.reply,
          mode: session?.mode ?? "live",
        },
      }),
    onSuccess: (data) => {
      setDraft("");
      setPhoto("");
      setReplyTo(null);
      queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
        if (!prev) {
          return {
            messages: [data.message],
            names: {},
            reactions: {},
            me: null,
            online: data.online,
            fetchedAt: Date.now(),
            saleSince: 0,
            gone: [],
            edited: [],
          };
        }
        if (prev.messages.some((row) => row.id === data.message.id)) {
          return { ...prev, online: data.online };
        }
        return { ...prev, messages: [...prev.messages, data.message], online: data.online };
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "slow") toast.error(t.chatSlow);
      else if (msg.toLowerCase().includes("expired")) {
        clearToken(address);
        setToken("");
        toast.error(t.chatError);
      } else toast.error(t.chatError);
    },
  });

  function submit() {
    if (!connected) {
      onConnect();
      return;
    }
    const body = draft.trim();
    const image = photo || null;
    if ((!body && !image) || send.isPending) return;
    const payload = { body, image, reply: replyTo ? packReply(replyTo) : undefined };
    if (!token) {
      join.mutate(undefined, {
        onSuccess: () => send.mutate(payload),
      });
      return;
    }
    send.mutate(payload);
  }

  async function sendRoar(to: string, amount: number) {
    if (!connected) {
      onConnect();
      return false;
    }
    if ((!isErdAddress(to) && to !== DEMO_ADDRESS) || to === address) {
      toast.error(t.walletSendSame);
      return false;
    }
    if (to === DEMO_ADDRESS) {
      const packed = `${amount}|${to}|demo`;
      const payload = { body: "", image: null as string | null, tip: packed };
      if (!token) join.mutate(undefined, { onSuccess: () => send.mutate(payload) });
      else send.mutate(payload);
      toast.success(`${t.walletSendOk} · ${formatNum(amount, 2)} ROAR`);
      return true;
    }
    const rawHash = await onSendRoar(to, amount);
    if (!rawHash) return false;
    const hash = String(rawHash).replace(/^0x/i, "").toLowerCase();
    const packed = `${amount}|${to}|${hash}`;
    const payload = { body: "", image: null as string | null, tip: packed };
    if (!token) {
      join.mutate(undefined, { onSuccess: () => send.mutate(payload) });
      return true;
    }
    send.mutate(payload);
    return true;
  }

  const react = useMutation({
    mutationFn: async (payload: { messageId: number; kind: ChatReactKind }) => {
      const attempt = (tok: string) =>
        toggleChatReaction({
          data: { address, token: tok, messageId: payload.messageId, kind: payload.kind },
        });
      const rejoin = async () => {
        const joined = await joinPrideChat({
          data: { address, mode: session?.mode ?? "live" },
        });
        writeToken(address, joined.token);
        setToken(joined.token);
        return joined.token;
      };
      let tok = token || readToken(address);
      if (!tok) tok = await rejoin();
      try {
        return await attempt(tok);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "slow") throw err;
        tok = await rejoin();
        return await attempt(tok);
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
        if (!prev) return prev;
        return {
          ...prev,
          reactions: { ...prev.reactions, [String(data.messageId)]: data.reactions },
        };
      });
    },
  });

  const saveNick = useMutation({
    mutationFn: async (nick: string) => {
      const cleaned = nick.trim();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleaned)) throw new Error("bad-name");
      const attempt = (tok: string) => setChatNick({ data: { address, token: tok, nick: cleaned } });
      const rejoin = async () => {
        const joined = await joinPrideChat({
          data: { address, mode: session?.mode ?? "live" },
        });
        writeToken(address, joined.token);
        setToken(joined.token);
        return joined.token;
      };
      let tok = token || readToken(address);
      if (tok) {
        try {
          await pingPrideChat({ data: { address, token: tok } });
        } catch {
          tok = "";
        }
      }
      if (!tok) tok = await rejoin();
      try {
        return await attempt(tok);
      } catch (err) {
        const code = chatErr(err);
        if (code === "taken" || code === "bad-name" || code === "slow") throw err;
        tok = await rejoin();
        return await attempt(tok);
      }
    },
    onSuccess: (data) => {
      toast.success(t.chatNameOk);
      queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
        if (!prev) return prev;
        return {
          ...prev,
          me: data,
          names: { ...prev.names, [address]: data },
        };
      });
    },
    onError: (err) => {
      const code = chatErr(err);
      if (code === "taken") toast.error(t.chatNameTaken);
      else if (code === "slow") toast.error(t.chatSlow);
      else if (code === "bad-name") toast.error(t.chatNameNeed);
      else if (code === "expired") {
        clearToken(address);
        setToken("");
        toast.error(t.chatError);
      } else toast.error(t.chatError);
    },
  });

  async function withSession<T>(run: (tok: string) => Promise<T>) {
    const rejoin = async () => {
      const joined = await joinPrideChat({
        data: { address, mode: session?.mode ?? "live" },
      });
      writeToken(address, joined.token);
      setToken(joined.token);
      return joined.token;
    };
    let tok = token || readToken(address);
    if (tok) {
      try {
        await pingPrideChat({ data: { address, token: tok } });
      } catch {
        tok = "";
      }
    }
    if (!tok) tok = await rejoin();
    try {
      return await run(tok);
    } catch (err) {
      const code = chatErr(err);
      if (code === "taken" || code === "bad-name" || code === "slow" || code === "missing" || code === "late" || code === "bio" || code === "oauth" || code === "oauth-need") {
        throw err;
      }
      tok = await rejoin();
      return await run(tok);
    }
  }

  const saveX = useMutation({
    mutationFn: (payload: { step: "begin" | "verify" | "unlink"; handle?: string }) =>
      withSession((tok) =>
        setChatXHandle({
          data: { address, token: tok, handle: payload.handle, step: payload.step },
        }),
      ),
    onSuccess: (data, payload) => {
      if (payload.step === "unlink") toast.success(t.chatXUnlinked);
      else if (payload.step === "verify" || data.xHandle) toast.success(t.chatXOk);
      queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
        if (!prev) return prev;
        return {
          ...prev,
          me: data,
          names: { ...prev.names, [address]: data },
        };
      });
    },
    onError: (err) => {
      const code = chatErr(err);
      if (code === "taken") toast.error(t.chatXTaken);
      else if (code === "missing") toast.error(t.chatXMissing);
      else if (code === "bad-name") toast.error(t.chatXNeed);
      else if (code === "bio") toast.error(t.chatXBioFail);
      else if (code === "slow") toast.error(t.chatSlow);
      else if (code === "expired") {
        clearToken(address);
        setToken("");
        toast.error(t.chatError);
      } else toast.error(t.chatError);
    },
  });

  const [xBusy, setXBusy] = useState(false);

  function writeXLinkPending(addr: string) {
    try {
      sessionStorage.setItem(X_LINK_KEY, addr);
    } catch {
      /* ignore */
    }
  }
  function takeXLinkPending() {
    try {
      const value = sessionStorage.getItem(X_LINK_KEY);
      if (value) sessionStorage.removeItem(X_LINK_KEY);
      return value;
    } catch {
      return null;
    }
  }

  function applyXName(name: ChatName) {
    queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
      if (!prev) return prev;
      return {
        ...prev,
        me: name,
        names: { ...prev.names, [address]: name },
      };
    });
  }

  async function claimLinkedX(quiet = false, handle = "") {
    const result = await withSession((tok) =>
      claimChatXFromSession({ data: { address, token: tok, handle } }),
    );
    if (result.needOauth) {
      if (quiet) return result.me;
      throw new Error("Unauthorized");
    }
    if (result.needHandle) {
      applyXName(result.me);
      return result.me;
    }
    applyXName(result.me);
    if (result.me.xHandle && (!quiet || result.me.xHandle.toLowerCase() !== (me?.xHandle ?? "").toLowerCase())) {
      toast.success(t.chatXOk);
    }
    return result.me;
  }

  async function connectX() {
    if (!connected) {
      onConnect();
      return;
    }
    if (xBusy) return;
    setXBusy(true);
    writeXLinkPending(address);
    try {
      if (!authUser) {
        await signIn("grok-x", { callbackURL: "/" });
      }
      takeXLinkPending();
      await claimLinkedX();
    } catch (err) {
      takeXLinkPending();
      const code = chatErr(err);
      if (code === "oauth" || code === "oauth-need") toast.error(t.chatXOauthFail);
      else if (code === "taken") toast.error(t.chatXTaken);
      else if (code === "missing") toast.error(t.chatXMissing);
      else if (code === "mismatch") toast.error(t.chatXMismatch);
      else if (code === "expired") {
        clearToken(address);
        setToken("");
        toast.error(t.chatError);
      } else toast.error(t.chatError);
    } finally {
      setXBusy(false);
    }
  }

  useEffect(() => {
    if (!connected || !address || !token || xBusy || authPending || !authUser) return;
    const key = `${address}:${authUser.id}`;
    if (claimOnce.current === key) return;
    claimOnce.current = key;
    void claimLinkedX(true).catch(() => {
      claimOnce.current = "";
    });
  }, [connected, address, token, xBusy, authPending, authUser?.id]);

  useEffect(() => {
    if (!connected || !address || !token || xBusy) return;
    let pending = "";
    try {
      pending = sessionStorage.getItem(X_LINK_KEY) ?? "";
    } catch {
      pending = "";
    }
    if (pending !== address) return;
    setXBusy(true);
    void claimLinkedX()
      .catch((err) => {
        const code = chatErr(err);
        if (code === "oauth" || code === "oauth-need") toast.error(t.chatXOauthFail);
        else if (code === "taken") toast.error(t.chatXTaken);
        else if (code === "missing") toast.error(t.chatXMissing);
        else if (code === "mismatch") toast.error(t.chatXMismatch);
        else toast.error(t.chatError);
      })
      .finally(() => {
        takeXLinkPending();
        setXBusy(false);
      });
  }, [connected, address, token, xBusy]);

  const editMsg = useMutation({
    mutationFn: (payload: { id: number; body: string }) =>
      withSession((tok) => editPrideChat({ data: { address, token: tok, id: payload.id, body: payload.body } })),
    onSuccess: (data) => {
      toast.success(t.chatEditOk);
      queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((row) => (row.id === data.message.id ? data.message : row)),
          edited: [...(prev.edited ?? []).filter((row) => row.id !== data.message.id), data.message],
        };
      });
    },
    onError: (err) => {
      const code = chatErr(err);
      if (code === "late") toast.error(t.chatEditTooLate);
      else if (code === "slow") toast.error(t.chatSlow);
      else if (code === "expired") {
        clearToken(address);
        setToken("");
        toast.error(t.chatError);
      } else toast.error(t.chatError);
    },
  });

  const dropMsg = useMutation({
    mutationFn: (id: number) =>
      withSession((tok) => deletePrideChat({ data: { address, token: tok, id } })),
    onSuccess: (data) => {
      toast.success(t.chatDeleteOk);
      queryClient.setQueryData(["pride-chat"], (prev: typeof snapshot.data) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.filter((row) => row.id !== data.id),
          gone: [...(prev.gone ?? []), data.id],
        };
      });
    },
    onError: (err) => {
      const code = chatErr(err);
      if (code === "late") toast.error(t.chatEditTooLate);
      else if (code === "slow") toast.error(t.chatSlow);
      else if (code === "expired") {
        clearToken(address);
        setToken("");
        toast.error(t.chatError);
      } else toast.error(t.chatError);
    },
  });

  const onlineLabel = useMemo(
    () => fillAmt(t.chatOnline, String(online)),
    [t.chatOnline, online],
  );

  const screen =
    view !== "off" && typeof document !== "undefined"
      ? createPortal(
          <>
            {view === "full" ? (
              <ChatScreen
                t={t}
                address={address}
                connected={connected}
                draft={draft}
                setDraft={setDraft}
                photo={photo}
                setPhoto={setPhoto}
                messages={messages}
                online={online}
                onlineLabel={onlineLabel}
                pending={snapshot.isPending && messages.length === 0}
                error={snapshot.isError && messages.length === 0}
                sending={send.isPending}
                scroller={scroller}
                stick={stick}
                inputRef={inputRef}
                onHide={() => setView("dock")}
                onConnect={onConnect}
                onSubmit={submit}
                onSendRoar={sendRoar}
                roarWallet={session?.roarWallet ?? 0}
                names={names}
                reactions={reactions}
                me={me}
                signedIn={signedIn}
                namingPending={saveNick.isPending}
                linkingPending={saveX.isPending || xBusy}
                replyTo={replyTo}
                onReply={(row) => {
                  if (!connected) {
                    onConnect();
                    return;
                  }
                  setReplyTo(row);
                  const tag = mentionName(
                    row.sale?.buyer && row.sale.buyer !== CHAT_SALE_ADDRESS
                      ? row.sale.buyer
                      : row.address === CHAT_SALE_ADDRESS
                        ? ""
                        : row.address,
                    { ...names, ...(me ? { [address]: me } : {}) },
                  );
                  if (tag) {
                    setDraft((d) => (d.includes(tag) ? d : `${tag} ${d}`.trimStart()));
                  }
                  window.setTimeout(() => inputRef.current?.focus(), 40);
                }}
                onClearReply={() => setReplyTo(null)}
                onReact={(messageId, kind) => {
                  if (!connected) {
                    onConnect();
                    return;
                  }
                  if (!token) {
                    join.mutate(undefined, {
                      onSuccess: () => react.mutate({ messageId, kind }),
                    });
                    return;
                  }
                  react.mutate({ messageId, kind });
                }}
                onSaveNick={(nick) => {
                  if (!token) {
                    join.mutate(undefined, { onSuccess: () => saveNick.mutate(nick) });
                    return;
                  }
                  saveNick.mutate(nick);
                }}
                onSaveX={(payload) => {
                  if (!connected) {
                    onConnect();
                    return;
                  }
                  saveX.mutate(payload);
                }}
                onConnectX={() => {
                  void connectX();
                }}
                onEdit={(id, body) => {
                  if (!connected) {
                    onConnect();
                    return;
                  }
                  editMsg.mutate({ id, body });
                }}
                onDelete={(id) => {
                  if (!connected) {
                    onConnect();
                    return;
                  }
                  dropMsg.mutate(id);
                }}
                onPhotoError={(kind) => toast.error(kind === "heavy" ? t.chatPhotoHeavy : t.chatPhotoBad)}
                theme={chatTheme}
                onToggleTheme={() => {
                  setChatTheme((prev) => {
                    const next = prev === "dark" ? "light" : "dark";
                    writeTheme(next);
                    return next;
                  });
                }}
              />
            ) : null}
            {view === "dock" ? (
              <ChatDock
                t={t}
                online={online}
                unread={unread}
                onOpen={() => setView("full")}
                onClose={() => setView("off")}
              />
            ) : null}
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setView((v) => (v === "full" ? "dock" : "full"))}
        aria-label={t.chatOpen}
        aria-expanded={view === "full"}
        title={onlineLabel}
        className={cn(
          "relative z-10 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5",
          view === "full" || view === "dock"
            ? "bg-ember/20 text-ember"
            : "text-muted hover:bg-surface-2 hover:text-fg",
        )}
      >
        <MessageCircle className="size-4" />
        <span className={cn("min-w-3 text-[11px] font-medium tabular", unread > 0 ? "text-ember" : online > 0 ? "text-volt" : "text-muted")}>
          {unread > 0 ? unread : online}
        </span>
      </button>
      {screen}
    </>
  );
}

function ChatScreen({
  t,
  address,
  connected,
  draft,
  setDraft,
  photo,
  setPhoto,
  messages,
  online,
  onlineLabel,
  pending,
  error,
  sending,
  scroller,
  stick,
  inputRef,
  onHide,
  onConnect,
  onSubmit,
  onSendRoar,
  roarWallet,
  names,
  reactions,
  me,
  signedIn,
  namingPending,
  linkingPending,
  replyTo,
  onReply,
  onClearReply,
  onReact,
  onSaveNick,
  onSaveX,
  onConnectX,
  onEdit,
  onDelete,
  onPhotoError,
  theme,
  onToggleTheme,
}: {
  t: Copy;
  address: string;
  connected: boolean;
  draft: string;
  setDraft: (v: string) => void;
  photo: string;
  setPhoto: (v: string) => void;
  messages: ChatMessage[];
  online: number;
  onlineLabel: string;
  pending: boolean;
  error: boolean;
  sending: boolean;
  scroller: RefObject<HTMLDivElement | null>;
  stick: MutableRefObject<boolean>;
  inputRef: RefObject<HTMLInputElement | null>;
  onHide: () => void;
  onConnect: () => void;
  onSubmit: () => void;
  onSendRoar: (to: string, amount: number) => Promise<boolean>;
  roarWallet: number;
  names: Record<string, ChatName>;
  reactions: Record<string, ChatReaction[]>;
  me: ChatName | null;
  signedIn: boolean;
  namingPending: boolean;
  linkingPending: boolean;
  replyTo: ChatMessage | null;
  onReply: (row: ChatMessage) => void;
  onClearReply: () => void;
  onReact: (messageId: number, kind: ChatReactKind) => void;
  onSaveNick: (nick: string) => void;
  onSaveX: (payload: { step: "begin" | "verify" | "unlink"; handle?: string }) => void;
  onConnectX: () => void;
  onEdit: (id: number, body: string) => void;
  onDelete: (id: number) => void;
  onPhotoError: (kind: "bad" | "heavy") => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const nickRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState("");
  const [holder, setHolder] = useState("");
  const [tipTo, setTipTo] = useState("");
  const [tipAmt, setTipAmt] = useState("");
  const [tipBusy, setTipBusy] = useState(false);
  const [picker, setPicker] = useState(0);
  const [menu, setMenu] = useState(0);
  const [editing, setEditing] = useState(0);
  const [editDraft, setEditDraft] = useState("");
  const mineName = address ? { ...names, ...(me ? { [address]: me } : {}) } : names;
  const hasHerotag = Boolean(me?.herotag || names[address]?.herotag);
  const hasNick = Boolean(me?.nick || names[address]?.nick);
  const hasX = Boolean(me?.xHandle);
  const [naming, setNaming] = useState(() => connected && !hasHerotag && !hasNick);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (hasHerotag) {
      setNaming(false);
      return;
    }
    if (!hasNick && connected) setNaming(true);
  }, [hasHerotag, hasNick, connected]);

  useEffect(() => {
    if (me?.nick) setNaming(false);
  }, [me?.nick]);

  useEffect(() => {
    if (connected && signedIn && !hasX) setLinking(true);
  }, [connected, signedIn, hasX]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const next = await compressPhoto(file);
      setPhoto(next);
    } catch (err) {
      onPhotoError(err instanceof Error && err.message === "heavy" ? "heavy" : "bad");
    }
  }

  useEffect(() => {
    if (!zoom && !holder) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (zoom) setZoom("");
      else setHolder("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [zoom, holder]);

  function lastPeer() {
    for (let i = messages.length - 1; i >= 0; i--) {
      const row = messages[i];
      if (row.sale) continue;
      if (row.address && row.address !== address && row.address !== CHAT_SALE_ADDRESS) {
        return row.address;
      }
    }
    return "";
  }

  function openTip(to?: string) {
    if (!connected) {
      onConnect();
      return;
    }
    const dest = to || lastPeer();
    if (!dest || dest === address) {
      toast.error(t.chatRoarNeed);
      return;
    }
    setTipTo(dest);
  }

  async function submitTip() {
    const amount = Number(String(tipAmt).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setTipBusy(true);
    try {
      const ok = await onSendRoar(tipTo, amount);
      if (ok) {
        setTipAmt("");
        setTipTo("");
      }
    } finally {
      setTipBusy(false);
    }
  }

  function jumpTo(id: number) {
    const el = document.getElementById(`pv-msg-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-bg text-fg"
      role="dialog"
      aria-modal="true"
      aria-label={t.chatTitle}
      data-chat-theme={theme}
    >
      <header className="relative shrink-0 bg-surface pt-[env(safe-area-inset-top)]">
        <div className="dual-bar h-0.5 w-full" />
        <div className="flex h-14 items-center gap-2 px-2 sm:h-16 sm:px-3">
          <button
            type="button"
            onClick={onHide}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-chat-meta hover:bg-chat-in hover:text-fg"
            aria-label={t.chatHide}
            title={t.chatHide}
          >
            <ArrowLeft className="size-5" />
          </button>
          <RoarMark className="size-8 shrink-0 sm:size-9" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base leading-none tracking-wide">{t.chatTitle}</p>
            <p className="mt-1 truncate text-xs text-chat-meta">
              {address ? (
                <>
                  <span className={isHerotag(address, mineName) ? "font-medium text-volt" : "font-medium text-ember"}>
                    {displayName(address, mineName, t, true)}
                  </span>
                  {xHandleOf(address, mineName) ? (
                    <span className="inline-flex items-center gap-0.5 font-medium text-volt">
                      {" · "}
                      {xHandleOf(address, mineName)}
                      <BadgeCheck className="size-3.5" />
                    </span>
                  ) : null}
                  <span className="tabular"> · {onlineLabel}</span>
                </>
              ) : (
                t.chatDen
              )}
            </p>
          </div>
          {connected && !hasHerotag ? (
            <button
              type="button"
              onClick={() => {
                setLinking(false);
                setNaming((v) => !v);
              }}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-chat-meta hover:bg-chat-in hover:text-fg"
              aria-label={hasNick ? t.chatNameEdit : t.chatNameSet}
              title={hasNick ? t.chatNameEdit : t.chatNameSet}
            >
              <Pencil className="size-4" />
            </button>
          ) : null}
          {connected ? (
            <button
              type="button"
              onClick={() => {
                setNaming(false);
                setLinking((v) => !v);
              }}
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-chat-in",
                hasX || linking ? "text-volt" : "text-chat-meta hover:text-fg",
              )}
              aria-label={t.chatXLink}
              title={hasX ? xHandleOf(address, mineName) : t.chatXLink}
            >
              <XMark className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-chat-meta hover:bg-chat-in hover:text-fg"
            aria-label={theme === "dark" ? t.chatThemeLight : t.chatThemeDark}
            title={theme === "dark" ? t.chatThemeLight : t.chatThemeDark}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          <span
            className={cn("inline-flex size-2.5 shrink-0 rounded-full", online > 0 ? "bg-volt" : "bg-chat-meta/40")}
            aria-hidden
          />
        </div>
        {connected && !hasHerotag && naming ? (
          <form
            className="flex flex-col gap-2 px-3 pb-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const fromForm = String(fd.get("nick") ?? "");
              const fromDom = String(nickRef.current?.value ?? "");
              const nick = (fromForm || fromDom).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
              onSaveNick(nick);
            }}
          >
            <p className="text-xs text-chat-meta">{hasNick ? t.chatNameEdit : t.chatNameHint}</p>
            <div className="flex items-center gap-2">
              <Input
                ref={nickRef}
                key={me?.nick || "new-nick"}
                name="nick"
                defaultValue={me?.nick ?? names[address]?.nick ?? ""}
                placeholder={t.chatName}
                maxLength={20}
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 min-w-0 flex-1 rounded-lg"
              />
              <Button type="submit" size="sm" className="h-11" disabled={namingPending}>
                {t.chatNameSave}
              </Button>
            </div>
          </form>
        ) : null}
        {connected && linking ? (
          <div className="flex flex-col gap-2 px-3 pb-3">
            <p className="text-xs text-chat-meta">
              {hasX
                ? `${t.chatXOk} · ${xHandleOf(address, mineName)}`
                : signedIn
                  ? t.chatXAttachHint
                  : t.chatXHint}
            </p>
            {hasX ? (
              <p className="text-xs text-volt">{t.chatXStayLinked}</p>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {hasX ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-11"
                  disabled={linkingPending}
                  onClick={() => onSaveX({ step: "unlink" })}
                >
                  {t.chatXUnlink}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-11"
                  disabled={linkingPending}
                  onClick={onConnectX}
                >
                  <XMark className="size-3.5" />
                  {linkingPending
                    ? t.chatXConnecting
                    : signedIn
                      ? t.chatXAttach
                      : t.chatXConnect}
                </Button>
              )}
            </div>
            <div className="min-w-0 overflow-hidden">
              <UserButton />
            </div>
          </div>
        ) : null}
      </header>

      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain px-3 py-4 touch-pan-y sm:px-6"
          style={{ WebkitOverflowScrolling: "touch", overflowX: "hidden" }}
        >
        {pending ? (
          <p className="py-16 text-center text-sm text-chat-meta">{t.chatLoading}</p>
        ) : error ? (
          <p className="py-16 text-center text-sm text-chat-meta">{t.chatError}</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <RoarMark className="size-16" />
            <p className="font-display text-lg">{t.chatTitle}</p>
            <p className="max-w-xs text-sm leading-relaxed text-chat-meta">{t.chatEmpty}</p>
          </div>
        ) : (
          <ol className="mx-auto flex min-h-full w-full min-w-0 max-w-2xl flex-col justify-end gap-3 overflow-x-hidden">
            {messages.map((row, i) => {
              const mine = Boolean(address && row.address === address);
              const prev = messages[i - 1];
              const stacked = Boolean(
                prev &&
                  !prev.sale &&
                  !row.sale &&
                  prev.address === row.address &&
                  row.at - prev.at < 120_000,
              );
              const day = fmtDay(row.at);
              const showDay = day && (!prev || fmtDay(prev.at) !== day);
              const tone = toneOf(row.address);
              const xPosts = extractXPosts(row.body);
              const bodyText = xPosts.text;
              const hasBubble = Boolean(bodyText || row.image || row.tip || row.reply);
              const dayLabel = showDay ? (
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-chat-meta">{day}</p>
              ) : null;
              const reactRow = (centered: boolean) => (
                <div className={cn("mt-1 flex max-w-full flex-wrap items-center gap-1", centered ? "justify-center" : mine ? "justify-end" : "justify-start")}>
                  {(reactions[String(row.id)] ?? []).map((item) => (
                    <button
                      key={item.kind}
                      type="button"
                      onClick={() => onReact(row.id, item.kind)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-full px-2 text-sm leading-none tabular",
                        item.mine
                          ? "bg-ember/30 text-fg ring-1 ring-ember/60"
                          : "bg-chat-in text-chat-in-fg shadow-[var(--shadow-border)]",
                      )}
                      aria-label={item.kind}
                      aria-pressed={item.mine}
                    >
                      <span aria-hidden>{CHAT_REACT_EMOJI[item.kind]}</span>
                      <span className="text-xs font-medium">{item.n}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPicker((v) => (v === row.id ? 0 : row.id))}
                    className={cn(
                      "inline-flex size-9 items-center justify-center rounded-full",
                      picker === row.id
                        ? "bg-ember/25 text-ember"
                        : "text-chat-meta hover:bg-chat-in hover:text-fg",
                    )}
                    aria-label={t.chatReact}
                    aria-expanded={picker === row.id}
                  >
                    <SmilePlus className="size-4" />
                  </button>
                  {picker === row.id ? (
                    <span className="inline-flex max-w-full flex-wrap items-center rounded-full bg-chat-in p-0.5 shadow-[var(--shadow-border-hover)]">
                      {CHAT_REACTS.map((kind) => {
                        const mineReact = (reactions[String(row.id)] ?? []).some(
                          (item) => item.kind === kind && item.mine,
                        );
                        return (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => {
                              onReact(row.id, kind);
                              setPicker(0);
                            }}
                            className={cn(
                              "inline-flex size-9 items-center justify-center rounded-full text-base leading-none",
                              mineReact ? "bg-ember/30" : "hover:bg-surface",
                            )}
                            aria-label={kind}
                            aria-pressed={mineReact}
                          >
                            <span aria-hidden>{CHAT_REACT_EMOJI[kind]}</span>
                          </button>
                        );
                      })}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setPicker(0);
                      onReply(row);
                    }}
                    className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-chat-meta hover:bg-chat-in hover:text-fg"
                    aria-label={t.chatReply}
                  >
                    <Reply className="size-3.5" />
                    {t.chatReply}
                  </button>
                  {!mine && connected && !row.sale ? (
                    <button
                      type="button"
                      onClick={() => openTip(row.address)}
                      className="inline-flex size-9 items-center justify-center rounded-full text-chat-meta hover:bg-chat-in hover:text-ember"
                      aria-label={t.chatRoarSend}
                      title={t.chatRoarSend}
                    >
                      <Coins className="size-4" />
                    </button>
                  ) : null}
                  {canRevise(row, address) ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setMenu((v) => (v === row.id ? 0 : row.id))}
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-full",
                          menu === row.id ? "bg-ember/25 text-ember" : "text-chat-meta hover:bg-chat-in hover:text-fg",
                        )}
                        aria-label={t.chatMore}
                        aria-expanded={menu === row.id}
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                      {menu === row.id ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-chat-in p-0.5 shadow-[var(--shadow-border-hover)]">
                          <button
                            type="button"
                            onClick={() => {
                              setMenu(0);
                              setEditing(row.id);
                              setEditDraft(row.body);
                            }}
                            className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-chat-in-fg hover:bg-surface"
                            aria-label={t.chatEdit}
                          >
                            <Pencil className="size-3.5" />
                            {t.chatEdit}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMenu(0);
                              onDelete(row.id);
                            }}
                            className="inline-flex h-9 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ember hover:bg-surface"
                            aria-label={t.chatDelete}
                          >
                            <Trash2 className="size-3.5" />
                            {t.chatDelete}
                          </button>
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              );
              if (row.sale) {
                return (
                  <li key={row.id} id={`pv-msg-${row.id}`} className="min-w-0 max-w-full">
                    {dayLabel}
                    <div className="mx-auto flex w-full min-w-0 max-w-md flex-col items-center">
                      <p className="mb-1 text-xs text-chat-meta tabular">
                        {t.chatSaleOn} · {fmtTime(row.at)}
                      </p>
                      <SaleCard row={row} t={t} names={names} address={address} />
                      {reactRow(true)}
                    </div>
                  </li>
                );
              }
              return (
                <li key={row.id} id={`pv-msg-${row.id}`} className="min-w-0 max-w-full">
                  {dayLabel}
                  <div className={cn("flex w-full min-w-0 max-w-full items-end gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                    {stacked ? (
                      <span className="size-9 shrink-0" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setZoom("");
                          setHolder(row.address);
                        }}
                        className={cn(
                          "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-transform duration-150 ease-out active:scale-[0.96]",
                          mine
                            ? ""
                            : tone === "volt"
                              ? "bg-volt/25 font-display text-xs text-volt hover:bg-volt/40"
                              : "bg-ember/25 font-display text-xs text-ember hover:bg-ember/40",
                        )}
                        aria-label={t.chatHolder}
                        title={t.chatHolder}
                      >
                        {mine ? (
                          <RoarMark className="size-9" />
                        ) : (
                          initialsOf(row.address, names, t, mine)
                        )}
                      </button>
                    )}
                    <div
                      className={cn(
                        "flex min-w-0 w-fit max-w-[calc(100%-2.75rem)] flex-col sm:max-w-md",
                        mine ? "items-end" : "items-start",
                      )}
                    >
                      {stacked ? null : (
                        <p className={cn("mb-1 max-w-full truncate text-xs", mine ? "text-right" : "text-left")}>
                          <button
                            type="button"
                            onClick={() => {
                              setZoom("");
                              setHolder(row.address);
                            }}
                            className={cn(
                              "font-medium",
                              isHerotag(row.address, names)
                                ? "text-volt"
                                : mine
                                  ? "text-ember"
                                  : tone === "volt"
                                    ? "text-volt"
                                    : "text-ember",
                            )}
                          >
                            {displayName(row.address, names, t, mine)}
                          </button>
                          {xHandleOf(row.address, names) ? (
                            <span className="inline-flex items-center gap-0.5 font-medium text-volt">
                              {" · "}
                              {xHandleOf(row.address, names)}
                              <BadgeCheck className="size-3" />
                            </span>
                          ) : null}
                          <span className="text-chat-meta tabular"> · {fmtTime(row.at)}</span>
                          {row.editedAt ? (
                            <span className="text-chat-meta"> · {t.chatEdited}</span>
                          ) : null}
                        </p>
                      )}
                      {editing === row.id ? (
                        <form
                          className="flex w-full min-w-0 flex-col gap-2 rounded-2xl bg-chat-in p-2 text-chat-in-fg"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const body = editDraft.trim();
                            if (!body && !row.image && !row.tip) return;
                            onEdit(row.id, body);
                            setEditing(0);
                          }}
                        >
                          <Input
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value.slice(0, CHAT_MAX_BODY))}
                            maxLength={CHAT_MAX_BODY}
                            className="h-11 rounded-lg"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10"
                              onClick={() => setEditing(0)}
                            >
                              {t.chatRoarCancel}
                            </Button>
                            <Button type="submit" size="sm" className="h-10">
                              {t.chatEditSave}
                            </Button>
                          </div>
                        </form>
                      ) : hasBubble ? (
                      <div
                        className={cn(
                          "max-w-full min-w-0 overflow-hidden text-base leading-relaxed break-words [overflow-wrap:anywhere]",
                          row.tip
                            ? mine
                              ? "rounded-2xl rounded-br-sm bg-ember/20 text-fg"
                              : "rounded-2xl rounded-bl-sm bg-chat-in text-chat-in-fg shadow-[var(--shadow-border-hover)]"
                            : mine
                              ? "rounded-2xl rounded-br-sm bg-ember text-primary-foreground"
                              : "rounded-2xl rounded-bl-sm bg-chat-in text-chat-in-fg shadow-[var(--shadow-border-hover)]",
                        )}
                      >
                        {row.reply ? (
                          <button
                            type="button"
                            className={cn(
                              "mx-2 mt-2 w-[calc(100%-1rem)] rounded-lg border-l-2 px-2 py-1.5 text-left",
                              mine
                                ? "border-primary-foreground/70 bg-fg/10"
                                : "border-volt bg-bg/50",
                            )}
                            onClick={() => jumpTo(row.reply!.id)}
                          >
                            <p className={cn("truncate text-xs font-medium", mine ? "text-primary-foreground" : "text-volt")}>
                              {fillAmt(
                                t.chatReplyTo,
                                displayName(row.reply.address, names, t, row.reply.address === address),
                              )}
                            </p>
                            <p className={cn("mt-0.5 truncate text-xs", mine ? "text-primary-foreground/90" : "text-chat-meta")}>
                              {replyPreview(row.reply, messages, t) || t.chatPhoto}
                            </p>
                          </button>
                        ) : null}
                        {row.tip ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <span className="inline-flex size-8 items-center justify-center rounded-md bg-ember/20 text-ember">
                              <Coins className="size-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="font-display text-sm leading-none">
                                {formatNum(row.tip.amount, 2)} ROAR
                              </p>
                              <p className="mt-1 truncate text-xs text-chat-meta">
                                {mine
                                  ? fillAmt(t.chatRoarYouSent, formatNum(row.tip.amount, 2))
                                  : fillAmt(t.chatRoarSent, formatNum(row.tip.amount, 2))}
                                {" · "}
                                {shortAddr(row.tip.to, 4, 4)}
                              </p>
                            </div>
                            {row.tip.hash && row.tip.hash !== "demo" ? (
                              <a
                                href={explorerTxUrl(row.tip.hash)}
                                target="_blank"
                                rel="noreferrer"
                                className="ml-auto text-xs text-volt"
                              >
                                tx
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                        {safeImageSrc(row.image) ? (
                          <button
                            type="button"
                            className="block max-w-full p-1.5"
                            onClick={() => setZoom(safeImageSrc(row.image))}
                            aria-label={t.chatPhoto}
                          >
                            <img
                              src={safeImageSrc(row.image)}
                              alt=""
                              className="max-h-48 w-full max-w-full rounded-lg object-cover"
                              onLoad={() => {
                                const el = scroller.current;
                                if (el && stick.current) el.scrollTop = el.scrollHeight;
                              }}
                            />
                          </button>
                        ) : null}
                        {bodyText ? (
                          <MessageBody
                            text={bodyText}
                            onEmber={mine && !row.tip}
                            className={cn("px-3.5 py-2.5", safeImageSrc(row.image) || row.tip || row.reply ? "pt-1.5" : "")}
                          />
                        ) : null}
                      </div>
                      ) : null}
                      {xPosts.posts.length ? (
                        <div className="mt-1 flex w-full min-w-0 flex-col gap-2">
                          {xPosts.posts.map((post) => (
                            <XPostBox key={post.id} url={post.url} t={t} />
                          ))}
                        </div>
                      ) : null}
                      {reactRow(false)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        </div>
      </div>

      <form
        className="relative min-w-0 shrink-0 overflow-x-hidden bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="dual-bar mb-2 h-px w-full" />
        {replyTo ? (
          <div className="mx-auto mb-2 flex max-w-2xl items-start gap-2 rounded-xl border-l-2 border-volt bg-chat-in px-3 py-2">
            <Reply className="mt-0.5 size-3.5 shrink-0 text-volt" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-volt">
                {fillAmt(
                  t.chatReplyTo,
                  displayName(replyTo.address, names, t, replyTo.address === address),
                )}
              </p>
              <p className="mt-0.5 truncate text-xs text-chat-meta">
                {replyTo.body ||
                  (replyTo.sale
                    ? `${formatNum(replyTo.sale.qty, 0)} Heart · ${formatEgld(replyTo.sale.egld, 2)}`
                    : replyTo.image
                      ? t.chatPhoto
                      : replyTo.tip
                        ? `${formatNum(replyTo.tip.amount, 2)} ROAR`
                        : "")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="inline-flex size-9 items-center justify-center rounded-md text-chat-meta hover:text-fg"
              aria-label={t.chatRoarCancel}
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
        {photo ? (
          <div className="mx-auto mb-2 flex max-w-2xl items-end gap-2">
            <div className="relative">
              <img src={photo} alt="" className="h-16 w-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => setPhoto("")}
                className="absolute -top-1.5 -right-1.5 inline-flex size-8 items-center justify-center rounded-full bg-surface text-chat-meta shadow-[var(--shadow-border-hover)] hover:text-fg"
                aria-label={t.chatPhotoRemove}
              >
                <X className="size-3" />
              </button>
            </div>
          </div>
        ) : null}
        {tipTo ? (
          <div className="mx-auto mb-2 flex max-w-2xl flex-col gap-2 rounded-xl bg-chat-in p-2.5 text-chat-in-fg">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-ember" />
              <p className="min-w-0 flex-1 truncate text-xs">
                {t.chatRoarSend} · {shortAddr(tipTo, 4, 4)}
              </p>
              <button
                type="button"
                onClick={() => setTipTo("")}
                className="inline-flex h-9 items-center px-2 text-xs text-chat-meta hover:text-fg"
              >
                {t.chatRoarCancel}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={tipAmt}
                onChange={(e) => setTipAmt(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 16))}
                placeholder={t.walletSendAmount}
                inputMode="decimal"
                className="h-11 min-w-0 flex-1 rounded-lg"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11"
                onClick={() => setTipAmt(String(Math.max(0, Math.floor(roarWallet * 100) / 100)))}
              >
                {t.chatRoarMax}
              </Button>
              <Button
                type="button"
                className="h-11"
                disabled={!tipAmt || tipBusy}
                onClick={() => void submitTip()}
              >
                {t.chatRoar}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mx-auto flex min-w-0 max-w-2xl items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void pickPhoto(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            disabled={!connected || sending}
            aria-label={t.chatPhotoAdd}
            title={t.chatPhotoAdd}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0 rounded-xl"
            disabled={!connected || sending}
            aria-label={t.chatRoarSend}
            title={t.chatRoarSend}
            onClick={() => openTip()}
          >
            <Coins className="size-4" />
          </Button>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, CHAT_MAX_BODY))}
            placeholder={connected ? t.chatPlaceholder : t.chatNeedWallet}
            maxLength={CHAT_MAX_BODY}
            aria-label={t.chatPlaceholder}
            disabled={!connected}
            className="h-12 min-w-0 flex-1 rounded-xl bg-chat-in text-chat-in-fg placeholder:text-chat-meta"
          />
          {connected ? (
            <Button
              type="submit"
              size="icon"
              className="size-12 shrink-0 rounded-xl"
              disabled={(!draft.trim() && !photo) || sending}
              aria-label={t.chatSend}
            >
              <Send className="size-4" />
            </Button>
          ) : (
            <Button type="button" className="h-12 shrink-0 rounded-xl px-4" onClick={onConnect}>
              {t.connect}
            </Button>
          )}
        </div>
      </form>
      {zoom ? (
        <button
          type="button"
          className="absolute inset-0 z-50 flex items-center justify-center bg-bg/90 p-4"
          onClick={() => setZoom("")}
          aria-label={t.chatClose}
        >
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      ) : null}
      {holder ? (
        <HolderPopup
          address={holder}
          names={mineName}
          t={t}
          mine={holder === address}
          onClose={() => setHolder("")}
        />
      ) : null}
    </div>
  );
}

function ChatDock({
  t,
  online,
  unread,
  onOpen,
  onClose,
}: {
  t: Copy;
  online: number;
  unread: number;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed z-[80] flex items-center gap-1"
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="inline-flex size-11 items-center justify-center rounded-full bg-chat-in text-chat-meta shadow-[var(--shadow-border-hover)] hover:text-fg"
        aria-label={t.chatClose}
        title={t.chatClose}
      >
        <X className="size-4" />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="relative inline-flex h-14 items-center gap-2 rounded-full bg-chat-in py-1 pr-4 pl-1 text-chat-in-fg shadow-[var(--shadow-border-hover)]"
        aria-label={t.chatShow}
        title={t.chatShow}
      >
        <RoarMark className="size-12 rounded-full" />
        <span className="text-left">
          <span className="block font-display text-sm leading-none">{t.chatTitle}</span>
          <span className="mt-1 block text-xs text-volt">{fillAmt(t.chatOnline, String(online))}</span>
        </span>
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-ember px-1.5 text-center text-[11px] font-medium tabular text-primary-foreground">
            {unread}
          </span>
        ) : (
          <span className="absolute right-1 bottom-1 size-2.5 rounded-full bg-volt" />
        )}
      </button>
    </div>
  );
}
