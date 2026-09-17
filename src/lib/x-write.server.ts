import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { DEMO_ADDRESS } from "./config";
import { getSql } from "./db";
import { isErdAddress } from "./utils";

const X_OAUTH_CLIENT_ID =
  process.env.X_CLIENT_ID?.trim() || "YzluQkprbG1GSU40U3dwREdWNUY6MTpjaQ";
const X_OAUTH_CLIENT_SECRET = process.env.X_CLIENT_SECRET?.trim() || "";
const X_OAUTH_SCOPES = "users.read tweet.read offline.access";

function isChatAddress(value: string) {
  return value === DEMO_ADDRESS || isErdAddress(value);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function asTweetId(raw: unknown) {
  const id = String(raw ?? "").trim();
  return /^\d{1,25}$/.test(id) ? id : "";
}

function xWriteKey() {
  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.GROK_AUTH_CLIENT_SECRET?.trim() ||
    "pride-x-write";
  return createHash("sha256").update(`pv-x:${secret}`).digest();
}

async function sealXToken(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", xWriteKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

async function openXToken(blob: string) {
  try {
    const buf = Buffer.from(blob, "base64url");
    if (buf.length < 29) return "";
    const decipher = createDecipheriv("aes-256-gcm", xWriteKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = xfHost || request.headers.get("host") || url.host;
  const proto = xfProto || (url.protocol === "http:" ? "http" : "https");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function exchangeTwitterToken(body: URLSearchParams) {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (X_OAUTH_CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(`${X_OAUTH_CLIENT_ID}:${X_OAUTH_CLIENT_SECRET}`).toString("base64")}`;
  }
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(12_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!res.ok || !json.access_token) return { access: "", refresh: "", expiresAt: 0, scopes: "" };
  return {
    access: String(json.access_token).trim(),
    refresh: String(json.refresh_token ?? "").trim(),
    expiresAt: Date.now() + Math.max(60, Number(json.expires_in ?? 7200)) * 1000,
    scopes: String(json.scope ?? ""),
  };
}

async function refreshTwitterToken(refresh: string) {
  if (!refresh) return { access: "", refresh: "", expiresAt: 0, scopes: "" };
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refresh,
    client_id: X_OAUTH_CLIENT_ID,
  });
  return exchangeTwitterToken(body);
}

export async function loadWriteToken(address: string) {
  const sql = await getSql();
  const rows = await sql<{
    access_token: string;
    refresh_token: string;
    token_expires: string | Date | null;
    scopes: string;
    x_user_id: string;
  }>`
    select access_token, refresh_token, token_expires, scopes, x_user_id
    from pride_x_write where address = ${address} limit 1
  `;
  const row = rows[0];
  if (!row?.access_token) return { access: "", refresh: "", userId: "", scopes: "" };
  let access = await openXToken(row.access_token);
  let refresh = await openXToken(row.refresh_token);
  const expires =
    row.token_expires instanceof Date
      ? row.token_expires.getTime()
      : row.token_expires
        ? Date.parse(String(row.token_expires))
        : 0;
  if (access && refresh && Number.isFinite(expires) && expires > 0 && expires - Date.now() < 60_000) {
    const refreshed = await refreshTwitterToken(refresh);
    if (refreshed.access) {
      access = refreshed.access;
      refresh = refreshed.refresh || refresh;
      await saveWriteToken(address, {
        access,
        refresh,
        expiresAt: refreshed.expiresAt,
        scopes: refreshed.scopes || row.scopes,
        userId: row.x_user_id,
        userIdKey: "",
      });
    }
  }
  return { access, refresh, userId: row.x_user_id, scopes: row.scopes };
}

export async function saveWriteToken(
  address: string,
  data: {
    access: string;
    refresh?: string;
    expiresAt?: number;
    scopes?: string;
    userId?: string;
    userIdKey: string;
  },
) {
  if (!data.access) return;
  const sql = await getSql();
  const expires = data.expiresAt && Number.isFinite(data.expiresAt) ? new Date(data.expiresAt) : null;
  await sql`
    insert into pride_x_write (
      address, user_id, access_token, refresh_token, token_expires, scopes, x_user_id, updated_at
    )
    values (
      ${address},
      ${data.userIdKey},
      ${await sealXToken(data.access)},
      ${await sealXToken(data.refresh ?? "")},
      ${expires},
      ${data.scopes ?? ""},
      ${data.userId ?? ""},
      now()
    )
    on conflict (address) do update
    set user_id = excluded.user_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires = excluded.token_expires,
        scopes = excluded.scopes,
        x_user_id = excluded.x_user_id,
        updated_at = now()
  `;
}

export async function startXWriteOAuth(request: Request) {
  const url = new URL(request.url);
  const address = String(url.searchParams.get("address") ?? "").trim();
  const token = String(url.searchParams.get("token") ?? "").trim();
  const tweetId = asTweetId(url.searchParams.get("tweetId"));
  const rawAction = String(url.searchParams.get("action") ?? "like");
  const action =
    rawAction === "unlike" || rawAction === "repost" || rawAction === "unrepost" || rawAction === "reply"
      ? rawAction
      : "like";
  const text = String(url.searchParams.get("text") ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 280);
  const origin = requestOrigin(request);
  const fail = (code: string) => Response.redirect(`${origin}/?pvx=${encodeURIComponent(code)}`, 302);
  if (!isChatAddress(address) || token.length < 16) return fail("need");
  const sql = await getSql();
  const gate = await sql<{ address: string }>`
    select address from pride_chat_presence
    where address = ${address} and token_hash = ${hashToken(token)}
  `;
  if (!gate[0]) return fail("need");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${origin}/api/x/callback`;
  try {
    await sql`
      insert into pride_x_oauth (
        state, verifier, address, chat_token_hash, action, tweet_id, text_body, redirect_uri, created_at
      )
      values (
        ${state}, ${verifier}, ${address}, ${hashToken(token)}, ${action}, ${tweetId}, ${text}, ${redirectUri}, now()
      )
    `;
  } catch {
    return fail("fail");
  }
  const authorize = new URL("https://x.com/i/oauth2/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", X_OAUTH_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", X_OAUTH_SCOPES);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return Response.redirect(authorize.toString(), 302);
}

export async function finishXWriteOAuth(request: Request) {
  const url = new URL(request.url);
  const origin = requestOrigin(request);
  const fail = (code: string) => Response.redirect(`${origin}/?pvx=${encodeURIComponent(code)}`, 302);
  const err = String(url.searchParams.get("error") ?? "").trim();
  if (err) return fail("deny");
  const code = String(url.searchParams.get("code") ?? "").trim();
  const state = String(url.searchParams.get("state") ?? "").trim();
  if (!code || !state) return fail("fail");
  const sql = await getSql();
  const rows = await sql<{
    verifier: string;
    address: string;
    redirect_uri: string;
    created_at: string | Date;
  }>`
    delete from pride_x_oauth
    where state = ${state}
    returning verifier, address, redirect_uri, created_at
  `;
  const row = rows[0];
  if (!row) return fail("fail");
  const created =
    row.created_at instanceof Date ? row.created_at.getTime() : Date.parse(String(row.created_at));
  if (!Number.isFinite(created) || Date.now() - created > 15 * 60_000) return fail("fail");
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: row.redirect_uri || `${origin}/api/x/callback`,
      client_id: X_OAUTH_CLIENT_ID,
      code_verifier: row.verifier,
    });
    const tokens = await exchangeTwitterToken(body);
    if (!tokens.access) return fail("fail");
    let userId = "";
    try {
      const me = await fetch("https://api.x.com/2/users/me", {
        headers: { Authorization: `Bearer ${tokens.access}` },
        signal: AbortSignal.timeout(8_000),
      });
      if (me.ok) {
        const json = (await me.json()) as { data?: { id?: string } };
        const id = String(json.data?.id ?? "").trim();
        if (/^\d{4,}$/.test(id)) userId = id;
      }
    } catch {
      /* keep empty */
    }
    await saveWriteToken(row.address, {
      access: tokens.access,
      refresh: tokens.refresh,
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      userId,
      userIdKey: "",
    });
    return Response.redirect(`${origin}/?pvx=ok`, 302);
  } catch {
    return fail("fail");
  }
}
