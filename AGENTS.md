# PrideVault — Grok Bot

MultiversX DeFi wallet for Heart of ROAR / ROARHighSpeX.

## Product rules (do not regress)

- Do not wall the app. Viewers can browse without sign-in.
- Do not put `authMiddleware` on every chat server function. UserButton / X connect lives in the chat X panel only.
- Never generic “Sign in with Grok” to gate the vault.
- Do not fake holdings, prices, or tx results.
- Chat X cards = preview + **Open on X** only. Do not resurrect in-chat like / repost / comment.
- Do not restore a JEXchange outbound link (`app.jexchange.io`). Swaps stay in PrideVault.
- Swap: EGLD uses the xExchange ROAR/WEGLD pool for the live rate. Every other token uses the JEXchange aggregator (xoxno `xo`). Keep **0.01 EGLD** for gas (`swapEgldKeep`).
- Amount changes on the swap desk must update the receive amount instantly (pool math for EGLD, cached aggregator rate × amount for others).
- Talk FR/EN mix with the product owner. Product-facing language.

## Stack

TanStack Start, React 19, Tailwind v4, React Query, Neon/PGLite unowned public tables for chat, wallet-session tokens for xPortal.

## Key files

- `src/components/swap-desk.tsx` — swap UI
- `src/lib/mx.functions.ts` — quotes, prepare txs, on-chain reads
- `src/lib/swap-math.ts` — client AMM + aggregator rate scale
- `src/lib/wallet.ts` — xPortal WC / webview signing
- `src/components/pride-chat.tsx` — live chat + holder popup
- `src/lib/config.ts` — chain, tokens (ROAR-e5185d, HORVSN-a3fd09), gas, links

## Quality

`npm run typecheck` and `npm run build` should stay green. Don’t invent balances.
