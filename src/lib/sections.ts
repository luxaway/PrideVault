export const SECTIONS = [
  { id: "heart", hash: "heart" },
  { id: "wallet", hash: "wallet" },
  { id: "buy", hash: "buy" },
  { id: "swap", hash: "swap" },
  { id: "roar", hash: "roar" },
  { id: "games", hash: "games" },
  { id: "board", hash: "board" },
  { id: "stats", hash: "stats" },
] as const;

export type AppSection = (typeof SECTIONS)[number]["id"];

export function sectionFromHash(hash: string): AppSection {
  const h = hash.replace(/^#/, "").toLowerCase();
  if (h === "desk" || h === "vault" || h === "heart") return "heart";
  if (h === "wallet" || h === "portefeuille") return "wallet";
  if (h === "marche" || h === "buy" || h === "market") return "buy";
  if (h === "swap") return "swap";
  if (h === "roar" || h === "farm") return "roar";
  if (h === "games" || h === "game" || h === "dice" || h === "casino") return "games";
  if (h === "board" || h === "holders" || h === "classement" || h === "leaderboard" || h === "ranks")
    return "board";
  if (h === "stats" || h === "charte" || h === "chart") return "stats";
  return "heart";
}

/** Fill roarDice + treasury after the SC is live. Treasury = PrideVault ops wallet. */
export const GAMES = {
  roarDice: "",
  treasury: "",
  rakeEgldBps: 400,
  rakeRoarBps: 200,
  houseEdgeBps: 500,
} as const;
