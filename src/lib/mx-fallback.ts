import { ADDRESSES, CHAIN, COLLECTION, PAIRS, TOKEN } from "./config";

export type MxFarmFallback = {
  roarPriceUsd: number;
  egldPriceUsd: number;
  ooxStaked: number;
  listedForSale: number;
  inWallets: number;
  walletHolderCount: number;
  poolRoar: number;
};

async function getJson(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${CHAIN.api}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Browser-side MultiversX API fallback when server snapshot fns fail or return empty.
 * Keeps Heart farm metrics from silently reading as 0.
 */
export async function fetchMxFarmFallback(): Promise<MxFarmFallback> {
  const [roar, wegld, accounts, ooxRoar, ooxNft] = await Promise.all([
    getJson(`/tokens/${TOKEN.identifier}`),
    getJson(`/mex/tokens/${PAIRS.wegld}`),
    getJson(`/nfts/${COLLECTION.sftId}/accounts?size=50`),
    getJson(`/accounts/${ADDRESSES.ooxStaking}/tokens/${TOKEN.identifier}`),
    getJson(`/accounts/${ADDRESSES.ooxStaking}/nfts/${COLLECTION.sftId}`),
  ]);

  const rows = Array.isArray(accounts) ? accounts : [];
  let ooxStaked = 0;
  let listedForSale = 0;
  let inWallets = 0;
  let walletHolderCount = 0;
  for (const row of rows) {
    const address = String(row?.address ?? "");
    const bal = Number(row?.balance ?? 0);
    if (!address || !Number.isFinite(bal)) continue;
    if (address === ADDRESSES.ooxStaking) ooxStaked = bal;
    else if (address === ADDRESSES.marketplace) listedForSale = bal;
    else {
      inWallets += bal;
      walletHolderCount += 1;
    }
  }
  if (ooxStaked <= 0) {
    const n = Number(ooxNft?.balance ?? 0);
    if (Number.isFinite(n) && n > 0) ooxStaked = n;
  }

  let poolRoar = 0;
  if (ooxRoar?.balance) {
    const dec = typeof ooxRoar.decimals === "number" ? ooxRoar.decimals : TOKEN.decimals;
    try {
      poolRoar = Number(BigInt(ooxRoar.balance)) / 10 ** dec;
    } catch {
      poolRoar = 0;
    }
  }

  return {
    roarPriceUsd: Number(roar?.price) || 0,
    egldPriceUsd: Number(wegld?.price) || 0,
    ooxStaked,
    listedForSale,
    inWallets,
    walletHolderCount,
    poolRoar: Number.isFinite(poolRoar) ? poolRoar : 0,
  };
}
