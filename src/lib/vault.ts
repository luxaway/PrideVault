import { COLLECTION, VAULT } from "./config";

export function occupancy(staked: number) {
  return Math.min(1, Math.max(0, staked / COLLECTION.supply));
}

export function daysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((VAULT.poolEnd - now) / 86_400_000));
}

/**
 * OOX Dynamic Community farm:
 * remaining pool is emitted over the FULL farm duration against max supply,
 * then scaled by occupancy. Fuller farm → higher ROAR / Heart / day.
 * Matches OOX "Daily / NFT" (not remaining / daysLeft / staked).
 */
export function dailyFromPool(poolRoar: number, stakedHearts: number, now = Date.now()) {
  const duration = Math.max(0, (VAULT.poolEnd - VAULT.poolStart) / 86_400_000);
  const max = COLLECTION.supply;
  if (poolRoar <= 0 || duration <= 0 || max <= 0) return 0;
  const occ = occupancy(stakedHearts);
  return (poolRoar / duration / max) * occ;
}

/** What each Heart would earn if the full 1 250 supply sat on the farm. */
export function dailyIfFullyStaked(poolRoar: number, now = Date.now()) {
  return dailyFromPool(poolRoar, COLLECTION.supply, now);
}

/** APR of one Heart at the 1 EGLD mint/floor, from the live daily emission. */
export function aprPct(daily: number, roarUsd: number, egldUsd: number) {
  if (daily <= 0 || roarUsd <= 0 || egldUsd <= 0) return 0;
  const yearlyUsd = daily * 365 * roarUsd;
  const nftUsd = COLLECTION.mintPriceEgld * egldUsd;
  if (!nftUsd) return 0;
  return (yearlyUsd / nftUsd) * 100;
}

/**
 * Tick pending from `lastTick`. For live wallets lastTick is OOX getUserStake
 * lastTs and pending is the on-chain snapshot — only the elapsed slice is added
 * (matches OOX Claim). Never estimate from first-stake.
 */
export function accruePending(
  stakedHearts: number,
  vaultStaked: number,
  lastTick: number,
  pending: number,
  now = Date.now(),
  poolRoar = 0,
  liveDaily = 0,
) {
  if (stakedHearts <= 0) return { pending, lastTick: now };
  if (lastTick <= 0 || lastTick < VAULT.poolStart - 86_400_000) return { pending, lastTick: now };
  const dt = Math.max(0, (now - lastTick) / 1000);
  if (dt > 400 * 86_400) return { pending, lastTick: now };
  const daily = liveDaily > 0 ? liveDaily : dailyFromPool(poolRoar, vaultStaked, now);
  const earned = stakedHearts * daily * (dt / 86_400);
  return { pending: pending + earned, lastTick: now };
}
