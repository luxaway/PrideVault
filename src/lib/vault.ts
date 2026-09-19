import { COLLECTION, VAULT } from "./config";

export function occupancy(staked: number) {
  return Math.min(1, Math.max(0, staked / COLLECTION.supply));
}

export function daysLeft(now = Date.now()) {
  return Math.max(0, Math.ceil((VAULT.poolEnd - now) / 86_400_000));
}

export function weeksSincePoolStart(now = Date.now()) {
  return Math.max(0, (now - VAULT.poolStart) / (VAULT.buybackDays * 86_400_000));
}

/** Yearly EGLD that NFT stakers receive from the 1250 EGLD treasury (70% of staking APR). */
export function buybackYearlyEgld(aprPct: number) {
  const apr = Number.isFinite(aprPct) ? Math.min(20, Math.max(0, aprPct)) : 0;
  return VAULT.egldStaked * (apr / 100) * VAULT.splitVault;
}

export function buybackWeeklyEgld(aprPct: number) {
  return buybackYearlyEgld(aprPct) / (365 / VAULT.buybackDays);
}

export function buybackDailyPerHeart(aprPct: number, farmHearts: number) {
  const n = Math.max(1, farmHearts);
  return buybackYearlyEgld(aprPct) / 365 / n;
}

export function farmDurationDays() {
  return Math.max(1, (VAULT.poolEnd - VAULT.poolStart) / 86_400_000);
}

/** Weekly ROAR bought with 70% of the 1 250 EGLD staking rewards, deposited into the OOX farm. */
export function weeklyBuybackRoar(aprPct: number, egldUsd: number, roarUsd: number) {
  if (!(roarUsd > 0) || !(egldUsd > 0)) return 0;
  return (buybackWeeklyEgld(aprPct) * egldUsd) / roarUsd;
}

export type FarmSimDay = {
  day: number;
  userRoar: number;
  dailyNft: number;
  remaining: number;
};

/**
 * One farm. Weekly buyback tops up remaining → daily/NFT steps up.
 * Farm is extended: simulation does not stop at poolEnd.
 */
export function simulateFarmDays({
  days,
  remaining,
  farmHearts,
  earnHearts,
  weeklyRoar,
}: {
  days: number;
  remaining: number;
  farmHearts: number;
  earnHearts: number;
  weeklyRoar: number;
}): { days: FarmSimDay[]; totalRoar: number; startDailyNft: number; endDailyNft: number } {
  const max = COLLECTION.supply;
  const duration = farmDurationDays();
  const staked = Math.max(1, farmHearts);
  const occ = occupancy(staked);
  const earn = Math.max(0, earnHearts);
  let rem = Math.max(0, remaining);
  const rows: FarmSimDay[] = [];
  let totalRoar = 0;
  let startDailyNft = 0;
  let endDailyNft = 0;
  const drop = Math.max(0, weeklyRoar);
  for (let i = 0; i < days; i++) {
    if (i > 0 && i % VAULT.buybackDays === 0) rem += drop;
    const dailyNft = rem > 0 ? (rem / duration / max) * occ : 0;
    if (i === 0) startDailyNft = dailyNft;
    endDailyNft = dailyNft;
    const userRoar = dailyNft * earn;
    rem = Math.max(0, rem - dailyNft * staked);
    totalRoar += userRoar;
    rows.push({ day: i, userRoar, dailyNft, remaining: rem });
  }
  return { days: rows, totalRoar, startDailyNft, endDailyNft };
}

export function remainingFromDaily(dailyNft: number, farmHearts: number) {
  const occ = occupancy(farmHearts);
  if (!(dailyNft > 0) || occ <= 0) return 0;
  return dailyNft * farmDurationDays() * COLLECTION.supply / occ;
}

export function paybackDaysFromFarm({
  remainEgld,
  roarUsd,
  egldUsd,
  remaining,
  farmHearts,
  earnHearts,
  weeklyRoar,
  maxDays = 365 * 8,
}: {
  remainEgld: number;
  roarUsd: number;
  egldUsd: number;
  remaining: number;
  farmHearts: number;
  earnHearts: number;
  weeklyRoar: number;
  maxDays?: number;
}) {
  if (remainEgld <= 1e-12) return 0;
  if (!(roarUsd > 0) || !(egldUsd > 0) || earnHearts <= 0) return Number.POSITIVE_INFINITY;
  const px = roarUsd / egldUsd;
  const sim = simulateFarmDays({
    days: maxDays,
    remaining,
    farmHearts,
    earnHearts,
    weeklyRoar,
  });
  let acc = 0;
  for (let i = 0; i < sim.days.length; i++) {
    acc += sim.days[i].userRoar * px;
    if (acc >= remainEgld) return i + 1;
  }
  return Number.POSITIVE_INFINITY;
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
  if (daily <= 0) return 0;
  const roar = roarUsd > 0 ? roarUsd : 0.015;
  const egld = egldUsd > 0 ? egldUsd : 4.15;
  const yearlyUsd = daily * 365 * roar;
  const nftUsd = COLLECTION.mintPriceEgld * egld;
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
