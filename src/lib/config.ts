export const APP_NAME = "PrideVault";

/** Preview / demo wallet — not a real bech32 account. */
export const DEMO_ADDRESS = "erd1pridevault000000000000000000000000000000000000000demo";


export const COLLECTION = {
  identifier: "HORVSN-a3fd09",
  nonce: 1,
  sftId: "HORVSN-a3fd09-01",
  name: "Heart of ROAR",
  ticker: "HORVSN",
  supply: 1250,
  mintPriceEgld: 1,
  royalties: 0.05,
} as const;

export const TOKEN = {
  identifier: "ROAR-e5185d",
  ticker: "ROAR",
  name: "ROAR",
  decimals: 10,
} as const;

export const ADDRESSES = {
  /**
   * OOX Marketplace — listings sit here, `buy@auction@token@nonce@qty` is sent here.
   * Explorer name: "OOX: Marketplace".
   */
  marketplace: "erd1qqqqqqqqqqqqqpgqwp73w2a9eyzs64eltupuz3y3hv798vlv899qrjnflg",
  /** OOX NFT staking pool that currently holds the majority of Hearts. */
  ooxStaking: "erd1qqqqqqqqqqqqqpgqq33eh6y7h5x72dwskh6r5cajrp6pymnv899q20mft3",
  /** xExchange wrapping SC — wrapEgld / unwrapEgld for WEGLD. */
  wrapEgld: "erd1qqqqqqqqqqqqqpgqhe8t5jewej70zupmh44jurgn29psua5l2jps3ntjj3",
  /** JEXchange orderbook — createOrder auto-fills when it crosses the book. */
  jexOrderbook: "erd1qqqqqqqqqqqqqpgqmmxzmktd09gq0hldtczerlv444ykt3pz6avsnys6m9",
  /** xExchange ROAR/WEGLD pair — JEX aggregator routes here; deepest ROAR/EGLD book. */
  roarWegldPair: "erd1qqqqqqqqqqqqqpgq2m0c6yzgwmhy69jjk635k4j7f0wlk9dl2jps5a9w38",
  /** xExchange ROAR/USDC pair. */
  roarUsdcPair: "erd1qqqqqqqqqqqqqpgqfrumuq6dq9qvmnmtjd7gd8u54p7mjtyj2jpszwk2vz",
  /** xExchange ROAR/MEX pair. */
  roarMexPair: "erd1qqqqqqqqqqqqqpgq076ssmzrs3jefwcjzytvuv38lzqv67mk2jpsehrt38",
  /** xExchange single-token ROAR staking farm (SROAR). */
  roarFarm: "erd1qqqqqqqqqqqqqpgqfnrln7ygyxdj96749e586lqwl8wr2fxskp2skn495u",
  /** xExchange router — multiPairSwap for 2-hop routes into ROAR. */
  xexRouter: "erd1qqqqqqqqqqqqqpgqq66xk9gfr4esuhem3jru86wg5hvp33a62jps2fy57p",
  /** XOXNO/JEX aggregator SC — `xo` routes across JEX, xExchange, OneDex, AshSwap. */
  jexAggregator: "erd1qqqqqqqqqqqqqpgq5rf2sppxk2xu4m0pkmugw2es4gak3rgjah0sxvajva",
} as const;

/** ESDT burn sink — ROAR sent here is considered burned. */
export const BURN_ADDRESS = "erd1deaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaddeaqtv0gag";

export const CHAIN = {
  id: "1",
  api: "https://api.multiversx.com",
  gasPrice: 1_000_000_000,
  buyGasLimit: 16_000_000,
  wrapGasLimit: 10_000_000,
  unwrapGasLimit: 10_000_000,
  swapGasLimit: 35_000_000,
  hopSwapGasLimit: 80_000_000,
  jexOrderGasLimit: 75_000_000,
  jexAggGasLimit: 120_000_000,
  stakeGasLimit: 38_000_000,
  unstakeGasLimit: 30_000_000,
  claimGasLimit: 15_000_000,
  farmStakeGasLimit: 25_000_000,
  farmClaimGasLimit: 25_000_000,
  farmUnstakeGasLimit: 25_000_000,
  farmUnbondGasLimit: 10_000_000,
  delegationClaimGasLimit: 6_000_000,
  delegationRestakeGasLimit: 12_000_000,
  delegationStakeGasLimit: 12_000_000,
  delegationUnstakeGasLimit: 12_000_000,
  delegationWithdrawGasLimit: 12_000_000,
  transferEgldGasLimit: 50_000,
  transferEsdtGasLimit: 1_200_000,
  transferNftGasLimit: 1_500_000,
  burnifyStakeGasLimit: 25_000_000,
  burnifyUnstakeGasLimit: 50_000_000,
  burnifyClaimGasLimit: 50_000_000,
  burnifyNftBaseGasLimit: 20_000_000,
  burnifyNftExtraGasLimit: 10_000_000,
  diceBetGasLimit: 8_000_000,
  diceClaimGasLimit: 8_000_000,
  diceResolveGasLimit: 16_000_000,
  diceDeployGasLimit: 40_000_000,
  diceFundGasLimit: 8_000_000,
  diceStartGasLimit: 8_000_000,
  buyStakeKeepEgld: 0.055,
  guardedExtraGas: 50_000,
  txVersion: 2,
  guardedOptions: 2,
} as const;

/** EGLD left in the wallet for the swap's own gas. Unused gas is refunded. */
export const SWAP_EGLD_KEEP = 0.01;

export function swapEgldKeep() {
  return SWAP_EGLD_KEEP;
}

export function swapEgldKeepGas() {
  return Math.round((SWAP_EGLD_KEEP * 1e18) / CHAIN.gasPrice);
}

const XPORTAL_DYNAMIC =
  "https://maiar.page.link/?apn=com.elrond.maiar.wallet&isi=1519405832&ibi=com.elrond.maiar.wallet&link=";

export const WALLETCONNECT = {
  projectId: "9b1a9564f91cb659ffe21b73d5c4e2d8",
  relay: "wss://relay.walletconnect.com",
  namespace: "mvx",
} as const;

export const PAIRS = {
  wegld: "WEGLD-bd4d79",
  usdc: "USDC-c76f1f",
  mex: "MEX-455c57",
} as const;

/** Locked / energy MEX on xExchange (MetaESDT). */
export const XMEX = {
  collection: "XMEX-fda355",
  ticker: "XMEX",
  name: "xMEX",
} as const;

/** Liquid-staked EGLD shown with an equivalent-EGLD peek in the wallet. */
export const LST = {
  xegld: "XEGLD-e413ed",
  segld: "SEGLD-3ad2d0",
  voxegld: "VOXEGLD-5872e5",
} as const;

export const SWAP = {
  slippageBps: 100,
  hopSlippageBps: 150,
  ammFeeBps: 30,
  jexApi: "https://api.jexchange.io",
  xoxnoApi: "https://swap.xoxno.com",
} as const;

export const SLIPPAGE_PCTS = [0.5, 1, 2.5] as const;
export type SlippagePct = (typeof SLIPPAGE_PCTS)[number];

export function asSlippagePct(raw: unknown): SlippagePct {
  const n = Number(raw);
  if (n === 0.5 || n === 2.5) return n;
  return 1;
}

export function slippageBpsOf(pct: SlippagePct, _hops = false) {
  return Math.round(pct * 100);
}

export function slippageAggOf(pct: SlippagePct) {
  if (pct === 0.5) return "0.005";
  if (pct === 2.5) return "0.025";
  return "0.01";
}

export const FARM = {
  token: "SROAR-b33f8a",
  ticker: "SROAR",
  name: "StakedRoAR",
  /** Farm token amounts share ROAR's 10 decimals (API lists 18). */
  decimals: 10,
  stakingHex: "000000000000000005004cc7f9f888219b22ebd52e687d7c0ef9dc3524d0b055",
  divisionSafety: 1_000_000_000_000n,
} as const;

/** Convert leftover tokens into ROAR only. ROAR itself is never included. */
export const DUST = {
  minUsd: 0,
  maxUsd: 2.5,
  maxTokens: 40,
  egldGasKeep: 0.01,
} as const;

export function isDustConvertible(
  id: string,
  ticker: string,
  valueUsd: number,
  meta?: { type?: string; tags?: string[] },
) {
  if (!id) return false;
  const tick = (ticker || "").toUpperCase();
  if (id === TOKEN.identifier || tick === "ROAR" || id === FARM.token || tick === "SROAR")
    return false;
  if (id === XMEX.collection || tick === "XMEX") return false;
  if (tick.includes("LP") || tick.endsWith("-LP")) return false;
  const type = (meta?.type || "").toLowerCase();
  if (type === "metaesdt" || type === "semifungibleesdt" || type === "nonfungibleesdt") return false;
  const tags = (meta?.tags || []).map((row) => String(row).toLowerCase());
  if (
    tags.includes("liquiditypool") ||
    tags.includes("liquidity") ||
    tags.includes("farm") ||
    tags.includes("farms") ||
    tags.includes("staking")
  )
    return false;
  const usd = Number.isFinite(valueUsd) ? valueUsd : 0;
  return usd > 0 && usd < DUST.maxUsd;
}

export const SWAP_TOKENS = [
  {
    id: "EGLD",
    ticker: "EGLD",
    decimals: 18,
    pair: ADDRESSES.roarWegldPair,
    pairToken: PAIRS.wegld,
    wrap: true,
  },
  {
    id: "USDC-c76f1f",
    ticker: "USDC",
    decimals: 6,
    pair: ADDRESSES.roarUsdcPair,
    pairToken: PAIRS.usdc,
    wrap: false,
  },
  {
    id: "MEX-455c57",
    ticker: "MEX",
    decimals: 18,
    pair: ADDRESSES.roarMexPair,
    pairToken: PAIRS.mex,
    wrap: false,
  },
  {
    id: PAIRS.wegld,
    ticker: "WEGLD",
    decimals: 18,
    pair: ADDRESSES.roarWegldPair,
    pairToken: PAIRS.wegld,
    wrap: false,
  },
] as const;

export const TIMEFRAMES = [
  { id: "5m", resolution: "5", label: "5m", seconds: 300, countback: 168 },
  { id: "15m", resolution: "15", label: "15m", seconds: 900, countback: 168 },
  { id: "1h", resolution: "60", label: "1H", seconds: 3600, countback: 168 },
  { id: "4h", resolution: "240", label: "4H", seconds: 14400, countback: 168 },
  { id: "1d", resolution: "D", label: "1D", seconds: 86400, countback: 180 },
  { id: "1w", resolution: "W", label: "1W", seconds: 604800, countback: 104 },
] as const;

export const GAMES = {
  /** PrideVault casino SC — set after mainnet deploy. Empty = demo table. */
  roarDice: "",
  rakeEgldBps: 400,
  rakeRoarBps: 200,
  houseEdgeBps: 500,
  minUnder: 2,
  maxUnder: 96,
  minBetEgld: 0.05,
  capBetEgld: 0.2,
  minBetRoar: 10,
  capBetRoar: 500,
  seedEgld: 10,
  seedRoar: 5_000,
} as const;

export const SECTIONS = [
  { id: "heart", hash: "heart" },
  { id: "wallet", hash: "wallet" },
  { id: "buy", hash: "buy" },
  { id: "swap", hash: "swap" },
  { id: "play", hash: "play" },
  { id: "roar", hash: "roar" },
  { id: "board", hash: "board" },
  { id: "stats", hash: "stats" },
] as const;

export type ChartPair = "egld" | "usdc";
export type ChartTimeframe = (typeof TIMEFRAMES)[number]["id"];
export type AppSection = (typeof SECTIONS)[number]["id"];
export type SwapDirection = "to-roar" | "from-roar";
/** @deprecated use SwapDirection */
export type SwapTokenId = (typeof SWAP_TOKENS)[number]["id"] | string;

export function sectionFromHash(hash: string): AppSection {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "desk" || h === "vault" || h === "heart") return "heart";
  if (h === "wallet" || h === "portefeuille") return "wallet";
  if (h === "marche" || h === "buy" || h === "market") return "buy";
  if (h === "swap") return "swap";
  if (h === "play" || h === "dice" || h === "jeu" || h === "des" || h === "casino") return "play";
  if (h === "roar" || h === "farm") return "roar";
  if (h === "board" || h === "holders" || h === "classement" || h === "leaderboard" || h === "ranks")
    return "board";
  if (h === "stats" || h === "charte" || h === "chart") return "stats";
  return "heart";
}

export const LINKS = {
  ooxCollection: "https://oox.art/marketplace/collections/HORVSN-a3fd09",
  oox: "https://oox.art",
  xRoar: "https://x.com/ROARHighSpeX",
  xLux: "https://x.com/X_WayDYOR",
  xExchange: "https://xexchange.com/swap?firstToken=EGLD&secondToken=ROAR-e5185d",
  xFarm: "https://xexchange.com/staking",
  xFarms: "https://xexchange.com/farms",
  xPools: "https://xexchange.com/pools",
  xUnlock: "https://xexchange.com/unlock",
  jex: "https://jexchange.io",
  jexSwap: "https://app.jexchange.io/swap",
  jexApp: "https://app.jexchange.io",
  onedex: "https://onedex.app",
  explorerCollection: "https://explorer.multiversx.com/collections/HORVSN-a3fd09",
  explorerToken: "https://explorer.multiversx.com/tokens/ROAR-e5185d",
  explorerStaking:
    "https://explorer.multiversx.com/accounts/erd1qqqqqqqqqqqqqpgqq33eh6y7h5x72dwskh6r5cajrp6pymnv899q20mft3",
  explorerFarm:
    "https://explorer.multiversx.com/accounts/erd1qqqqqqqqqqqqqpgqfnrln7ygyxdj96749e586lqwl8wr2fxskp2skn495u",
  ecompass: `https://e-compass.io/token/${TOKEN.identifier}`,
  ecompassEgld: `https://e-compass.io/charts/${TOKEN.identifier}/${PAIRS.wegld}`,
  ecompassUsdc: `https://e-compass.io/charts/${TOKEN.identifier}/${PAIRS.usdc}`,
  xportal: "https://xportal.com",
  linktree: "https://linktr.ee/ROARHighSpeX",
  hatom: "https://app.hatom.com",
  hatomLending: "https://app.hatom.com/lending",
  hatomBooster: "https://app.hatom.com/booster",
  hatomLst: "https://app.hatom.com/liquid-staking",
  hatomUsh: "https://app.hatom.com/ush",
  hatomIsolated: "https://app.hatom.com/isolated",
  burnify: "https://burnify.app",
} as const;

export function ooxBuyUrl(auctionId: number) {
  return `https://oox.art/marketplace/nfts/${COLLECTION.sftId}?auctionId=${auctionId}&marketplace=oox`;
}

export function explorerTxUrl(hash: string) {
  return `https://explorer.multiversx.com/transactions/${hash}`;
}

export function explorerAddrUrl(address: string) {
  return `https://explorer.multiversx.com/accounts/${address}`;
}

export function swapUrl(first: string, second: string) {
  return `https://xexchange.com/swap?firstToken=${first}&secondToken=${second}`;
}

function dynamicTo(path: string) {
  return `${XPORTAL_DYNAMIC}${encodeURIComponent(path)}`;
}

/** Pairing only — never reuse this URI when asking for a signature. */
export function xportalWcLink(uri: string) {
  return dynamicTo(`https://xportal.com/?wallet-connect=${encodeURIComponent(uri)}`);
}

/**
 * Wake xPortal so it can process a pending WalletConnect request.
 * Must NOT include a pairing URI or xPortal kills the existing session.
 */
export function xportalOpenLink() {
  return dynamicTo("https://xportal.com/");
}

/**
 * Incomplete WalletConnect URI — wakes xPortal for an *existing* session.
 * `wc:<sessionTopic>@2` is not a pairing URI (no symKey). Per WC mobile-linking
 * spec this is the only safe redirect while a signature is pending.
 */
export function xportalSignLink(topic: string) {
  return xportalWcLink(`wc:${topic}@2`);
}

export const VAULT = {
  /**
   * PrideVault is the Heart of ROAR farm on the OOX NFT staking SC.
   * Occupancy = Hearts sitting on `ADDRESSES.ooxStaking`.
   * Pool = ROAR balance of that same SC (live).
   * Farm id 0x41 — ESDTNFTTransfer … @stake@41 / unstake@41@01@{qty} / claim@41.
   */
  ooxFarmId: 65,
  ooxStakingHex: "0000000000000000050004639be89ebd0de535d0b5f43a63b21874126e6c394a",
  poolRoar: 10_000,
  poolStart: 1_788_533_192_000,
  poolEnd: 1_820_673_900_000,
  /** Mint treasury staked on-chain. 70% of staking rewards → weekly ROAR buyback into the farm. */
  egldStaked: 1_250,
  buybackDays: 7,
  splitVault: 0.7,
  splitBurn: 0.1,
  splitLiquidity: 0.2,
  dailyMin: 0.2,
  dailyMax: 1,
} as const;

/** 32-byte hex of ADDRESSES.xexRouter (multiPairSwap). */
export const XEX_ROUTER_HEX = "0000000000000000050006b46b15091d730e5f3b8c87c3e9c8a5d818c7ba5483";

/** Hatom Protocol — lending, LST, USH, booster. Receipt HTokens live in the wallet. */
export const HATOM = {
  htm: "HTM-f51d55",
  ush: "USH-111e09",
  segld: "SEGLD-3ad2d0",
  wtao: "WTAO-4f5363",
  swtao: "SWTAO-356a25",
  hush: "HUSH-d2996f",
  lkhtm: ["LKHTM-cbb969", "LKHTM-cd8d6c"] as const,
  controller: "erd1qqqqqqqqqqqqqpgqxp28qpnv7rfcmk6qrgxgw5uf2fnp84ar78ssqdk6hr",
  booster: "erd1qqqqqqqqqqqqqpgqw4dsh8j9xafw45uwr2f6a48ajvcqey8s78sstvn7xd",
  boosterV2: "erd1qqqqqqqqqqqqqpgqfalcv4c705d457x23hz5d3y5qa2f0p5u78sspe9rh6",
  liquidStaking: "erd1qqqqqqqqqqqqqpgq4gzfcw7kmkjy8zsf04ce6dl0auhtzjx078sslvrf4e",
  taoLst: "erd1qqqqqqqqqqqqqpgqhykmg59ny8tem37m0gng3ygwtphmefyz78ssfecn6q",
  ushStaking: "erd1qqqqqqqqqqqqqpgqjcmh08y6ejad07qr2dn8mju9x2fea85578sscjkrvy",
  ushMinter: "erd1qqqqqqqqqqqqqpgq2y55sf0tqsdncxcrpe67tce4hc0qagv478ssaw9vkl",
  isolatedEgld: "erd1qqqqqqqqqqqqqpgqzwv6tfg63m8nrxlw2lpl4y8nve3lmrqv78ssqtghs5",
  isolatedWtao: "erd1qqqqqqqqqqqqqpgq2202fyeklanhzmeewzlnz65ahvm5aynf78sssulpam",
  markets: [
    { id: "HEGLD-d61095", ticker: "HEGLD", underlying: "EGLD", cf: 0.75, market: "erd1qqqqqqqqqqqqqpgq35qkf34a8svu4r2zmfzuztmeltqclapv78ss5jleq3" },
    { id: "HSEGLD-c13a4e", ticker: "HSEGLD", underlying: "sEGLD", cf: 0.75, market: "erd1qqqqqqqqqqqqqpgqxmn4jlazsjp6gnec95423egatwcdfcjm78ss5q550k" },
    { id: "HUSDC-d80042", ticker: "HUSDC", underlying: "USDC", cf: 0.8, market: "erd1qqqqqqqqqqqqqpgqkrgsvct7hfx7ru30mfzk3uy6pxzxn6jj78ss84aldu" },
    { id: "HUSDT-6f0914", ticker: "HUSDT", underlying: "USDT", cf: 0.8, market: "erd1qqqqqqqqqqqqqpgqvxn0cl35r74tlw2a8d794v795jrzfxyf78sstg8pjr" },
    { id: "HUTK-4fa4b2", ticker: "HUTK", underlying: "UTK", cf: 0.55, market: "erd1qqqqqqqqqqqqqpgqta0tv8d5pjzmwzshrtw62n4nww9kxtl278ssspxpxu" },
    { id: "HHTM-e03ba5", ticker: "HHTM", underlying: "HTM", cf: 0.5, market: "erd1qqqqqqqqqqqqqpgqxerzmkr80xc0qwa8vvm5ug9h8e2y7jgsqk2svevje0" },
    { id: "HWTAO-2e9136", ticker: "HWTAO", underlying: "wTAO", cf: 0.65, market: "erd1qqqqqqqqqqqqqpgqz9pvuz22qvqxfqpk6r3rluj0u2can55c78ssgcqs00" },
    { id: "HSWTAO-6df80c", ticker: "HSWTAO", underlying: "swTAO", cf: 0.65, market: "erd1qqqqqqqqqqqqqpgq7sspywe6e2ehy7dn5dz00ved3aa450mv78ssllmln6" },
    { id: "HMEX-df6df7", ticker: "HMEX", underlying: "MEX", cf: 0.4, market: "erd1qqqqqqqqqqqqqpgq2rnjnp543m5d8fac8v2ltkr5w2quh0v978ssswj939" },
    { id: "HWETH-b3d17e", ticker: "HWETH", underlying: "WETH", cf: 0.7, market: "" },
    { id: "HWBTC-49ca31", ticker: "HWBTC", underlying: "WBTC", cf: 0.7, market: "" },
    { id: "HUSH-d2996f", ticker: "HUSH", underlying: "USH", cf: 0, market: "" },
  ],
} as const;

/** BurnifyApp — proof-of-burn, staking, BUFU NFTs. */
export const BURNIFY = {
  bfy: "BFY-8344ff",
  bfuel: "BFUEL-361c73",
  bufu: "BUFU-4890a9",
  bufuOh: "BUFUOH-5db3b1",
  staking: "erd1qqqqqqqqqqqqqpgqm2mkm02pam4tvtykfs7e8w508vzfvjqrp4ssfrts0f",
  minter: "erd1qqqqqqqqqqqqqpgqxetccmv9rjefu2fwtw7a6kkx0tsqtqxpp4ssj8shz4",
  nftStaking: "erd1qqqqqqqqqqqqqpgqssc5tls4r9mzcl30n7wpng8jupjrdmnlp4ssqwpwc7",
  boosted: "erd1qqqqqqqqqqqqqpgqugzjkahchuscf85wyhjynqt3uaxvuduq4wuqde8806",
  nftBurn: "erd1qqqqqqqqqqqqqpgqq7t0k5zh7qwht2xk3rc5s9zdf7td9an5u7zs56vyvy",
  guilds: "erd1qqqqqqqqqqqqqpgqeyhl43er94kp2yj9lfljhz7sgj683pwqp4ssza4c7j",
  predictions: "erd1qqqqqqqqqqqqqpgq76e8d42rwqr3n9988p78cstya2vld5dnp4ssqypmx8",
} as const;

const HATOM_MARKET_IDS = new Set<string>(HATOM.markets.map((m) => m.id));
const HATOM_LKHTM = new Set<string>(HATOM.lkhtm);
const HATOM_LIQUID = new Set<string>([HATOM.htm, HATOM.ush, HATOM.segld, HATOM.wtao, HATOM.swtao, HATOM.hush]);

export type HatomRole = "supply" | "liquid" | "booster" | "lst" | "lp";

export function hatomRoleOf(id: string): HatomRole | null {
  if (!id) return null;
  if (HATOM_MARKET_IDS.has(id)) return "supply";
  if (HATOM_LKHTM.has(id)) return "booster";
  if (id === HATOM.segld || id === HATOM.swtao) return "lst";
  if (HATOM_LIQUID.has(id)) return "liquid";
  const tick = id.split("-")[0]?.toUpperCase() ?? "";
  if (/^H(EGLD|SEGLD|USDC|USDT|UTK|HTM|WTAO|SWTAO|MEX|WETH|WBTC|USH)/.test(tick)) return "supply";
  if (tick === "SEGLD" || tick === "SWTAO") return "lst";
  if (tick === "LKHTM") return "booster";
  if (tick === "HTM" || tick === "USH" || tick === "WTAO" || tick === "HUSH") return "liquid";
  if (/(HTM|USH|SEGLD|WTAO)/.test(tick) && /(LP|FARM|ALP)/i.test(`${id}${tick}`)) return "lp";
  return null;
}

export function isHatomAsset(id: string, ticker?: string, name?: string) {
  if (hatomRoleOf(id)) return true;
  const blob = `${id} ${ticker ?? ""} ${name ?? ""}`.toUpperCase();
  return /\b(HTM|USH|SEGLD|HSEGLD|HEGLD|HUSDC|HUSDT|HHTM|HWTAO|HSWTAO|HMEX|HWETH|HWBTC|HUSH|LKHTM|WTAO|SWTAO)\b/.test(
    blob,
  );
}

export function isBurnifyAsset(id: string, ticker?: string, name?: string, collection?: string) {
  const key = collection || id;
  if (!key) return false;
  if (key === BURNIFY.bfy || key === BURNIFY.bfuel || key === BURNIFY.bufu || key === BURNIFY.bufuOh) return true;
  const tick = (ticker || key.split("-")[0] || "").toUpperCase();
  if (tick === "BFY" || tick === "BFUEL" || tick === "BUFU" || tick === "BUFUOH") return true;
  const blob = `${key} ${ticker ?? ""} ${name ?? ""}`.toUpperCase();
  return blob.includes("BURNIFY") || blob.includes("BUFU") || /\bBFY/.test(blob);
}

export function hatomMarketOf(id: string) {
  return HATOM.markets.find((m) => m.id === id);
}
