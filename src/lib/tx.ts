import { BURNIFY, COLLECTION, FARM, VAULT } from "./config";

export type UnsignedTx = {
  sender: string;
  receiver: string;
  nonce: number;
  value: string;
  data: string;
  gasLimit: number;
  gasPrice: number;
  chainID: string;
  version: number;
  options?: number;
  guardian?: string;
};

export function toEvenHex(n: number | bigint | string): string {
  const h = BigInt(n).toString(16);
  return h.length % 2 ? `0${h}` : h;
}

export function utf8ToHex(value: string): string {
  return Array.from(new TextEncoder().encode(value))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** On-chain OOX buy calldata: buy@{auctionId}@{collection}@{nonce}@{qty} */
export function encodeBuyData(auctionId: number, quantity: number): string {
  return [
    "buy",
    toEvenHex(auctionId),
    utf8ToHex(COLLECTION.identifier),
    toEvenHex(COLLECTION.nonce),
    toEvenHex(quantity),
  ].join("@");
}

export function encodeWrapEgld(): string {
  return "wrapEgld";
}

export function encodeEsdtCall(
  token: string,
  amount: bigint | string,
  fn: string,
  args: string[] = [],
): string {
  return ["ESDTTransfer", utf8ToHex(token), toEvenHex(amount), utf8ToHex(fn), ...args].join("@");
}

/** Plain ESDT send — no smart-contract function. */
export function encodeEsdtTransfer(token: string, amount: bigint | string): string {
  return ["ESDTTransfer", utf8ToHex(token), toEvenHex(amount)].join("@");
}

/** Self-directed MetaESDT / SFT send. Receiver of the tx is the sender. */
export function encodeEsdtNftSend(
  token: string,
  nonce: number,
  amount: bigint | string,
  destHex: string,
): string {
  return ["ESDTNFTTransfer", utf8ToHex(token), toEvenHex(nonce), toEvenHex(amount), destHex].join(
    "@",
  );
}

/** Multi-token send with no SC endpoint. Receiver of the tx is the sender. */
export function encodeMultiEsdtSend(destHex: string, payments: EsdtPayment[]): string {
  const parts = ["MultiESDTNFTTransfer", destHex, toEvenHex(payments.length)];
  for (const p of payments) {
    parts.push(utf8ToHex(p.token), p.nonce === 0 ? "" : toEvenHex(p.nonce), toEvenHex(p.amount));
  }
  return parts.join("@");
}


/** xExchange AMM: ESDTTransfer@{in}@{amt}@swapTokensFixedInput@{out}@{minOut} */
export function encodeSwapFixedInput(
  tokenIn: string,
  amountIn: bigint | string,
  tokenOut: string,
  minOut: bigint | string,
): string {
  return encodeEsdtCall(tokenIn, amountIn, "swapTokensFixedInput", [
    utf8ToHex(tokenOut),
    toEvenHex(minOut),
  ]);
}

export type SwapHop = {
  pairHex: string;
  tokenOut: string;
  minOut: bigint | string;
};

/** Router multiPairSwap — each hop is pairHex, swapTokensFixedInput, tokenOut, minOut. */
export function encodeMultiPairSwap(
  tokenIn: string,
  amountIn: bigint | string,
  hops: SwapHop[],
): string {
  const args: string[] = [];
  for (const hop of hops) {
    args.push(hop.pairHex, utf8ToHex("swapTokensFixedInput"), utf8ToHex(hop.tokenOut), toEvenHex(hop.minOut));
  }
  return encodeEsdtCall(tokenIn, amountIn, "multiPairSwap", args);
}

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << to) - 1;
  const out: number[] = [];
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (pad && bits > 0) out.push((acc << (to - bits)) & maxv);
  return out;
}

/** Bech32 `erd1…` → 32-byte hex (no 0x). */
export function bech32ToHex(address: string): string {
  const sep = address.lastIndexOf("1");
  if (sep < 1) throw new Error("Invalid address");
  const data = address.slice(sep + 1);
  const values: number[] = [];
  for (const c of data) {
    const v = BECH32_CHARSET.indexOf(c);
    if (v < 0) throw new Error("Invalid address");
    values.push(v);
  }
  const bytes = convertBits(values.slice(0, -6), 5, 8, false);
  return Buffer.from(bytes).toString("hex");
}

/** JEX orderbook: ESDTTransfer@{in}@{amt}@createOrder@{out}@{amtOut}@ */
export function encodeJexCreateOrder(
  tokenIn: string,
  amountIn: bigint | string,
  tokenOut: string,
  amountOut: bigint | string,
): string {
  return encodeEsdtCall(tokenIn, amountIn, "createOrder", [
    utf8ToHex(tokenOut),
    toEvenHex(amountOut),
    "",
    "",
  ]);
}

export function encodeUnwrapEgld(amount: bigint | string): string {
  return encodeEsdtCall("WEGLD-bd4d79", amount, "unwrapEgld");
}

/** Self-directed SFT transfer into the OOX Heart of ROAR farm. */
export function encodeStakeHearts(quantity: number): string {
  return [
    "ESDTNFTTransfer",
    utf8ToHex(COLLECTION.identifier),
    toEvenHex(COLLECTION.nonce),
    toEvenHex(quantity),
    VAULT.ooxStakingHex,
    utf8ToHex("stake"),
    toEvenHex(VAULT.ooxFarmId),
  ].join("@");
}

/** Unstake SFTs from farm 0x41: unstake@{farm}@{nonce}@{qty} */
export function encodeUnstakeHearts(quantity: number): string {
  return [
    "unstake",
    toEvenHex(VAULT.ooxFarmId),
    toEvenHex(COLLECTION.nonce),
    toEvenHex(quantity),
  ].join("@");
}

/** Claim ROAR rewards from the Heart of ROAR farm. */
export function encodeClaimHearts(): string {
  return ["claim", toEvenHex(VAULT.ooxFarmId)].join("@");
}

export function encodeStakeFarm(amount: bigint | string): string {
  return encodeEsdtCall("ROAR-e5185d", amount, "stakeFarm");
}

export function encodeFarmNftCall(
  nonce: number,
  amount: bigint | string,
  fn: "claimRewards" | "compoundRewards" | "unstakeFarm" | "unbondFarm",
): string {
  return [
    "ESDTNFTTransfer",
    utf8ToHex(FARM.token),
    toEvenHex(nonce),
    toEvenHex(amount),
    FARM.stakingHex,
    utf8ToHex(fn),
  ].join("@");
}

export type EsdtPayment = {
  token: string;
  nonce: number;
  amount: bigint | string;
};

/** MultiESDTNFTTransfer — fungible nonce 0 is encoded as an empty hex field. */
export function encodeMultiEsdtNftTransfer(
  destHex: string,
  payments: EsdtPayment[],
  fn: string,
): string {
  const parts = ["MultiESDTNFTTransfer", destHex, toEvenHex(payments.length)];
  for (const p of payments) {
    parts.push(utf8ToHex(p.token), p.nonce === 0 ? "" : toEvenHex(p.nonce), toEvenHex(p.amount));
  }
  parts.push(utf8ToHex(fn));
  return parts.join("@");
}

export function encodeStakeFarmMerge(amount: bigint | string, nonce: number, staked: bigint | string): string {
  return encodeMultiEsdtNftTransfer(
    FARM.stakingHex,
    [
      { token: "ROAR-e5185d", nonce: 0, amount },
      { token: FARM.token, nonce, amount: staked },
    ],
    "stakeFarm",
  );
}

export function weiTimes(priceWei: string, qty: number): string {
  return (BigInt(priceWei || "0") * BigInt(qty)).toString();
}

export function toAtomic(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const s = abs.toFixed(decimals);
  const [i, f = ""] = s.split(".");
  const raw = BigInt(i + f.padEnd(decimals, "0").slice(0, decimals));
  return negative ? -raw : raw;
}

export function fromAtomic(raw: bigint | string, decimals: number): number {
  const value = BigInt(raw);
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  return Number(whole) + Number(frac) / Number(base);
}

export const COLLECTION_HEX = utf8ToHex(COLLECTION.identifier);

/** Claim EGLD rewards from a staking-provider delegation contract. */
export function encodeClaimDelegation(): string {
  return "claimRewards";
}

/** Compound EGLD rewards back into the same staking provider. */
export function encodeReDelegateRewards(): string {
  return "reDelegateRewards";
}

export function encodeDelegate(): string {
  return "delegate";
}

export function encodeUnDelegate(amount: bigint | string): string {
  return ["unDelegate", toEvenHex(amount)].join("@");
}

export function encodeWithdrawDelegation(): string {
  return "withdraw";
}

/** ESDTTransfer BFY @ deposit @ Option::None @ lock-period 3 (Burnify min). */
export function encodeBurnifyStakeBfy(amount: bigint | string): string {
  return encodeEsdtCall(BURNIFY.bfy, amount, "deposit", ["", "03"]);
}

export function encodeBurnifyUnstakeBfy(amount: bigint | string): string {
  return ["withdraw", toEvenHex(amount)].join("@");
}

export function encodeBurnifyClaim(): string {
  return "claimRewards";
}

export function encodeBurnifyStakeBufu(
  destHex: string,
  nfts: { collection: string; nonce: number }[],
): string {
  return encodeMultiEsdtNftTransfer(
    destHex,
    nfts.map((n) => ({ token: n.collection, nonce: n.nonce, amount: 1n })),
    "deposit",
  );
}

/** withdraw @ Option::Some(0) @ (token, nonce, 1-based index)* */
export function encodeBurnifyUnstakeBufu(
  nfts: { collection: string; nonce: number; index: number }[],
): string {
  const parts = ["withdraw", "010000000000000000"];
  for (const n of nfts) {
    parts.push(utf8ToHex(n.collection), toEvenHex(n.nonce), toEvenHex(n.index));
  }
  return parts.join("@");
}

export function encodePlaceBet(under: number): string {
  return ["placeBet", toEvenHex(under)].join("@");
}

export function encodeDiceClaim(): string {
  return "claim";
}

export function encodeResolveRound(): string {
  return "resolveRound";
}

export function encodeEsdtPlaceBet(token: string, amount: bigint | string, under: number): string {
  return encodeEsdtCall(token, amount, "placeBet", [toEvenHex(under)]);
}

export function encodeFundBankroll(): string {
  return "fundBankroll";
}

export function encodeStartRound(): string {
  return "startRound";
}

export function encodeEsdtFundBankroll(token: string, amount: bigint | string): string {
  return encodeEsdtCall(token, amount, "fundBankroll");
}

/** Upgradeable + readable + payable + payable-by-SC. */
export const DICE_CODE_METADATA = "0506";

export function encodeContractDeploy(codeHex: string, args: string[]): string {
  return [codeHex.replace(/^0x/i, ""), DICE_CODE_METADATA, ...args].join("@");
}

export function encodeDiceInit(args: {
  treasuryHex: string;
  roarToken: string;
  minEgld: bigint;
  capEgld: bigint;
  minRoar: bigint;
  capRoar: bigint;
  roundBlocks: number;
  minBankEgld: bigint;
  minBankRoar: bigint;
}): string[] {
  return [
    args.treasuryHex,
    utf8ToHex(args.roarToken),
    toEvenHex(args.minEgld),
    toEvenHex(args.capEgld),
    toEvenHex(args.minRoar),
    toEvenHex(args.capRoar),
    toEvenHex(args.roundBlocks),
    toEvenHex(args.minBankEgld),
    toEvenHex(args.minBankRoar),
  ];
}


