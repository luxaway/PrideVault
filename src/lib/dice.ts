import { GAMES, TOKEN } from "./config";

export type DiceToken = "EGLD" | "ROAR";

export function diceRakeBps(token: DiceToken) {
  return token === "ROAR" ? GAMES.rakeRoarBps : GAMES.rakeEgldBps;
}

export function diceRake(amount: number, token: DiceToken) {
  if (!(amount > 0)) return 0;
  return (amount * diceRakeBps(token)) / 10_000;
}

export function diceNet(amount: number, token: DiceToken) {
  return Math.max(0, amount - diceRake(amount, token));
}

/** Contract: amount * 100 / under * (10000 - 500) / 10000 */
export function dicePayout(net: number, under: number) {
  if (!(net > 0) || !(under > 0)) return 0;
  return (net * 100 * (10_000 - GAMES.houseEdgeBps)) / under / 10_000;
}

export function diceChance(under: number) {
  const u = clampUnder(under);
  return u;
}

export function diceMultiplier(under: number) {
  const u = clampUnder(under);
  return (100 / u) * ((10_000 - GAMES.houseEdgeBps) / 10_000);
}

export function clampUnder(under: number) {
  const n = Math.round(under);
  return Math.min(GAMES.maxUnder, Math.max(GAMES.minUnder, n));
}

export function diceRoll(seed: number, index: number) {
  return Number((BigInt(seed) * 1_000_003n + BigInt(index)) % 100n);
}

export function freshSeed() {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  return (BigInt(buf[0]) << 32n) + BigInt(buf[1]);
}

export function diceDecimals(token: DiceToken) {
  return token === "ROAR" ? TOKEN.decimals : 18;
}

export function diceMin(token: DiceToken) {
  return token === "ROAR" ? GAMES.minBetRoar : GAMES.minBetEgld;
}

export function diceCap(token: DiceToken) {
  return token === "ROAR" ? GAMES.capBetRoar : GAMES.capBetEgld;
}

export function loadDiceSc() {
  try {
    const sc = localStorage.getItem("pv.dice.sc") || "";
    return sc.startsWith("erd1qqqq") ? sc : "";
  } catch {
    return "";
  }
}

export function saveDiceSc(sc: string) {
  if (!sc.startsWith("erd1qqqq")) return;
  localStorage.setItem("pv.dice.sc", sc);
}
