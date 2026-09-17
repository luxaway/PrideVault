import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Lang } from "./i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddr(address: string, left = 6, right = 4) {
  if (address.length <= left + right + 1) return address;
  return `${address.slice(0, left)}…${address.slice(-right)}`;
}

export function formatNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/**
 * Claimable ROAR. Adaptive digits so 1 Heart (~0.00067/h) is visible,
 * while 345 Hearts still read like OOX (27.56). Always floor.
 */
export function formatRoarClaim(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0.00";
  const digits = n >= 1 ? 2 : n >= 0.01 ? 4 : n >= 0.0001 ? 6 : 8;
  const f = 10 ** digits;
  let floored = Math.floor(n * f + 1e-9) / f;
  let used = digits;
  if (floored <= 0) {
    floored = Math.floor(n * 1e8 + 1e-9) / 1e8;
    used = 8;
  }
  if (floored <= 0) return n.toFixed(10).replace(/\.?0+$/, "") || "0.00";
  return floored.toLocaleString("en-US", {
    minimumFractionDigits: used,
    maximumFractionDigits: used,
  });
}


export function formatUsd(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatEgldAmount(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const d = abs >= 1 ? digits : abs >= 0.01 ? Math.max(digits, 4) : abs >= 0.0001 ? 6 : 8;
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, d),
    maximumFractionDigits: d,
  });
  if (Number(formatted.replace(/,/g, "")) === 0) {
    return n.toFixed(10).replace(/0+$/, "").replace(/\.$/, "") || "0";
  }
  return formatted;
}

export function formatEgld(n: number, digits = 2) {
  const amt = formatEgldAmount(n, digits);
  if (amt === "—") return amt;
  return `${amt} EGLD`;
}

export function formatUsdc(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return `${formatNum(n, digits)} USDC`;
}

export function fillAmt(template: string, amount: string) {
  if (!template) return amount;
  return template.includes("{n}") ? template.replaceAll("{n}", amount) : `${template} ${amount}`;
}

export function formatPct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatNum(n, digits)}%`;
}

export function fromDenom(raw: string | number | undefined, decimals = 18) {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  return n / 10 ** decimals;
}

export function timeAgo(tsSecOrMs: number, lang: Lang, now = Date.now()) {
  if (!tsSecOrMs) return "—";
  const ms = tsSecOrMs < 1e12 ? tsSecOrMs * 1000 : tsSecOrMs;
  const delta = Math.max(0, now - ms);
  const s = Math.floor(delta / 1000);
  if (s < 8) return lang === "fr" ? "à l'instant" : "just now";
  if (s < 60) return lang === "fr" ? `il y a ${s}s` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return lang === "fr" ? `il y a ${m} min` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return lang === "fr" ? `il y a ${h} h` : `${h}h ago`;
  const days = Math.floor(h / 24);
  return lang === "fr" ? `il y a ${days} j` : `${days}d ago`;
}

export function isErdAddress(value: string) {
  return /^erd1[a-z0-9]{58}$/.test(value.trim());
}

/** EGLD, ESDT `TICKER-hex6`, or NFT `TICKER-hex6-nonce`. */
export function isTokenId(value: string) {
  const id = value.trim();
  if (id === "EGLD") return true;
  return /^[A-Za-z0-9]{3,20}-[a-f0-9]{6}(-[a-fA-F0-9]+)?$/.test(id);
}
