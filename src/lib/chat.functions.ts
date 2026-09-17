import { createHash, randomBytes } from "node:crypto";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { ADDRESSES, CHAIN, COLLECTION, DEMO_ADDRESS } from "./config";
import { getSql } from "./db";
import { fromDenom, isErdAddress } from "./utils";

const ONLINE_MS = 45_000;
const RATE_MS = 3_000;
const KEEP_MESSAGES = 200;
const KEEP_IMAGES = 40;
const MAX_BODY = 240;
const MAX_IMAGE_BYTES = 80_000;
const SALE_INGEST_MS = 8_000;
const SALE_FETCH = 50;
const SALE_TZ = "America/Toronto";
const EDIT_MS = 15 * 60_000;
const HEART_COLLECTION_HEX = Buffer.from(COLLECTION.identifier, "utf8").toString("hex");

export type ChatMode = "demo" | "live" | "xportal";
export const CHAT_REACTS = ["roar", "fire", "heart", "laugh", "up"] as const;
export type ChatReactKind = (typeof CHAT_REACTS)[number];
export const CHAT_REACT_EMOJI: Record<ChatReactKind, string> = {
  roar: "🦁",
  fire: "🔥",
  heart: "❤️",
  laugh: "😂",
  up: "👍",
};

export type ChatTip = {
  amount: number;
  to: string;
  hash: string;
};

export type ChatReply = {
  id: number;
  address: string;
  preview: string;
};

export type ChatSale = {
  qty: number;
  egld: number;
  buyer: string;
  hash: string;
  auctionId: number;
};

export type ChatName = {
  herotag: string;
  nick: string;
  xHandle: string;
  xPending: string;
  xCode: string;
};

export type ChatReaction = {
  kind: ChatReactKind;
  n: number;
  mine: boolean;
};

export type ChatMessage = {
  id: number;
  address: string;
  mode: ChatMode;
  body: string;
  image: string | null;
  tip: ChatTip | null;
  reply: ChatReply | null;
  sale: ChatSale | null;
  at: number;
  editedAt: number;
};

function isChatAddress(value: string) {
  return value === DEMO_ADDRESS || isErdAddress(value);
}

function asMode(value: unknown): ChatMode {
  if (value === "demo" || value === "xportal" || value === "live") return value;
  return "live";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cleanBody(raw: unknown) {
  const text = String(raw ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 1) return "";
  return text.slice(0, MAX_BODY);
}

function asId(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function cleanImage(raw: unknown): string | null {
  const text = String(raw ?? "").replace(/\s+/g, "");
  if (!text) return null;
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(text);
  if (!match) return null;
  const mime = match[1] === "jpg" ? "jpeg" : match[1];
  const b64 = match[2];
  if (b64.length > 120_000) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return null;
  }
  if (buf.length < 32 || buf.length > MAX_IMAGE_BYTES) return null;
  const okJpeg = mime === "jpeg" && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const okPng =
    mime === "png" && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const okWebp =
    mime === "webp" &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.toString("ascii", 8, 12) === "WEBP";
  if (!okJpeg && !okPng && !okWebp) return null;
  return `data:image/${mime};base64,${b64}`;
}

function cleanTip(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const match = /^([0-9]+(?:\.[0-9]{1,6})?)\|([a-z0-9]{50,80})\|([a-f0-9]{64}|demo)$/i.exec(text);
  if (!match) return null;
  const amount = Number(match[1]);
  const to = match[2];
  const hash = match[3].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return null;
  if (!isChatAddress(to)) return null;
  return `${amount}|${to}|${hash}`;
}

function parseTip(raw: string | null | undefined): ChatTip | null {
  const packed = cleanTip(raw);
  if (!packed) return null;
  const [amount, to, hash] = packed.split("|");
  return { amount: Number(amount), to, hash };
}

function cleanReply(raw: unknown): string | null {
  const text = String(raw ?? "");
  if (!text) return null;
  const first = text.indexOf("|");
  const second = text.indexOf("|", first + 1);
  if (first < 1 || second < 0) return null;
  const id = Number(text.slice(0, first));
  const address = text.slice(first + 1, second).trim();
  const preview = text
    .slice(second + 1)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\|/g, " ")
    .slice(0, 80);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) return null;
  if (!isChatAddress(address)) return null;
  return `${id}|${address}|${preview}`;
}

function parseReply(raw: string | null | undefined): ChatReply | null {
  const packed = cleanReply(raw);
  if (!packed) return null;
  const first = packed.indexOf("|");
  const second = packed.indexOf("|", first + 1);
  return {
    id: Number(packed.slice(0, first)),
    address: packed.slice(first + 1, second),
    preview: packed.slice(second + 1),
  };
}

function cleanSale(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const match =
    /^(\d{1,4})\|([0-9]+(?:\.[0-9]{1,8})?)\|(erd1[a-z0-9]{58})\|([a-f0-9]{64})(?:\|(\d{1,12}))?$/i.exec(
      text,
    );
  if (!match) return null;
  const qty = Number(match[1]);
  const egld = Number(match[2]);
  const buyer = match[3];
  const hash = match[4].toLowerCase();
  const auctionId = match[5] ? Number(match[5]) : 0;
  if (!Number.isInteger(qty) || qty < 1 || qty > COLLECTION.supply) return null;
  if (!Number.isFinite(egld) || egld < 0 || egld > 1_000_000) return null;
  if (!isErdAddress(buyer)) return null;
  if (auctionId && (!Number.isInteger(auctionId) || auctionId <= 0)) return null;
  return auctionId > 0
    ? `${qty}|${egld}|${buyer}|${hash}|${auctionId}`
    : `${qty}|${egld}|${buyer}|${hash}`;
}

function parseSale(raw: string | null | undefined): ChatSale | null {
  const packed = cleanSale(raw);
  if (!packed) return null;
  const parts = packed.split("|");
  return {
    qty: Number(parts[0]),
    egld: Number(parts[1]),
    buyer: parts[2],
    hash: parts[3],
    auctionId: parts[4] ? Number(parts[4]) : 0,
  };
}

function decodeTxData(data: string | undefined) {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function parseBuyQty(decoded: string) {
  const parts = decoded.split("@");
  if (parts[0] !== "buy" || parts.length < 5) return 0;
  const qty = Number.parseInt(parts[4], 16);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function parseAuctionId(decoded: string) {
  const parts = decoded.split("@");
  if (parts[0] !== "buy" || parts.length < 2) return 0;
  const id = Number.parseInt(parts[1], 16);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

function isHeartBuy(decoded: string) {
  return decoded.startsWith("buy@") && decoded.toLowerCase().includes(HEART_COLLECTION_HEX);
}

type MxBuyTx = {
  txHash?: string;
  sender?: string;
  value?: string;
  data?: string;
  timestamp?: number;
};

function parseHeartBuy(tx: MxBuyTx) {
  const hash = String(tx.txHash ?? "")
    .replace(/^0x/i, "")
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  const decoded = decodeTxData(tx.data);
  if (!isHeartBuy(decoded)) return null;
  const qty = parseBuyQty(decoded);
  const buyer = String(tx.sender ?? "").trim();
  const egld = fromDenom(tx.value, 18);
  const auctionId = parseAuctionId(decoded);
  const packed = cleanSale(`${qty}|${egld.toFixed(6)}|${buyer}|${hash}|${auctionId}`);
  if (!packed) return null;
  return {
    hash,
    qty,
    egld,
    buyer,
    auctionId,
    ts: Number(tx.timestamp ?? 0),
    packed,
  };
}

function startOfDayUnix(timeZone: string, now = Date.now()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(new Date(now))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const midnightAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    0,
    0,
    0,
  );
  return Math.floor((midnightAsUtc - (asUtc - now)) / 1000);
}

async function fetchBuyPage(from: number, size: number): Promise<MxBuyTx[]> {
  const url = `${CHAIN.api}/accounts/${ADDRESSES.marketplace}/transactions?function=buy&status=success&from=${from}&size=${size}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const json = (await res.json()) as MxBuyTx[] | null;
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

async function pruneOldSaleMessages() {
  const sql = await getSql();
  const todayIso = new Date(startOfDayUnix(SALE_TZ) * 1000).toISOString();
  await sql`
    delete from pride_chat_reactions
    where message_id in (
      select id from pride_chat_messages
      where sale is not null and created_at < ${todayIso}::timestamptz
    )
  `;
  await sql`
    delete from pride_chat_messages
    where sale is not null and created_at < ${todayIso}::timestamptz
  `;
}

async function ingestHeartSalesNow() {
  const sql = await getSql();
  const todayStart = startOfDayUnix(SALE_TZ);
  const collected: NonNullable<ReturnType<typeof parseHeartBuy>>[] = [];
  const seen = new Set<string>();
  let hitKnown = false;
  let crossedToday = false;

  for (let page = 0; page < 6 && !hitKnown && !crossedToday; page++) {
    const txs = await fetchBuyPage(page * SALE_FETCH, SALE_FETCH);
    if (!txs.length) break;
    for (const tx of txs) {
      const ts = Number(tx.timestamp ?? 0);
      if (ts > 0 && ts < todayStart) {
        crossedToday = true;
        continue;
      }
      const sale = parseHeartBuy(tx);
      if (!sale || seen.has(sale.hash) || sale.ts < todayStart) continue;
      seen.add(sale.hash);
      const have = await sql<{ hash: string }>`
        select hash from pride_chat_sales where hash = ${sale.hash}
      `;
      if (have[0]) {
        hitKnown = true;
        break;
      }
      collected.push(sale);
    }
    if (txs.length < SALE_FETCH) break;
  }

  const chronological = [...collected].reverse();
  for (const sale of chronological) {
    const claimed = await sql<{ hash: string }>`
      insert into pride_chat_sales (hash, qty, egld, buyer)
      values (${sale.hash}, ${sale.qty}, ${String(sale.egld)}, ${sale.buyer})
      on conflict (hash) do nothing
      returning hash
    `;
    if (!claimed[0]) continue;
    const created =
      sale.ts > 1_000_000_000 ? new Date(sale.ts * 1000).toISOString() : new Date().toISOString();
    try {
      await sql`
        insert into pride_chat_messages (address, mode, body, sale, created_at)
        values (${ADDRESSES.marketplace}, 'live', '', ${sale.packed}, ${created}::timestamptz)
      `;
    } catch {
      await sql`delete from pride_chat_sales where hash = ${sale.hash}`;
    }
  }
}

async function ingestHeartSales() {
  const g = globalThis as typeof globalThis & {
    __prideSaleIngest__?: { at: number; run?: Promise<void> };
  };
  const now = Date.now();
  if (g.__prideSaleIngest__?.run) {
    await g.__prideSaleIngest__.run.catch(() => undefined);
    return;
  }
  if (g.__prideSaleIngest__ && now - g.__prideSaleIngest__.at < SALE_INGEST_MS) return;
  const run = ingestHeartSalesNow();
  g.__prideSaleIngest__ = { at: now, run };
  try {
    await run;
    g.__prideSaleIngest__ = { at: Date.now() };
  } catch {
    g.__prideSaleIngest__ = { at: Date.now() - SALE_INGEST_MS + 2_000 };
  }
}

function asReactKind(value: unknown): ChatReactKind | "" {
  const kind = String(value ?? "");
  return (CHAT_REACTS as readonly string[]).includes(kind) ? (kind as ChatReactKind) : "";
}

function herotagOf(username: unknown) {
  if (!username || typeof username !== "string") return "";
  const tag = username.replace(/\.elrond$/i, "").replace(/\.x$/i, "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{1,32}$/.test(tag)) return "";
  return tag;
}

function cleanNick(raw: unknown) {
  const text = String(raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(text)) return "";
  const lower = text.toLowerCase();
  if (/^(you|toi|demo|admin|system|mod|moderator|wallet)$/.test(lower)) {
    return "";
  }
  return text;
}

function cleanXHandle(raw: unknown) {
  const text = String(raw ?? "")
    .replace(/^@+/, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
  if (!/^[A-Za-z0-9_]{1,15}$/.test(text)) return "";
  const lower = text.toLowerCase();
  if (/^(admin|help|support|twitter)$/.test(lower)) return "";
  return text;
}

function asName(
  row: {
    herotag?: string | null;
    nick?: string | null;
    x_handle?: string | null;
    x_pending?: string | null;
    x_code?: string | null;
    x_verified?: boolean | number | string | null;
  } | null | undefined,
  mine = false,
): ChatName {
  const verified =
    row?.x_verified === true ||
    row?.x_verified === "t" ||
    row?.x_verified === "true" ||
    Number(row?.x_verified) === 1;
  const handle = cleanXHandle(row?.x_handle);
  const pending = cleanXHandle(row?.x_pending);
  return {
    herotag: herotagOf(row?.herotag) || "",
    nick: row?.nick || "",
    xHandle: verified && handle ? handle : "",
    xPending: mine ? pending : "",
    xCode: mine ? String(row?.x_code ?? "").slice(0, 16) : "",
  };
}

const EMPTY_NAME: ChatName = { herotag: "", nick: "", xHandle: "", xPending: "", xCode: "" };

function xProofCode(address: string) {
  return `PV-${createHash("sha256").update(`pride-x:${address}`).digest("hex").slice(0, 8).toUpperCase()}`;
}

function proofInBio(bio: string, code: string, address: string) {
  const hay = String(bio ?? "").toLowerCase();
  if (code && hay.includes(code.toLowerCase())) return true;
  if (address && hay.includes(address.toLowerCase())) return true;
  return false;
}

async function fetchHerotag(address: string) {
  if (!isErdAddress(address)) return "";
  try {
    const res = await fetch(`${CHAIN.api}/accounts/${address}?fields=username`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { username?: string };
    return herotagOf(json?.username);
  } catch {
    return "";
  }
}

async function loadProfiles(addresses: string[]) {
  const unique = [...new Set(addresses.filter(Boolean))];
  if (!unique.length) return new Map<string, ChatName>();
  const sql = await getSql();
  const rows = await sql<{
    address: string;
    herotag: string;
    nick: string;
    x_handle: string;
    x_verified: boolean;
  }>`
    select address, herotag, nick, x_handle, x_verified from pride_chat_profiles
  `;
  const map = new Map<string, ChatName>();
  for (const row of rows) {
    if (!unique.includes(row.address)) continue;
    map.set(row.address, asName(row));
  }
  return map;
}

async function ensureProfile(address: string) {
  const sql = await getSql();
  const existing = await sql<{
    herotag: string;
    nick: string;
    x_handle: string;
    x_pending: string;
    x_code: string;
    x_verified: boolean;
    herotag_at: string | Date | null;
  }>`
    select herotag, nick, x_handle, x_pending, x_code, x_verified, herotag_at
    from pride_chat_profiles where address = ${address}
  `;
  const prev = existing[0];
  const last =
    prev?.herotag_at instanceof Date
      ? prev.herotag_at.getTime()
      : prev?.herotag_at
        ? Date.parse(String(prev.herotag_at))
        : 0;
  const stale = !last || Date.now() - last > 24 * 3600 * 1000;
  let herotag = prev?.herotag || "";
  if (stale) {
    const fresh = await fetchHerotag(address);
    if (fresh) herotag = fresh;
  }
  await sql`
    insert into pride_chat_profiles (address, herotag, nick, herotag_at, updated_at)
    values (${address}, ${herotag}, ${prev?.nick ?? ""}, now(), now())
    on conflict (address) do update
    set herotag = excluded.herotag,
        herotag_at = now(),
        updated_at = now()
  `;
  return asName(
    {
      herotag,
      nick: prev?.nick ?? "",
      x_handle: prev?.x_handle ?? "",
      x_pending: prev?.x_pending ?? "",
      x_code: prev?.x_code ?? "",
      x_verified: prev?.x_verified ?? false,
    },
    true,
  );
}

async function fillMissingHerotags(addresses: string[]) {
  const sql = await getSql();
  const missing = addresses.filter((addr) => isErdAddress(addr)).slice(0, 8);
  for (const address of missing) {
    const have = await sql<{ herotag: string; herotag_at: string | Date | null }>`
      select herotag, herotag_at from pride_chat_profiles where address = ${address}
    `;
    const last =
      have[0]?.herotag_at instanceof Date
        ? have[0].herotag_at.getTime()
        : have[0]?.herotag_at
          ? Date.parse(String(have[0].herotag_at))
          : 0;
    if (have[0]?.herotag && last && Date.now() - last < 24 * 3600 * 1000) continue;
    const tag = await fetchHerotag(address);
    await sql`
      insert into pride_chat_profiles (address, herotag, nick, herotag_at, updated_at)
      values (${address}, ${tag}, '', now(), now())
      on conflict (address) do update
      set herotag = case when excluded.herotag <> '' then excluded.herotag else pride_chat_profiles.herotag end,
          herotag_at = now(),
          updated_at = now()
    `;
  }
}

function namesObject(map: Map<string, ChatName>) {
  const out: Record<string, ChatName> = {};
  for (const [address, name] of map) out[address] = name;
  return out;
}

async function loadReactions(messageIds: number[], viewer: string) {
  const out: Record<string, ChatReaction[]> = {};
  if (!messageIds.length) return out;
  const sql = await getSql();
  const minId = Math.min(...messageIds);
  const rows = await sql<{ message_id: number; kind: string; n: number; mine: number }>`
    select
      message_id,
      kind,
      count(*)::int as n,
      coalesce(sum(case when address = ${viewer} then 1 else 0 end), 0)::int as mine
    from pride_chat_reactions
    where message_id >= ${minId}
    group by message_id, kind
  `;
  for (const row of rows) {
    const kind = asReactKind(row.kind);
    if (!kind) continue;
    const key = String(row.message_id);
    const list = out[key] ?? [];
    list.push({ kind, n: Number(row.n), mine: Number(row.mine) > 0 });
    out[key] = list;
  }
  return out;
}

function mapRow(row: {
  id: number | string;
  address: string;
  mode: string;
  body: string;
  image?: string | null;
  tip?: string | null;
  reply?: string | null;
  sale?: string | null;
  at: number | string;
  edited_at?: number | string | null;
}): ChatMessage {
  return {
    id: Number(row.id),
    address: row.address,
    mode: asMode(row.mode),
    body: row.body ?? "",
    image: cleanImage(row.image),
    tip: parseTip(row.tip),
    reply: parseReply(row.reply),
    sale: parseSale(row.sale),
    at: Number(row.at),
    editedAt: Number(row.edited_at) || 0,
  };
}

type ChatRow = {
  id: number;
  address: string;
  mode: string;
  body: string;
  image: string | null;
  tip: string | null;
  reply: string | null;
  sale: string | null;
  at: number;
  edited_at: number;
};

async function onlineCount() {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from pride_chat_presence
    where seen_at > now() - interval '45 seconds'
  `;
  return Number(rows[0]?.n ?? 0);
}

async function trimChat() {
  const sql = await getSql();
  await sql`
    delete from pride_chat_messages
    where id < coalesce((
      select id from pride_chat_messages order by id desc offset ${KEEP_MESSAGES} limit 1
    ), 0)
  `;
  await sql`
    update pride_chat_messages
    set image = null
    where image is not null
      and id < coalesce((
        select id from pride_chat_messages
        where image is not null
        order by id desc offset ${KEEP_IMAGES} limit 1
      ), 0)
  `;
  await sql`
    delete from pride_chat_reactions
    where message_id < coalesce((
      select id from pride_chat_messages order by id desc offset ${KEEP_MESSAGES} limit 1
    ), 0)
  `;
  await sql`
    delete from pride_chat_presence
    where seen_at < now() - interval '2 hours'
  `;
}

export const getChatSnapshot = createServerFn({ method: "GET" })
  .validator((data: { afterId?: number; viewer?: string } | undefined) => ({
    afterId: asId(data?.afterId),
    viewer: isChatAddress(String(data?.viewer ?? "").trim()) ? String(data?.viewer).trim() : "",
  }))
  .handler(async ({ data }) => {
    await pruneOldSaleMessages().catch(() => undefined);
    await ingestHeartSales().catch(() => undefined);
    const sql = await getSql();
    const afterId = data.afterId;
    const rows =
      afterId > 0
        ? await sql<ChatRow>`
            select id, address, mode, body, image, tip, reply, sale,
              (extract(epoch from created_at) * 1000)::bigint as at,
              coalesce((extract(epoch from edited_at) * 1000)::bigint, 0) as edited_at
            from pride_chat_messages
            where id > ${afterId} and deleted_at is null
            order by id asc
            limit 80
          `
        : await sql<ChatRow>`
            select id, address, mode, body, image, tip, reply, sale,
              (extract(epoch from created_at) * 1000)::bigint as at,
              coalesce((extract(epoch from edited_at) * 1000)::bigint, 0) as edited_at
            from pride_chat_messages
            where deleted_at is null
            order by id desc
            limit 80
          `;
    const messages = rows.map(mapRow);
    if (afterId <= 0) messages.reverse();
    const recent = await sql<{ id: number; address: string }>`
      select id, address from pride_chat_messages where deleted_at is null order by id desc limit 80
    `;
    let gone: number[] = [];
    let edited: ChatMessage[] = [];
    try {
      const goneRows = await sql<{ id: number }>`
        select id from pride_chat_messages
        where deleted_at is not null
        order by deleted_at desc
        limit 40
      `;
      gone = goneRows.map((row) => Number(row.id));
      const editedRows = await sql<ChatRow>`
        select id, address, mode, body, image, tip, reply, sale,
          (extract(epoch from created_at) * 1000)::bigint as at,
          coalesce((extract(epoch from edited_at) * 1000)::bigint, 0) as edited_at
        from pride_chat_messages
        where edited_at is not null and deleted_at is null
        order by edited_at desc
        limit 40
      `;
      edited = editedRows.map(mapRow);
    } catch {
      gone = [];
      edited = [];
    }
    const addrs = [
      ...new Set(
        [
          ...messages.map((row) => row.sale?.buyer ?? ""),
          ...messages.map((row) => row.address),
          ...messages.map((row) => row.reply?.address ?? ""),
          ...recent.map((row) => row.address),
          data.viewer,
        ].filter(Boolean),
      ),
    ];
    void fillMissingHerotags(addrs).catch(() => undefined);
    let names: Record<string, ChatName> = {};
    try {
      names = namesObject(await loadProfiles(addrs));
    } catch {
      names = {};
    }
    let reactions: Record<string, ChatReaction[]> = {};
    try {
      reactions = await loadReactions(
        recent.map((row) => Number(row.id)),
        data.viewer,
      );
    } catch {
      reactions = {};
    }
    const me = data.viewer
      ? await (async () => {
          try {
            const mine = await sql<{
              herotag: string;
              nick: string;
              x_handle: string;
              x_pending: string;
              x_code: string;
              x_verified: boolean;
            }>`
              select herotag, nick, x_handle, x_pending, x_code, x_verified
              from pride_chat_profiles where address = ${data.viewer}
            `;
            const row = mine[0];
            if (row && cleanXHandle(row.x_pending) && !row.x_code) {
              row.x_code = xProofCode(data.viewer);
              await sql`
                update pride_chat_profiles
                set x_code = ${row.x_code}
                where address = ${data.viewer} and x_code = ''
              `;
            }
            return asName(row, true);
          } catch {
            return names[data.viewer] ?? EMPTY_NAME;
          }
        })()
      : null;
    return {
      messages,
      names,
      reactions,
      me,
      online: await onlineCount(),
      fetchedAt: Date.now(),
      saleSince: startOfDayUnix(SALE_TZ) * 1000,
      gone,
      edited,
    };
  });

export const joinPrideChat = createServerFn({ method: "POST" })
  .validator((data: { address?: string; mode?: string }) => {
    const address = String(data?.address ?? "").trim();
    if (!isChatAddress(address)) throw new Error("Invalid address");
    return { address, mode: asMode(data?.mode) };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const token = randomBytes(24).toString("base64url");
    const tokenHash = hashToken(token);
    await sql`
      insert into pride_chat_presence (address, token_hash, mode, seen_at)
      values (${data.address}, ${tokenHash}, ${data.mode}, now())
      on conflict (address) do update
      set token_hash = excluded.token_hash,
          mode = excluded.mode,
          seen_at = now()
    `;
    const me = await ensureProfile(data.address).catch(() => EMPTY_NAME);
    return { token, me, online: await onlineCount(), ttlMs: 24 * 3600 * 1000 };
  });

export const pingPrideChat = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    return { address, token };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ address: string }>`
      update pride_chat_presence
      set seen_at = now()
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
      returning address
    `;
    if (!rows[0]) throw new Error("Chat session expired");
    return { online: await onlineCount(), ok: true as const };
  });

export const postPrideChat = createServerFn({ method: "POST" })
  .validator((data: {
    address?: string;
    token?: string;
    body?: string;
    image?: string;
    tip?: string;
    reply?: string;
    mode?: string;
  }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const body = cleanBody(data?.body);
    const image = cleanImage(data?.image);
    const tip = cleanTip(data?.tip);
    const reply = cleanReply(data?.reply);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (!body && !image && !tip) throw new Error("Empty message");
    return { address, token, body, image, tip, reply, mode: asMode(data?.mode) };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const tokenHash = hashToken(data.token);
    const gate = await sql<{ last_post_at: string | null }>`
      update pride_chat_presence
      set seen_at = now(), mode = ${data.mode}
      where address = ${data.address} and token_hash = ${tokenHash}
      returning last_post_at
    `;
    if (!gate[0]) throw new Error("Chat session expired");
    const lastRaw = gate[0].last_post_at as string | Date | null;
    const last =
      lastRaw instanceof Date ? lastRaw.getTime() : lastRaw ? Date.parse(String(lastRaw)) : 0;
    if (Number.isFinite(last) && last > 0 && Date.now() - last < RATE_MS) {
      throw new Error("slow");
    }
    await sql`
      update pride_chat_presence
      set last_post_at = now()
      where address = ${data.address} and token_hash = ${tokenHash}
    `;
    const inserted = await sql<{
      id: number;
      address: string;
      mode: string;
      body: string;
      image: string | null;
      tip: string | null;
      reply: string | null;
      sale: string | null;
      at: number;
      edited_at: number;
    }>`
      insert into pride_chat_messages (address, mode, body, image, tip, reply)
      values (${data.address}, ${data.mode}, ${data.body}, ${data.image}, ${data.tip}, ${data.reply})
      returning id, address, mode, body, image, tip, reply, sale,
        (extract(epoch from created_at) * 1000)::bigint as at,
        coalesce((extract(epoch from edited_at) * 1000)::bigint, 0) as edited_at
    `;
    void trimChat().catch(() => undefined);
    const message = inserted[0] ? mapRow(inserted[0]) : null;
    if (!message) throw new Error("Send failed");
    return { message, online: await onlineCount() };
  });

export const CHAT_ONLINE_MS = ONLINE_MS;
export const CHAT_MAX_BODY = MAX_BODY;
export const CHAT_MAX_IMAGE = MAX_IMAGE_BYTES;
export const CHAT_SALE_ADDRESS = ADDRESSES.marketplace;
export const CHAT_EDIT_MS = EDIT_MS;

export const setChatNick = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string; nick?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const nick = cleanNick(data?.nick);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (!nick) throw new Error("bad-name");
    return { address, token, nick };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const gate = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!gate[0]) throw new Error("Chat session expired");
    const profile = await sql<{
      herotag: string;
      nick: string;
      x_handle: string;
      x_pending: string;
      x_code: string;
      x_verified: boolean;
    }>`
      select herotag, nick, x_handle, x_pending, x_code, x_verified
      from pride_chat_profiles where address = ${data.address}
    `;
    const herotag = herotagOf(profile[0]?.herotag);
    if (herotag) return asName({ ...profile[0], herotag, nick: "" }, true);
    const taken = await sql<{ address: string }>`
      select address from pride_chat_profiles
      where lower(nick) = lower(${data.nick}) and address <> ${data.address}
      limit 1
    `;
    if (taken[0]) throw new Error("taken");
    try {
      await sql`
        insert into pride_chat_profiles (address, herotag, nick, nick_at, updated_at)
        values (${data.address}, '', ${data.nick}, now(), now())
        on conflict (address) do update
        set nick = excluded.nick,
            nick_at = now(),
            updated_at = now()
      `;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|pride_chat_profiles_nick/i.test(msg)) throw new Error("taken");
      throw err;
    }
    return asName({ ...profile[0], herotag: "", nick: data.nick }, true);
  });

export const toggleChatReaction = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string; messageId?: number; kind?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const kind = asReactKind(data?.kind);
    const messageId = asId(data?.messageId);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (!kind || !messageId) throw new Error("Invalid reaction");
    return { address, token, kind, messageId };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const session = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!session[0]) throw new Error("Chat session expired");
    const msg = await sql<{ id: number }>`
      select id from pride_chat_messages where id = ${data.messageId} and deleted_at is null
    `;
    if (!msg[0]) throw new Error("Missing message");
    const existing = await sql<{ kind: string }>`
      select kind from pride_chat_reactions
      where message_id = ${data.messageId} and address = ${data.address} and kind = ${data.kind}
    `;
    if (existing[0]) {
      await sql`
        delete from pride_chat_reactions
        where message_id = ${data.messageId} and address = ${data.address} and kind = ${data.kind}
      `;
    } else {
      await sql`
        insert into pride_chat_reactions (message_id, address, kind)
        values (${data.messageId}, ${data.address}, ${data.kind})
      `;
    }
    const reactions = await loadReactions([data.messageId], data.address);
    return { messageId: data.messageId, reactions: reactions[String(data.messageId)] ?? [] };
  });

async function lookupXUser(handle: string): Promise<
  { ok: string; bio: string; name: string; id: string } | { missing: true } | { error: true }
> {
  const path = xLookupPath(handle);
  if (!path) return { missing: true };
  try {
    const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(path)}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return { missing: true };
    if (!res.ok) return { error: true };
    const json = (await res.json()) as {
      user?: {
        screen_name?: string;
        description?: string;
        name?: string;
        id?: string | number;
      };
      screen_name?: string;
      description?: string;
    };
    const screen = cleanXHandle(json.user?.screen_name ?? json.screen_name ?? "");
    if (!screen) return { missing: true };
    const id = String(json.user?.id ?? "").trim();
    return {
      ok: screen,
      bio: String(json.user?.description ?? json.description ?? ""),
      name: String(json.user?.name ?? "").slice(0, 80),
      id: /^\d{4,}$/.test(id) ? id : "",
    };
  } catch {
    return { error: true };
  }
}

async function twitterUserId(handle: string) {
  const looked = await lookupXUser(handle);
  if ("ok" in looked) return looked.id;
  return "";
}

function xLookupPath(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (/^\d{4,}$/.test(text)) return `id:${text}`;
  if (/^id:\d+$/i.test(text)) return text.toLowerCase();
  return cleanXHandle(text);
}

function handleCandidateFromEmail(email: string | null | undefined) {
  const raw = String(email ?? "").trim();
  if (!raw) return "";
  const at = raw.indexOf("@");
  const local = at > 0 ? raw.slice(0, at) : raw;
  if (/^\d{8,}$/.test(local)) return `id:${local}`;
  return cleanXHandle(local);
}

function numericFromAccountId(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (/^\d{4,}$/.test(text)) return text;
  const tail = text.includes("|") ? text.slice(text.lastIndexOf("|") + 1) : text;
  if (/^\d{4,}$/.test(tail)) return tail;
  const digits = /(\d{8,})/.exec(text);
  return digits ? digits[1] : "";
}

function handleFromDisplayName(name: unknown) {
  const stripped = String(name ?? "")
    .replace(/^@+/, "")
    .replace(/[^\w]/g, "");
  return cleanXHandle(stripped);
}

function isXProvider(providerId: string) {
  const id = providerId.toLowerCase();
  return (
    id === "grok-x" ||
    id === "twitter" ||
    id === "x" ||
    id.includes("twitter") ||
    id.endsWith("-x")
  );
}

function foldName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .toLowerCase();
}

function namesAlign(oauthName: string, profileName: string) {
  const a = foldName(oauthName);
  const b = foldName(profileName);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

async function searchXHandleByName(oauthName: string): Promise<{ handle: string; userId: string }> {
  const key = foldName(oauthName);
  if (!key || key.length < 3) return { handle: "", userId: "" };
  const g = globalThis as typeof globalThis & {
    __prideXName__?: Map<string, { at: number; handle: string; userId: string }>;
  };
  g.__prideXName__ ??= new Map();
  const hit = g.__prideXName__.get(key);
  const ttl = hit?.handle ? 24 * 60 * 60_000 : 5 * 60_000;
  if (hit && Date.now() - hit.at < ttl) return { handle: hit.handle, userId: hit.userId };

  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) return { handle: "", userId: "" };

  const empty = { handle: "", userId: "" };
  try {
    const res = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        input: `Find the X/Twitter account whose display name is exactly: ${oauthName}. Reply with JSON only: {"handle":"screen_name"}`,
        tools: [{ type: "x_search" }],
        max_output_tokens: 80,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      g.__prideXName__.set(key, { at: Date.now(), ...empty });
      return empty;
    }
    const json = (await res.json()) as {
      output?: {
        type?: string;
        content?: { type?: string; text?: string; annotations?: { url?: string }[] }[];
      }[];
    };
    const tries: string[] = [];
    const blob = JSON.stringify(json);
    for (const match of blob.matchAll(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/i\/user\/(\d{4,})/gi)) {
      tries.push(`id:${match[1]}`);
    }
    for (const item of json.output ?? []) {
      for (const part of item.content ?? []) {
        const text = String(part.text ?? "");
        const parsed = /"handle"\s*:\s*"@?([A-Za-z0-9_]{1,15})"/i.exec(text);
        if (parsed?.[1]) tries.push(parsed[1]);
        for (const ann of part.annotations ?? []) {
          const url = String(ann.url ?? "");
          const id = /\/i\/user\/(\d{4,})/i.exec(url)?.[1];
          if (id) tries.push(`id:${id}`);
          const named = /(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:\/|$)/i.exec(url)?.[1];
          if (named && named.toLowerCase() !== "i" && named.toLowerCase() !== "intent") {
            tries.push(named);
          }
        }
      }
    }
    const seen = new Set<string>();
    let fallback = empty;
    for (const candidate of tries) {
      const k = candidate.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const looked = await lookupXUser(candidate);
      if (!("ok" in looked) || !looked.name) continue;
      if (!namesAlign(oauthName, looked.name)) continue;
      const row = { handle: looked.ok, userId: looked.id };
      if (foldName(looked.name) === foldName(oauthName)) {
        g.__prideXName__.set(key, { at: Date.now(), ...row });
        return row;
      }
      if (!fallback.handle) fallback = row;
    }
    g.__prideXName__.set(key, { at: Date.now(), ...fallback });
    return fallback;
  } catch {
    g.__prideXName__.set(key, { at: Date.now(), ...empty });
    return empty;
  }
}

function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const data = JSON.parse(json) as unknown;
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isBrokerJwt(token: string) {
  const iss = String(decodeJwt(token)?.iss ?? "");
  return /auth\.grok\.me/i.test(iss);
}

function isTwitterUserToken(token: string) {
  const text = String(token ?? "").trim();
  if (text.length < 20) return false;
  if (isBrokerJwt(text)) return false;
  return true;
}

function handleFromClaims(claims: Record<string, unknown> | null | undefined) {
  if (!claims) return "";
  const keys = [
    "preferred_username",
    "username",
    "nickname",
    "screen_name",
    "twitter_username",
    "handle",
  ];
  for (const key of keys) {
    const handle = cleanXHandle(claims[key]);
    if (handle) return handle;
  }
  return "";
}

function numericIdFromClaims(claims: Record<string, unknown> | null | undefined) {
  if (!claims) return "";
  for (const key of ["sub", "id", "user_id", "uid", "twitter_id", "accountId"]) {
    const raw = String(claims[key] ?? "").trim();
    const tail = raw.includes("|") ? raw.slice(raw.lastIndexOf("|") + 1) : raw;
    if (/^\d{4,}$/.test(tail)) return tail;
  }
  return "";
}

function grokIssuer() {
  return (process.env.GROK_AUTH_ISSUER ?? "https://auth.grok.me").replace(/\/+$/, "");
}

function collectAccessTokens(value: unknown, into: string[], depth = 0) {
  if (!value || depth > 5) return;
  if (typeof value === "string") {
    const text = value.trim();
    if (text.length >= 24 && text.length < 4000 && !text.includes(" ")) into.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAccessTokens(item, into, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (
        /access.?token|refresh.?token|twitter.?token|x.?token|oauth.?token|identity.?token/i.test(
          key,
        )
      ) {
        collectAccessTokens(item, into, depth + 1);
      } else if (/identit|account|provider|twitter|credential/i.test(key)) {
        collectAccessTokens(item, into, depth + 1);
      }
    }
  }
}

function uniqueTokens(...groups: Array<string | string[] | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    const list = Array.isArray(group) ? group : group ? [group] : [];
    for (const raw of list) {
      const token = String(raw ?? "").trim();
      if (token.length < 20 || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

async function decryptStoredOAuthToken(raw: string | null | undefined) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  const looksEncrypted =
    text.startsWith("$ba$") || (/^[0-9a-f]+$/i.test(text) && text.length % 2 === 0 && text.length > 40);
  if (!looksEncrypted) return text;
  try {
    const { auth } = await import("@/lib/auth/server");
    const { symmetricDecrypt } = await import("better-auth/crypto");
    const ctx = await auth.$context;
    const secret = String((ctx as { secret?: string }).secret ?? process.env.BETTER_AUTH_SECRET ?? "").trim();
    if (!secret) return "";
    return String((await symmetricDecrypt({ key: secret, data: text })) ?? "").trim();
  } catch {
    return "";
  }
}

async function brokerUserInfo(accessToken: string) {
  try {
    const res = await fetch(`${grokIssuer()}/api/auth/oauth2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

async function brokerTwitterToken(brokerToken: string) {
  if (!brokerToken) return "";
  const issuer = grokIssuer();
  try {
    const res = await fetch(`${issuer}/api/auth/get-access-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${brokerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ providerId: "twitter" }),
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const json = (await res.json()) as { accessToken?: string };
      const token = String(json.accessToken ?? "").trim();
      if (isTwitterUserToken(token)) return token;
    }
  } catch {
    /* try token exchange */
  }
  try {
    const { PREVIEW_CLIENT_ID, PREVIEW_CLIENT_SECRET } = await import("./auth/preview");
    const clientId = process.env.GROK_AUTH_CLIENT_ID?.trim() || PREVIEW_CLIENT_ID;
    const clientSecret = process.env.GROK_AUTH_CLIENT_SECRET?.trim() || PREVIEW_CLIENT_SECRET;
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: brokerToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      audience: "https://api.x.com",
      scope: "users.read tweet.read like.write tweet.write offline.access",
    });
    const res = await fetch(`${issuer}/api/auth/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return "";
    const json = (await res.json()) as { access_token?: string; accessToken?: string };
    const token = String(json.access_token ?? json.accessToken ?? "").trim();
    return isTwitterUserToken(token) ? token : "";
  } catch {
    return "";
  }
}

async function findXAccount(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    accountId: string;
    providerId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    scope: string | null;
  }>`
    select "accountId", "providerId", "accessToken", "refreshToken", "idToken", "scope"
    from account where "userId" = ${userId}
  `;
  return rows.find((row) => isXProvider(String(row.providerId ?? ""))) ?? null;
}

async function xApiMe(accessToken: string) {
  if (!accessToken) return { id: "", username: "", name: "" };
  try {
    const res = await fetch("https://api.x.com/2/users/me?user.fields=username,name", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return { id: "", username: "", name: "" };
    const json = (await res.json()) as {
      data?: { id?: string; username?: string; name?: string };
    };
    const id = String(json.data?.id ?? "").trim();
    return {
      id: /^\d{4,}$/.test(id) ? id : "",
      username: cleanXHandle(json.data?.username ?? ""),
      name: String(json.data?.name ?? "").slice(0, 80),
    };
  } catch {
    return { id: "", username: "", name: "" };
  }
}

async function resolveXHandle(input: {
  accountId: string;
  email: string | null;
  name: string | null;
  accessToken?: string;
  claims?: Record<string, unknown> | null;
}) {
  const oauthName = String(input.name ?? "").trim();
  const tries: string[] = [];
  const fromApi = input.accessToken ? (await xApiMe(input.accessToken)).username : "";
  if (fromApi) tries.push(fromApi);
  const fromClaims = handleFromClaims(input.claims);
  if (fromClaims) tries.push(fromClaims);
  const fromEmail = handleCandidateFromEmail(input.email);
  if (fromEmail) tries.push(fromEmail);
  const numeric =
    numericIdFromClaims(input.claims) || numericFromAccountId(input.accountId);
  if (numeric) tries.push(`id:${numeric}`);
  const fromName = handleFromDisplayName(input.name);
  if (fromName) tries.push(fromName);
  const seen = new Set<string>();
  for (const candidate of tries) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const looked = await lookupXUser(candidate);
    if (!("ok" in looked)) continue;
    if (oauthName && looked.name && !namesAlign(oauthName, looked.name)) continue;
    return { handle: looked.ok, userId: looked.id };
  }
  if (fromApi) return { handle: fromApi, userId: "" };
  if (oauthName) return searchXHandleByName(oauthName);
  return { handle: "", userId: numeric };
}

const withAuthBearer = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const { getBearerToken } = await import("@/lib/auth/client");
    return next({ sendContext: { bearerToken: getBearerToken() ?? undefined } });
  })
  .server(async ({ next, context }) => {
    return next({
      context: { bearerToken: (context as { bearerToken?: string }).bearerToken },
    });
  });


async function readMineName(address: string) {
  const sql = await getSql();
  const rows = await sql<{
    herotag: string;
    nick: string;
    x_handle: string;
    x_pending: string;
    x_code: string;
    x_verified: boolean;
  }>`
    select herotag, nick, x_handle, x_pending, x_code, x_verified
    from pride_chat_profiles where address = ${address}
  `;
  return asName(rows[0], true);
}

function isFresh(created: string | Date | null | undefined) {
  if (!created) return false;
  const t = created instanceof Date ? created.getTime() : Date.parse(String(created));
  return Number.isFinite(t) && Date.now() - t <= EDIT_MS;
}

export const setChatXHandle = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string; handle?: string; step?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const step =
      data?.step === "verify" || data?.step === "unlink" ? data.step : ("begin" as const);
    const raw = String(data?.handle ?? "").trim();
    const handle = raw ? cleanXHandle(raw) : "";
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (step === "begin" && !handle) throw new Error("bad-name");
    return { address, token, handle, step };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const gate = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!gate[0]) throw new Error("Chat session expired");

    const readMine = async () => {
      const rows = await sql<{
        herotag: string;
        nick: string;
        x_handle: string;
        x_pending: string;
        x_code: string;
        x_verified: boolean;
      }>`
        select herotag, nick, x_handle, x_pending, x_code, x_verified
        from pride_chat_profiles where address = ${data.address}
      `;
      return asName(rows[0], true);
    };

    if (data.step === "unlink") {
      await sql`
        insert into pride_chat_profiles (address, herotag, nick, x_handle, x_pending, x_code, x_verified, x_user_id, x_handle_at, updated_at)
        values (${data.address}, '', '', '', '', '', false, '', now(), now())
        on conflict (address) do update
        set x_handle = '',
            x_pending = '',
            x_code = '',
            x_verified = false,
            x_user_id = '',
            x_handle_at = now(),
            updated_at = now()
      `;
      return readMine();
    }

    if (data.step === "begin") {
      const looked = await lookupXUser(data.handle);
      if ("missing" in looked) throw new Error("missing");
      const handle = "ok" in looked ? looked.ok : data.handle;
      const taken = await sql<{ address: string }>`
        select address from pride_chat_profiles
        where lower(x_handle) = lower(${handle}) and address <> ${data.address}
        limit 1
      `;
      if (taken[0]) throw new Error("taken");
      const code = xProofCode(data.address);
      await sql`
        insert into pride_chat_profiles (address, herotag, nick, x_pending, x_code, x_verified, updated_at)
        values (${data.address}, '', '', ${handle}, ${code}, false, now())
        on conflict (address) do update
        set x_pending = excluded.x_pending,
            x_code = excluded.x_code,
            updated_at = now()
      `;
      return readMine();
    }

    const current = await sql<{
      x_pending: string;
      x_code: string;
    }>`
      select x_pending, x_code from pride_chat_profiles where address = ${data.address}
    `;
    const pending = cleanXHandle(current[0]?.x_pending);
    const code = String(current[0]?.x_code ?? "") || xProofCode(data.address);
    if (!pending) throw new Error("bad-name");
    const looked = await lookupXUser(pending);
    if ("missing" in looked) throw new Error("missing");
    if ("error" in looked) throw new Error("bio");
    if (!proofInBio(looked.bio, code, data.address)) throw new Error("bio");
    const handle = looked.ok;
    const taken = await sql<{ address: string }>`
      select address from pride_chat_profiles
      where lower(x_handle) = lower(${handle}) and address <> ${data.address}
      limit 1
    `;
    if (taken[0]) throw new Error("taken");
    try {
      await sql`
        update pride_chat_profiles
        set x_handle = ${handle},
            x_pending = '',
            x_code = '',
            x_verified = true,
            x_handle_at = now(),
            updated_at = now()
        where address = ${data.address}
      `;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|pride_chat_profiles_x_handle/i.test(msg)) throw new Error("taken");
      throw err;
    }
    return readMine();
  });

export const claimChatXFromSession = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string; handle?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const handle = cleanXHandle(data?.handle);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    return { address, token, handle };
  })
  .middleware([withAuthBearer])
  .handler(async ({ data, context }) => {
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser(context.bearerToken);
    const sql = await getSql();
    const gate = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!gate[0]) throw new Error("Chat session expired");
    if (!session?.id) {
      return { needOauth: true as const, needHandle: false as const, me: await readMineName(data.address) };
    }

    const acc = await findXAccount(session.id);
    if (!acc?.accountId) {
      return { needOauth: true as const, needHandle: false as const, me: await readMineName(data.address) };
    }

    const users = await sql<{ name: string; email: string }>`
      select name, email from "user" where id = ${session.id} limit 1
    `;
    const tokens = await grokXTokens(context.bearerToken, session.id);
    const oauthName = String(users[0]?.name ?? tokens.claims?.name ?? "").trim();
    const oauthEmail = users[0]?.email ?? session.email ?? null;

    let handle = "";
    let xUserId = "";

    if (data.handle) {
      const looked = await lookupXUser(data.handle);
      if ("missing" in looked) throw new Error("missing");
      if (!("ok" in looked)) throw new Error("missing");
      if (oauthName && looked.name && !namesAlign(oauthName, looked.name)) {
        throw new Error("mismatch");
      }
      handle = looked.ok;
      xUserId = looked.id;
    } else {
      const current = await readMineName(data.address);
      if (current.xHandle) {
        const looked = await lookupXUser(current.xHandle);
        if ("ok" in looked && (!oauthName || !looked.name || namesAlign(oauthName, looked.name))) {
          handle = looked.ok;
          xUserId = looked.id;
        }
      }
      if (!handle) {
        const resolved = await resolveXHandle({
          accountId: acc.accountId,
          email: oauthEmail,
          name: oauthName || null,
          accessToken: tokens.twitter || undefined,
          claims: tokens.claims,
        });
        handle = resolved.handle;
        xUserId = resolved.userId;
      }
    }

    if (tokens.twitter) {
      const me = await xApiMe(tokens.twitter);
      if (me.username) handle = me.username;
      if (me.id) xUserId = me.id;
    }

    if (!handle) {
      const current = await readMineName(data.address);
      if (current.xHandle) {
        const looked = await lookupXUser(current.xHandle);
        if ("ok" in looked && oauthName && looked.name && namesAlign(oauthName, looked.name)) {
          handle = looked.ok;
          xUserId = looked.id || xUserId;
        } else {
          await sql`
            update pride_chat_profiles
            set x_handle = '',
                x_pending = '',
                x_code = '',
                x_verified = false,
                x_user_id = '',
                x_handle_at = now(),
                updated_at = now()
            where address = ${data.address}
          `;
        }
      }
    }

    if (!handle) {
      return { needOauth: false as const, needHandle: true as const, me: await readMineName(data.address) };
    }

    if (!xUserId) xUserId = await twitterUserId(handle);

    const taken = await sql<{ address: string }>`
      select address from pride_chat_profiles
      where address <> ${data.address}
        and (
          lower(x_handle) = lower(${handle})
          or (${xUserId} <> '' and x_user_id <> '' and x_user_id = ${xUserId})
        )
      limit 1
    `;
    if (taken[0]) throw new Error("taken");

    try {
      await sql`
        insert into pride_chat_profiles (
          address, herotag, nick, x_handle, x_pending, x_code, x_verified, x_user_id, x_handle_at, updated_at
        )
        values (
          ${data.address}, '', '', ${handle}, '', '', true, ${xUserId}, now(), now()
        )
        on conflict (address) do update
        set x_handle = excluded.x_handle,
            x_pending = '',
            x_code = '',
            x_verified = true,
            x_user_id = excluded.x_user_id,
            x_handle_at = now(),
            updated_at = now()
      `;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/unique|pride_chat_profiles_x_handle|pride_chat_profiles_x_user/i.test(msg)) {
        throw new Error("taken");
      }
      throw err;
    }
    return { needOauth: false as const, needHandle: false as const, me: await readMineName(data.address) };
  });

export type XPostAction = "like" | "unlike" | "repost" | "unrepost" | "reply";

function asTweetId(raw: unknown) {
  const id = String(raw ?? "").trim();
  return /^\d{1,25}$/.test(id) ? id : "";
}

export function xIntentUrl(kind: XPostAction, tweetId: string, text = "") {
  if (kind === "like" || kind === "unlike") {
    return `https://x.com/intent/like?tweet_id=${encodeURIComponent(tweetId)}`;
  }
  if (kind === "repost" || kind === "unrepost") {
    return `https://x.com/intent/retweet?tweet_id=${encodeURIComponent(tweetId)}`;
  }
  const query = new URLSearchParams();
  query.set("in_reply_to", tweetId);
  if (text) query.set("text", text.slice(0, 280));
  return `https://x.com/intent/tweet?${query.toString()}`;
}

async function grokXTokens(bearerToken?: string, userId?: string) {
  let broker = "";
  let idToken = "";
  try {
    const { auth } = await import("@/lib/auth/server");
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (request) {
      let headers = request.headers;
      if (bearerToken) {
        headers = new Headers(request.headers);
        headers.set("Authorization", `Bearer ${bearerToken}`);
      }
      for (const providerId of ["grok-x", "twitter", "x"] as const) {
        try {
          const tokens = await auth.api.getAccessToken({
            body: userId ? { providerId, userId } : { providerId },
            headers,
          });
          const token = String(tokens?.accessToken ?? "").trim();
          if (token) broker = token;
          const id = String((tokens as { idToken?: string })?.idToken ?? "").trim();
          if (id) idToken = id;
          if (broker) break;
        } catch {
          /* try next provider id */
        }
      }
    }
  } catch {
    /* no session / no token */
  }
  const acc = userId ? await findXAccount(userId).catch(() => null) : null;
  if (!idToken) idToken = String(acc?.idToken ?? "").trim();
  if (!broker && acc?.accessToken) {
    broker = await decryptStoredOAuthToken(acc.accessToken);
  }
  if (acc?.refreshToken && !broker) {
    const refresh = await decryptStoredOAuthToken(acc.refreshToken);
    if (refresh && !isBrokerJwt(refresh) && refresh.length > 20) {
      broker = refresh;
    }
  }
  const claims = decodeJwt(idToken) || decodeJwt(broker);
  const info = broker ? await brokerUserInfo(broker) : null;
  const merged = { ...(claims ?? {}), ...(info ?? {}) };
  const nested: string[] = [];
  collectAccessTokens(merged, nested);
  collectAccessTokens(decodeJwt(broker), nested);
  const twitter =
    (broker ? await brokerTwitterToken(broker) : "") ||
    nested.find((token) => isTwitterUserToken(token) && !isBrokerJwt(token)) ||
    (isTwitterUserToken(broker) ? broker : "");
  return {
    broker,
    twitter,
    idToken,
    extra: uniqueTokens(nested),
    claims: Object.keys(merged).length ? merged : null,
  };
}

async function xApiAct(
  accessToken: string,
  userId: string,
  action: XPostAction,
  tweetId: string,
  text: string,
) {
  if (!accessToken || !userId) return false;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const signal = AbortSignal.timeout(10_000);
  const hosts = ["https://api.x.com", "https://api.twitter.com"] as const;

  async function send(path: string, init: RequestInit) {
    for (const host of hosts) {
      try {
        const res = await fetch(`${host}${path}`, { ...init, headers, signal });
        if (res.ok || res.status === 409) return true;
        const body = await res.text().catch(() => "");
        if (res.status === 403 || res.status === 401 || res.status === 429) {
          if (/already|duplicate|you have already|favorited/i.test(body)) return true;
        }
        if (res.status >= 500) continue;
      } catch {
        /* try next host */
      }
    }
    return false;
  }

  if (action === "like") {
    if (
      await send(`/2/users/${userId}/likes`, {
        method: "POST",
        body: JSON.stringify({ tweet_id: tweetId }),
      })
    ) {
      return true;
    }
    return send(`/1.1/favorites/create.json?id=${encodeURIComponent(tweetId)}`, {
      method: "POST",
      body: "{}",
    });
  }
  if (action === "unlike") {
    if (await send(`/2/users/${userId}/likes/${tweetId}`, { method: "DELETE" })) return true;
    return send(`/1.1/favorites/destroy.json?id=${encodeURIComponent(tweetId)}`, {
      method: "POST",
      body: "{}",
    });
  }
  if (action === "repost") {
    if (
      await send(`/2/users/${userId}/retweets`, {
        method: "POST",
        body: JSON.stringify({ tweet_id: tweetId }),
      })
    ) {
      return true;
    }
    return send(`/1.1/statuses/retweet/${encodeURIComponent(tweetId)}.json`, {
      method: "POST",
      body: "{}",
    });
  }
  if (action === "unrepost") {
    if (await send(`/2/users/${userId}/retweets/${tweetId}`, { method: "DELETE" })) return true;
    return send(`/1.1/statuses/unretweet/${encodeURIComponent(tweetId)}.json`, {
      method: "POST",
      body: "{}",
    });
  }
  const body = text.trim().slice(0, 280);
  if (!body) return false;
  if (
    await send("/2/tweets", {
      method: "POST",
      body: JSON.stringify({
        text: body,
        reply: { in_reply_to_tweet_id: tweetId },
      }),
    })
  ) {
    return true;
  }
  return send("/1.1/statuses/update.json", {
    method: "POST",
    body: JSON.stringify({
      status: body,
      in_reply_to_status_id: tweetId,
      auto_populate_reply_metadata: true,
    }),
  });
}

export const actOnXPost = createServerFn({ method: "POST" })
  .middleware([withAuthBearer])
  .validator((data: { address?: string; token?: string; tweetId?: string; action?: string; text?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const tweetId = asTweetId(data?.tweetId);
    const action = (
      data?.action === "unlike" ||
      data?.action === "repost" ||
      data?.action === "unrepost" ||
      data?.action === "reply"
        ? data.action
        : "like"
    ) as XPostAction;
    const text = String(data?.text ?? "")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim()
      .slice(0, 280);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (!tweetId) throw new Error("missing");
    return { address, token, tweetId, action, text };
  })
  .handler(async ({ data, context }) => {
    const intent = xIntentUrl(data.action, data.tweetId, data.text);
    const sql = await getSql();
    const gate = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!gate[0]) throw new Error("Chat session expired");
    const mine = await sql<{
      x_handle: string;
      x_verified: boolean | string | number | null;
      x_user_id: string;
    }>`
      select x_handle, x_verified, x_user_id from pride_chat_profiles
      where address = ${data.address}
    `;
    const row = mine[0];
    const verified =
      row?.x_verified === true ||
      row?.x_verified === "t" ||
      String(row?.x_verified) === "true" ||
      Number(row?.x_verified) === 1;
    const linked = Boolean(verified && cleanXHandle(row?.x_handle));
    const { getSessionUser } = await import("@/lib/auth/verify.server");
    const session = await getSessionUser(context.bearerToken);
    if (!linked && !session) {
      return {
        ok: false as const,
        needOauth: true as const,
        needHandle: false as const,
        needWriteAuth: false as const,
        authUrl: "",
        intent,
      };
    }
    const tokens = await grokXTokens(context.bearerToken, session?.id);
    const { loadWriteToken, saveWriteToken } = await import("./x-write.server");
    const stored = await loadWriteToken(data.address).catch(() => ({
      access: "",
      refresh: "",
      userId: "",
      scopes: "",
    }));
    const candidates = uniqueTokens(
      stored.access,
      tokens.twitter,
      tokens.extra,
      tokens.broker,
      tokens.idToken,
    );
    let userId = stored.userId;
    for (const token of candidates) {
      const me = await xApiMe(token);
      if (me.id) {
        userId = me.id;
        break;
      }
    }
    if (!userId) {
      const storedId = /^\d{4,}$/.test(String(row?.x_user_id ?? "")) ? String(row?.x_user_id) : "";
      userId = storedId;
    }
    if (!userId) {
      const handle = cleanXHandle(row?.x_handle);
      if (handle) userId = await twitterUserId(handle);
    }
    if (userId) {
      for (const token of candidates) {
        try {
          const ok = await xApiAct(token, userId, data.action, data.tweetId, data.text);
          if (ok) {
            if (isTwitterUserToken(token)) {
              await saveWriteToken(data.address, {
                access: token,
                refresh: stored.refresh,
                userId,
                userIdKey: session?.id ?? "",
                scopes: stored.scopes,
              }).catch(() => undefined);
            }
            return {
              ok: true as const,
              needOauth: false as const,
              needHandle: false as const,
              needWriteAuth: false as const,
              authUrl: "",
              intent,
            };
          }
        } catch {
          /* stay in chat — never bounce to X */
        }
      }
    }
    if (session && !linked) {
      return {
        ok: false as const,
        needOauth: false as const,
        needHandle: true as const,
        needWriteAuth: false as const,
        authUrl: "",
        intent,
      };
    }
    const authUrl = `/api/x/start?address=${encodeURIComponent(data.address)}&token=${encodeURIComponent(data.token)}&action=${encodeURIComponent(data.action)}&tweetId=${encodeURIComponent(data.tweetId)}&text=${encodeURIComponent(data.text)}`;
    return {
      ok: false as const,
      needOauth: false as const,
      needHandle: false as const,
      needWriteAuth: true as const,
      authUrl,
      intent,
    };
  });

export const editPrideChat = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string; id?: number; body?: string }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const id = asId(data?.id);
    const body = cleanBody(data?.body);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (!id) throw new Error("Missing message");
    return { address, token, id, body };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const session = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!session[0]) throw new Error("Chat session expired");
    const rows = await sql<{
      id: number;
      address: string;
      image: string | null;
      tip: string | null;
      sale: string | null;
      created_at: string | Date;
    }>`
      select id, address, image, tip, sale, created_at
      from pride_chat_messages
      where id = ${data.id} and deleted_at is null
    `;
    const row = rows[0];
    if (!row || row.address !== data.address) throw new Error("Missing message");
    if (row.sale) throw new Error("late");
    if (!isFresh(row.created_at)) throw new Error("late");
    if (!data.body && !cleanImage(row.image) && !cleanTip(row.tip)) throw new Error("Empty message");
    const updated = await sql<{
      id: number;
      address: string;
      mode: string;
      body: string;
      image: string | null;
      tip: string | null;
      reply: string | null;
      sale: string | null;
      at: number;
      edited_at: number;
    }>`
      update pride_chat_messages
      set body = ${data.body}, edited_at = now()
      where id = ${data.id} and address = ${data.address} and deleted_at is null
      returning id, address, mode, body, image, tip, reply, sale,
        (extract(epoch from created_at) * 1000)::bigint as at,
        coalesce((extract(epoch from edited_at) * 1000)::bigint, 0) as edited_at
    `;
    const message = updated[0] ? mapRow(updated[0]) : null;
    if (!message) throw new Error("Missing message");
    return { message };
  });

export const deletePrideChat = createServerFn({ method: "POST" })
  .validator((data: { address?: string; token?: string; id?: number }) => {
    const address = String(data?.address ?? "").trim();
    const token = String(data?.token ?? "").trim();
    const id = asId(data?.id);
    if (!isChatAddress(address) || token.length < 16) throw new Error("Invalid session");
    if (!id) throw new Error("Missing message");
    return { address, token, id };
  })
  .handler(async ({ data }) => {
    const sql = await getSql();
    const session = await sql<{ address: string }>`
      select address from pride_chat_presence
      where address = ${data.address} and token_hash = ${hashToken(data.token)}
    `;
    if (!session[0]) throw new Error("Chat session expired");
    const rows = await sql<{
      id: number;
      address: string;
      sale: string | null;
      created_at: string | Date;
    }>`
      select id, address, sale, created_at
      from pride_chat_messages
      where id = ${data.id} and deleted_at is null
    `;
    const row = rows[0];
    if (!row || row.address !== data.address) throw new Error("Missing message");
    if (row.sale) throw new Error("late");
    if (!isFresh(row.created_at)) throw new Error("late");
    await sql`
      update pride_chat_messages
      set deleted_at = now()
      where id = ${data.id} and address = ${data.address} and deleted_at is null
    `;
    await sql`delete from pride_chat_reactions where message_id = ${data.id}`;
    return { id: data.id };
  });

export type XPost = {
  id: string;
  url: string;
  text: string;
  name: string;
  handle: string;
  avatar: string;
  image: string;
  likes: number;
  retweets: number;
  replies: number;
};

function asHttps(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function parseXStatus(raw: unknown) {
  const text = String(raw ?? "").trim();
  const match =
    /(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter\.com|x\.com)\/(?:[A-Za-z0-9_]+|i\/web)\/status(?:es)?\/(\d{1,25})/i.exec(
      text,
    );
  if (!match) return null;
  return { id: match[1], url: `https://x.com/i/status/${match[1]}` };
}

export const getXPost = createServerFn({ method: "GET" })
  .validator((data: { url?: string } | undefined) => {
    const parsed = parseXStatus(data?.url);
    if (!parsed) throw new Error("bad");
    return parsed;
  })
  .handler(async ({ data }) => {
    const g = globalThis as typeof globalThis & {
      __prideXPost__?: Map<string, { at: number; post: XPost }>;
    };
    g.__prideXPost__ ??= new Map();
    const hit = g.__prideXPost__.get(data.id);
    if (hit && Date.now() - hit.at < 10 * 60_000) return hit.post;

    const post: XPost = {
      id: data.id,
      url: data.url,
      text: "",
      name: "",
      handle: "",
      avatar: "",
      image: "",
      likes: 0,
      retweets: 0,
      replies: 0,
    };
    try {
      const res = await fetch(`https://api.fxtwitter.com/status/${data.id}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          tweet?: {
            text?: string;
            likes?: number;
            retweets?: number;
            replies?: number;
            author?: { name?: string; screen_name?: string; avatar_url?: string };
            media?: { photos?: { url?: string }[] };
          };
        };
        const tweet = json.tweet;
        if (tweet) {
          post.text = String(tweet.text ?? "").slice(0, 2_000);
          post.name = String(tweet.author?.name ?? "").slice(0, 80);
          post.handle = String(tweet.author?.screen_name ?? "")
            .replace(/^@/, "")
            .slice(0, 40);
          post.avatar = asHttps(tweet.author?.avatar_url);
          post.image = asHttps(tweet.media?.photos?.[0]?.url);
          post.likes = Number(tweet.likes) || 0;
          post.retweets = Number(tweet.retweets) || 0;
          post.replies = Number(tweet.replies) || 0;
        }
      }
    } catch {
      /* card still opens the post on X */
    }
    g.__prideXPost__.set(data.id, { at: Date.now(), post });
    if (g.__prideXPost__.size > 80) {
      const first = g.__prideXPost__.keys().next().value;
      if (first) g.__prideXPost__.delete(first);
    }
    return post;
  });
