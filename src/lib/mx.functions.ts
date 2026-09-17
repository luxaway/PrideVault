// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import {
  ADDRESSES,
  BURN_ADDRESS,
  BURNIFY,
  CHAIN,
  COLLECTION,
  DUST,
  FARM,
  HATOM,
  LST,
  PAIRS,
  SWAP,
  SWAP_TOKENS,
  TIMEFRAMES,
  TOKEN,
  VAULT,
  XMEX,
  hatomMarketOf,
  hatomRoleOf,
  isBurnifyAsset,
  isDustConvertible,
  isHatomAsset,
  asSlippagePct,
  slippageAggOf,
  slippageBpsOf,
  ooxBuyUrl,
  swapUrl,
  swapEgldKeepGas,
} from "./config";
import {
  COLLECTION_HEX,
  bech32ToHex,
  encodeBuyData,
  encodeClaimDelegation,
  encodeClaimHearts,
  encodeFarmNftCall,
  encodeJexCreateOrder,
  encodeMultiEsdtNftTransfer,
  encodeEsdtTransfer,
  encodeEsdtNftSend,
  encodeMultiEsdtSend,
  encodeMultiPairSwap,
  encodeReDelegateRewards,
  encodeStakeFarm,
  encodeStakeFarmMerge,
  encodeStakeHearts,
  encodeSwapFixedInput,
  encodeUnstakeHearts,
  encodeUnwrapEgld,
  encodeWrapEgld,
  encodeBurnifyStakeBfy,
  encodeBurnifyUnstakeBfy,
  encodeBurnifyClaim,
  encodeBurnifyStakeBufu,
  encodeBurnifyUnstakeBufu,
  encodeDelegate,
  encodeUnDelegate,
  encodeWithdrawDelegation,
  fromAtomic,
  toAtomic,
  toEvenHex,
  weiTimes,
  type UnsignedTx,
} from "./tx";
import { fromDenom, isErdAddress, isTokenId } from "./utils";
import { accruePending, dailyFromPool } from "./vault";
import type { HistoryItem } from "./store";

export type HolderKind = "market" | "ooxStake" | "holder";

export type HolderRow = {
  address: string;
  balance: number;
  kind: HolderKind;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type BoardEquivalent = {
  ticker: string;
  amount: number;
};

export type BoardToken = {
  id: string;
  ticker: string;
  name: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  icon: string;
  equivalent?: BoardEquivalent;
};

export type BoardNft = {
  collection: string;
  identifier: string;
  name: string;
  ticker: string;
  amount: number;
  thumbnail: string;
  valueUsd: number;
  isHeart: boolean;
};

export type BoardPosition = {
  id: string;
  titleKey?: "walletHeartFarm" | "walletRoarFarm" | "walletDelegation";
  title?: string;
  amount: number;
  amountTicker: string;
  pending: number;
  unlocking: number;
  valueUsd: number;
  pendingUsd: number;
};

export type BoardVenue = "xexchange" | "onedex" | "jexchange" | "other";

export type BoardPoolKind = "lp" | "farm" | "stakedLp" | "xmex" | "order";

export type BoardPoolUnder = {
  id: string;
  ticker: string;
  amount: number;
  icon: string;
  valueUsd: number;
};

export type BoardPool = {
  id: string;
  venue: BoardVenue;
  kind: BoardPoolKind;
  title: string;
  pairLabel: string;
  amount: number;
  amountTicker: string;
  valueUsd: number;
  icon: string;
  icon2?: string;
  under?: BoardPoolUnder[];
  equivalent?: BoardEquivalent;
};

export type BoardDelegation = {
  contract: string;
  name: string;
  identity?: string;
  avatar?: string;
  staked: number;
  rewards: number;
  unlocking: number;
  unlockReady?: number;
  unlockEndsAt?: number;
  apr?: number;
  valueUsd: number;
  pendingUsd: number;
};

export type BoardProvider = {
  contract: string;
  name: string;
  identity?: string;
  avatar?: string;
  apr?: number;
  nodes?: number;
  users?: number;
  featured?: boolean;
  fee?: number;
};

export type WalletBoard = {
  address: string;
  totalUsd: number;
  tokensUsd: number;
  nftsUsd: number;
  poolsUsd: number;
  stakingUsd: number;
  tokens: BoardToken[];
  nfts: BoardNft[];
  pools: BoardPool[];
  positions: BoardPosition[];
  delegations: BoardDelegation[];
  providers: BoardProvider[];
  hatom: HatomBoard;
  burnify: BurnifyBoard;
  fetchedAt: number;
};

export type ProtocolRole =
  | "supply"
  | "borrow"
  | "booster"
  | "lst"
  | "ushStake"
  | "isolated"
  | "liquid"
  | "lp"
  | "staked"
  | "nft"
  | "fuel";

export type ProtocolRow = {
  id: string;
  protocol: "hatom" | "burnify";
  role: ProtocolRole;
  ticker: string;
  name: string;
  amount: number;
  amountTicker: string;
  valueUsd: number;
  pending?: number;
  pendingUsd?: number;
  icon: string;
  underlying?: string;
};

export type HatomBoard = {
  suppliedUsd: number;
  borrowedUsd: number;
  boosterUsd: number;
  lstUsd: number;
  ushStakeUsd: number;
  liquidUsd: number;
  isolatedUsd: number;
  borrowLimitUsd: number;
  rows: ProtocolRow[];
};

export type BurnifyNftRef = {
  collection: string;
  nonce: number;
  index?: number;
};

export type BurnifyBoard = {
  liquidUsd: number;
  stakedUsd: number;
  nftUsd: number;
  pendingUsd: number;
  pendingEgld: number;
  nftPendingEgld: number;
  liquidBfy: number;
  stakedBfy: number;
  bfyPriceUsd: number;
  lockedUntilEpoch: number;
  walletBufu: BurnifyNftRef[];
  stakedBufu: BurnifyNftRef[];
  rows: ProtocolRow[];
};

export type FarmAction = "stake" | "unstake" | "claim" | "compound" | "unbond";

export type FarmSlot = {
  kind: string;
  nonce: number;
  amount: number;
  amountRaw?: string;
  unlockEpoch: number;
};

export type FarmPosition = {
  staked: number;
  pending: number;
  unlocking: number;
  slots: FarmSlot[];
};

export type ChatHolder = {
  address: string;
  herotag: string;
  roar: number;
  roarStaked: number;
  roarUnlocking: number;
  roarPending: number;
  hearts: number;
  heartsStaked: number;
  heartPending: number;
  egld: number;
  txCount: number;
};

export type RoarFarmSnapshot = {
  state: string;
  tvlUsd: number;
  staked: number;
  rewards: number;
  aprPct: number;
  stakers: number;
  unbondEpochs: number;
  epoch: number;
};

export type DelegationAction = "claim" | "restake" | "stake" | "unstake" | "withdraw";

export type BurnifyAction =
  | "stakeBfy"
  | "unstakeBfy"
  | "claimBfy"
  | "stakeBufu"
  | "unstakeBufu"
  | "claimBufu"
  | "claimAll";

export type MarketListing = {
  auctionId: number;
  name: string;
  amount: number;
  priceEgld: number;
  priceUsd: number;
  auctionType?: string;
  thumbnail?: string;
};

export type HeartActivity = {
  hash: string;
  kind: string;
  functionName?: string;
  quantity: number;
  valueEgld: number;
  sender: string;
  receiver: string;
  timestamp: number;
};

export type MarketPairRow = {
  id: string;
  baseSymbol: string;
  quoteSymbol: string;
  tvlUsd: number;
  volume24h: number;
  trades24h: number;
  roarPrice?: number;
  swapUrl: string;
};

export type MarketSnapshot = {
  listings: MarketListing[];
  floorEgld: number;
  floorUsd: number;
  listedForSale: number;
  lastSaleEgld: number;
  lastSaleQty: number;
  lastSaleAt: number;
  lastSaleHash: string;
  heartHolders: number;
  heartTransfers: number;
  ooxStaked: number;
  inWallets: number;
  marketplaceHeld: number;
  prideVaultStaked: number;
  roarPriceUsd: number;
  roarPrev24h: number;
  roarChange24h: number;
  roarVolume24h: number;
  roarMcap: number;
  roarHolders: number;
  roarCirculating: number;
  tvlUsd: number;
  egldPriceUsd: number;
  pairs: MarketPairRow[];
  activity: HeartActivity[];
  poolRoar: number;
  dailyPerNft: number;
  fetchedAt: number;
};

export type RoarBoardRow = {
  rank: number;
  address: string;
  herotag: string;
  wallet: number;
  staked: number;
  total: number;
  valueUsd: number;
  heldDays: number;
  sharePct: number;
};

export type RoarBoardSnapshot = {
  rows: RoarBoardRow[];
  you?: RoarBoardRow;
  fetchedAt: number;
  supply: number;
  burned: number;
  liquidity: number;
  holders: number;
  rankedRoar: number;
  liquidRoar: number;
  stakedRoar: number;
  roarUsd: number;
  stakers: number;
};

export type RoarFlowPoint = {
  t: number;
  liqRoar: number;
  liqUsd: number;
  burnRoar: number;
  burnUsd: number;
  stakedRoar: number;
  stakedUsd: number;
  supply: number;
  supplyUsd: number;
  price: number;
};

export type SwapCatalogToken = {
  id: string;
  ticker: string;
  name: string;
  decimals: number;
  hops: number;
  via?: string;
  icon: string;
  wrap?: boolean;
  pair?: string;
  pairToken?: string;
};

export type SwapQuote = {
  amountIn: number;
  amountOut: number;
  minOut: number;
  priceImpact: number;
  roarReserve: number;
  otherReserve: number;
  route: string;
  venue?: string;
};

var MX = CHAIN.api;
var OOX = "https://api.oox.art";
var GW = "https://gateway.multiversx.com";
var INDEX = "https://index.multiversx.com";
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
async function getJson(url, extraHeaders, timeout = 12e3) {
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const res = await fetch(url, {
				headers: {
					accept: "application/json",
					"user-agent": "PrideVault/1.0 (Heart of ROAR)",
					...extraHeaders
				},
				signal: AbortSignal.timeout(timeout)
			});
			if (res.status === 429) {
				const ra = Number(res.headers.get("retry-after"));
				await sleep((Number.isFinite(ra) && ra > 0 ? ra * 1e3 : 450 * (attempt + 1)) + Math.random() * 250);
				continue;
			}
			if (!res.ok) {
				if (attempt < 3 && res.status >= 500) {
					await sleep(350 * (attempt + 1));
					continue;
				}
				return null;
			}
			return await res.json();
		} catch {
			if (attempt < 3) {
				await sleep(300 * (attempt + 1));
				continue;
			}
			return null;
		}
	}
	return null;
}
async function postJson(url, body, timeout = 2e4) {
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
				"user-agent": "PrideVault/1.0 (Heart of ROAR)"
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(timeout)
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}
function mx(path, timeout = 12e3) {
	return new Promise((resolve) => {
		const run = async () => {
			mxActive++;
			try {
				resolve(await getJson(`${MX}${path}`, undefined, timeout));
			} finally {
				mxActive--;
				const next = mxWait.shift();
				if (next) next();
			}
		};
		if (mxActive < MX_LIMIT) run();
		else if (mxWait.length >= MX_QUEUE_MAX) resolve(null);
		else mxWait.push(run);
	});
}
const MX_LIMIT = 2;
const MX_QUEUE_MAX = 48;
let mxActive = 0;
const mxWait = [];
const reserveMemo = new Map();
async function mxDirect(path, timeout = 2500) {
	try {
		const res = await fetch(`${MX}${path}`, {
			headers: {
				accept: "application/json",
				"user-agent": "PrideVault/1.0 (Heart of ROAR)"
			},
			signal: AbortSignal.timeout(timeout)
		});
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}
async function mxTokenAccounts(identifier, pageSize = 200, maxPages = 40) {
	const bulk = await mx(`/tokens/${identifier}/accounts?size=10000`, 22e3);
	if (Array.isArray(bulk) && bulk.length) return bulk;
	const all = [];
	for (let page = 0; page < maxPages; page++) {
		const rows = await mx(`/tokens/${identifier}/accounts?from=${page * pageSize}&size=${pageSize}`, 15e3);
		if (!Array.isArray(rows) || !rows.length) break;
		all.push(...rows);
		if (rows.length < pageSize) break;
	}
	return all;
}
function kindOf(address) {
	if (address === ADDRESSES.marketplace) return "market";
	if (address === ADDRESSES.ooxStaking) return "ooxStake";
	return "holder";
}
function isProtocolAddress(address) {
	if (!address) return true;
	if (address.startsWith("erd1qqqqqqqqqqqqq")) return true;
	if (isBurnAddress(address)) return true;
	return Object.values(ADDRESSES).includes(address);
}
function isBurnAddress(address) {
	return Boolean(address) && (address === "erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag" || address.startsWith("erd1deaddeaddeaddead"));
}
function isLiquidityAccount(address, assets) {
	if (!address) return false;
	if (address === ADDRESSES.roarWegldPair || address === ADDRESSES.roarUsdcPair || address === ADDRESSES.roarMexPair) return true;
	const name = String(assets?.name || "").toLowerCase();
	const tags = (assets?.tags || []).map((t) => String(t).toLowerCase());
	if (tags.includes("liquiditypool") || tags.includes("liquidity")) return true;
	if (name.includes("liquidity pool") || name.includes("liquiditypool")) return true;
	if (tags.includes("swap") && (tags.includes("exchange") || name.includes("onedex")) && !tags.includes("farm") && !tags.includes("farms") && !tags.includes("staking") && !tags.includes("aggregator")) return true;
	return false;
}
function esSec(key) {
	const n = Number(key ?? 0);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return n > 0xe8d4a51000 ? Math.floor(n / 1e3) : Math.floor(n);
}
function daySec(sec) {
	return Math.floor(sec / 86400) * 86400;
}
function histBalance(bucket) {
	const raw = bucket?.last?.hits?.hits?.[0]?._source?.balance;
	if (raw == null) return 0;
	return fromAtomic(String(raw), TOKEN.decimals);
}
function pointsOfBuckets(buckets) {
	const out = [];
	for (const bucket of Array.isArray(buckets) ? buckets : []) {
		const t = daySec(esSec(bucket.key));
		if (!t) continue;
		out.push({
			t,
			v: histBalance(bucket)
		});
	}
	out.sort((a, b) => a.t - b.t);
	return out;
}
function forwardSum(seriesByAddr, start, end) {
	const addrs = [...seriesByAddr.keys()];
	const idx = new Map(addrs.map((addr) => [addr, 0]));
	const last = new Map(addrs.map((addr) => [addr, 0]));
	const out = [];
	for (let t = start; t <= end; t += 86400) {
		for (const addr of addrs) {
			const pts = seriesByAddr.get(addr) || [];
			let i = idx.get(addr) || 0;
			while (i < pts.length && pts[i].t <= t) {
				last.set(addr, pts[i].v);
				i += 1;
			}
			idx.set(addr, i);
		}
		let sum = 0;
		for (const v of last.values()) sum += v;
		out.push({
			t,
			v: sum
		});
	}
	return out;
}
function priceAt(prices, t) {
	if (!prices.length) return 0;
	let lo = 0;
	let hi = prices.length - 1;
	if (t < prices[0].t) return prices[0].c;
	if (t >= prices[hi].t) return prices[hi].c;
	while (lo <= hi) {
		const mid = lo + hi >> 1;
		if (prices[mid].t === t) return prices[mid].c;
		if (prices[mid].t < t) lo = mid + 1;
		else hi = mid - 1;
	}
	return prices[Math.max(0, hi)].c;
}
function asTokenAmount(raw, decimals) {
	const s = String(raw ?? "0").split(".")[0];
	if (!s || s === "0") return 0;
	if (s.length > 12) return fromAtomic(s, decimals);
	const n = Number(s);
	return Number.isFinite(n) ? n : 0;
}
function herotagOf(username) {
	if (!username || typeof username !== "string") return "";
	const tag = username.replace(/\.elrond$/i, "").replace(/\.x$/i, "").trim().toLowerCase();
	if (!/^[a-z0-9._-]{1,32}$/.test(tag)) return "";
	return tag;
}
function toMsTs(ts) {
	const n = Number(ts ?? 0);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return n < 0xe8d4a51000 ? n * 1e3 : n;
}
async function poolMap(items, limit, fn) {
	const out = new Array(items.length);
	let next = 0;
	async function worker() {
		while (true) {
			const i = next++;
			if (i >= items.length) return;
			try {
				out[i] = await fn(items[i], i);
			} catch {
				out[i] = null;
			}
		}
	}
	const n = Math.max(1, Math.min(limit, items.length));
	await Promise.all(Array.from({ length: n }, () => worker()));
	return out;
}
async function firstRoarHoldMs(address) {
	const roar = await mx(`/accounts/${address}/transfers?token=${TOKEN.identifier}&order=asc&size=1`);
	let ts = Array.isArray(roar) && roar[0]?.timestamp ? toMsTs(roar[0].timestamp) : 0;
	if (ts) return ts;
	const farm = await mx(`/accounts/${address}/transfers?token=${FARM.token}&order=asc&size=1`);
	return Array.isArray(farm) && farm[0]?.timestamp ? toMsTs(farm[0].timestamp) : 0;
}
async function enrichBoardRows(rows) {
	const addrs = rows.map((row) => row.address).filter(isErdAddress);
	if (!addrs.length) return rows;
	try {
		const [accounts, firsts] = await Promise.all([
			postJson(`${INDEX}/accounts/_search`, {
				size: Math.min(addrs.length, 250),
				_source: ["address", "username", "userName"],
				query: { terms: { address: addrs } }
			}, 8e3),
			postJson(`${INDEX}/accountsesdthistory/_search`, {
				size: 0,
				query: {
					bool: {
						must: [
							{ terms: { address: addrs } },
							{ terms: { token: [TOKEN.identifier, FARM.token] } }
						]
					}
				},
				aggs: {
					by_addr: {
						terms: { field: "address", size: Math.min(addrs.length, 250) },
						aggs: { first: { min: { field: "timestamp" } } }
					}
				}
			}, 8e3)
		]);
		const tags = /* @__PURE__ */ new Map();
		for (const hit of accounts?.hits?.hits ?? []) {
			const src = hit?._source || {};
			if (src.address) tags.set(src.address, herotagOf(src.username || src.userName));
		}
		const firstMs = /* @__PURE__ */ new Map();
		for (const bucket of firsts?.aggregations?.by_addr?.buckets ?? []) {
			firstMs.set(bucket.key, toMsTs(bucket.first?.value));
		}
		const now = Date.now();
		return rows.map((row) => {
			const ts = firstMs.get(row.address) || 0;
			return {
				...row,
				herotag: tags.get(row.address) || row.herotag || "",
				heldDays: ts > 0 ? Math.max(0, Math.floor((now - ts) / 864e5)) : row.heldDays
			};
		});
	} catch {
		return rows;
	}
}
function decodeB64(data) {
	if (!data) return "";
	try {
		return Buffer.from(data, "base64").toString("utf8");
	} catch {
		return "";
	}
}
function parseBuyQty(decoded) {
	const parts = decoded.split("@");
	if (parts[0] !== "buy" || parts.length < 5) return 0;
	const qty = Number.parseInt(parts[4], 16);
	return Number.isFinite(qty) ? qty : 0;
}
function isHeartBuy(decoded) {
	return decoded.startsWith("buy@") && decoded.toLowerCase().includes(COLLECTION_HEX);
}
function classifyActivity(fn, sender, receiver) {
	const f = fn.toLowerCase();
	if (f === "buy" || f === "buysft" || f === "buynft") return "sale";
	if (f === "stake" || receiver === ADDRESSES.ooxStaking) return "ooxStake";
	if (f === "unstake" || sender === ADDRESSES.ooxStaking) return "unstake";
	if (receiver === ADDRESSES.marketplace) return "list";
	if (sender === ADDRESSES.marketplace) return "sale";
	return "transfer";
}
function mapHolders(accounts) {
	return (accounts ?? []).map((a) => ({
		address: a.address ?? "",
		balance: Number(a.balance ?? 0),
		kind: kindOf(a.address ?? "")
	})).filter((h) => h.address);
}
function splitHolders(holders) {
	const marketplaceHeld = holders.find((h) => h.kind === "market")?.balance ?? 0;
	const ooxStaked = holders.find((h) => h.kind === "ooxStake")?.balance ?? 0;
	const wallets = holders.filter((h) => h.kind === "holder");
	return {
		marketplaceHeld,
		ooxStaked,
		inWallets: wallets.reduce((sum, h) => sum + h.balance, 0),
		walletHolderCount: wallets.length,
		prideVaultStaked: ooxStaked
	};
}
async function ooxPridePoolRoar() {
	const [specific, list] = await Promise.all([mx(`/accounts/${ADDRESSES.ooxStaking}/tokens/${TOKEN.identifier}`), mx(`/accounts/${ADDRESSES.ooxStaking}/tokens?size=50`)]);
	const roar = specific?.identifier === TOKEN.identifier ? specific : list?.find((t) => t.identifier === TOKEN.identifier);
	if (!roar?.balance) return 0;
	return fromAtomic(roar.balance, roar.decimals ?? TOKEN.decimals);
}
async function ooxFarmHearts() {
	const nft = await mx(`/accounts/${ADDRESSES.ooxStaking}/nfts/${COLLECTION.sftId}`);
	const n = Number(nft?.balance ?? 0);
	return Number.isFinite(n) && n > 0 ? n : 0;
}
function ooxFarmArg() {
	return toEvenHex(VAULT.ooxFarmId);
}
async function ooxQuery(funcName, args = []) {
	try {
		const body = await (await fetch(`${GW}/vm-values/query`, {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
				"user-agent": "PrideVault/1.0 (Heart of ROAR)"
			},
			body: JSON.stringify({
				scAddress: ADDRESSES.ooxStaking,
				funcName,
				args
			}),
			signal: AbortSignal.timeout(8e3)
		})).json();
		if (body.data?.data?.returnCode && body.data.data.returnCode !== "ok") return [];
		return body.data?.data?.returnData ?? [];
	} catch {
		return [];
	}
}
function toMs(ts) {
	if (!ts || ts <= 0) return 0;
	return ts < 0xe8d4a51000 ? ts * 1e3 : ts;
}
function b64Buf(b64) {
	if (!b64) return /* @__PURE__ */ new Uint8Array(0);
	try {
		return Uint8Array.from(Buffer.from(b64, "base64"));
	} catch {
		return /* @__PURE__ */ new Uint8Array(0);
	}
}
function skipManagedBuffer(buf, offset) {
	if (offset + 4 > buf.length) return -1;
	const len = (buf[offset] << 24 | buf[offset + 1] << 16 | buf[offset + 2] << 8 | buf[offset + 3]) >>> 0;
	const next = offset + 4 + len;
	return next > buf.length ? -1 : next;
}
function decodeOoxPool(buf) {
	if (!buf || buf.length < 80) return null;
	let i = 32;
	i = skipManagedBuffer(buf, i);
	if (i < 0) return null;
	i = skipManagedBuffer(buf, i);
	if (i < 0) return null;
	const totalRaw = readBigUint(buf, i);
	if (!totalRaw) return null;
	const distRaw = readBigUint(buf, totalRaw[1]);
	if (!distRaw) return null;
	i = distRaw[1];
	if (i + 16 > buf.length) return null;
	const start = readU64(buf, i);
	const end = readU64(buf, i + 8);
	i += 16;
	if (i + 4 > buf.length) return null;
	const maxNfts = (buf[i] << 24 | buf[i + 1] << 16 | buf[i + 2] << 8 | buf[i + 3]) >>> 0;
	i += 4;
	let staked = 0;
	if (i + 8 <= buf.length) {
		const asU64 = readU64(buf, i);
		const asU32 = (buf[i + 4] << 24 | buf[i + 5] << 16 | buf[i + 6] << 8 | buf[i + 7]) >>> 0;
		staked = asU64 > 0 && asU64 < 1e7 ? asU64 : asU32;
	}
	const totalPool = fromAtomic(totalRaw[0], TOKEN.decimals);
	const distributed = fromAtomic(distRaw[0], TOKEN.decimals);
	const remaining = Math.max(0, totalPool - distributed);
	const duration = Math.max(0, (end - start) / 86400);
	const max = maxNfts || COLLECTION.supply;
	const occ = max > 0 ? Math.min(1, Math.max(0, staked / max)) : 0;
	const dailyPerNft = remaining > 0 && duration > 0 && max > 0 ? remaining / duration / max * occ : 0;
	return {
		totalPool,
		distributed,
		remaining,
		start,
		end,
		maxNfts: max,
		staked,
		dailyPerNft
	};
}
function decodeOoxUserStake(buf) {
	if (!buf || buf.length < 8) return {
		staked: 0,
		pendingRoar: 0,
		lastTs: 0
	};
	const staked = (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0;
	const pendingRaw = readBigUint(buf, 4);
	if (!pendingRaw) return {
		staked,
		pendingRoar: 0,
		lastTs: 0
	};
	let lastTs = 0;
	const i = pendingRaw[1];
	if (i + 8 <= buf.length) lastTs = readU64(buf, i);
	else if (i + 4 <= buf.length) lastTs = (buf[i] << 24 | buf[i + 1] << 16 | buf[i + 2] << 8 | buf[i + 3]) >>> 0;
	return {
		staked,
		pendingRoar: fromAtomic(pendingRaw[0], TOKEN.decimals),
		lastTs
	};
}
async function readOoxFarm() {
	const decoded = decodeOoxPool(b64Buf((await ooxQuery("getPool", [ooxFarmArg()]))[0]));
	if (decoded && decoded.maxNfts > 0) return decoded;
	const [pool, staked] = await Promise.all([ooxPridePoolRoar(), ooxFarmHearts()]);
	return {
		totalPool: pool,
		distributed: 0,
		remaining: pool,
		start: VAULT.poolStart / 1e3,
		end: VAULT.poolEnd / 1e3,
		maxNfts: COLLECTION.supply,
		staked,
		dailyPerNft: dailyFromPool(pool, staked)
	};
}
function isFarm41(decoded, fn) {
	const parts = decoded.split("@");
	return parts[0] === fn && parts[1]?.toLowerCase() === VAULT.ooxFarmId.toString(16);
}
function transferQty(row) {
	return Number(row.action?.arguments?.transfers?.[0]?.value ?? 0);
}
async function readOoxPosition(address) {
	const [transfers, claims, unstakes, stakeView] = await Promise.all([
		mx(`/accounts/${address}/transfers?token=${COLLECTION.sftId}&size=100`),
		mx(`/accounts/${address}/transactions?receiver=${ADDRESSES.ooxStaking}&function=claim&status=success&size=25`),
		mx(`/accounts/${address}/transactions?receiver=${ADDRESSES.ooxStaking}&function=unstake&status=success&size=25`),
		ooxQuery("getUserStake", [ooxFarmArg(), bech32ToHex(address)])
	]);
	let staked = 0;
	let firstStakeAt = 0;
	const history = [];
	const seen = /* @__PURE__ */ new Set();
	for (const row of transfers ?? []) {
		const fn = (row.function || row.action?.arguments?.functionName || "").toLowerCase();
		const innerRecv = row.action?.arguments?.receiver ?? "";
		const qty = transferQty(row);
		const at = (row.timestamp ?? 0) * 1e3;
		const id = row.txHash ?? `${fn}-${at}`;
		if (fn === "stake" && innerRecv === ADDRESSES.ooxStaking && qty > 0) {
			staked += qty;
			if (!firstStakeAt || row.timestamp && row.timestamp < firstStakeAt) firstStakeAt = row.timestamp ?? 0;
			if (!seen.has(id)) {
				seen.add(id);
				history.push({
					id,
					kind: "stake",
					amount: qty,
					at
				});
			}
		} else if (row.sender === ADDRESSES.ooxStaking && row.receiver === address && qty > 0) staked -= qty;
	}
	for (const row of unstakes ?? []) {
		const decoded = decodeB64(row.data);
		if (!isFarm41(decoded, "unstake")) continue;
		const parts = decoded.split("@");
		const qty = Number.parseInt(parts[3] || "0", 16);
		const id = row.txHash ?? `unstake-${row.timestamp}`;
		if (!seen.has(id)) {
			seen.add(id);
			history.push({
				id,
				kind: "unstake",
				amount: Number.isFinite(qty) ? qty : 0,
				at: (row.timestamp ?? 0) * 1e3
			});
		}
	}
	let lastClaimAt = 0;
	for (const row of claims ?? []) {
		if (!isFarm41(decodeB64(row.data), "claim")) continue;
		const at = row.timestamp ?? 0;
		if (at > lastClaimAt) lastClaimAt = at;
		const id = row.txHash ?? `claim-${at}`;
		if (!seen.has(id)) {
			seen.add(id);
			history.push({
				id,
				kind: "claim",
				amount: 0,
				at: at * 1e3
			});
		}
	}
	staked = Math.max(0, staked);
	const onChain = decodeOoxUserStake(b64Buf(stakeView[0]));
	// Prefer getUserStake whenever the VM returned a payload — including explicit zero
	// (transfer history alone can leave a phantom staked balance after full unstake).
	if (Array.isArray(stakeView) && stakeView.length > 0) staked = onChain.staked;
	else if (onChain.staked > 0 || onChain.pendingRoar > 0) staked = onChain.staked;
	const pendingRoar = onChain.pendingRoar;
	lastClaimAt = toMs(onChain.lastTs) || toMs(lastClaimAt) || toMs(firstStakeAt);
	history.sort((a, b) => b.at - a.at);
	return {
		staked,
		pendingRoar,
		lastClaimAt,
		history: history.slice(0, 12)
	};
}
function mapListings(ooxNfts) {
	const listings = (ooxNfts ?? []).filter((n) => n.auctionInfo?.auctionId && n.auctionInfo.currentPrice).map((n) => {
		const a = n.auctionInfo;
		const priceWei = a.currentPrice ?? "0";
		const priceEgld = fromDenom(priceWei, 18);
		return {
			identifier: n.identifier ?? COLLECTION.sftId,
			name: n.name ?? COLLECTION.name,
			auctionId: a.auctionId ?? 0,
			auctionType: a.auctionType ?? "Nft",
			priceEgld,
			priceUsd: a.auctionPriceUsd ?? 0,
			priceWei,
			amount: Number(a.amount ?? 1),
			paymentToken: a.paymentToken ?? "EGLD",
			deadline: a.deadline ?? 0,
			thumbnailUrl: n.thumbnailUrl ?? "/heart-of-roar.jpg",
			buyUrl: ooxBuyUrl(a.auctionId ?? 0)
		};
	}).sort((a, b) => a.priceEgld - b.priceEgld || b.amount - a.amount);
	const unique = /* @__PURE__ */ new Map();
	for (const row of listings) if (!unique.has(row.auctionId)) unique.set(row.auctionId, row);
	return [...unique.values()];
}
function readBigUint(buf, offset) {
	if (offset + 4 > buf.length) return null;
	const len = (buf[offset] << 24 | buf[offset + 1] << 16 | buf[offset + 2] << 8 | buf[offset + 3]) >>> 0;
	offset += 4;
	if (offset + len > buf.length) return null;
	if (len === 0) return [0n, offset];
	let n = 0n;
	for (let i = 0; i < len; i++) n = (n << 8n) + BigInt(buf[offset + i]);
	return [n, offset + len];
}
function attrsToBytes(attributes) {
	if (!attributes) return /* @__PURE__ */ new Uint8Array(0);
	if (attributes instanceof Uint8Array) return attributes;
	if (Array.isArray(attributes)) return Uint8Array.from(attributes);
	if (typeof attributes !== "string") return /* @__PURE__ */ new Uint8Array(0);
	const s = attributes.trim();
	if (!s) return /* @__PURE__ */ new Uint8Array(0);
	const hex = s.startsWith("0x") || s.startsWith("0X") ? s.slice(2) : s;
	if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) try {
		return Uint8Array.from(Buffer.from(hex, "hex"));
	} catch {}
	try {
		return Uint8Array.from(Buffer.from(s, "base64"));
	} catch {
		return /* @__PURE__ */ new Uint8Array(0);
	}
}
function readU64(buf, offset = 0) {
	if (offset + 8 > buf.length) return 0;
	let e = 0n;
	for (let i = 0; i < 8; i++) e = (e << 8n) + BigInt(buf[offset + i]);
	const n = Number(e);
	return Number.isFinite(n) ? n : 0;
}
/**
* SROAR staking-farm tokens:
* - staked: 3 nested BigUints (rps, compounded_reward, current_farm_amount), ~36–62 bytes
* - unbonding: raw u64 unlocking_epoch, exactly 8 bytes
* Never treat the 8-byte unbond SFT as staked — compounding it fails with
* `error decoding ESDT attributes: input too short`.
*/
function decodeFarmAttrs(attributes) {
	const empty = {
		rps: 0n,
		farmAmount: 0n,
		unlockEpoch: 0,
		staked: true
	};
	const buf = attrsToBytes(attributes);
	if (buf.length === 0) return empty;
	if (buf.length === 8) return {
		rps: 0n,
		farmAmount: 0n,
		unlockEpoch: readU64(buf),
		staked: false
	};
	if (buf.length < 8) return empty;
	const first = readBigUint(buf, 0);
	if (!first) return empty;
	const second = readBigUint(buf, first[1]);
	if (!second) return empty;
	const third = readBigUint(buf, second[1]);
	if (!third) return empty;
	if (third[1] < 12) return empty;
	return {
		rps: first[0],
		farmAmount: third[0],
		unlockEpoch: 0,
		staked: true
	};
}
async function vmQuery(funcName, args = []) {
	try {
		const body = await (await fetch(`${GW}/vm-values/query`, {
			method: "POST",
			headers: {
				accept: "application/json",
				"content-type": "application/json",
				"user-agent": "PrideVault/1.0 (Heart of ROAR)"
			},
			body: JSON.stringify({
				scAddress: ADDRESSES.roarFarm,
				funcName,
				args
			}),
			signal: AbortSignal.timeout(8e3)
		})).json();
		if (body.data?.data?.returnCode && body.data.data.returnCode !== "ok") return [];
		return body.data?.data?.returnData ?? [];
	} catch {
		return [];
	}
}
function b64ToBig(b64) {
	if (!b64) return 0n;
	const hex = Buffer.from(b64, "base64").toString("hex");
	return hex ? BigInt(`0x${hex}`) : 0n;
}
async function farmRewardPerShare() {
	return b64ToBig((await vmQuery("getRewardPerShare"))[0]);
}
function emptyFarm() {
	return {
		staked: 0,
		pending: 0,
		unlocking: 0,
		slots: []
	};
}
async function readFarmPosition(address) {
	const [nfts, rpsGlobal] = await Promise.all([mx(`/accounts/${address}/nfts?collections=${FARM.token}&size=100`), farmRewardPerShare()]);
	if (!nfts?.length) return emptyFarm();
	const slots = [];
	let staked = 0;
	let unlocking = 0;
	let pendingRaw = 0n;
	for (const nft of nfts) {
		const amountRaw = BigInt(nft.balance ?? "0");
		if (amountRaw <= 0n) continue;
		const amount = fromAtomic(amountRaw, FARM.decimals);
		const attrs = decodeFarmAttrs(nft.attributes ?? nft.attributesBase64);
		const unbonding = !attrs.staked && attrs.unlockEpoch > 0;
		const farmAmt = attrs.farmAmount > 0n ? attrs.farmAmount : amountRaw;
		if (!unbonding && rpsGlobal > attrs.rps && farmAmt > 0n) pendingRaw += (rpsGlobal - attrs.rps) * farmAmt / FARM.divisionSafety;
		const slot = {
			nonce: nft.nonce ?? 0,
			amount,
			amountRaw: amountRaw.toString(),
			kind: unbonding ? "unbonding" : "staked",
			unlockEpoch: attrs.unlockEpoch
		};
		slots.push(slot);
		if (unbonding) unlocking += amount;
		else staked += amount;
	}
	slots.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind === "staked" ? -1 : 1;
		const d = BigInt(b.amountRaw) - BigInt(a.amountRaw);
		if (d > 0n) return 1;
		if (d < 0n) return -1;
		return 0;
	});
	return {
		staked,
		unlocking,
		pending: fromAtomic(pendingRaw, TOKEN.decimals),
		slots
	};
}
export const getRoarFarm = createServerFn({ method: "GET" }).handler(async () => {
	const [supply, rewards, aprRaw, unbondRaw, stateRaw, farmToken, roar, stats] = await Promise.all([
		vmQuery("getFarmTokenSupply"),
		vmQuery("getRewardReserve"),
		vmQuery("getAnnualPercentageRewards"),
		vmQuery("getMinUnbondEpochs"),
		vmQuery("getState"),
		mx(`/tokens/${FARM.token}`),
		mx(`/tokens/${TOKEN.identifier}`),
		mx("/stats")
	]);
	const staked = fromAtomic(b64ToBig(supply[0]), FARM.decimals);
	const rewardPool = fromAtomic(b64ToBig(rewards[0]), TOKEN.decimals);
	const aprPct = Number(b64ToBig(aprRaw[0])) / 100;
	const roarUsd = roar?.price || .015;
	return {
		staked,
		rewards: rewardPool,
		aprPct,
		unbondEpochs: Number(b64ToBig(unbondRaw[0])) || 10,
		stakers: farmToken?.accounts ?? 0,
		tvlUsd: staked * roarUsd,
		roarUsd,
		epoch: stats?.epoch ?? 0,
		state: Number(b64ToBig(stateRaw[0])) === 1 ? "active" : "paused",
		fetchedAt: Date.now()
	};
});
export const getRoarLeaderboard = createServerFn({ method: "POST" }).validator((data) => {
	const address = typeof data?.address === "string" ? data.address.trim() : "";
	if (address && !isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const pack = await loadRoarBoardPack();
	const look = data.address;
	let you = look
		? pack.rows.find((row) => row.address === look) || pack.ranked.find((row) => row.address === look) || null
		: null;
	if (you && !pack.rows.slice(0, 100).some((row) => row.address === you.address)) {
		const [account, firstMs] = await Promise.all([
			mx(`/accounts/${you.address}?fields=username`, 8e3),
			firstRoarHoldMs(you.address)
		]);
		you = {
			...you,
			herotag: herotagOf(account?.username),
			heldDays: firstMs > 0 ? Math.max(0, Math.floor((Date.now() - firstMs) / 864e5)) : -1
		};
	}
	return {
		...pack.public,
		rows: pack.rows,
		you
	};
});
var roarBoardCache = {
	at: 0,
	pack: null,
	pending: null
};
async function loadRoarBoardPack() {
	const now = Date.now();
	if (roarBoardCache.pack && now - roarBoardCache.at < 90e3) return roarBoardCache.pack;
	if (roarBoardCache.pending) return roarBoardCache.pending;
	roarBoardCache.pending = (async () => {
		try {
			const pack = await fetchRoarBoardPack();
			roarBoardCache = {
				at: Date.now(),
				pack,
				pending: null
			};
			return pack;
		} catch (err) {
			roarBoardCache.pending = null;
			if (roarBoardCache.pack) return roarBoardCache.pack;
			throw err;
		}
	})();
	return roarBoardCache.pending;
}
async function fetchRoarBoardPack() {
	const [liquid, farmTok, roar] = await Promise.all([
		mx(`/tokens/${TOKEN.identifier}/accounts?size=10000`, 22e3),
		mx(`/tokens/${FARM.token}/accounts?size=10000`, 22e3),
		mx(`/tokens/${TOKEN.identifier}`)
	]);
	if (!Array.isArray(liquid)) throw new Error("ROAR holders unavailable");
	const farmRows = Array.isArray(farmTok) ? farmTok : [];
	const map = /* @__PURE__ */ new Map();
	let burnedRaw = 0n;
	let liquidityRaw = 0n;
	const addRaw = (address, field, raw) => {
		if (!address || isProtocolAddress(address)) return;
		let amt = 0n;
		try {
			amt = BigInt(raw ?? 0);
		} catch {
			return;
		}
		if (amt <= 0n) return;
		const cur = map.get(address) || {
			wallet: 0n,
			staked: 0n
		};
		cur[field] += amt;
		map.set(address, cur);
	};
	for (const row of liquid) {
		let amt = 0n;
		try {
			amt = BigInt(row.balance ?? 0);
		} catch {
			amt = 0n;
		}
		if (isBurnAddress(row.address)) {
			burnedRaw += amt;
			continue;
		}
		if (isLiquidityAccount(row.address, row.assets)) {
			liquidityRaw += amt;
			continue;
		}
		addRaw(row.address, "wallet", row.balance);
	}
	for (const row of farmRows) addRaw(row.address, "staked", row.balance);
	const roarUsd = roar?.price || .015;
	const ranked = [...map.entries()].map(([address, raw]) => {
		const wallet = fromAtomic(raw.wallet, TOKEN.decimals);
		const staked = fromAtomic(raw.staked, FARM.decimals);
		return {
			address,
			wallet,
			staked,
			total: wallet + staked
		};
	}).filter((row) => row.total > 0).sort((a, b) => b.total - a.total);
	const rankedRoar = ranked.reduce((sum, row) => sum + row.total, 0);
	const liquidRoar = ranked.reduce((sum, row) => sum + row.wallet, 0);
	const stakedRoar = ranked.reduce((sum, row) => sum + row.staked, 0);
	const withRank = ranked.map((row, i) => ({
		rank: i + 1,
		address: row.address,
		herotag: "",
		wallet: row.wallet,
		staked: row.staked,
		total: row.total,
		valueUsd: row.total * roarUsd,
		sharePct: rankedRoar > 0 ? row.total / rankedRoar * 100 : 0,
		heldDays: -1
	}));
	const rowsBare = withRank.slice(0, 250);
	const enriched = await enrichBoardRows(rowsBare.slice(0, 100));
	const byAddr = new Map(rowsBare.slice(0, 100).map((row, i) => [row.address, enriched[i] || row]));
	const rows = rowsBare.map((row) => byAddr.get(row.address) || row);
	const now = Date.now();
	return {
		ranked: withRank,
		rows,
		public: {
			holders: ranked.length,
			stakers: ranked.filter((row) => row.staked > 0).length,
			rankedRoar,
			liquidRoar,
			stakedRoar,
			roarUsd,
			supply: asTokenAmount(roar?.supply, TOKEN.decimals),
			burned: fromAtomic(burnedRaw, TOKEN.decimals),
			liquidity: fromAtomic(liquidityRaw, TOKEN.decimals),
			fetchedAt: now
		}
	};
}
export const getChainSnapshot = createServerFn({ method: "GET" }).handler(async () => {
	const [accounts, roar, ooxNfts, wegld, farm] = await Promise.all([
		mx(`/nfts/${COLLECTION.sftId}/accounts?size=50`),
		mx(`/tokens/${TOKEN.identifier}`),
		getJson(`${OOX}/collections/${COLLECTION.identifier}/nfts?size=40`),
		mx(`/mex/tokens/${PAIRS.wegld}`),
		readOoxFarm()
	]);
	const holders = mapHolders(accounts);
	const split = splitHolders(holders);
	const ooxStaked = farm.staked > 0 ? farm.staked : split.ooxStaked;
	const listedForSale = mapListings(ooxNfts).reduce((sum, l) => sum + l.amount, 0);
	return {
		...split,
		ooxStaked,
		prideVaultStaked: ooxStaked,
		listedForSale: listedForSale || split.marketplaceHeld,
		holders,
		roarPriceUsd: roar?.price ?? 0,
		egldPriceUsd: wegld?.price || 0,
		roarCirculating: Number(roar?.circulatingSupply ?? 0),
		poolRoar: farm.remaining || farm.totalPool,
		dailyPerNft: farm.dailyPerNft
	};
});
export const getWalletHoldings = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const { address } = data;
	const [nfts, token, account, extra, position, farm] = await Promise.all([
		mx(`/accounts/${address}/nfts?collections=${COLLECTION.identifier}&size=10`),
		mx(`/accounts/${address}/tokens/${TOKEN.identifier}`),
		mx(`/accounts/${address}?withGuardianInfo=true`),
		mx(`/accounts/${address}/tokens?identifiers=${PAIRS.wegld},${PAIRS.usdc},${PAIRS.mex}&size=10`),
		readOoxPosition(address),
		readFarmPosition(address)
	]);
	const heart = (nfts ?? []).find((n) => n.identifier === COLLECTION.sftId);
	const roar = fromAtomic(token?.balance ?? "0", token?.decimals ?? TOKEN.decimals);
	const pick = (id, dec) => {
		const row = extra?.find((t) => t.identifier === id);
		if (!row?.balance) return 0;
		return fromAtomic(row.balance, row.decimals ?? dec);
	};
	return {
		address,
		hearts: Number(heart?.balance ?? 0),
		heartsStaked: position.staked,
		roar,
		egld: fromDenom(account?.balance, 18),
		wegld: pick(PAIRS.wegld, 18),
		usdc: pick(PAIRS.usdc, 6),
		mex: pick(PAIRS.mex, 18),
		nonce: account?.nonce ?? 0,
		isGuarded: Boolean(account?.isGuarded),
		pendingRoar: position.pendingRoar,
		lastTick: position.lastClaimAt || Date.now(),
		history: position.history as HistoryItem[],
		farm
	};
});
async function readOoxStakeLite(address) {
	try {
		const stakeView = await ooxQuery("getUserStake", [ooxFarmArg(), bech32ToHex(address)]);
		const onChain = decodeOoxUserStake(b64Buf(stakeView[0]));
		return {
			staked: Number(onChain.staked) || 0,
			pendingRoar: Number(onChain.pendingRoar) || 0
		};
	} catch {
		return {
			staked: 0,
			pendingRoar: 0
		};
	}
}
export const getChatHolder = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const { address } = data;
	const [nfts, token, account, oox, farm] = await Promise.all([
		mx(`/accounts/${address}/nfts?collections=${COLLECTION.identifier}&size=10`),
		mx(`/accounts/${address}/tokens/${TOKEN.identifier}`),
		mx(`/accounts/${address}`),
		readOoxStakeLite(address),
		readFarmPosition(address)
	]);
	const heart = (nfts ?? []).find((n) => n.identifier === COLLECTION.sftId);
	const roar = fromAtomic(token?.balance ?? "0", token?.decimals ?? TOKEN.decimals);
	const username = String(account?.username ?? "").replace(/\.(elrond|x)$/i, "");
	return {
		address,
		herotag: username,
		roar,
		roarStaked: farm.staked,
		roarUnlocking: farm.unlocking,
		roarPending: farm.pending,
		hearts: Number(heart?.balance ?? 0),
		heartsStaked: oox.staked,
		heartPending: oox.pendingRoar,
		egld: fromDenom(account?.balance, 18),
		txCount: Number(account?.txCount ?? 0)
	};
});
function tokenIcon(identifier, assets) {
	return assets?.pngUrl || assets?.svgUrl || (identifier === TOKEN.identifier ? "/nfts/roar-token.png" : identifier === "EGLD" || identifier === PAIRS.wegld ? `https://tools.multiversx.com/assets-cdn/tokens/${PAIRS.wegld}/icon.png` : `https://tools.multiversx.com/assets-cdn/tokens/${identifier}/icon.png`);
}
function pairOf(pairs, a, b) {
	return pairs.find((p) => p.baseId === a && p.quoteId === b || p.baseId === b && p.quoteId === a);
}
function tickerOf(id) {
	if (id === "EGLD") return "EGLD";
	return id.split("-")[0] || id;
}
function venueFromAssets(website, description) {
	const blob = `${website ?? ""} ${description ?? ""}`.toLowerCase();
	if (blob.includes("xexchange") || blob.includes("x-exchange")) return "xexchange";
	if (blob.includes("onedex")) return "onedex";
	if (blob.includes("jexchange") || blob.includes("jex")) return "jexchange";
	return "other";
}
function detectVenue(args) {
	if (args.farmMeta || args.mex || args.lockedMex || args.xmexLp) return "xexchange";
	if (args.onedex) return "onedex";
	if (args.jex) return "jexchange";
	const name = args.name ?? "";
	const id = args.id;
	if (/^LP/i.test(id) || /jexlp/i.test(name) || /\(JEX\)/i.test(name) || /jexchange/i.test(name) || /\bjex\b/i.test(name)) return "jexchange";
	if (/onedex/i.test(name)) return "onedex";
	return venueFromAssets(args.website, args.description);
}
function prettyLpTicker(sym) {
	if (!sym) return "";
	if (String(sym).toUpperCase() === "WEGLD") return "wEGLD";
	return String(sym);
}
function isActualLpToken(args) {
	if (args.mex || args.onedex || args.jex) return true;
	const name = args.name ?? "";
	const desc = args.description ?? "";
	const id = args.id ?? "";
	const tick = tickerOf(id);
	if (/^LP/i.test(id) || /^LP/i.test(tick)) return true;
	if (/jexlp/i.test(name) || /\(JEX\)/i.test(name)) return true;
	if (/onedex/i.test(name) && /lp/i.test(name)) return true;
	if (/LP$/i.test(name.replace(/\s/g, ""))) return true;
	if (/liquidity provider/i.test(desc)) return true;
	if (/LPStaked|LP tokens|LP token/i.test(name)) return true;
	return false;
}
function equivalentOf(ticker, amount, priceUsd, egldUsd, mexUsd) {
	const t = String(ticker || "").toUpperCase();
	const qty = Number(amount) || 0;
	const px = Number(priceUsd) || 0;
	if (qty <= 0) return;
	if (t === "XEGLD" || t === "SEGLD" || t === "VOXEGLD" || t === "LEGLD") {
		if (!(egldUsd > 0) || !(px > 0)) return;
		return { ticker: "EGLD", amount: qty * (px / egldUsd) };
	}
	if (t === "XMEX" || t === "LKMEX" || t === "WXMEX") {
		const rate = mexUsd > 0 && px > 0 ? px / mexUsd : 1;
		return { ticker: "MEX", amount: qty * rate };
	}
}
function splitCompoundTicker(id, name) {
	const fromName = String(name ?? "").replace(/\s*\((JEX|OneDex|xExchange)\)\s*/gi, "").trim().match(/^([A-Za-z0-9$]+)-([A-Za-z0-9$]+)$/);
	if (fromName) return [prettyLpTicker(fromName[1]), prettyLpTicker(fromName[2])];
	const tick = tickerOf(id ?? "");
	const fromTick = tick.match(/^([A-Za-z0-9$]+)-([A-Za-z0-9$]+)$/);
	if (fromTick && !/^[0-9a-f]{4,}$/i.test(fromTick[2])) return [prettyLpTicker(fromTick[1]), prettyLpTicker(fromTick[2])];
	const quotes = [
		"WEGLD",
		"WUSDC",
		"USDC",
		"USDT",
		"SEGLD",
		"EGLD",
		"ROAR",
		"MEX",
		"RARE",
		"ONE",
		"UTK",
		"HTM",
		"XMN",
		"JEX"
	];
	const u = tick.toUpperCase();
	for (const q of quotes) {
		if (u.endsWith(q) && u.length > q.length) return [prettyLpTicker(tick.slice(0, tick.length - q.length)), prettyLpTicker(q)];
		if (u.startsWith(q) && u.length > q.length) return [prettyLpTicker(q), prettyLpTicker(tick.slice(q.length))];
	}
	return null;
}
function iconOfTicker(tick, id) {
	const u = String(tick ?? "").toUpperCase();
	if (id) return tokenIcon(id);
	if (u === "EGLD" || u === "WEGLD") return tokenIcon("EGLD");
	if (u === "ROAR") return tokenIcon(TOKEN.identifier);
	if (u === "USDC") return tokenIcon(PAIRS.usdc);
	if (u === "MEX") return tokenIcon(PAIRS.mex);
	return tokenIcon(String(tick ?? ""));
}
function lpTitleFromPair(base, quote, fallback) {
	if (!base || !quote) return fallback;
	return `${prettyLpTicker(base)}-${prettyLpTicker(quote)}`;
}
function underFromMex(mex, valueUsd) {
	if (!mex?.baseId || !mex?.quoteId) return [];
	const half = Math.max(0, Number(valueUsd) || 0) / 2;
	const basePx = Number(mex.basePrice) || 0;
	const quotePx = Number(mex.quotePrice) || 0;
	return [{
		id: mex.baseId,
		ticker: prettyLpTicker(mex.baseSymbol || tickerOf(mex.baseId)),
		amount: basePx > 0 ? half / basePx : 0,
		icon: tokenIcon(mex.baseId),
		valueUsd: half
	}, {
		id: mex.quoteId,
		ticker: prettyLpTicker(mex.quoteSymbol || tickerOf(mex.quoteId)),
		amount: quotePx > 0 ? half / quotePx : 0,
		icon: tokenIcon(mex.quoteId),
		valueUsd: half
	}];
}
function underFromNames(base, quote, valueUsd) {
	if (!base || !quote) return [];
	const half = Math.max(0, Number(valueUsd) || 0) / 2;
	return [{
		id: base,
		ticker: prettyLpTicker(base),
		amount: 0,
		icon: iconOfTicker(base),
		valueUsd: half
	}, {
		id: quote,
		ticker: prettyLpTicker(quote),
		amount: 0,
		icon: iconOfTicker(quote),
		valueUsd: half
	}];
}
function underFromJex(pool, amount) {
	if (!pool?.tokens?.length) return [];
	const decimals = pool.lp_token?.decimals ?? 18;
	const supply = fromAtomic(String(pool.lp_token_supply ?? "0"), decimals);
	const share = supply > 0 ? amount / supply : 0;
	return pool.tokens.map((tok, i) => {
		const reserve = fromAtomic(String(pool.reserves?.[i] ?? "0"), tok.decimals ?? 18);
		const usd = share * Number(pool.reserves_usd_value?.[i] ?? 0);
		return {
			id: tok.identifier,
			ticker: prettyLpTicker(tok.name || tickerOf(tok.identifier)),
			amount: share * reserve,
			icon: tokenIcon(tok.identifier),
			valueUsd: usd
		};
	});
}
function titleFromJex(pool, fallback) {
	const toks = pool?.tokens ?? [];
	if (toks.length >= 2) return lpTitleFromPair(toks[0].name || tickerOf(toks[0].identifier), toks[1].name || tickerOf(toks[1].identifier), fallback);
	return fallback;
}
function tickerUpper(id) {
	return tickerOf(id).toUpperCase();
}
function isLockedMexFamily(id) {
	const t = tickerUpper(id);
	return t === "XMEX" || t === "LKMEX" || t === "WXMEX";
}
function isXmexLpFamily(id) {
	const t = tickerUpper(id);
	return t === "XMEXLP" || t === "XMEXFARM";
}
function prettyIdentity(id) {
	if (!id) return "";
	return id.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function mapProvider(row, identityByKey) {
	const contract = row?.provider ?? "";
	if (!isErdAddress(contract)) return null;
	const ident = row.identity ? identityByKey.get(row.identity) : void 0;
	return {
		contract,
		name: ident?.name || prettyIdentity(row.identity) || `Validator ${contract.slice(-6)}`,
		identity: row.identity,
		avatar: ident?.avatar,
		apr: row.apr,
		nodes: row.numNodes,
		users: row.numUsers,
		featured: Boolean(row.featured),
		fee: row.serviceFee
	};
}
function buildProviderCatalog(providers, identityByKey, used) {
	const rows = [];
	for (const row of providers ?? []) {
		const mapped = mapProvider(row, identityByKey);
		if (mapped) rows.push(mapped);
	}
	rows.sort((a, b) => {
		const au = used.has(a.contract) ? 0 : 1;
		const bu = used.has(b.contract) ? 0 : 1;
		if (au !== bu) return au - bu;
		const af = a.featured ? 0 : 1;
		const bf = b.featured ? 0 : 1;
		if (af !== bf) return af - bf;
		const an = (b.nodes ?? 0) - (a.nodes ?? 0);
		if (an) return an;
		return (b.apr ?? 0) - (a.apr ?? 0);
	});
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const row of rows) {
		if (seen.has(row.contract)) continue;
		seen.add(row.contract);
		out.push(row);
	}
	return out;
}
function mergePool(map, row) {
	const prev = map.get(row.id);
	if (prev) {
		prev.amount += row.amount;
		prev.valueUsd += row.valueUsd;
		if (!prev.icon2 && row.icon2) prev.icon2 = row.icon2;
		if (row.under?.length) {
			if (!prev.under) prev.under = row.under.map((u) => ({ ...u }));
			else for (const u of row.under) {
				const hit = prev.under.find((x) => x.id === u.id || x.ticker === u.ticker);
				if (hit) {
					hit.amount += u.amount;
					hit.valueUsd += u.valueUsd;
				} else prev.under.push({ ...u });
			}
		}
		return;
	}
	map.set(row.id, {
		...row,
		under: row.under?.map((u) => ({ ...u }))
	});
}
function classifyFarmKind(farmMeta, id) {
	if (isLockedMexFamily(id)) return "xmex";
	if (tickerUpper(id) === "XMEXFARM") return "stakedLp";
	if (tickerUpper(id) === "XMEXLP") return "lp";
	if (!farmMeta) {
		if (/LPStaked/i.test(id) || /FL-/i.test(id)) return "stakedLp";
		return "farm";
	}
	if (Boolean(farmMeta.farmingId && farmMeta.farmingName?.includes("LP")) || /LPStaked/i.test(farmMeta.name ?? "") || /FL-/i.test(farmMeta.id ?? "")) return "stakedLp";
	return "farm";
}
function buildDexPool(args) {
	let valueUsd = Number(args.valueUsd) || 0;
	if (args.jex && valueUsd <= 0 && args.jex.usd_value_per_lp_token) valueUsd = args.amount * Number(args.jex.usd_value_per_lp_token);
	if (args.mex && valueUsd <= 0 && Number(args.mex.price) > 0) valueUsd = args.amount * Number(args.mex.price);
	if (args.farmMeta && valueUsd <= 0) valueUsd = args.amount * (Number(args.farmMeta.price) || Number(args.farmMeta.farmingPrice) || 0);
	const venue = detectVenue({
		id: args.id,
		name: args.name,
		farmMeta: args.farmMeta,
		mex: Boolean(args.mex),
		onedex: args.onedex,
		jex: Boolean(args.jex),
		lockedMex: args.lockedMex,
		xmexLp: args.xmexLp,
		website: args.website,
		description: args.description
	});
	const kind = args.lockedMex ? "xmex" : args.isFarmTok || args.xmexLp ? classifyFarmKind(args.farmMeta, args.id) : "lp";
	let pairParts = args.mex ? [args.mex.baseSymbol ?? tickerOf(args.mex.baseId ?? ""), args.mex.quoteSymbol ?? tickerOf(args.mex.quoteId ?? "")] : splitCompoundTicker(args.id, args.ticker || args.name);
	if (args.jex?.tokens?.length >= 2) pairParts = [args.jex.tokens[0].name || tickerOf(args.jex.tokens[0].identifier), args.jex.tokens[1].name || tickerOf(args.jex.tokens[1].identifier)];
	const pairLabel = args.lockedMex ? `${XMEX.name} · xExchange` : args.farmMeta ? `${args.farmMeta.farmingSymbol ?? tickerOf(args.farmMeta.farmingId ?? "")} ${kind === "stakedLp" ? "LP staked" : "farm"}` : pairParts ? `${prettyLpTicker(pairParts[0])} / ${prettyLpTicker(pairParts[1])}` : args.name?.replace(/\s*\(JEX\)\s*/i, "").replace(/^(JexLp|OneDex)/i, "").replace(/LP$/i, "") || tickerOf(args.id);
	const title = kind === "lp" || kind === "stakedLp" ? args.jex ? titleFromJex(args.jex, args.ticker || tickerOf(args.id)) : lpTitleFromPair(pairParts?.[0], pairParts?.[1], args.ticker || tickerOf(args.id)) : args.ticker || tickerOf(args.id);
	const under = kind === "lp" || kind === "stakedLp" ? args.jex ? underFromJex(args.jex, args.amount) : args.mex ? underFromMex(args.mex, valueUsd) : underFromNames(pairParts?.[0], pairParts?.[1], valueUsd) : void 0;
	const amountTicker = args.ticker || tickerOf(args.id);
	return {
		id: args.id,
		venue,
		kind,
		title,
		pairLabel,
		amount: args.amount,
		amountTicker,
		valueUsd,
		icon: under?.[0]?.icon || tokenIcon(args.id, args.assets),
		icon2: under?.[1]?.icon,
		under
	};
}
async function readJexOrders(address) {
	const direct = await getJson(`${SWAP.jexApi}/accounts/${address}/orders`);
	return (Array.isArray(direct) ? direct : []).filter((o) => o.status === 0 || o.status == null).map((o) => {
		const payId = o.token_a_identifier ?? "";
		const getId = o.token_b_identifier ?? "";
		const remaining = Number(o.token_a_amount_remaining_human ?? 0);
		return {
			id: `jex-${o.id ?? `${payId}-${getId}`}`,
			venue: "jexchange",
			kind: "order",
			title: `${tickerOf(payId)} → ${tickerOf(getId)}`,
			pairLabel: `${tickerOf(payId)} / ${tickerOf(getId)}`,
			amount: remaining,
			amountTicker: tickerOf(payId),
			valueUsd: Number(o.token_a_amount_remaining_usd_value ?? 0),
			icon: tokenIcon(payId)
		};
	});
}
function emptyHatom() {
	return {
		suppliedUsd: 0,
		borrowedUsd: 0,
		boosterUsd: 0,
		lstUsd: 0,
		ushStakeUsd: 0,
		liquidUsd: 0,
		isolatedUsd: 0,
		borrowLimitUsd: 0,
		rows: []
	};
}
function emptyBurnify() {
	return {
		liquidUsd: 0,
		stakedUsd: 0,
		nftUsd: 0,
		pendingUsd: 0,
		pendingEgld: 0,
		nftPendingEgld: 0,
		liquidBfy: 0,
		stakedBfy: 0,
		bfyPriceUsd: 0,
		lockedUntilEpoch: 0,
		walletBufu: [],
		stakedBufu: [],
		rows: []
	};
}
function decodeVmBig(b64) {
	if (!b64) return 0n;
	try {
		const buf = Buffer.from(b64, "base64");
		if (!buf.length) return 0n;
		return BigInt("0x" + buf.toString("hex"));
	} catch {
		return 0n;
	}
}
function weiToEgld(raw) {
	if (!raw || raw === 0n) return 0;
	return Number(raw) / 0xde0b6b3a7640000;
}
/** Burnify RPS: stake * (globalRPS - userRPS) / 1e27. Skip if user checkpoint is unset. */
function rpsPendingWei(stakeRaw, globalRps, userRps, safety = 10n ** 27n) {
	if (stakeRaw <= 0n || userRps <= 0n || globalRps <= userRps || safety <= 0n) return 0n;
	return stakeRaw * (globalRps - userRps) / safety;
}
function parseBurnifyReward(raw) {
	if (raw == null) return 0;
	if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
	if (typeof raw === "string") {
		const n = Number(raw.replace(/[^\d.eE+-]/g, ""));
		return Number.isFinite(n) ? n : 0;
	}
	if (typeof raw === "object") {
		const n = Number(raw.rewards ?? raw.amount ?? raw.egld ?? raw.value ?? 0);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}
async function scQuery(sc, func, args = [], timeout = 5e3) {
	if (!sc) return [];
	const res = await postJson(`${GW}/vm-values/query`, {
		scAddress: sc,
		funcName: func,
		args
	}, timeout);
	const data = res?.data?.data ?? res?.data ?? {};
	return Array.isArray(data.returnData) ? data.returnData : [];
}
function decodeNftToken(b64) {
	if (!b64) return null;
	try {
		const buf = Buffer.from(b64, "base64");
		if (buf.length < 12) return null;
		const len = buf.readUInt32BE(0);
		if (len <= 0 || buf.length < 4 + len + 8) return null;
		const collection = buf.slice(4, 4 + len).toString("utf8");
		const nonce = Number(buf.readBigUInt64BE(4 + len));
		if (!collection || !Number.isFinite(nonce)) return null;
		return {
			collection,
			nonce
		};
	} catch {
		return null;
	}
}
function nftNonceOf(identifier, collection) {
	const raw = identifier?.startsWith(`${collection}-`) ? identifier.slice(collection.length + 1) : (identifier || "").split("-").pop();
	const n = parseInt(raw || "1", 16);
	return Number.isFinite(n) && n > 0 ? n : 1;
}
async function readProtocolExtras(address) {
	const extras = {
		hatom: [],
		burnify: [],
		burnifyMeta: {
			stakedBfy: 0,
			pendingEgld: 0,
			nftPendingEgld: 0,
			lockedUntilEpoch: 0,
			stakedBufu: [],
			bfyPrice: 0
		}
	};
	if (!isErdAddress(address)) return extras;
	let hex = "";
	try {
		hex = bech32ToHex(address);
	} catch {
		return extras;
	}
	const [booster, ushStake, isolated, isolatedTao, lst, burnStake, burnRewards, burnLock, burnRps, burnUserRps, bufuNfts, bufuRewards, nftApiRewards, nftApiStats, marketSnaps, htmTok, ushTok, segldTok, bfyTok] = await Promise.all([
		scQuery(HATOM.boosterV2, "getAccountTokens", [hex]),
		scQuery(HATOM.ushStaking, "getAccount", [hex]),
		scQuery(HATOM.isolatedEgld, "getAccount", [hex]),
		scQuery(HATOM.isolatedWtao, "getAccount", [hex]),
		scQuery(HATOM.liquidStaking, "getLsUserUndelegatedList", [hex]),
		scQuery(BURNIFY.staking, "getUserStake", [hex]),
		scQuery(BURNIFY.staking, "getAccruedUserRewards", [hex]),
		scQuery(BURNIFY.staking, "getUserStakeLockedUntil", [hex]),
		scQuery(BURNIFY.staking, "getRewardPerShare"),
		scQuery(BURNIFY.staking, "getRewardPerShareForUser", [hex]),
		scQuery(BURNIFY.nftStaking, "getUserDepositedNfts", [hex]),
		scQuery(BURNIFY.nftStaking, "getUserAccumulatedRewards", [hex]),
		getJson(`https://api.burnify.app/nft/${address}/rewards`).catch(() => null),
		getJson(`https://api.burnify.app/nft/${address}/rewards/stats`).catch(() => null),
		Promise.all(HATOM.markets.filter((m) => m.market).map(async (m) => {
			try {
				return {
					m,
					data: await scQuery(m.market, "getAccountSnapshot", [hex], 2200)
				};
			} catch {
				return {
					m,
					data: []
				};
			}
		})),
		mx(`/tokens/${HATOM.htm}`).catch(() => null),
		mx(`/tokens/${HATOM.ush}`).catch(() => null),
		mx(`/tokens/${HATOM.segld}`).catch(() => null),
		mx(`/tokens/${BURNIFY.bfy}`).catch(() => null)
	]);
	try {
		const boosterAmt = Number(decodeVmBig(booster[0] ?? booster[1])) / 0xde0b6b3a7640000;
		if (boosterAmt > 1e-4) extras.hatom.push({
			id: "hatom-booster",
			protocol: "hatom",
			role: "booster",
			ticker: "HTM",
			name: "HTM Booster",
			amount: boosterAmt,
			amountTicker: "HTM",
			valueUsd: 0,
			icon: tokenIcon(HATOM.htm),
			underlying: "HTM"
		});
		const ushAmt = Number(decodeVmBig(ushStake[0] ?? ushStake[1])) / 0xde0b6b3a7640000;
		if (ushAmt > 1e-4) extras.hatom.push({
			id: "hatom-ush-stake",
			protocol: "hatom",
			role: "ushStake",
			ticker: "USH",
			name: "USH staking",
			amount: ushAmt,
			amountTicker: "USH",
			valueUsd: 0,
			icon: tokenIcon(HATOM.ush),
			underlying: "USH"
		});
		const isoAmt = Number(decodeVmBig(isolated[0] ?? isolated[1])) / 0xde0b6b3a7640000;
		if (isoAmt > 1e-4) extras.hatom.push({
			id: "hatom-isolated-egld",
			protocol: "hatom",
			role: "isolated",
			ticker: "EGLD",
			name: "Isolated EGLD",
			amount: isoAmt,
			amountTicker: "EGLD",
			valueUsd: 0,
			icon: tokenIcon("EGLD"),
			underlying: "EGLD"
		});
		const isoTaoAmt = Number(decodeVmBig(isolatedTao[0] ?? isolatedTao[1])) / 0xde0b6b3a7640000;
		if (isoTaoAmt > 1e-4) extras.hatom.push({
			id: "hatom-isolated-wtao",
			protocol: "hatom",
			role: "isolated",
			ticker: "wTAO",
			name: "Isolated wTAO",
			amount: isoTaoAmt,
			amountTicker: "wTAO",
			valueUsd: 0,
			icon: tokenIcon(HATOM.wtao),
			underlying: "wTAO"
		});
		const lstAmt = Number(decodeVmBig(lst[0] ?? lst[1])) / 0xde0b6b3a7640000;
		if (lstAmt > 1e-4) extras.hatom.push({
			id: "hatom-lst-unbond",
			protocol: "hatom",
			role: "lst",
			ticker: "sEGLD",
			name: "sEGLD unbonding",
			amount: lstAmt,
			amountTicker: "sEGLD",
			valueUsd: 0,
			icon: tokenIcon(HATOM.segld),
			underlying: "sEGLD"
		});
		const stakeRaw = decodeVmBig(burnStake[0] ?? burnStake[1]);
		const bfyAmt = weiToEgld(stakeRaw);
		extras.burnifyMeta.stakedBfy = bfyAmt;
		extras.burnifyMeta.bfyPrice = Number(bfyTok?.price) || 0;
		const accrued = decodeVmBig(burnRewards[0] ?? burnRewards[1]);
		const globalRps = decodeVmBig(burnRps[0] ?? burnRps[1]);
		const userRps = decodeVmBig(burnUserRps[0] ?? burnUserRps[1]);
		let computedRewards = rpsPendingWei(stakeRaw, globalRps, userRps);
		if (stakeRaw > 0n && computedRewards === 0n && userRps === 0n) {
			const calc = await scQuery(BURNIFY.staking, "calculateRewardsForGivenPosition", [hex, toEvenHex(stakeRaw)], 4e3).catch(() => []);
			computedRewards = decodeVmBig(calc[0] ?? calc[1]);
		}
		extras.burnifyMeta.pendingEgld = weiToEgld(accrued + computedRewards);
		const nftScRewards = weiToEgld(decodeVmBig(bufuRewards[0] ?? bufuRewards[1]));
		const nftApi = Math.max(parseBurnifyReward(nftApiRewards), parseBurnifyReward(nftApiStats?.rewards ?? nftApiStats));
		extras.burnifyMeta.nftPendingEgld = Math.max(nftScRewards, nftApi);
		extras.burnifyMeta.lockedUntilEpoch = Number(decodeVmBig(burnLock[0] ?? burnLock[1]));
		extras.burnifyMeta.stakedBufu = (bufuNfts ?? []).map((row, i) => {
			const nft = decodeNftToken(row);
			if (!nft) return null;
			return {
				collection: nft.collection,
				nonce: nft.nonce,
				index: i + 1
			};
		}).filter(Boolean);
		if (bfyAmt > 1e-4) extras.burnify.push({
			id: "burnify-stake",
			protocol: "burnify",
			role: "staked",
			ticker: "BFY",
			name: "Staked BFY",
			amount: bfyAmt,
			amountTicker: "BFY",
			valueUsd: 0,
			pending: extras.burnifyMeta.pendingEgld,
			pendingUsd: 0,
			icon: tokenIcon(BURNIFY.bfy)
		});
		if (extras.burnifyMeta.stakedBufu.length > 0) extras.burnify.push({
			id: "burnify-bufu-staked",
			protocol: "burnify",
			role: "nft",
			ticker: "BUFU",
			name: "Staked BUFU",
			amount: extras.burnifyMeta.stakedBufu.length,
			amountTicker: "BUFU",
			valueUsd: 0,
			pending: extras.burnifyMeta.nftPendingEgld,
			pendingUsd: 0,
			icon: tokenIcon(BURNIFY.bfy)
		});
		const htmPx = htmTok?.price || 0;
		const ushPx = ushTok?.price || 1;
		const segldPx = segldTok?.price || 0;
		const bfyPx = extras.burnifyMeta.bfyPrice || bfyTok?.price || 0;
		for (const row of extras.hatom) {
			if (row.valueUsd > 0) continue;
			if (row.underlying === "HTM") row.valueUsd = row.amount * htmPx;
			else if (row.underlying === "USH") row.valueUsd = row.amount * ushPx;
			else if (row.underlying === "sEGLD") row.valueUsd = row.amount * (segldPx || 0);
		}
		for (const row of extras.burnify) {
			if (row.valueUsd > 0) continue;
			if (row.role === "nft") continue;
			row.valueUsd = row.amount * bfyPx;
		}
		for (const { m, data } of marketSnaps ?? []) {
			const vals = (data ?? []).map(decodeVmBig);
			if (!vals.length) continue;
			let borrow = 0n;
			if (vals.length >= 4) borrow = vals[2];
			else if (vals.length >= 2) borrow = vals[1];
			else borrow = vals[0];
			const dec = m.underlying === "USDC" || m.underlying === "USDT" ? 6 : 18;
			const amt = Number(borrow) / 10 ** dec;
			if (!(amt > 1e-4) || amt > 1e9) continue;
			extras.hatom.push({
				id: `hatom-borrow-${m.ticker}`,
				protocol: "hatom",
				role: "borrow",
				ticker: m.underlying,
				name: `Borrowed ${m.underlying}`,
				amount: amt,
				amountTicker: m.underlying,
				valueUsd: 0,
				icon: tokenIcon(m.id),
				underlying: m.underlying
			});
		}
	} catch {}
	return extras;
}
function buildBurnifyBoard(tokens, nfts, pools, extras, priceById) {
	const board = emptyBurnify();
	const extraRows = extras?.burnify ?? extras ?? [];
	const meta = extras?.burnifyMeta ?? {};
	const seen = /* @__PURE__ */ new Set();
	const push = (row) => {
		if (!row?.id || seen.has(row.id) || row.amount <= 0 && (row.valueUsd ?? 0) <= 0 && !(row.pending > 0)) return;
		seen.add(row.id);
		board.rows.push(row);
		if (row.role === "staked") board.stakedUsd += row.valueUsd;
		else if (row.role === "nft") board.nftUsd += row.valueUsd;
		else if (row.role === "fuel") board.liquidUsd += row.valueUsd;
		else board.liquidUsd += row.valueUsd;
		board.pendingUsd += row.pendingUsd ?? 0;
	};
	const egldPx = priceById.get("EGLD") || priceById.get(PAIRS.wegld) || 0;
	const bfyPx = priceById.get(BURNIFY.bfy) || meta.bfyPrice || 0;
	board.liquidBfy = tokens.filter((t) => t.id === BURNIFY.bfy || t.ticker === "BFY").reduce((s, t) => s + t.amount, 0);
	board.stakedBfy = meta.stakedBfy || extraRows.find((r) => r.id === "burnify-stake")?.amount || 0;
	board.bfyPriceUsd = bfyPx;
	board.pendingEgld = meta.pendingEgld || 0;
	board.nftPendingEgld = meta.nftPendingEgld || 0;
	board.lockedUntilEpoch = meta.lockedUntilEpoch || 0;
	board.stakedBufu = meta.stakedBufu || [];
	for (const n of nfts) {
		if (n.collection !== BURNIFY.bufu && n.collection !== BURNIFY.bufuOh) continue;
		const copies = Math.max(1, Math.floor(n.amount || 1));
		const nonce = n.nonce || nftNonceOf(n.identifier, n.collection);
		for (let i = 0; i < copies; i++) board.walletBufu.push({
			collection: n.collection,
			nonce: nonce + (copies > 1 ? i : 0)
		});
	}
	for (const t of tokens) {
		if (!isBurnifyAsset(t.id, t.ticker, t.name)) continue;
		const fuel = t.id === BURNIFY.bfuel || t.ticker === "BFUEL";
		push({
			id: t.id,
			protocol: "burnify",
			role: fuel ? "fuel" : "liquid",
			ticker: t.ticker,
			name: t.name,
			amount: t.amount,
			amountTicker: t.ticker,
			valueUsd: t.valueUsd,
			icon: t.icon
		});
	}
	for (const n of nfts) {
		if (!isBurnifyAsset(n.identifier, n.ticker, n.name, n.collection)) continue;
		push({
			id: n.collection,
			protocol: "burnify",
			role: "nft",
			ticker: n.ticker,
			name: n.name,
			amount: n.amount,
			amountTicker: n.ticker,
			valueUsd: n.valueUsd,
			icon: n.thumbnail
		});
	}
	for (const p of pools) {
		if (!isBurnifyAsset(p.id, p.amountTicker, p.pairLabel) && !isBurnifyAsset(p.id, p.title)) continue;
		push({
			id: p.id,
			protocol: "burnify",
			role: "lp",
			ticker: p.title,
			name: p.pairLabel,
			amount: p.amount,
			amountTicker: p.amountTicker,
			valueUsd: p.valueUsd,
			icon: p.icon
		});
	}
	for (const row of extraRows) {
		if (row.valueUsd <= 0 && row.role !== "nft") row.valueUsd = row.amount * bfyPx;
		if (row.pending && !row.pendingUsd) row.pendingUsd = row.pending * egldPx;
		push(row);
	}
	if (board.stakedBfy > 0 && bfyPx > 0) board.stakedUsd = board.stakedBfy * bfyPx;
	board.pendingUsd = (board.pendingEgld + board.nftPendingEgld) * egldPx;
	board.rows.sort((a, b) => b.valueUsd - a.valueUsd);
	return board;
}
export const getWalletBoard = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const { address } = data;
	const [account, tokenPage, nftsPage, nftCount, metaPage, position, farm, ooxNfts, wegld, mexToken, mexPairs, mexFarms, odPools, jexPools, jexFarms, delegations, stakeInfo, providers, identities, extras, bfyMarket] = await Promise.all([
		mx(`/accounts/${address}`),
		mx(`/accounts/${address}/tokens?size=500`),
		mx(`/accounts/${address}/nfts?size=200`),
		mx(`/accounts/${address}/nfts/count`),
		mx(`/accounts/${address}/nfts?type=MetaESDT&size=200`),
		readOoxPosition(address),
		readFarmPosition(address),
		getJson(`${OOX}/collections/${COLLECTION.identifier}/nfts?size=40`),
		mx(`/mex/tokens/${PAIRS.wegld}`),
		mx(`/mex/tokens/${PAIRS.mex}`),
		loadMexPairs(),
		mx("/mex/farms?size=200"),
		getJson("https://api.onedex.app/pools"),
		getJson(`${SWAP.jexApi}/pools/v3`),
		getJson(`${SWAP.jexApi}/farms`),
		mx(`/accounts/${address}/delegation`),
		mx(`/accounts/${address}/stake`),
		mx("/providers?size=400"),
		mx("/identities?size=1000"),
		readProtocolExtras(address).catch(() => ({
			hatom: [],
			burnify: [],
			burnifyMeta: {
				stakedBfy: 0,
				pendingEgld: 0,
				nftPendingEgld: 0,
				lockedUntilEpoch: 0,
				stakedBufu: [],
				bfyPrice: 0
			}
		})),
		mx(`/tokens/${BURNIFY.bfy}`)
	]);
	if (!account) throw new Error("Account unavailable");
	if (tokenPage == null) throw new Error("Tokens unavailable");
	let tokens = Array.isArray(tokenPage) ? tokenPage : [];
	if (tokens.length >= 500) {
		const extraTok = await mx(`/accounts/${address}/tokens?from=500&size=500`);
		if (extraTok?.length) tokens = [...tokens, ...extraTok];
	}
	let providerRows = providers ?? [];
	if (providerRows.length >= 400) {
		const extraProv = await mx("/providers?from=400&size=400");
		if (extraProv?.length) providerRows = [...providerRows, ...extraProv];
	}
	let nfts = nftsPage ?? [];
	if (typeof nftCount === "number" && nftCount > nfts.length) {
		const extra = await mx(`/accounts/${address}/nfts?from=${nfts.length}&size=${Math.min(300, nftCount - nfts.length)}`);
		if (extra?.length) nfts = [...nfts, ...extra];
	}
	const seenNft = new Set(nfts.map((n) => n.identifier).filter(Boolean));
	for (const meta of metaPage ?? []) if (meta.identifier && !seenNft.has(meta.identifier)) {
		nfts.push(meta);
		seenNft.add(meta.identifier);
	}
	if ((metaPage ?? []).length >= 200) {
		const extraMeta = await mx(`/accounts/${address}/nfts?type=MetaESDT&from=200&size=200`);
		for (const meta of extraMeta ?? []) if (meta.identifier && !seenNft.has(meta.identifier)) {
			nfts.push(meta);
			seenNft.add(meta.identifier);
		}
	}
	const econPrice = Number((await mx("/economics").catch(() => null))?.price) || 0;
	const egldUsd = Number(wegld?.price) || econPrice || 0;
	const mexUsd = mexToken?.price || tokens.find((t) => t.identifier === PAIRS.mex)?.price || 0;
	const heartUsd = (mapListings(ooxNfts)[0]?.priceEgld ?? COLLECTION.mintPriceEgld) * egldUsd;
	const egld = fromDenom(account?.balance, 18);
	const roarUsd = tokens.find((t) => t.identifier === TOKEN.identifier)?.price || .015;
	const mexLp = /* @__PURE__ */ new Map();
	for (const p of mexPairs ?? []) if (p.id) mexLp.set(p.id, p);
	const farmById = /* @__PURE__ */ new Map();
	for (const f of mexFarms ?? []) if (f.id && f.id !== FARM.token) farmById.set(f.id, f);
	const onedexLp = new Set((odPools ?? []).map((p) => p.lpTokenId).filter((id) => Boolean(id)));
	const jexLp = /* @__PURE__ */ new Map();
	for (const p of jexPools ?? []) {
		const id = p.lp_token_identifier || p.lp_token?.identifier;
		if (id) jexLp.set(id, p);
	}
	const jexFarmStake = /* @__PURE__ */ new Set();
	for (const f of jexFarms ?? []) {
		const id = f.staking_token?.identifier;
		if (id && (f.staking_token?.is_lp_token || f.staking_token?.is_jex_lp_token || jexLp.has(id))) jexFarmStake.add(id);
	}
	const identityByKey = /* @__PURE__ */ new Map();
	for (const row of identities ?? []) if (row.identity) identityByKey.set(row.identity, row);
	const providerByContract = /* @__PURE__ */ new Map();
	for (const row of providerRows ?? []) if (row.provider) providerByContract.set(row.provider, row);
	const poolMap = /* @__PURE__ */ new Map();
	const pushPool = (row) => mergePool(poolMap, row);
	const boardTokens = [];
	const pushToken = (row) => {
		const prev = boardTokens.find((t) => t.id === row.id);
		if (prev) {
			prev.amount += row.amount;
			prev.valueUsd += row.valueUsd;
			if (!prev.priceUsd && row.priceUsd) prev.priceUsd = row.priceUsd;
			return;
		}
		boardTokens.push(row);
	};
	if (egld > 0) pushToken({
		id: "EGLD",
		ticker: "EGLD",
		name: "eGold",
		amount: egld,
		priceUsd: egldUsd,
		valueUsd: egld * egldUsd,
		icon: tokenIcon("EGLD")
	});
	for (const row of tokens) {
		if (!row.identifier) continue;
		if (row.identifier === FARM.token) continue;
		const amount = fromAtomic(row.balance ?? "0", row.decimals ?? 18);
		if (amount <= 0) continue;
		let valueUsd = Number(row.valueUsd) || amount * (row.price ?? 0);
		const farmMeta = farmById.get(row.identifier);
		const mex = mexLp.get(row.identifier) || (farmMeta?.farmingId ? mexLp.get(farmMeta.farmingId) : undefined);
		const lockedMex = isLockedMexFamily(row.identifier);
		const xmexLp = isXmexLpFamily(row.identifier);
		if ((lockedMex || xmexLp) && valueUsd <= 0 && mexUsd > 0) valueUsd = amount * mexUsd;
		if (mex && valueUsd <= 0 && Number(mex.price) > 0) valueUsd = amount * Number(mex.price);
		if (farmMeta && valueUsd <= 0) valueUsd = amount * (Number(farmMeta.price) || Number(farmMeta.farmingPrice) || 0);
		const isFarmTok = Boolean(farmMeta);
		const hatomCore = hatomRoleOf(row.identifier);
		const skipPool = hatomCore === "supply" || hatomCore === "liquid" || hatomCore === "lst" || hatomCore === "booster";
		const jex = jexLp.get(row.identifier);
		const actualLp = isActualLpToken({
			id: row.identifier,
			name: row.name,
			description: row.assets?.description,
			mex: Boolean(mex),
			onedex: onedexLp.has(row.identifier),
			jex: Boolean(jex)
		});
		if (!skipPool && (isFarmTok || lockedMex || xmexLp || actualLp)) {
			pushPool(buildDexPool({
				id: row.identifier,
				name: row.name,
				ticker: row.ticker,
				amount,
				valueUsd,
				assets: row.assets,
				mex,
				jex,
				onedex: onedexLp.has(row.identifier),
				farmMeta,
				lockedMex,
				xmexLp,
				isFarmTok,
				website: row.assets?.website,
				description: row.assets?.description
			}));
			continue;
		}
		pushToken({
			id: row.identifier,
			ticker: row.ticker || tickerOf(row.identifier),
			name: row.name || row.ticker || row.identifier,
			amount,
			priceUsd: row.price ?? 0,
			valueUsd,
			icon: tokenIcon(row.identifier, row.assets)
		});
	}
	boardTokens.sort((a, b) => b.valueUsd - a.valueUsd);
	const nftMap = /* @__PURE__ */ new Map();
	for (const nft of nfts ?? []) {
		const collection = nft.collection || "";
		if (!collection || collection === FARM.token) continue;
		const farmMeta = farmById.get(collection);
		const lockedMex = isLockedMexFamily(collection);
		const xmexLp = isXmexLpFamily(collection);
		const mex = mexLp.get(collection) || (farmMeta?.farmingId ? mexLp.get(farmMeta.farmingId) : undefined);
		const jex = jexLp.get(collection);
		const actualLp = isActualLpToken({
			id: collection,
			name: nft.name,
			description: nft.assets?.description,
			mex: Boolean(mex),
			onedex: onedexLp.has(collection),
			jex: Boolean(jex)
		});
		if (farmMeta || lockedMex || xmexLp || actualLp) {
			const amount = fromAtomic(nft.balance ?? "0", nft.decimals ?? 18);
			if (amount <= 0) continue;
			let valueUsd = Number(nft.valueUsd) || amount * (Number(farmMeta?.price) || 0);
			if (valueUsd <= 0) {
				if ((lockedMex || xmexLp) && mexUsd > 0) valueUsd = amount * mexUsd;
				else if (mex && Number(mex.price) > 0) valueUsd = amount * Number(mex.price);
				else if (farmMeta?.farmingPrice) valueUsd = amount * farmMeta.farmingPrice;
			}
			pushPool(buildDexPool({
				id: collection,
				name: nft.name,
				ticker: farmMeta?.symbol || nft.ticker,
				amount,
				valueUsd,
				assets: nft.assets,
				mex,
				jex,
				onedex: onedexLp.has(collection),
				farmMeta,
				lockedMex,
				xmexLp,
				isFarmTok: Boolean(farmMeta) || xmexLp,
				website: nft.assets?.website,
				description: nft.assets?.description
			}));
			continue;
		}
		if (nft.type === "MetaESDT") {
			const amount = fromAtomic(nft.balance ?? "0", nft.decimals ?? 18);
			if (amount <= 0) continue;
			const valueUsd = nft.valueUsd ?? amount * (nft.price ?? 0);
			pushToken({
				id: collection,
				ticker: nft.ticker || tickerOf(collection),
				name: nft.name || nft.ticker || collection,
				amount,
				priceUsd: nft.price ?? 0,
				valueUsd,
				icon: tokenIcon(collection, nft.assets)
			});
			continue;
		}
		const amount = Number(nft.balance ?? 1) || 1;
		const isHeart = nft.identifier === COLLECTION.sftId || collection === COLLECTION.identifier;
		const valueUsd = isHeart ? amount * heartUsd : nft.valueUsd ?? 0;
		const prev = nftMap.get(collection);
		const thumb = (isHeart ? "/heart-of-roar.jpg" : null) || nft.media?.[0]?.thumbnailUrl || nft.media?.[0]?.url || nft.assets?.pngUrl || "/heart-of-roar.jpg";
		if (prev) {
			prev.amount += amount;
			prev.valueUsd += valueUsd;
		} else nftMap.set(collection, {
			collection,
			identifier: nft.identifier ?? collection,
			name: isHeart ? COLLECTION.name : nft.name || nft.ticker || collection,
			ticker: nft.ticker || collection.split("-")[0],
			amount,
			thumbnail: thumb,
			valueUsd,
			isHeart
		});
	}
	const boardNfts = [...nftMap.values()].sort((a, b) => b.valueUsd - a.valueUsd || b.amount - a.amount);
	boardTokens.sort((a, b) => b.valueUsd - a.valueUsd);
	const positions = [];
	if (position.staked > 0 || position.pendingRoar > 0) positions.push({
		id: "heart",
		titleKey: "walletHeartFarm" as const,
		amount: position.staked,
		amountTicker: "Heart",
		pending: position.pendingRoar,
		unlocking: 0,
		valueUsd: position.staked * heartUsd,
		pendingUsd: position.pendingRoar * roarUsd
	});
	if (farm.staked > 0 || farm.pending > 0 || farm.unlocking > 0) positions.push({
		id: "sroar",
		titleKey: "walletRoarFarm" as const,
		amount: farm.staked,
		amountTicker: "ROAR",
		pending: farm.pending,
		unlocking: farm.unlocking,
		valueUsd: (farm.staked + farm.unlocking) * roarUsd,
		pendingUsd: farm.pending * roarUsd
	});
	const boardDelegations = [];
	let delegatedActive = 0;
	for (const row of delegations ?? []) {
		const contract = row.contract ?? "";
		const staked = fromDenom(row.userActiveStake, 18);
		const rewards = fromDenom(row.claimableRewards, 18);
		let unlocking = 0;
		let readyFromList = 0;
		let minSec = Infinity;
		for (const u of row.userUndelegatedList ?? []) {
			const amt = fromDenom(u.amount, 18);
			unlocking += amt;
			const sec = Number(u.seconds ?? u.secondsRemaining ?? u.remainingSeconds);
			if (Number.isFinite(sec) && sec > 0) {
				if (sec < minSec) minSec = sec;
			} else if (Number.isFinite(sec) && sec <= 0) {
				readyFromList += amt;
			}
		}
		const unlockReady = Math.max(fromDenom(row.userUnBondable, 18), readyFromList);
		const unlockEndsAt = minSec < Infinity ? Date.now() + minSec * 1000 : undefined;
		if (staked <= 0 && rewards <= 0 && unlocking <= 0) continue;
		delegatedActive += staked;
		const provider = isErdAddress(contract) ? providerByContract.get(contract) : void 0;
		const ident = provider?.identity ? identityByKey.get(provider.identity) : void 0;
		boardDelegations.push({
			contract,
			name: ident?.name || prettyIdentity(provider?.identity) || "Validator",
			identity: provider?.identity,
			avatar: ident?.avatar,
			staked,
			rewards,
			unlocking,
			unlockReady,
			unlockEndsAt,
			apr: provider?.apr,
			valueUsd: (staked + unlocking) * egldUsd,
			pendingUsd: rewards * egldUsd
		});
	}
	const legacyStake = fromDenom(stakeInfo?.totalStaked, 18);
	if (legacyStake > delegatedActive + 1e-4) {
		const leftover = legacyStake - delegatedActive;
		boardDelegations.push({
			contract: "legacy",
			name: "Stake EGLD",
			staked: leftover,
			rewards: 0,
			unlocking: 0,
			valueUsd: leftover * egldUsd,
			pendingUsd: 0
		});
	}
	const usedContracts = new Set(boardDelegations.map((d) => d.contract).filter((c) => isErdAddress(c)));
	const boardProviders = buildProviderCatalog(providerRows, identityByKey, usedContracts);
	const priceById = /* @__PURE__ */ new Map();
	priceById.set("EGLD", egldUsd);
	priceById.set(PAIRS.wegld, egldUsd);
	priceById.set(TOKEN.identifier, roarUsd);
	priceById.set(PAIRS.mex, mexUsd);
	for (const t of boardTokens) priceById.set(t.id, t.priceUsd);
	for (const p of mexPairs ?? []) {
		if (p.baseId && p.basePrice) priceById.set(p.baseId, p.basePrice);
		if (p.quoteId && p.quotePrice) priceById.set(p.quoteId, p.quotePrice);
	}
	priceById.set(HATOM.htm, tokens.find((t) => t.identifier === HATOM.htm)?.price || 0);
	priceById.set(HATOM.ush, tokens.find((t) => t.identifier === HATOM.ush)?.price || 1);
	priceById.set(HATOM.segld, tokens.find((t) => t.identifier === HATOM.segld)?.price || egldUsd);
	priceById.set(BURNIFY.bfy, tokens.find((t) => t.identifier === BURNIFY.bfy)?.price || 0);
	for (const t of tokens ?? []) {
		if (t.identifier && t.price) priceById.set(t.identifier, t.price);
		const tick = (t.ticker || tickerOf(t.identifier ?? "")).toUpperCase();
		if (tick && t.price) priceById.set(tick, t.price);
	}
	priceById.set("USDC", priceById.get("USDC") || priceById.get(PAIRS.usdc) || 1);
	priceById.set("USDT", priceById.get("USDT") || 1);
	try {
		const jexPools = await readJexOrders(address);
		for (const row of jexPools) {
			if (row.valueUsd <= 0) {
				const payId = row.amountTicker === "EGLD" ? "EGLD" : row.amountTicker === "WEGLD" ? PAIRS.wegld : row.amountTicker === "ROAR" ? TOKEN.identifier : (tokens ?? []).find((t) => (t.ticker || tickerOf(t.identifier ?? "")) === row.amountTicker)?.identifier || "";
				row.valueUsd = row.amount * (priceById.get(payId) || 0);
			}
			pushPool(row);
		}
	} catch {}
	const pools = [...poolMap.values()].sort((a, b) => b.valueUsd - a.valueUsd);
	const protocolExtras = extras ?? {
		hatom: [],
		burnify: [],
		burnifyMeta: {}
	};
	const bfyPx = Number(bfyMarket?.price) || protocolExtras?.burnifyMeta?.bfyPrice || 0;
	if (bfyPx) {
		priceById.set(BURNIFY.bfy, bfyPx);
		priceById.set("BFY", bfyPx);
	}
	const burnify = buildBurnifyBoard(boardTokens, boardNfts, pools, protocolExtras, priceById);
	const pulled = new Set(burnify.rows.filter((row) => row.role !== "lp").map((row) => row.id));
	const displayTokens = boardTokens.filter((t) => !pulled.has(t.id));
	const displayNfts = boardNfts.filter((n) => !pulled.has(n.collection) && !pulled.has(n.identifier) && !isBurnifyAsset(n.identifier, n.ticker, n.name, n.collection));
	const pulledPools = new Set(burnify.rows.filter((row) => row.role === "lp").map((row) => row.id));
	const displayPools = pools.filter((p) => !pulledPools.has(p.id));
	const tokensUsd = displayTokens.reduce((s, t) => s + t.valueUsd, 0);
	const nftsUsd = displayNfts.reduce((s, n) => s + n.valueUsd, 0);
	const poolsUsd = displayPools.reduce((s, p) => s + p.valueUsd, 0);
	const stakingUsd = positions.reduce((s, p) => s + p.valueUsd + p.pendingUsd, 0) + boardDelegations.reduce((s, d) => s + d.valueUsd + d.pendingUsd, 0);
	const burnifyAssetUsd = burnify.liquidUsd + burnify.stakedUsd + burnify.nftUsd + burnify.pendingUsd;
	for (const tok of displayTokens) {
		const eq = equivalentOf(tok.ticker, tok.amount, tok.priceUsd, egldUsd, mexUsd);
		if (eq) tok.equivalent = eq;
	}
	for (const pool of displayPools) {
		if (pool.kind === "xmex") {
			const px = pool.amount > 0 ? pool.valueUsd / pool.amount : mexUsd;
			const eq = equivalentOf(pool.amountTicker || "XMEX", pool.amount, px, egldUsd, mexUsd);
			if (eq) pool.equivalent = eq;
		}
	}
	return {
		address,
		totalUsd: tokensUsd + nftsUsd + poolsUsd + stakingUsd + burnifyAssetUsd,
		tokensUsd,
		nftsUsd,
		poolsUsd,
		stakingUsd,
		tokens: displayTokens,
		nfts: displayNfts,
		pools: displayPools,
		positions,
		delegations: boardDelegations,
		providers: boardProviders,
		hatom: emptyHatom(),
		burnify,
		fetchedAt: Date.now()
	};
});
export const getMarketSnapshot = createServerFn({ method: "GET" }).handler(async () => {
	const [ooxNfts, token, mex, pairs, transfers, transferCount, accounts, buyTxs, wegld, farm] = await Promise.all([
		getJson(`${OOX}/collections/${COLLECTION.identifier}/nfts?size=40`),
		mx(`/tokens/${TOKEN.identifier}`),
		mx(`/mex/tokens/${TOKEN.identifier}`),
		loadMexPairs(),
		mx(`/nfts/${COLLECTION.sftId}/transfers?size=20`),
		mx(`/nfts/${COLLECTION.sftId}/transfers/count`),
		mx(`/nfts/${COLLECTION.sftId}/accounts?size=50`),
		mx(`/accounts/${ADDRESSES.marketplace}/transactions?function=buy&status=success&size=12`),
		mx(`/mex/tokens/${PAIRS.wegld}`),
		readOoxFarm()
	]);
	const cleanListings = mapListings(ooxNfts);
	const floorEgld = cleanListings[0]?.priceEgld ?? 0;
	const floorUsd = cleanListings[0]?.priceUsd ?? 0;
	const listedForSale = cleanListings.reduce((sum, l) => sum + l.amount, 0);
	const split = splitHolders(mapHolders(accounts));
	const heartBuys = (buyTxs ?? []).filter((tx) => isHeartBuy(decodeB64(tx.data)));
	const lastBuy = heartBuys[0];
	const lastBuyDecoded = decodeB64(lastBuy?.data);
	const lastSaleQty = lastBuy ? parseBuyQty(lastBuyDecoded) : 0;
	const lastSaleEgld = lastBuy ? lastSaleQty > 0 ? fromDenom(lastBuy.value, 18) / lastSaleQty : fromDenom(lastBuy.value, 18) : 0;
	const lastSaleAt = lastBuy?.timestamp ?? 0;
	const lastSaleHash = lastBuy?.txHash ?? "";
	const roarPriceUsd = mex?.price || token?.price || 0;
	const roarPrev24h = mex?.previous24hPrice || 0;
	const roarChange24h = roarPrev24h > 0 ? (roarPriceUsd - roarPrev24h) / roarPrev24h * 100 : 0;
	const pairRows = (pairs ?? []).filter((p) => p.baseId === TOKEN.identifier || p.quoteId === TOKEN.identifier).map((p) => {
		const roarIsBase = p.baseId === TOKEN.identifier;
		const other = roarIsBase ? p.quoteId : p.baseId;
		const first = other && other !== "EGLD" ? other : "EGLD";
		return {
			id: p.id ?? "",
			baseSymbol: p.baseSymbol ?? "—",
			quoteSymbol: p.quoteSymbol ?? "—",
			tvlUsd: p.totalValue ?? 0,
			volume24h: p.volume24h ?? 0,
			trades24h: p.tradesCount24h ?? 0,
			roarPrice: roarIsBase ? p.basePrice ?? roarPriceUsd : p.quotePrice ?? roarPriceUsd,
			swapUrl: swapUrl(first ?? "EGLD", TOKEN.identifier)
		};
	}).sort((a, b) => b.tvlUsd - a.tvlUsd);
	const tvlUsd = token?.totalLiquidity || pairRows.reduce((sum, p) => sum + p.tvlUsd, 0);
	const seen = /* @__PURE__ */ new Set();
	const activity = [];
	for (const tx of heartBuys) {
		const hash = tx.txHash ?? "";
		if (!hash || seen.has(hash)) continue;
		seen.add(hash);
		const decoded = decodeB64(tx.data);
		activity.push({
			hash,
			kind: "sale",
			functionName: "buy",
			quantity: parseBuyQty(decoded),
			sender: tx.sender ?? "",
			receiver: tx.receiver ?? ADDRESSES.marketplace,
			timestamp: tx.timestamp ?? 0,
			valueEgld: fromDenom(tx.value, 18)
		});
		if (activity.length >= 10) break;
	}
	for (const t of transfers ?? []) {
		const hash = t.txHash ?? "";
		const sender = t.sender ?? "";
		const receiver = t.receiver ?? "";
		if (!hash || sender === receiver || seen.has(hash)) continue;
		if (sender === ADDRESSES.marketplace) continue;
		seen.add(hash);
		const qty = Number(t.action?.arguments?.transfers?.[0]?.value ?? 0);
		const fn = t.function ?? t.action?.name ?? "transfer";
		activity.push({
			hash,
			kind: classifyActivity(fn, sender, receiver),
			functionName: fn,
			quantity: Number.isFinite(qty) ? qty : 0,
			sender,
			receiver,
			timestamp: t.timestamp ?? 0,
			valueEgld: fromDenom(t.value, 18)
		});
		if (activity.length >= 12) break;
	}
	activity.sort((a, b) => b.timestamp - a.timestamp);
	return {
		listings: cleanListings,
		floorEgld,
		floorUsd,
		listedForSale,
		lastSaleEgld,
		lastSaleQty,
		lastSaleAt,
		lastSaleHash,
		heartHolders: split.walletHolderCount,
		heartTransfers: typeof transferCount === "number" ? transferCount : 0,
		ooxStaked: farm.staked > 0 ? farm.staked : split.ooxStaked,
		inWallets: split.inWallets,
		marketplaceHeld: split.marketplaceHeld,
		prideVaultStaked: farm.staked > 0 ? farm.staked : split.prideVaultStaked,
		roarPriceUsd,
		roarPrev24h,
		roarChange24h,
		roarVolume24h: token?.totalVolume24h || mex?.previous24hVolume || 0,
		roarMcap: token?.marketCap ?? 0,
		roarHolders: token?.accounts ?? 0,
		roarCirculating: Number(token?.circulatingSupply ?? 0),
		tvlUsd,
		egldPriceUsd: wegld?.price || 0,
		pairs: pairRows,
		activity: activity.slice(0, 10),
		poolRoar: farm.remaining || farm.totalPool,
		dailyPerNft: farm.dailyPerNft,
		fetchedAt: Date.now()
	};
});
function withAccountGuard(base, account) {
	const extra = account?.isGuarded ? CHAIN.guardedExtraGas : 0;
	const guarded = Boolean(account?.isGuarded && account.activeGuardianAddress);
	return {
		...base,
		gasLimit: base.gasLimit + extra,
		version: CHAIN.txVersion,
		...guarded ? {
			options: CHAIN.guardedOptions,
			guardian: account.activeGuardianAddress
		} : {}
	};
}
export const prepareBuyTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	const auctionId = Number(data.auctionId);
	const quantity = Math.floor(Number(data.quantity));
	if (!isErdAddress(address)) throw new Error("Invalid address");
	if (!Number.isFinite(auctionId) || auctionId <= 0) throw new Error("Invalid auction");
	if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");
	return {
		address,
		auctionId,
		quantity
	};
}).handler(async ({ data }) => {
	const { address, auctionId, quantity } = data;
	const [ooxNfts, account] = await Promise.all([getJson(`${OOX}/collections/${COLLECTION.identifier}/nfts?size=40`), mx(`/accounts/${address}?withGuardianInfo=true`)]);
	const listing = mapListings(ooxNfts).find((row) => row.auctionId === auctionId);
	if (!listing) throw new Error("Listing no longer active on OOX");
	if (listing.paymentToken !== "EGLD") throw new Error("Only EGLD listings can be bought here");
	if (quantity > listing.amount) throw new Error("Not enough Hearts in this listing");
	const value = weiTimes(listing.priceWei, quantity);
	const egld = fromDenom(account?.balance, 18);
	const totalEgld = fromDenom(value, 18);
	if (egld + 1e-12 < totalEgld) throw new Error("Not enough EGLD — swap ROAR to EGLD first");
	return {
		...withAccountGuard({
			sender: address,
			receiver: ADDRESSES.marketplace,
			nonce: account?.nonce ?? 0,
			value,
			data: encodeBuyData(auctionId, quantity),
			gasLimit: CHAIN.buyGasLimit,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account),
		auctionId,
		quantity,
		priceEgld: listing.priceEgld,
		totalEgld,
		isGuarded: Boolean(account?.isGuarded)
	};
});
export const prepareBuyStakeTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	const auctionId = Number(data.auctionId);
	const quantity = Math.floor(Number(data.quantity));
	if (!isErdAddress(address)) throw new Error("Invalid address");
	if (!Number.isFinite(auctionId) || auctionId <= 0) throw new Error("Invalid auction");
	if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");
	return {
		address,
		auctionId,
		quantity
	};
}).handler(async ({ data }) => {
	const { address, auctionId, quantity } = data;
	const [ooxNfts, account] = await Promise.all([getJson(`${OOX}/collections/${COLLECTION.identifier}/nfts?size=40`), mx(`/accounts/${address}?withGuardianInfo=true`)]);
	const listing = mapListings(ooxNfts).find((row) => row.auctionId === auctionId);
	if (!listing) throw new Error("Listing no longer active on OOX");
	if (listing.paymentToken !== "EGLD") throw new Error("Only EGLD listings can be bought here");
	if (quantity > listing.amount) throw new Error("Not enough Hearts in this listing");
	const value = weiTimes(listing.priceWei, quantity);
	const egld = fromDenom(account?.balance, 18);
	const totalEgld = fromDenom(value, 18);
	if (egld + 1e-12 < totalEgld + CHAIN.buyStakeKeepEgld) throw new Error("Not enough EGLD — swap ROAR to EGLD first");
	const nonce = account?.nonce ?? 0;
	return {
		txs: [withAccountGuard({
			sender: address,
			receiver: ADDRESSES.marketplace,
			nonce,
			value,
			data: encodeBuyData(auctionId, quantity),
			gasLimit: CHAIN.buyGasLimit,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account), withAccountGuard({
			sender: address,
			receiver: address,
			nonce: nonce + 1,
			value: "0",
			data: encodeStakeHearts(quantity),
			gasLimit: CHAIN.stakeGasLimit,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account)],
		auctionId,
		quantity,
		priceEgld: listing.priceEgld,
		totalEgld,
		isGuarded: Boolean(account?.isGuarded)
	};
});
export const prepareStakeTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	const quantity = Math.floor(Number(data.quantity));
	if (!isErdAddress(address)) throw new Error("Invalid address");
	if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");
	return {
		address,
		quantity
	};
}).handler(async ({ data }) => {
	const { address, quantity } = data;
	const [nfts, account] = await Promise.all([mx(`/accounts/${address}/nfts?collections=${COLLECTION.identifier}&size=10`), mx(`/accounts/${address}?withGuardianInfo=true`)]);
	const heart = (nfts ?? []).find((n) => n.identifier === COLLECTION.sftId);
	if (quantity > Number(heart?.balance ?? 0)) throw new Error("Not enough Hearts in wallet");
	return {
		...withAccountGuard({
			sender: address,
			receiver: address,
			nonce: account?.nonce ?? 0,
			value: "0",
			data: encodeStakeHearts(quantity),
			gasLimit: CHAIN.stakeGasLimit,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account),
		kind: "stake",
		quantity
	};
});
export const prepareUnstakeTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	const quantity = Math.floor(Number(data.quantity));
	if (!isErdAddress(address)) throw new Error("Invalid address");
	if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Invalid quantity");
	return {
		address,
		quantity
	};
}).handler(async ({ data }) => {
	const { address, quantity } = data;
	const [position, account] = await Promise.all([readOoxPosition(address), mx(`/accounts/${address}?withGuardianInfo=true`)]);
	if (quantity > position.staked) throw new Error("Not enough Hearts staked on OOX");
	return {
		...withAccountGuard({
			sender: address,
			receiver: ADDRESSES.ooxStaking,
			nonce: account?.nonce ?? 0,
			value: "0",
			data: encodeUnstakeHearts(quantity),
			gasLimit: CHAIN.unstakeGasLimit,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account),
		kind: "unstake",
		quantity
	};
});
export const prepareClaimTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const { address } = data;
	const [position, account] = await Promise.all([readOoxPosition(address), mx(`/accounts/${address}?withGuardianInfo=true`)]);
	if (position.staked <= 0 && position.pendingRoar <= 0) throw new Error("Nothing to claim on OOX");
	return {
		...withAccountGuard({
			sender: address,
			receiver: ADDRESSES.ooxStaking,
			nonce: account?.nonce ?? 0,
			value: "0",
			data: encodeClaimHearts(),
			gasLimit: CHAIN.claimGasLimit,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account),
		kind: "claim",
		quantity: 0
	};
});
export const prepareHeartRestakeTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const { address } = data;
	const [position, account] = await Promise.all([
		readOoxPosition(address),
		mx(`/accounts/${address}?withGuardianInfo=true`)
	]);
	if (position.pendingRoar <= 0) throw new Error("Nothing to restake");
	const amount = position.pendingRoar;
	let raw = toAtomic(amount, TOKEN.decimals);
	if (raw > 1n) raw -= 1n;
	if (raw <= 0n) throw new Error("Nothing to restake");
	const claimTx = withAccountGuard({
		sender: address,
		receiver: ADDRESSES.ooxStaking,
		nonce: account?.nonce ?? 0,
		value: "0",
		data: encodeClaimHearts(),
		gasLimit: CHAIN.claimGasLimit,
		gasPrice: CHAIN.gasPrice,
		chainID: CHAIN.id
	}, account);
	// Claim only — client re-reads wallet ROAR after claim success, then prepareFarmTx stake.
	return {
		txs: [claimTx],
		amount: fromAtomic(raw, TOKEN.decimals)
	};
});
export const prepareDelegationTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = String(data.address ?? "").trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	const kind = String(data.kind ?? "");
	if (![
		"claim",
		"restake",
		"stake",
		"unstake",
		"withdraw"
	].includes(kind)) throw new Error("Invalid action");
	const contract = String(data.contract ?? "").trim();
	if (kind === "stake" || kind === "unstake" || kind === "withdraw") {
		if (!isErdAddress(contract)) throw new Error("Invalid provider");
	} else if (contract && contract !== "legacy" && !isErdAddress(contract)) throw new Error("Invalid provider");
	return {
		address,
		kind,
		contract,
		amount: Number(data.amount ?? 0)
	};
}).handler(async ({ data }) => {
	const { address, kind, contract, amount } = data;
	if (kind === "stake" || kind === "unstake" || kind === "withdraw") {
		if (kind === "stake") {
			const provider = await mx(`/providers/${contract}`);
			if (!provider) throw new Error("Unknown validator");
		}
		const account = await mx(`/accounts/${address}?withGuardianInfo=true`);
		const raw = kind === "withdraw" ? 0n : toAtomic(amount, 18);
		if (kind !== "withdraw" && raw <= 0n) throw new Error("Invalid amount");
		const dataField = kind === "stake" ? encodeDelegate() : kind === "unstake" ? encodeUnDelegate(raw) : encodeWithdrawDelegation();
		const gas = kind === "stake" ? CHAIN.delegationStakeGasLimit : kind === "unstake" ? CHAIN.delegationUnstakeGasLimit : CHAIN.delegationWithdrawGasLimit;
		return {
			kind,
			txs: [withAccountGuard({
				sender: address,
				receiver: contract,
				nonce: account?.nonce ?? 0,
				value: kind === "stake" ? raw.toString() : "0",
				data: dataField,
				gasLimit: gas,
				gasPrice: CHAIN.gasPrice,
				chainID: CHAIN.id
			}, account)],
			amount: kind === "withdraw" ? 0 : fromAtomic(raw, 18)
		};
	}
	const [account, rows] = await Promise.all([mx(`/accounts/${address}?withGuardianInfo=true`), mx(`/accounts/${address}/delegation`)]);
	const targets = (rows ?? []).filter((row) => {
		const c = row.contract ?? "";
		if (!isErdAddress(c)) return false;
		if (contract && c !== contract) return false;
		return fromDenom(row.claimableRewards, 18) > 0;
	});
	if (targets.length === 0) throw new Error("Nothing to claim");
	let nonce = account?.nonce ?? 0;
	const txs = [];
	let claimed = 0;
	const dataField = kind === "restake" ? encodeReDelegateRewards() : encodeClaimDelegation();
	const gas = kind === "restake" ? CHAIN.delegationRestakeGasLimit : CHAIN.delegationClaimGasLimit;
	for (const row of targets) {
		claimed += fromDenom(row.claimableRewards, 18);
		txs.push(withAccountGuard({
			sender: address,
			receiver: row.contract,
			nonce: nonce++,
			value: "0",
			data: dataField,
			gasLimit: gas,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account));
	}
	return {
		kind,
		txs,
		amount: claimed
	};
});
export const prepareBurnifyTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = String(data.address ?? "").trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	const kind = data.kind;
	if (![
		"stakeBfy",
		"unstakeBfy",
		"claimBfy",
		"stakeBufu",
		"unstakeBufu",
		"claimBufu",
		"claimAll"
	].includes(kind)) throw new Error("Invalid Burnify action");
	return {
		address,
		kind,
		amount: Number(data.amount ?? 0)
	};
}).handler(async ({ data }) => {
	const { address, kind, amount } = data;
	const [account, extras] = await Promise.all([mx(`/accounts/${address}?withGuardianInfo=true`), readProtocolExtras(address).catch(() => ({
		hatom: [],
		burnify: [],
		burnifyMeta: {}
	}))]);
	const meta = extras?.burnifyMeta ?? {};
	const nftHex = bech32ToHex(BURNIFY.nftStaking);
	let nonce = account?.nonce ?? 0;
	const wrap = (tx) => withAccountGuard({
		sender: address,
		nonce: nonce++,
		value: "0",
		gasPrice: CHAIN.gasPrice,
		chainID: CHAIN.id,
		...tx
	}, account);
	if (kind === "claimBfy" || kind === "claimBufu" || kind === "claimAll") {
		const txs = [];
		let claimed = 0;
		if (kind === "claimBfy" || kind === "claimAll" && ((meta.pendingEgld || 0) > 0 || (meta.stakedBfy || 0) > 0)) {
			claimed += meta.pendingEgld || 0;
			txs.push(wrap({
				receiver: BURNIFY.staking,
				data: encodeBurnifyClaim(),
				gasLimit: CHAIN.burnifyClaimGasLimit
			}));
		}
		if (kind === "claimBufu" || kind === "claimAll" && ((meta.nftPendingEgld || 0) > 0 || (meta.stakedBufu?.length || 0) > 0)) {
			claimed += meta.nftPendingEgld || 0;
			txs.push(wrap({
				receiver: BURNIFY.nftStaking,
				data: encodeBurnifyClaim(),
				gasLimit: CHAIN.burnifyClaimGasLimit
			}));
		}
		if (txs.length === 0) throw new Error("Nothing to claim");
		return {
			kind,
			amount: claimed,
			ticker: "EGLD",
			txs
		};
	}
	if (kind === "stakeBfy") {
		const tok = await mx(`/accounts/${address}/tokens/${BURNIFY.bfy}`).catch(() => null);
		const have = fromAtomic(tok?.balance ?? "0", tok?.decimals ?? 18);
		const raw = toAtomic(amount > 0 ? Math.min(amount, have) : have, 18);
		if (raw <= 0n) throw new Error("Not enough BFY");
		return {
			kind,
			amount: fromAtomic(raw, 18),
			ticker: "BFY",
			txs: [wrap({
				receiver: BURNIFY.staking,
				data: encodeBurnifyStakeBfy(raw),
				gasLimit: CHAIN.burnifyStakeGasLimit
			})]
		};
	}
	if (kind === "unstakeBfy") {
		const have = meta.stakedBfy || 0;
		const raw = toAtomic(amount > 0 ? Math.min(amount, have) : have, 18);
		if (raw <= 0n) throw new Error("Nothing staked");
		return {
			kind,
			amount: fromAtomic(raw, 18),
			ticker: "BFY",
			txs: [wrap({
				receiver: BURNIFY.staking,
				data: encodeBurnifyUnstakeBfy(raw),
				gasLimit: CHAIN.burnifyUnstakeGasLimit
			})]
		};
	}
	if (kind === "stakeBufu") {
		const [bufu, bufuOh] = await Promise.all([mx(`/accounts/${address}/nfts?collections=${BURNIFY.bufu}&size=50`).catch(() => []), mx(`/accounts/${address}/nfts?collections=${BURNIFY.bufuOh}&size=50`).catch(() => [])]);
		const nfts = [];
		for (const n of [...bufu ?? [], ...bufuOh ?? []]) {
			const collection = n.collection || "";
			if (collection !== BURNIFY.bufu && collection !== BURNIFY.bufuOh) continue;
			const nonceNft = Number(n.nonce ?? nftNonceOf(n.identifier, collection));
			const copies = Math.max(1, Number(n.amount ?? n.balance ?? 1));
			for (let i = 0; i < copies && nfts.length < 12; i++) nfts.push({
				collection,
				nonce: nonceNft
			});
		}
		if (nfts.length === 0) throw new Error("No BUFU to stake");
		return {
			kind,
			amount: nfts.length,
			ticker: "BUFU",
			txs: [wrap({
				receiver: address,
				data: encodeBurnifyStakeBufu(nftHex, nfts),
				gasLimit: CHAIN.burnifyNftBaseGasLimit + CHAIN.burnifyNftExtraGasLimit * Math.max(0, nfts.length - 1)
			})]
		};
	}
	const staked = (meta.stakedBufu ?? []).slice(0, 12);
	if (staked.length === 0) throw new Error("No BUFU staked");
	return {
		kind,
		amount: staked.length,
		ticker: "BUFU",
		txs: [wrap({
			receiver: BURNIFY.nftStaking,
			data: encodeBurnifyUnstakeBufu(staked),
			gasLimit: CHAIN.burnifyNftBaseGasLimit + CHAIN.burnifyNftExtraGasLimit * Math.max(0, staked.length - 1)
		})]
	};
});
export const prepareFarmTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	const kind = data.kind;
	if (![
		"stake",
		"claim",
		"compound",
		"unstake",
		"unbond"
	].includes(kind)) throw new Error("Invalid farm action");
	return {
		address,
		kind,
		amount: Number(data.amount ?? 0)
	};
}).handler(async ({ data }) => {
	const { address, kind, amount } = data;
	const [account, farm, roarToken, stats] = await Promise.all([
		mx(`/accounts/${address}?withGuardianInfo=true`),
		readFarmPosition(address),
		mx(`/accounts/${address}/tokens/${TOKEN.identifier}`),
		mx("/stats")
	]);
	const base = {
		sender: address,
		nonce: account?.nonce ?? 0,
		value: "0",
		gasPrice: CHAIN.gasPrice,
		chainID: CHAIN.id
	};
	const stakedSlots = farm.slots.filter((s) => s.kind === "staked").sort((a, b) => BigInt(b.amountRaw) > BigInt(a.amountRaw) ? 1 : BigInt(b.amountRaw) < BigInt(a.amountRaw) ? -1 : 0);
	const epoch = Number(stats?.epoch ?? 0);
	const unbondSlots = farm.slots.filter((s) => s.kind === "unbonding").sort((a, b) => {
		const aReady = a.unlockEpoch > 0 && a.unlockEpoch <= epoch ? 0 : 1;
		const bReady = b.unlockEpoch > 0 && b.unlockEpoch <= epoch ? 0 : 1;
		if (aReady !== bReady) return aReady - bReady;
		return BigInt(b.amountRaw) > BigInt(a.amountRaw) ? 1 : -1;
	});
	if (kind === "stake") {
		const raw = toAtomic(amount, TOKEN.decimals);
		if (raw <= 0n) throw new Error("Amount too small");
		if (BigInt(roarToken?.balance ?? "0") < raw) throw new Error("Not enough ROAR");
		const live = stakedSlots[0];
		const dataField = live ? encodeStakeFarmMerge(raw, live.nonce, live.amountRaw) : encodeStakeFarm(raw);
		return {
			...withAccountGuard({
				...base,
				receiver: live ? address : ADDRESSES.roarFarm,
				data: dataField,
				gasLimit: CHAIN.farmStakeGasLimit
			}, account),
			kind,
			amount
		};
	}
	if (kind === "unbond") {
		const slot = unbondSlots[0];
		if (!slot) throw new Error("Nothing to unbond yet");
		return {
			...withAccountGuard({
				...base,
				receiver: address,
				data: encodeFarmNftCall(slot.nonce, BigInt(slot.amountRaw), "unbondFarm"),
				gasLimit: CHAIN.farmUnbondGasLimit
			}, account),
			kind,
			amount: fromAtomic(slot.amountRaw, FARM.decimals)
		};
	}
	if (stakedSlots.length === 0) throw new Error("No SROAR position");
	const fn = kind === "claim" ? "claimRewards" : kind === "compound" ? "compoundRewards" : "unstakeFarm";
	const totalRaw = stakedSlots.reduce((s, row) => s + BigInt(row.amountRaw), 0n);
	if (kind === "unstake" && amount > 0) {
		const slot = stakedSlots[0];
		const want = toAtomic(amount, FARM.decimals);
		if (want > totalRaw) throw new Error("Not enough staked ROAR");
		if (want > 0n && want < totalRaw) {
			const sendRaw = want <= BigInt(slot.amountRaw) ? want : BigInt(slot.amountRaw);
			return {
				...withAccountGuard({
					...base,
					receiver: address,
					data: encodeFarmNftCall(slot.nonce, sendRaw, fn),
					gasLimit: CHAIN.farmUnstakeGasLimit
				}, account),
				kind,
				amount: fromAtomic(sendRaw, FARM.decimals)
			};
		}
	}
	const payments = stakedSlots.map((s) => ({
		token: FARM.token,
		nonce: s.nonce,
		amount: s.amountRaw
	}));
	const extra = Math.max(0, payments.length - 1);
	const gas = (kind === "unstake" ? CHAIN.farmUnstakeGasLimit : CHAIN.farmClaimGasLimit) + extra * 8e6;
	const dataField = payments.length === 1 ? encodeFarmNftCall(payments[0].nonce, BigInt(payments[0].amount), fn) : encodeMultiEsdtNftTransfer(FARM.stakingHex, payments, fn);
	return {
		...withAccountGuard({
			...base,
			receiver: address,
			data: dataField,
			gasLimit: gas
		}, account),
		kind,
		amount: fromAtomic(totalRaw, FARM.decimals)
	};
});
export const prepareEgldStakeTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	const amount = Number(data.amount);
	if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
	return {
		address,
		amount,
		slippage: asSlippagePct(data.slippage)
	};
}).handler(async ({ data }) => {
	const { address, amount, slippage } = data;
	const [swap, account, farm] = await Promise.all([
		prepareSwapTx({ data: {
			address,
			tokenId: "EGLD",
			direction: "to-roar",
			amount,
			slippage
		} }),
		mx(`/accounts/${address}?withGuardianInfo=true`),
		readFarmPosition(address)
	]);
	const minRaw = toAtomic(swap.minOut, TOKEN.decimals);
	if (minRaw <= 0n) throw new Error("Amount too small");
	const live = farm.slots.filter((s) => s.kind === "staked").sort((a, b) => BigInt(b.amountRaw) > BigInt(a.amountRaw) ? 1 : BigInt(b.amountRaw) < BigInt(a.amountRaw) ? -1 : 0)[0];
	const lastNonce = Math.max(...swap.txs.map((tx) => tx.nonce));
	const stakeTx = withAccountGuard({
		sender: address,
		receiver: live ? address : ADDRESSES.roarFarm,
		nonce: lastNonce + 1,
		value: "0",
		data: live ? encodeStakeFarmMerge(minRaw, live.nonce, live.amountRaw) : encodeStakeFarm(minRaw),
		gasLimit: CHAIN.farmStakeGasLimit,
		gasPrice: CHAIN.gasPrice,
		chainID: CHAIN.id
	}, account);
	return {
		txs: [...swap.txs, stakeTx],
		amountIn: swap.amountIn,
		amountOut: swap.amountOut,
		minOut: swap.minOut,
		route: swap.route,
		venue: swap.venue
	};
});
async function listDustCandidates(address) {
	const [account, tokenPage, wegld] = await Promise.all([
		mx(`/accounts/${address}?withGuardianInfo=true`),
		mx(`/accounts/${address}/tokens?size=500`),
		mx(`/mex/tokens/${PAIRS.wegld}`)
	]);
	let tokens = tokenPage ?? [];
	if (tokens.length >= 500) {
		const extra = await mx(`/accounts/${address}/tokens?from=500&size=500`);
		if (extra?.length) tokens = [...tokens, ...extra];
	}
	const egldUsd = wegld?.price || 0;
	const rows = [];
	const egldAmount = fromDenom(account?.balance, 18);
	const egldValue = egldAmount * egldUsd;
	if (egldAmount > 0 && isDustConvertible("EGLD", "EGLD", egldValue)) rows.push({
		id: "EGLD",
		ticker: "EGLD",
		amount: egldAmount,
		valueUsd: egldValue,
		icon: tokenIcon("EGLD"),
		balanceRaw: account?.balance ?? "0",
		decimals: 18
	});
	for (const row of tokens) {
		const id = row.identifier ?? "";
		if (!id) continue;
		const ticker = row.ticker || tickerOf(id);
		const amount = fromAtomic(row.balance ?? "0", row.decimals ?? 18);
		if (amount <= 0) continue;
		const valueUsd = Number(row.valueUsd ?? amount * (row.price ?? 0)) || 0;
		if (!isDustConvertible(id, ticker, valueUsd, {
			type: row.type,
			tags: row.assets?.tags
		})) continue;
		rows.push({
			id,
			ticker,
			amount,
			valueUsd,
			icon: tokenIcon(id, row.assets),
			balanceRaw: row.balance ?? "0",
			decimals: row.decimals ?? 18
		});
	}
	rows.sort((a, b) => b.valueUsd - a.valueUsd || b.amount - a.amount);
	return {
		account,
		rows: rows.slice(0, DUST.maxTokens)
	};
}
export const getDustPreview = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	return { address };
}).handler(async ({ data }) => {
	const { rows } = await listDustCandidates(data.address);
	return { tokens: rows.map((row) => ({
		id: row.id,
		ticker: row.ticker,
		amount: row.amount,
		valueUsd: row.valueUsd,
		icon: row.icon
	})) };
});
export const prepareDustConvertTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	const tokenIds = Array.isArray(data.tokenIds)
		? [...new Set(data.tokenIds.map((id) => String(id || "").trim()).filter(isTokenId))].slice(0, DUST.maxTokens)
		: [];
	if (tokenIds.length === 0) throw new Error("No dust selected");
	return {
		address,
		tokenIds,
		slippage: asSlippagePct(data.slippage)
	};
}).handler(async ({ data }) => {
	const { address, tokenIds, slippage } = data;
	const { account, rows } = await listDustCandidates(address);
	const wanted = new Set(tokenIds);
	const picked = rows.filter((row) => wanted.has(row.id));
	if (picked.length === 0) throw new Error("No dust to convert");
	const usable = (await Promise.all(picked.map(async (row) => {
		let inAtomic = BigInt(row.balanceRaw ?? "0");
		if (row.id === "EGLD") {
			const keep = toAtomic(DUST.egldGasKeep, 18);
			if (inAtomic <= keep) return null;
			inAtomic -= keep;
		}
		if (inAtomic <= 0n) return null;
		const agg = await xoxnoQuote(row.id, TOKEN.identifier, inAtomic, address, slippage);
		const decoded = decodeXoxnoData(agg?.transaction?.data || agg?.txData || "");
		const amountOut = Number(agg?.amountOutShort ?? 0);
		if (!decoded || amountOut <= 0) return null;
		const rawValue = agg?.transaction?.value;
		const value = rawValue && rawValue !== "" && rawValue !== "0x" ? rawValue : row.id === "EGLD" ? inAtomic.toString() : "0";
		const gas = Math.min(Math.max(agg?.transaction?.gasLimit ?? CHAIN.jexAggGasLimit, 1e6), 25e7);
		return {
			row,
			decoded,
			amountOut,
			receiver: agg?.transaction?.receiver || ADDRESSES.jexAggregator,
			value,
			gas
		};
	}))).filter(Boolean);
	if (usable.length === 0) throw new Error("No route to ROAR for this dust");
	let nonce = account?.nonce ?? 0;
	const txs = [];
	const outRows = [];
	for (const item of usable) {
		txs.push(withAccountGuard({
			sender: address,
			receiver: item.receiver,
			nonce,
			value: item.value,
			data: item.decoded,
			gasLimit: item.gas,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account));
		nonce += 1;
		outRows.push({
			id: item.row.id,
			ticker: item.row.ticker,
			amount: item.row.amount,
			valueUsd: item.row.valueUsd,
			amountOut: item.amountOut,
			icon: item.row.icon
		});
	}
	return {
		txs,
		rows: outRows,
		totalOut: outRows.reduce((s, r) => s + r.amountOut, 0),
		totalUsd: outRows.reduce((s, r) => s + r.valueUsd, 0)
	};
});
function broadcastError(body) {
	return body.returnMessage || body.message || body.error || body.status || "Broadcast failed";
}

export const prepareSendTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = String(data.address ?? "").trim();
	const to = String(data.to ?? "").trim();
	const tokenId = String(data.tokenId ?? "").trim();
	const amount = Number(data.amount ?? 0);
	if (!isErdAddress(address) || !isErdAddress(to)) throw new Error("Invalid address");
	if (address === to) throw new Error("Same address");
	if (!isTokenId(tokenId)) throw new Error("Missing token");
	if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
	return { address, to, tokenId, amount };
}).handler(async ({ data }) => {
	const { address, to, tokenId, amount } = data;
	const destHex = bech32ToHex(to);
	const account = await mx(`/accounts/${address}?withGuardianInfo=true`);
	const push = (base) => withAccountGuard({
		sender: address,
		nonce: account?.nonce ?? 0,
		gasPrice: CHAIN.gasPrice,
		chainID: CHAIN.id,
		...base
	}, account);
	if (tokenId === "EGLD") {
		const raw = toAtomic(amount, 18);
		const bal = BigInt(account?.balance ?? "0");
		if (raw <= 0n || raw > bal) throw new Error("Insufficient balance");
		return {
			txs: [push({
				receiver: to,
				value: raw.toString(),
				data: "",
				gasLimit: CHAIN.transferEgldGasLimit
			})],
			ticker: "EGLD",
			amount: fromAtomic(raw, 18)
		};
	}
	const tokens = await mx(`/accounts/${address}/tokens?size=500`);
	const tok = (tokens ?? []).find((row) => row.identifier === tokenId);
	if (tok) {
		const decimals = tok.decimals ?? 18;
		const raw = toAtomic(amount, decimals);
		const bal = BigInt(tok.balance ?? "0");
		if (raw <= 0n || raw > bal) throw new Error("Insufficient balance");
		return {
			txs: [push({
				receiver: to,
				value: "0",
				data: encodeEsdtTransfer(tokenId, raw),
				gasLimit: CHAIN.transferEsdtGasLimit
			})],
			ticker: tok.ticker || tickerOf(tokenId),
			amount: fromAtomic(raw, decimals)
		};
	}
	const nfts = await mx(`/accounts/${address}/nfts?size=200`);
	const owned = (nfts ?? []).filter((row) => row.collection === tokenId || row.identifier === tokenId);
	if (!owned.length) throw new Error("Token not found");
	const decimals = owned[0]?.decimals ?? 18;
	let need = toAtomic(amount, decimals);
	const payments = [];
	for (const nft of owned) {
		if (need <= 0n) break;
		const have = BigInt(nft.balance ?? "0");
		if (have <= 0n) continue;
		const take = have < need ? have : need;
		payments.push({
			token: nft.collection || tokenId,
			nonce: Number(nft.nonce ?? 0),
			amount: take
		});
		need -= take;
	}
	if (need > 0n || payments.length === 0) throw new Error("Insufficient balance");
	const extra = Math.max(0, payments.length - 1) * 400_000;
	const dataField = payments.length === 1
		? encodeEsdtNftSend(payments[0].token, payments[0].nonce, payments[0].amount, destHex)
		: encodeMultiEsdtSend(destHex, payments);
	return {
		txs: [push({
			receiver: address,
			value: "0",
			data: dataField,
			gasLimit: CHAIN.transferNftGasLimit + extra
		})],
		ticker: owned[0]?.ticker || tickerOf(tokenId),
		amount: fromAtomic(toAtomic(amount, decimals) - need, decimals)
	};
});
export const broadcastTx = createServerFn({ method: "POST" }).validator((data) => {
	const tx = data?.tx;
	if (!tx || typeof tx !== "object") throw new Error("Invalid signed transaction");
	const sender = String(tx.sender ?? "").trim();
	const receiver = String(tx.receiver ?? "").trim();
	const signature = String(tx.signature ?? "").replace(/^0x/i, "");
	const chainID = String(tx.chainID ?? "");
	if (!isErdAddress(sender) || !isErdAddress(receiver)) throw new Error("Invalid address");
	if (!/^[a-fA-F0-9]{128,192}$/.test(signature)) throw new Error("Invalid signature");
	if (chainID !== CHAIN.id) throw new Error("Wrong network");
	return { tx: { ...tx, sender, receiver, signature, chainID } };
}).handler(async ({ data }) => {
	const payload = { ...data.tx };
	if (payload.guardian && !payload.guardianSignature) throw new Error("Missing guardian signature — open PrideVault in xPortal");
	const res = await fetch(`${MX}/transactions`, {
		method: "POST",
		headers: {
			accept: "application/json",
			"content-type": "application/json",
			"user-agent": "PrideVault/1.0 (Heart of ROAR)"
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(12e3)
	});
	const body = await res.json();
	if (!res.ok || !body.txHash) throw new Error(broadcastError(body));
	return { txHash: body.txHash };
});
export const getTxStatus = createServerFn({ method: "POST" }).validator((data) => {
	const txHash = data.txHash.trim();
	if (!/^[a-fA-F0-9]{64}$/.test(txHash)) throw new Error("Invalid tx hash");
	return { txHash };
}).handler(async ({ data }) => {
	const { txHash } = data;
	const tx = await mxDirect(`/transactions/${txHash}`, 2500);
	if (!tx) return {
		txHash,
		status: "pending",
		message: ""
	};
	const status = tx.status ?? "pending";
	if (status === "fail" || status === "invalid") return {
		txHash,
		status,
		message: tx.results?.[0]?.returnMessage || tx.operations?.find((o) => o.message)?.message || "Transaction failed on-chain"
	};
	if (status === "success") return {
		txHash,
		status,
		message: ""
	};
	return {
		txHash,
		status: "pending",
		message: ""
	};
});
var TV = "https://tv-api.mvx.fr";
var TV_HEADERS = {
	origin: "https://e-compass.io",
	referer: "https://e-compass.io/"
};
function tvJson(path) {
	return getJson(`${TV}${path}`, TV_HEADERS);
}
export const getRoarChart = createServerFn({ method: "GET" }).validator((data) => {
	if (data.pair !== "egld" && data.pair !== "usdc") throw new Error("Invalid pair");
	if (!TIMEFRAMES.some((row) => row.id === data.timeframe)) throw new Error("Invalid timeframe");
	return {
		pair: data.pair,
		timeframe: data.timeframe
	};
}).handler(async ({ data }) => {
	const pair = data.pair;
	const tf = TIMEFRAMES.find((row) => row.id === data.timeframe) ?? TIMEFRAMES[2];
	const quoteId = pair === "egld" ? "WEGLD-bd4d79" : "USDC-c76f1f";
	const now = Math.floor(Date.now() / 1e3);
	const from = now - tf.seconds * tf.countback * 2;
	const symbolRaw = await tvJson(`/pairs/${TOKEN.identifier}/${quoteId}/symbol`);
	const symbol = typeof symbolRaw === "string" && symbolRaw.length > 0 ? symbolRaw : pair === "egld" ? `XEXCHANGE:${TOKEN.identifier}/${quoteId}` : `COMPOSED:${TOKEN.identifier}/${quoteId}`;
	const hist = await tvJson(`/history?symbol=${encodeURIComponent(symbol)}&resolution=${tf.resolution}&from=${from}&to=${now}&countback=${tf.countback}`);
	const candles = (hist?.t ?? []).map((t, i) => ({
		t: Number(t),
		o: Number(hist?.o?.[i] ?? hist?.c?.[i] ?? 0),
		h: Number(hist?.h?.[i] ?? hist?.c?.[i] ?? 0),
		l: Number(hist?.l?.[i] ?? hist?.c?.[i] ?? 0),
		c: Number(hist?.c?.[i] ?? 0),
		v: Number(hist?.v?.[i] ?? 0)
	})).filter((row) => Number.isFinite(row.c) && row.c > 0);
	const last = candles.at(-1)?.c ?? 0;
	const dayAgo = now - 86400;
	const past = [...candles].reverse().find((row) => row.t <= dayAgo) ?? candles[0];
	const change24h = past && past.c > 0 ? (last - past.c) / past.c * 100 : 0;
	return {
		pair,
		timeframe: tf.id,
		symbol,
		quote: pair === "egld" ? "EGLD" : "USDC",
		candles,
		last,
		change24h,
		fetchedAt: Date.now()
	};
});
var roarFlowCache = {
	at: 0,
	data: null,
	pending: null
};
export const getRoarFlowChart = createServerFn({ method: "GET" }).handler(async () => {
	const now = Date.now();
	if (roarFlowCache.data && now - roarFlowCache.at < 45e3) return roarFlowCache.data;
	if (roarFlowCache.pending) return await roarFlowCache.pending;
	const job = buildRoarFlowChart(now);
	roarFlowCache.pending = job;
	try {
		const snapshot = await job;
		roarFlowCache = {
			at: Date.now(),
			data: snapshot,
			pending: null
		};
		return snapshot;
	} catch (err) {
		roarFlowCache.pending = null;
		if (roarFlowCache.data) return roarFlowCache.data;
		throw err;
	}
});
async function buildRoarFlowChart(now) {
	const genesis = 1710199476;
	const nowSec = Math.floor(now / 1e3);
	const [accounts, roar, sroarAcc, hist] = await Promise.all([
		mx(`/tokens/${TOKEN.identifier}/accounts?size=10000`, 22e3),
		mx(`/tokens/${TOKEN.identifier}`),
		mxTokenAccounts(FARM.token, 200, 40),
		tvJson(`/history?symbol=${encodeURIComponent("COMPOSED:ROAR-e5185d/USDC-c76f1f")}&resolution=D&from=1710113076&to=${nowSec}&countback=1000`)
	]);
	const liveLiq = /* @__PURE__ */ new Map();
	let liveBurn = 0;
	let liveFarm = 0;
	const watch = /* @__PURE__ */ new Set([
		ADDRESSES.roarWegldPair,
		ADDRESSES.roarUsdcPair,
		ADDRESSES.roarMexPair,
		ADDRESSES.roarFarm,
		BURN_ADDRESS
	]);
	for (const row of Array.isArray(accounts) ? accounts : []) {
		const address = row?.address;
		if (!address) continue;
		let amt = 0;
		try {
			amt = fromAtomic(String(row.balance ?? "0"), TOKEN.decimals);
		} catch {
			amt = 0;
		}
		if (isBurnAddress(address)) {
			liveBurn += amt;
			watch.add(address);
			continue;
		}
		if (address === ADDRESSES.roarFarm) {
			liveFarm += amt;
			continue;
		}
		if (isLiquidityAccount(address, row.assets)) {
			liveLiq.set(address, (liveLiq.get(address) || 0) + amt);
			watch.add(address);
		}
	}
	for (const addr of [
		ADDRESSES.roarWegldPair,
		ADDRESSES.roarUsdcPair,
		ADDRESSES.roarMexPair
	]) if (!liveLiq.has(addr)) liveLiq.set(addr, 0);
	let liveStaked = 0;
	for (const row of Array.isArray(sroarAcc) ? sroarAcc : []) {
		const address = row?.address;
		if (!address || address.startsWith("erd1qqqqqqqqqqqqq")) continue;
		try {
			liveStaked += fromAtomic(String(row.balance ?? "0"), FARM.decimals);
		} catch {}
	}
	const histQuery = await postJson(`${INDEX}/accountsesdthistory/_search`, {
		size: 0,
		track_total_hits: false,
		query: { bool: { must: [{ term: { token: TOKEN.identifier } }, { terms: { address: [...watch] } }] } },
		aggs: { by_addr: {
			terms: {
				field: "address",
				size: 30
			},
			aggs: { by_day: {
				date_histogram: {
					field: "timestamp",
					fixed_interval: "1d",
					min_doc_count: 1,
					time_zone: "UTC"
				},
				aggs: { last: { top_hits: {
					size: 1,
					sort: [{ timestamp: { order: "desc" } }],
					_source: ["balance"]
				} } }
			} }
		} }
	}, 2e4);
	const liqSeries = /* @__PURE__ */ new Map();
	const burnSeries = /* @__PURE__ */ new Map();
	const stakedSeries = /* @__PURE__ */ new Map();
	for (const bucket of histQuery?.aggregations?.by_addr?.buckets ?? []) {
		const address = bucket.key;
		const pts = pointsOfBuckets(bucket.by_day?.buckets);
		if (isBurnAddress(address)) burnSeries.set(address, pts);
		else if (address === ADDRESSES.roarFarm) stakedSeries.set(address, pts);
		else liqSeries.set(address, pts);
	}
	for (const [addr, live] of liveLiq) {
		const pts = liqSeries.get(addr) || [];
		const last = pts.at(-1);
		const t = daySec(nowSec);
		if (!last) pts.push({
			t,
			v: live
		});
		else if (last.t === t) last.v = live;
		else pts.push({
			t,
			v: live
		});
		liqSeries.set(addr, pts);
	}
	{
		const pts = burnSeries.get("erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag") || [];
		const last = pts.at(-1);
		const t = daySec(nowSec);
		if (!last) pts.push({
			t,
			v: liveBurn
		});
		else if (last.t === t) last.v = liveBurn;
		else pts.push({
			t,
			v: liveBurn
		});
		burnSeries.set(BURN_ADDRESS, pts);
	}
	{
		const pts = stakedSeries.get(ADDRESSES.roarFarm) || [];
		const last = pts.at(-1);
		const t = daySec(nowSec);
		const farmNow = liveFarm || liveStaked;
		if (!last) pts.push({
			t,
			v: farmNow
		});
		else if (last.t === t) last.v = farmNow;
		else pts.push({
			t,
			v: farmNow
		});
		stakedSeries.set(ADDRESSES.roarFarm, pts);
	}
	let start = nowSec;
	for (const pts of [
		...liqSeries.values(),
		...burnSeries.values(),
		...stakedSeries.values()
	]) if (pts[0]?.t && pts[0].t < start) start = pts[0].t;
	if (!Number.isFinite(start) || start <= 0 || start >= nowSec) start = genesis;
	start = daySec(start);
	const end = daySec(nowSec);
	const liqDaily = forwardSum(liqSeries, start, end);
	const burnDaily = forwardSum(burnSeries, start, end);
	const farmDaily = forwardSum(stakedSeries, start, end);
	const farmLast = farmDaily.at(-1)?.v || liveFarm || 1;
	const stakeScale = liveStaked > 0 && farmLast > 0 ? liveStaked / farmLast : 1;
	const prices = (hist?.t ?? []).map((t, i) => ({
		t: Number(t),
		c: Number(hist?.c?.[i] ?? 0)
	})).filter((row) => Number.isFinite(row.t) && row.t > 0 && Number.isFinite(row.c) && row.c > 0);
	const roarUsd = roar?.price || prices.at(-1)?.c || .015;
	const supply = asTokenAmount(roar?.supply, TOKEN.decimals);
	const n = Math.min(liqDaily.length, burnDaily.length, farmDaily.length);
	const points = [];
	for (let i = 0; i < n; i++) {
		const t = liqDaily[i].t;
		const liqRoar = liqDaily[i].v;
		const burnRoar = burnDaily[i].v;
		const stakedRoar = farmDaily[i].v * stakeScale;
		const px = i === n - 1 ? roarUsd : priceAt(prices, t) || roarUsd;
		points.push({
			t,
			liqRoar,
			liqUsd: liqRoar * px,
			burnRoar,
			burnUsd: burnRoar * px,
			stakedRoar,
			stakedUsd: stakedRoar * px,
			supply,
			supplyUsd: supply * px,
			price: px
		});
	}
	if (points.length) {
		const last = points[points.length - 1];
		last.t = nowSec;
		last.liqRoar = [...liveLiq.values()].reduce((s, v) => s + v, 0);
		last.burnRoar = liveBurn;
		last.stakedRoar = liveStaked || last.stakedRoar;
		last.price = roarUsd;
		last.liqUsd = last.liqRoar * roarUsd;
		last.burnUsd = last.burnRoar * roarUsd;
		last.stakedUsd = last.stakedRoar * roarUsd;
		last.supply = supply;
		last.supplyUsd = supply * roarUsd;
	}
	const last = points.at(-1);
	const snapshot = {
		points,
		liqRoar: last?.liqRoar ?? [...liveLiq.values()].reduce((s, v) => s + v, 0),
		liqUsd: last?.liqUsd ?? 0,
		burnRoar: last?.burnRoar ?? liveBurn,
		burnUsd: last?.burnUsd ?? 0,
		stakedRoar: last?.stakedRoar ?? liveStaked,
		stakedUsd: last?.stakedUsd ?? 0,
		supply,
		roarUsd,
		start,
		fetchedAt: now
	};
	return snapshot;
}
function ammOut(amountIn, reserveIn, reserveOut, feeBps) {
	if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
	const inWithFee = amountIn * (10000n - BigInt(feeBps));
	return inWithFee * reserveOut / (reserveIn * 10000n + inWithFee);
}
function applyBps(amount, bps) {
	return amount * BigInt(1e4 - bps) / 10000n;
}
function fillBook(orders, paying, amountIn) {
	let remaining = amountIn;
	let out = 0n;
	for (const order of orders) {
		if (remaining <= 0n) break;
		const baseLeft = BigInt(order.token_a_amount_remaining ?? "0");
		const quoteLeft = BigInt(order.token_b_amount_remaining ?? "0");
		if (baseLeft <= 0n || quoteLeft <= 0n) continue;
		if (paying === "quote") {
			const takeQuote = remaining < quoteLeft ? remaining : quoteLeft;
			const takeBase = takeQuote * baseLeft / quoteLeft;
			remaining -= takeQuote;
			out += takeBase;
		} else {
			const takeBase = remaining < baseLeft ? remaining : baseLeft;
			const takeQuote = takeBase * quoteLeft / baseLeft;
			remaining -= takeBase;
			out += takeQuote;
		}
	}
	return {
		filledOut: out,
		spent: amountIn - remaining
	};
}
async function pairReservesOf(pair, otherId) {
	const key = `${pair}:${otherId}`;
	const hit = reserveMemo.get(key);
	if (hit && Date.now() - hit.at < 2000) return hit.data;
	const tokens = await mxDirect(`/accounts/${pair}/tokens?size=10`, 2200);
	const data = {
		roar: BigInt(tokens?.find((t) => t.identifier === TOKEN.identifier)?.balance ?? "0"),
		other: BigInt(tokens?.find((t) => t.identifier === otherId)?.balance ?? "0")
	};
	if (data.roar > 0n && data.other > 0n) reserveMemo.set(key, { at: Date.now(), data });
	return data;
}
async function pairTokenReserves(pair, tokenA, tokenB) {
	const key = `ab:${pair}:${tokenA}:${tokenB}`;
	const hit = reserveMemo.get(key);
	if (hit && Date.now() - hit.at < 2000) return hit.data;
	const tokens = await mxDirect(`/accounts/${pair}/tokens?size=10`, 2200);
	const data = {
		a: BigInt(tokens?.find((t) => t.identifier === tokenA)?.balance ?? "0"),
		b: BigInt(tokens?.find((t) => t.identifier === tokenB)?.balance ?? "0")
	};
	if (data.a > 0n && data.b > 0n) reserveMemo.set(key, { at: Date.now(), data });
	return data;
}
async function jexBook() {
	return getJson(`${SWAP.jexApi}/pairs/${TOKEN.identifier}/${PAIRS.wegld}/orderbook?depth=20`);
}
function decodeXoxnoData(data) {
	if (!data) return "";
	const asCall = (s) => s.startsWith("xo") || s.startsWith("ESDTTransfer") || s.startsWith("MultiESDTNFTTransfer") ? s : "";
	const plain = asCall(data);
	if (plain) return plain;
	if (/^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0) try {
		const hex = asCall(Buffer.from(data, "hex").toString("utf8"));
		if (hex) return hex;
	} catch {}
	try {
		const b64 = asCall(Buffer.from(data, "base64").toString("utf8"));
		if (b64) return b64;
	} catch {}
	return data;
}
const xoxnoWait = new Map();
const aggRateMemo = new Map();
const tokenMetaMemo = new Map();
async function xoxnoQuote(from, to, amountIn, sender, slippagePct, timeoutMs) {
	const slip = slippageAggOf(asSlippagePct(slippagePct));
	const key = `${from}|${to}|${amountIn.toString()}|${sender || ""}|${slip}`;
	const pending = xoxnoWait.get(key);
	if (pending) return pending;
	const timeout = timeoutMs ?? (sender ? 8e3 : 2800);
	const run = (async () => {
		const params = new URLSearchParams({
			from,
			to,
			amountIn: amountIn.toString(),
			slippage: slip
		});
		if (sender) params.set("sender", sender);
		try {
			const res = await fetch(`${SWAP.xoxnoApi}/api/v1/quote?${params.toString()}`, {
				headers: {
					accept: "application/json",
					"user-agent": "PrideVault/1.0 (Heart of ROAR)"
				},
				signal: AbortSignal.timeout(timeout)
			});
			if (!res.ok) return null;
			return await res.json();
		} catch {
			return null;
		}
	})();
	xoxnoWait.set(key, run);
	try {
		return await run;
	} finally {
		if (xoxnoWait.get(key) === run) xoxnoWait.delete(key);
	}
}
function aggSides(token, direction) {
	const other = token.wrap ? "EGLD" : token.pairToken || token.id;
	if (direction === "to-roar") return {
		from: other,
		to: TOKEN.identifier
	};
	return {
		from: TOKEN.identifier,
		to: other
	};
}
var KNOWN_DECIMALS = {
	EGLD: 18,
	[PAIRS.wegld]: 18,
	[PAIRS.usdc]: 6,
	[PAIRS.mex]: 18,
	[TOKEN.identifier]: TOKEN.decimals
};
function pairHexOf(address) {
	try {
		return bech32ToHex(address);
	} catch {
		return "";
	}
}
function otherOfPair(pair, tokenId) {
	return pair.baseId === tokenId ? pair.quoteId : pair.baseId;
}
async function loadMexPairs() {
	const [a, b] = await Promise.all([mx("/mex/pairs?from=0&size=400"), mx("/mex/pairs?from=400&size=400")]);
	return [...a ?? [], ...b ?? []];
}
async function loadSwapIndex() {
	const [pairs, ash] = await Promise.all([loadMexPairs(), getJson("https://aggregator.ashswap.io/tokens")]);
	const decimals = new Map(Object.entries(KNOWN_DECIMALS));
	for (const t of ash ?? []) if (t.id && typeof t.decimal === "number" && !decimals.has(t.id)) decimals.set(t.id, t.decimal);
	return {
		pairs: pairs ?? [],
		decimals
	};
}
function buildCatalog(pairs, decimals) {
	const roarWegld = pairOf(pairs, TOKEN.identifier, PAIRS.wegld);
	const roarUsdc = pairOf(pairs, TOKEN.identifier, PAIRS.usdc);
	const roarMex = pairOf(pairs, TOKEN.identifier, PAIRS.mex);
	const lpIds = new Set(pairs.map((p) => p.id).filter(Boolean));
	const byId = /* @__PURE__ */ new Map();
	const push = (row) => {
		if (!row.id || row.id === TOKEN.identifier) return;
		if (lpIds.has(row.id)) return;
		const prev = byId.get(row.id);
		if (prev && prev.hops <= row.hops) return;
		byId.set(row.id, row);
	};
	push({
		id: "EGLD",
		ticker: "EGLD",
		name: "eGold",
		decimals: 18,
		icon: tokenIcon("EGLD"),
		wrap: true,
		hops: 1,
		via: "direct",
		pair: ADDRESSES.roarWegldPair,
		pairToken: PAIRS.wegld
	});
	if (roarWegld?.address) push({
		id: PAIRS.wegld,
		ticker: "WEGLD",
		name: "WrappedEGLD",
		decimals: 18,
		icon: tokenIcon(PAIRS.wegld),
		wrap: false,
		hops: 1,
		via: "direct",
		pair: roarWegld.address,
		pairToken: PAIRS.wegld
	});
	if (roarUsdc?.address) push({
		id: PAIRS.usdc,
		ticker: "USDC",
		name: "USDC",
		decimals: decimals.get(PAIRS.usdc) ?? 6,
		icon: tokenIcon(PAIRS.usdc),
		wrap: false,
		hops: 1,
		via: "direct",
		pair: roarUsdc.address,
		pairToken: PAIRS.usdc
	});
	if (roarMex?.address) push({
		id: PAIRS.mex,
		ticker: "MEX",
		name: "MEX",
		decimals: 18,
		icon: tokenIcon(PAIRS.mex),
		wrap: false,
		hops: 1,
		via: "direct",
		pair: roarMex.address,
		pairToken: PAIRS.mex
	});
	for (const p of pairs) {
		if (!p.address || !p.baseId || !p.quoteId) continue;
		if (p.baseId === TOKEN.identifier || p.quoteId === TOKEN.identifier) {
			const other = otherOfPair(p, TOKEN.identifier);
			if (!other || other === "EGLD") continue;
			push({
				id: other,
				ticker: other === p.baseId ? p.baseSymbol ?? tickerOf(other) : p.quoteSymbol ?? tickerOf(other),
				name: other === p.baseId ? p.baseName || tickerOf(other) : p.quoteName || tickerOf(other),
				decimals: decimals.get(other) ?? 18,
				icon: tokenIcon(other),
				wrap: false,
				hops: 1,
				via: "direct",
				pair: p.address,
				pairToken: other
			});
			continue;
		}
		const mid = p.baseId === PAIRS.wegld || p.quoteId === PAIRS.wegld ? "wegld" : p.baseId === PAIRS.usdc || p.quoteId === PAIRS.usdc ? "usdc" : null;
		if (!mid) continue;
		const midToken = mid === "wegld" ? PAIRS.wegld : PAIRS.usdc;
		const roarPair = mid === "wegld" ? roarWegld : roarUsdc;
		if (!roarPair?.address) continue;
		const other = otherOfPair(p, midToken);
		if (!other || other === TOKEN.identifier) continue;
		push({
			id: other,
			ticker: other === p.baseId ? p.baseSymbol ?? tickerOf(other) : p.quoteSymbol ?? tickerOf(other),
			name: other === p.baseId ? p.baseName || tickerOf(other) : p.quoteName || tickerOf(other),
			decimals: decimals.get(other) ?? 18,
			icon: tokenIcon(other),
			wrap: false,
			hops: 2,
			via: mid,
			pair: p.address,
			pairToken: other,
			midPair: roarPair.address,
			midToken
		});
	}
	const featured = new Set(SWAP_TOKENS.map((t) => t.id));
	return [...byId.values()].sort((a, b) => {
		const af = featured.has(a.id) ? 0 : 1;
		const bf = featured.has(b.id) ? 0 : 1;
		if (af !== bf) return af - bf;
		if (a.hops !== b.hops) return a.hops - b.hops;
		return a.ticker.localeCompare(b.ticker);
	});
}
async function resolveRoute(tokenId) {
	const featured = SWAP_TOKENS.find((t) => t.id === tokenId);
	if (featured) return {
		id: featured.id,
		ticker: featured.ticker,
		name: featured.ticker,
		decimals: featured.decimals,
		icon: tokenIcon(featured.id),
		wrap: featured.wrap,
		hops: 1,
		via: "direct",
		pair: featured.pair,
		pairToken: featured.pairToken
	};
	const cached = tokenMetaMemo.get(tokenId);
	if (cached && Date.now() - cached.at < 60_000) return cached.data;
	const info = await mxDirect(`/tokens/${tokenId}`, 2200);
	const data = {
		id: tokenId,
		ticker: info?.ticker || tickerOf(tokenId),
		name: info?.name || tickerOf(tokenId),
		decimals: typeof info?.decimals === "number" ? info.decimals : (KNOWN_DECIMALS[tokenId] ?? 18),
		icon: tokenIcon(tokenId, info?.assets),
		wrap: false,
		hops: 0,
		via: "agg",
		pair: "",
		pairToken: tokenId
	};
	tokenMetaMemo.set(tokenId, { at: Date.now(), data });
	return data;
}
async function loadSwapPool(token) {
	if (token.hops === 1) {
		const reserves = await pairReservesOf(token.pair, token.pairToken);
		return {
			tokenId: token.id,
			ticker: token.ticker,
			decimals: token.decimals,
			hops: 1,
			roar: reserves.roar.toString(),
			other: reserves.other.toString(),
			reserves
		};
	}
	const mid = token.midToken ?? PAIRS.wegld;
	const [leg, roarLeg] = await Promise.all([
		pairTokenReserves(token.pair, token.pairToken, mid),
		pairTokenReserves(token.midPair ?? ADDRESSES.roarWegldPair, TOKEN.identifier, mid)
	]);
	return {
		tokenId: token.id,
		ticker: token.ticker,
		decimals: token.decimals,
		hops: 2,
		via: token.via === "usdc" ? "usdc" : "wegld",
		roar: roarLeg.a.toString(),
		other: leg.a.toString(),
		legIn: leg.a.toString(),
		legMid: leg.b.toString(),
		roarMid: roarLeg.b.toString(),
		roarOut: roarLeg.a.toString(),
		leg,
		roarLeg
	};
}
export const getSwapPool = createServerFn({ method: "GET" }).validator((data) => {
	const tokenId = String(data.tokenId || "").trim();
	if (!isTokenId(tokenId)) throw new Error("Invalid token");
	return { tokenId };
}).handler(async ({ data }) => {
	const token = await resolveRoute(data.tokenId);
	const pool = await loadSwapPool(token);
	return {
		tokenId: pool.tokenId,
		ticker: pool.ticker,
		decimals: pool.decimals,
		hops: pool.hops,
		via: pool.via,
		roar: pool.roar,
		other: pool.other,
		legIn: pool.legIn,
		legMid: pool.legMid,
		roarMid: pool.roarMid,
		roarOut: pool.roarOut
	};
});
export const getSwapAggRate = createServerFn({ method: "GET" }).validator((data) => {
	const tokenId = String(data.tokenId || "").trim();
	if (!isTokenId(tokenId)) throw new Error("Invalid token");
	if (data.direction !== "to-roar" && data.direction !== "from-roar") throw new Error("Invalid direction");
	return {
		tokenId,
		direction: data.direction
	};
}).handler(async ({ data }) => {
	const token = await resolveRoute(data.tokenId);
	const sides = aggSides(token, data.direction);
	const key = `${sides.from}|${sides.to}`;
	const hit = aggRateMemo.get(key);
	if (hit && Date.now() - hit.at < 8_000) return hit.payload;
	const inDec = data.direction === "to-roar" ? token.decimals : TOKEN.decimals;
	const refHuman = data.direction === "from-roar" ? 100 : 1;
	const ref = toAtomic(refHuman, inDec);
	if (ref <= 0n) throw new Error("Amount too small");
	const agg = await xoxnoQuote(sides.from, sides.to, ref, void 0, 1, 4000);
	const amountOut = agg?.amountOutShort ?? 0;
	if (!agg || amountOut <= 0) throw new Error("No aggregator route");
	const payload = {
		tokenId: token.id,
		ticker: token.ticker,
		decimals: token.decimals,
		direction: data.direction,
		amountIn: refHuman,
		amountOut,
		minOut: agg.amountOutMinShort ?? 0,
		priceImpact: agg.priceImpact ?? 0,
		route: "jex-agg",
		fetchedAt: Date.now()
	};
	aggRateMemo.set(key, { at: Date.now(), payload });
	return payload;
});
export const getSwapCatalog = createServerFn({ method: "GET" }).handler(async () => {
	const { pairs, decimals } = await loadSwapIndex();
	return buildCatalog(pairs, decimals);
});
export const getSwapMarkets = createServerFn({ method: "GET" }).handler(async () => {
	const rows = [];
	for (const tok of SWAP_TOKENS.filter((t) => t.id !== PAIRS.wegld)) {
		const res = await pairReservesOf(tok.pair, tok.pairToken);
		rows.push({
			id: tok.id,
			ticker: tok.ticker,
			decimals: tok.decimals,
			roarReserve: fromAtomic(res.roar, TOKEN.decimals),
			otherReserve: fromAtomic(res.other, tok.decimals)
		});
	}
	return rows.filter((r) => r.roarReserve > 0 && r.otherReserve > 0);
});
function quoteDirect(direction, amountIn, token, roar, other, book, slippagePct) {
	const inDec = direction === "to-roar" ? token.decimals : TOKEN.decimals;
	const outDec = direction === "to-roar" ? TOKEN.decimals : token.decimals;
	const inAtomic = toAtomic(amountIn, inDec);
	if (inAtomic <= 0n) throw new Error("Amount too small");
	const useJex = token.wrap && book;
	let bookFill = 0n;
	let bookSpent = 0n;
	if (useJex) {
		const sells = (book?.sell_orders ?? []).filter((o) => BigInt(o.token_a_amount_remaining ?? "0") > 0n);
		const buys = (book?.buy_orders ?? []).filter((o) => BigInt(o.token_b_amount_remaining ?? "0") > 0n);
		const fill = direction === "to-roar" ? fillBook(sells, "quote", inAtomic) : fillBook(buys, "base", inAtomic);
		bookFill = BigInt(fill.filledOut);
		bookSpent = BigInt(fill.spent);
	}
	const bookCovers = bookSpent === inAtomic && bookFill > 0n;
	const ammFill = direction === "to-roar" ? ammOut(inAtomic, other, roar, SWAP.ammFeeBps) : ammOut(inAtomic, roar, other, SWAP.ammFeeBps);
	const useBook = bookCovers && bookFill >= ammFill;
	const outAtomic = useBook ? bookFill : ammFill;
	if (outAtomic <= 0n) throw new Error("Pool too thin for this size");
	const minOut = applyBps(outAtomic, slippageBpsOf(asSlippagePct(slippagePct), false));
	const amountOut = fromAtomic(outAtomic, outDec);
	const minOutHuman = fromAtomic(minOut, outDec);
	const roarR = fromAtomic(roar, TOKEN.decimals);
	const otherR = fromAtomic(other, token.decimals);
	const spot = roarR > 0 ? otherR / roarR : 0;
	const execRate = amountIn > 0 ? direction === "to-roar" ? amountIn / amountOut : amountOut / amountIn : 0;
	const priceImpact = spot > 0 && execRate > 0 ? (execRate - spot) / spot * 100 : 0;
	return {
		tokenId: token.id,
		ticker: token.ticker,
		direction,
		amountIn,
		amountOut,
		minOut: minOutHuman,
		rate: execRate,
		priceImpact,
		route: useBook ? "jex-book" : "amm",
		venue: useBook ? "JEXchange orderbook" : `xExchange · ROAR/${token.ticker}`,
		hops: 1,
		roarReserve: roarR,
		otherReserve: otherR
	};
}
function quoteHop(direction, amountIn, token, tokenRes, roarRes, slippagePct) {
	const mid = token.midToken ?? PAIRS.wegld;
	const inDec = direction === "to-roar" ? token.decimals : TOKEN.decimals;
	const outDec = direction === "to-roar" ? TOKEN.decimals : token.decimals;
	const inAtomic = toAtomic(amountIn, inDec);
	if (inAtomic <= 0n) throw new Error("Amount too small");
	let outAtomic;
	if (direction === "to-roar") outAtomic = ammOut(ammOut(inAtomic, tokenRes.a, tokenRes.b, SWAP.ammFeeBps), roarRes.b, roarRes.a, SWAP.ammFeeBps);
	else outAtomic = ammOut(ammOut(inAtomic, roarRes.a, roarRes.b, SWAP.ammFeeBps), tokenRes.b, tokenRes.a, SWAP.ammFeeBps);
	if (outAtomic <= 0n) throw new Error("Pool too thin for this size");
	const minOut = applyBps(outAtomic, slippageBpsOf(asSlippagePct(slippagePct), true));
	const amountOut = fromAtomic(outAtomic, outDec);
	const roarR = fromAtomic(roarRes.a, TOKEN.decimals);
	const otherR = fromAtomic(tokenRes.a, token.decimals);
	const via = tickerOf(mid);
	return {
		tokenId: token.id,
		ticker: token.ticker,
		direction,
		amountIn,
		amountOut,
		minOut: fromAtomic(minOut, outDec),
		rate: amountOut > 0 ? amountIn / amountOut : 0,
		priceImpact: 0,
		route: "amm-hop",
		venue: `xExchange · ${token.ticker} → ${via} → ROAR`,
		hops: 2,
		via,
		roarReserve: roarR,
		otherReserve: otherR
	};
}
export const getSwapQuote = createServerFn({ method: "GET" }).validator((data) => {
	if (data.direction !== "to-roar" && data.direction !== "from-roar") throw new Error("Invalid direction");
	const amount = Number(data.amount);
	if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
	const tokenId = String(data.tokenId || "").trim();
	if (!isTokenId(tokenId)) throw new Error("Invalid token");
	return {
		tokenId,
		direction: data.direction,
		amount,
		slippage: asSlippagePct(data.slippage)
	};
}).handler(async ({ data }) => {
	const token = await resolveRoute(data.tokenId);
	const inDec = data.direction === "to-roar" ? token.decimals : TOKEN.decimals;
	const inAtomic = toAtomic(data.amount, inDec);
	if (inAtomic <= 0n) throw new Error("Amount too small");
	const isEgld = Boolean(token.wrap) || token.id === "EGLD";
	if (!isEgld) {
		const sides = aggSides(token, data.direction);
		const agg = await xoxnoQuote(sides.from, sides.to, inAtomic, void 0, data.slippage, 4000);
		if (agg && (agg.amountOutShort ?? 0) > 0) return {
			tokenId: token.id,
			ticker: token.ticker,
			direction: data.direction,
			amountIn: data.amount,
			amountOut: agg.amountOutShort,
			minOut: agg.amountOutMinShort ?? 0,
			rate: agg.rate ?? 0,
			priceImpact: agg.priceImpact ?? 0,
			route: "jex-agg",
			venue: "JEXchange aggregator",
			hops: 0,
			roarReserve: 0,
			otherReserve: 0,
			fetchedAt: Date.now()
		};
		throw new Error("No aggregator route");
	}
	const reserves = await pairReservesOf(token.pair, token.pairToken);
	if (reserves.roar <= 0n || reserves.other <= 0n) throw new Error("No quote right now");
	return {
		...quoteDirect(data.direction, data.amount, token, reserves.roar, reserves.other, null, data.slippage),
		fetchedAt: Date.now()
	};
});
function clampEgldIn(inAtomic, balanceRaw, gasLimit) {
	const gas = BigInt(Math.min(Math.max(Number(gasLimit) || 0, 0), 25e7));
	const fee = gas * BigInt(CHAIN.gasPrice);
	let bal = 0n;
	try {
		bal = BigInt(balanceRaw ?? "0");
	} catch {
		bal = 0n;
	}
	if (bal <= fee) return 0n;
	const maxIn = bal - fee;
	return inAtomic > maxIn ? maxIn : inAtomic;
}
function gasBudget(balanceRaw, inAtomic) {
	let bal = 0n;
	try {
		bal = BigInt(balanceRaw ?? "0");
	} catch {
		bal = 0n;
	}
	if (bal <= inAtomic) return 1_000_000;
	const leftover = bal - inAtomic;
	const gas = leftover / BigInt(CHAIN.gasPrice);
	const n = Number(gas > 250_000_000n ? 250_000_000n : gas);
	return Math.max(1_000_000, Math.min(n, 25e7));
}
export const prepareSwapTx = createServerFn({ method: "POST" }).validator((data) => {
	const address = data.address.trim();
	if (!isErdAddress(address)) throw new Error("Invalid address");
	if (data.direction !== "to-roar" && data.direction !== "from-roar") throw new Error("Invalid direction");
	const amount = Number(data.amount);
	if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
	const tokenId = String(data.tokenId || "").trim();
	if (!isTokenId(tokenId)) throw new Error("Invalid token");
	return {
		address,
		tokenId,
		direction: data.direction,
		amount,
		slippage: asSlippagePct(data.slippage)
	};
}).handler(async ({ data }) => {
	const { address, tokenId, direction, amount, slippage } = data;
	const token = await resolveRoute(tokenId);
	const isEgld = Boolean(token.wrap) || token.id === "EGLD";
	const [account, roarToken, otherToken] = await Promise.all([
		mx(`/accounts/${address}?withGuardianInfo=true`),
		mx(`/accounts/${address}/tokens/${TOKEN.identifier}`),
		isEgld ? Promise.resolve(null) : mx(`/accounts/${address}/tokens/${token.id}`)
	]);
	let nonce = account?.nonce ?? 0;
	const push = (base) => {
		const tx = withAccountGuard({
			...base,
			sender: address,
			gasPrice: CHAIN.gasPrice,
			chainID: CHAIN.id
		}, account);
		nonce += 1;
		return tx;
	};
	const txs = [];
	const inDec = direction === "to-roar" ? token.decimals : TOKEN.decimals;
	const outDec = direction === "to-roar" ? TOKEN.decimals : token.decimals;
	let inAtomic = toAtomic(amount, inDec);
	if (inAtomic <= 0n) throw new Error("Amount too small");
	if (direction === "to-roar" && token.wrap) {
		inAtomic = clampEgldIn(inAtomic, account?.balance, swapEgldKeepGas());
		if (inAtomic <= 0n) throw new Error("Not enough EGLD (keep some for gas)");
	}
	let spend = fromAtomic(inAtomic, inDec);
	// Non-EGLD: JEXchange / xoxno aggregator only.
	if (!isEgld) {
		const sides = aggSides(token, direction);
		if (direction === "to-roar") {
			if (BigInt(otherToken?.balance ?? "0") < inAtomic) throw new Error(`Not enough ${token.ticker}`);
		} else if (BigInt(roarToken?.balance ?? "0") < inAtomic) throw new Error("Not enough ROAR");
		const agg = await xoxnoQuote(sides.from, sides.to, inAtomic, address, slippage, 5e3);
		const aggTx = agg?.transaction;
		const aggOut = agg?.amountOutShort ?? 0;
		const decoded = decodeXoxnoData(aggTx?.data || agg?.txData || "");
		if (!decoded || aggOut <= 0) throw new Error("No aggregator route right now");
		const quotedGas = Math.min(Math.max(aggTx?.gasLimit ?? CHAIN.jexAggGasLimit, 1e6), 25e7);
		const rawValue = aggTx?.value;
		const value = rawValue && rawValue !== "" && rawValue !== "0x" ? rawValue : "0";
		txs.push(push({
			receiver: aggTx?.receiver || ADDRESSES.jexAggregator,
			nonce,
			value,
			data: decoded,
			gasLimit: quotedGas
		}));
		return {
			tokenId,
			direction,
			txs,
			amountIn: spend,
			amountOut: aggOut,
			minOut: agg?.amountOutMinShort ?? 0,
			route: "jex-agg",
			venue: "JEXchange aggregator",
			ticker: token.ticker
		};
	}
	// EGLD / wrap: xExchange ROAR/WEGLD pool path only (matches SwapDesk + AGENTS.md).
	const poolP = loadSwapPool(token).catch(() => null);
	if (token.hops === 1) {
		const pooled = await poolP;
		const reserves = pooled?.reserves ?? await pairReservesOf(token.pair, token.pairToken);
		if (reserves.roar <= 0n || reserves.other <= 0n) throw new Error("ROAR pool unavailable");
		const quote = quoteDirect(direction, spend, token, reserves.roar, reserves.other, null, slippage);
		const minOutAtomic = toAtomic(quote.minOut, outDec);
		if (minOutAtomic <= 0n) throw new Error("Amount too small");
		const tokenOut = direction === "to-roar" ? TOKEN.identifier : token.pairToken;
		const tokenIn = direction === "to-roar" ? token.pairToken : TOKEN.identifier;
		if (direction === "to-roar") {
			if (token.wrap) {
				inAtomic = clampEgldIn(inAtomic, account?.balance, CHAIN.wrapGasLimit + CHAIN.swapGasLimit);
				if (inAtomic <= 0n) throw new Error("Not enough EGLD (keep some for gas)");
				spend = fromAtomic(inAtomic, inDec);
				txs.push(push({
					receiver: ADDRESSES.wrapEgld,
					nonce,
					value: inAtomic.toString(),
					data: encodeWrapEgld(),
					gasLimit: CHAIN.wrapGasLimit
				}));
			} else if (BigInt(otherToken?.balance ?? "0") < inAtomic) throw new Error(`Not enough ${token.ticker}`);
			if (quote.route === "jex-book") txs.push(push({
				receiver: ADDRESSES.jexOrderbook,
				nonce,
				value: "0",
				data: encodeJexCreateOrder(tokenIn, inAtomic, tokenOut, minOutAtomic),
				gasLimit: CHAIN.jexOrderGasLimit
			}));
			else txs.push(push({
				receiver: token.pair,
				nonce,
				value: "0",
				data: encodeSwapFixedInput(tokenIn, inAtomic, tokenOut, minOutAtomic),
				gasLimit: CHAIN.swapGasLimit
			}));
		} else {
			if (BigInt(roarToken?.balance ?? "0") < inAtomic) throw new Error("Not enough ROAR");
			if (quote.route === "jex-book") {
				txs.push(push({
					receiver: ADDRESSES.jexOrderbook,
					nonce,
					value: "0",
					data: encodeJexCreateOrder(TOKEN.identifier, inAtomic, token.pairToken, minOutAtomic),
					gasLimit: CHAIN.jexOrderGasLimit
				}));
				if (token.wrap) txs.push(push({
					receiver: ADDRESSES.wrapEgld,
					nonce,
					value: "0",
					data: encodeUnwrapEgld(minOutAtomic),
					gasLimit: CHAIN.unwrapGasLimit
				}));
			} else {
				txs.push(push({
					receiver: token.pair,
					nonce,
					value: "0",
					data: encodeSwapFixedInput(TOKEN.identifier, inAtomic, token.pairToken, minOutAtomic),
					gasLimit: CHAIN.swapGasLimit
				}));
				if (token.wrap) txs.push(push({
					receiver: ADDRESSES.wrapEgld,
					nonce,
					value: "0",
					data: encodeUnwrapEgld(minOutAtomic),
					gasLimit: CHAIN.unwrapGasLimit
				}));
			}
		}
		return {
			tokenId,
			direction,
			txs,
			amountIn: quote.amountIn,
			amountOut: quote.amountOut,
			minOut: quote.minOut,
			route: quote.route,
			venue: quote.venue,
			ticker: token.ticker
		};
	}
	const mid = token.midToken ?? PAIRS.wegld;
	const midPair = token.midPair ?? ADDRESSES.roarWegldPair;
	const pooled = await poolP;
	const leg = pooled?.leg ?? await pairTokenReserves(token.pair, token.pairToken, mid);
	const roarLeg = pooled?.roarLeg ?? await pairTokenReserves(midPair, TOKEN.identifier, mid);
	if (leg.a <= 0n || leg.b <= 0n || roarLeg.a <= 0n || roarLeg.b <= 0n) throw new Error("Route too thin for this size");
	const quote = quoteHop(direction, spend, token, leg, roarLeg, slippage);
	const minOutAtomic = toAtomic(quote.minOut, outDec);
	if (minOutAtomic <= 0n) throw new Error("Amount too small");
	if (direction === "to-roar") {
		if (BigInt(otherToken?.balance ?? "0") < inAtomic) throw new Error(`Not enough ${token.ticker}`);
		const firstHex = pairHexOf(token.pair);
		const secondHex = pairHexOf(midPair);
		if (!firstHex || !secondHex) throw new Error("Invalid pair address");
		txs.push(push({
			receiver: ADDRESSES.xexRouter,
			nonce,
			value: "0",
			data: encodeMultiPairSwap(token.pairToken, inAtomic, [{
				pairHex: firstHex,
				tokenOut: mid,
				minOut: 1n
			}, {
				pairHex: secondHex,
				tokenOut: TOKEN.identifier,
				minOut: minOutAtomic
			}]),
			gasLimit: CHAIN.hopSwapGasLimit
		}));
	} else {
		if (BigInt(roarToken?.balance ?? "0") < inAtomic) throw new Error("Not enough ROAR");
		const firstHex = pairHexOf(midPair);
		const secondHex = pairHexOf(token.pair);
		if (!firstHex || !secondHex) throw new Error("Invalid pair address");
		txs.push(push({
			receiver: ADDRESSES.xexRouter,
			nonce,
			value: "0",
			data: encodeMultiPairSwap(TOKEN.identifier, inAtomic, [{
				pairHex: firstHex,
				tokenOut: mid,
				minOut: 1n
			}, {
				pairHex: secondHex,
				tokenOut: token.pairToken,
				minOut: minOutAtomic
			}]),
			gasLimit: CHAIN.hopSwapGasLimit
		}));
	}
	return {
		tokenId,
		direction,
		txs,
		amountIn: quote.amountIn,
		amountOut: quote.amountOut,
		minOut: quote.minOut,
		route: quote.route,
		venue: quote.venue,
		ticker: token.ticker
	};
});
//#endregion