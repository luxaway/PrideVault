import { SWAP, TOKEN, slippageBpsOf, type SlippagePct, type SwapDirection } from "./config";
import { fromAtomic, toAtomic } from "./tx";

export type SwapPool = {
  tokenId: string;
  ticker: string;
  decimals: number;
  hops: number;
  roar: string;
  other: string;
  via?: string;
  legIn?: string;
  legMid?: string;
  roarMid?: string;
  roarOut?: string;
};

export type PoolQuote = {
  tokenId: string;
  ticker: string;
  direction: SwapDirection;
  amountIn: number;
  amountOut: number;
  minOut: number;
  priceImpact: number;
  roarReserve: number;
  otherReserve: number;
  route: "amm" | "amm-hop" | "jex-agg";
  venue: string;
  hops: number;
};

export type AggRate = {
  tokenId: string;
  ticker: string;
  decimals: number;
  amountIn: number;
  amountOut: number;
  priceImpact?: number;
};

export function ammOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeBps: number): bigint {
  if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) return 0n;
  const inWithFee = amountIn * (10000n - BigInt(feeBps));
  return (inWithFee * reserveOut) / (reserveIn * 10000n + inWithFee);
}

function asBig(raw: string | undefined): bigint {
  try {
    return BigInt(raw || "0");
  } catch {
    return 0n;
  }
}

export function quoteFromAggRate(
  rate: AggRate,
  direction: SwapDirection,
  spend: number,
  slippage: SlippagePct,
): PoolQuote | null {
  if (!Number.isFinite(spend) || spend <= 0) return null;
  if (!rate || rate.tokenId == null || !(rate.amountIn > 0) || !(rate.amountOut > 0)) return null;
  const amountOut = spend * (rate.amountOut / rate.amountIn);
  if (!(amountOut > 0)) return null;
  const minOut = (amountOut * (10_000 - slippageBpsOf(slippage, false))) / 10_000;
  return {
    tokenId: rate.tokenId,
    ticker: rate.ticker,
    direction,
    amountIn: spend,
    amountOut,
    minOut,
    priceImpact: rate.priceImpact ?? 0,
    roarReserve: 0,
    otherReserve: 0,
    route: "jex-agg",
    venue: "JEXchange aggregator",
    hops: 0,
  };
}

export function quoteFromPool(
  pool: SwapPool,
  direction: SwapDirection,
  amountIn: number,
  slippage: SlippagePct,
): PoolQuote | null {
  if (!Number.isFinite(amountIn) || amountIn <= 0) return null;
  if (pool.hops === 2) return quoteHopFromPool(pool, direction, amountIn, slippage);

  const roar = asBig(pool.roar);
  const other = asBig(pool.other);
  if (roar <= 0n || other <= 0n) return null;

  const inDec = direction === "to-roar" ? pool.decimals : TOKEN.decimals;
  const outDec = direction === "to-roar" ? TOKEN.decimals : pool.decimals;
  const inAtomic = toAtomic(amountIn, inDec);
  if (inAtomic <= 0n) return null;

  const outAtomic =
    direction === "to-roar"
      ? ammOut(inAtomic, other, roar, SWAP.ammFeeBps)
      : ammOut(inAtomic, roar, other, SWAP.ammFeeBps);
  if (outAtomic <= 0n) return null;

  const minOut = (outAtomic * BigInt(10_000 - slippageBpsOf(slippage, false))) / 10000n;
  const amountOut = fromAtomic(outAtomic, outDec);
  const roarR = fromAtomic(roar, TOKEN.decimals);
  const otherR = fromAtomic(other, pool.decimals);
  const spot = roarR > 0 ? otherR / roarR : 0;
  const execRate = amountOut > 0 ? (direction === "to-roar" ? amountIn / amountOut : amountOut / amountIn) : 0;
  const priceImpact = spot > 0 && execRate > 0 ? ((execRate - spot) / spot) * 100 : 0;

  return {
    tokenId: pool.tokenId,
    ticker: pool.ticker,
    direction,
    amountIn,
    amountOut,
    minOut: fromAtomic(minOut, outDec),
    priceImpact,
    roarReserve: roarR,
    otherReserve: otherR,
    route: "amm",
    venue: `xExchange · ROAR/${pool.ticker}`,
    hops: 1,
  };
}

function quoteHopFromPool(
  pool: SwapPool,
  direction: SwapDirection,
  amountIn: number,
  slippage: SlippagePct,
): PoolQuote | null {
  const tokenResA = asBig(pool.legIn);
  const tokenResB = asBig(pool.legMid);
  const roarResA = asBig(pool.roarOut ?? pool.roar);
  const roarResB = asBig(pool.roarMid);
  if (tokenResA <= 0n || tokenResB <= 0n || roarResA <= 0n || roarResB <= 0n) return null;

  const inDec = direction === "to-roar" ? pool.decimals : TOKEN.decimals;
  const outDec = direction === "to-roar" ? TOKEN.decimals : pool.decimals;
  const inAtomic = toAtomic(amountIn, inDec);
  if (inAtomic <= 0n) return null;

  const outAtomic =
    direction === "to-roar"
      ? ammOut(ammOut(inAtomic, tokenResA, tokenResB, SWAP.ammFeeBps), roarResB, roarResA, SWAP.ammFeeBps)
      : ammOut(ammOut(inAtomic, roarResA, roarResB, SWAP.ammFeeBps), tokenResB, tokenResA, SWAP.ammFeeBps);
  if (outAtomic <= 0n) return null;

  const minOut = (outAtomic * BigInt(10_000 - slippageBpsOf(slippage, true))) / 10000n;
  const via = pool.via === "usdc" ? "USDC" : "WEGLD";

  return {
    tokenId: pool.tokenId,
    ticker: pool.ticker,
    direction,
    amountIn,
    amountOut: fromAtomic(outAtomic, outDec),
    minOut: fromAtomic(minOut, outDec),
    priceImpact: 0,
    roarReserve: fromAtomic(roarResA, TOKEN.decimals),
    otherReserve: fromAtomic(tokenResA, pool.decimals),
    route: "amm-hop",
    venue: `xExchange · ${pool.ticker} → ${via} → ROAR`,
    hops: 2,
  };
}
