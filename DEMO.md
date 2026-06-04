# Mandate live demo runbook

Wallet-first, policy-controlled smart-account demo on **Robinhood Chain testnet (chainId 46630)**.

A user wallet funds a `MandateAccount`. A **server-side** demo agent (holding the
session key) then submits two fixed actions:

- a **safe** action (small TSLA buy) → preview `OK` → submitted → **EXECUTED**
- a **dangerous** action (oversized TSLA buy) → preview `SINGLE_ASSET_EXPOSURE_EXCEEDED`
  → submitted and recorded **BLOCKED** → the relayer never calls `executeAction`, so
  there is no execute CTA.

The session key private key never reaches the browser. The relayer accepts only the
two fixed action kinds (`safe` / `dangerous`) — nothing else.

---

## 1. Prerequisites

- Node.js 24+ (the verify script uses native TypeScript execution) and npm.
- A browser wallet (e.g. MetaMask) with the demo wallet imported.
- The committed deployment descriptor `deployments/46630.json` (source of truth for
  all contract addresses, the price signer, and the session key).
- Dependencies installed:
  ```bash
  npm --prefix signer install
  npm --prefix web install
  ```

---

## 2. Services to run

On Vercel, the demo runs as a single Next.js app. The in-app Node.js route
`GET /api/demo-price` signs demo prices with server-only `PRICE_SIGNER_KEY`, so
Vercel does **not** need a separate `npm --prefix signer start` process.

### Web app (Next.js)

```bash
npm --prefix web run dev
```

It serves `http://localhost:3002`. The console lives at `/live`; `/app` redirects to
`/live`.

### Optional local-only price signer

The standalone signer remains useful for local signer development. It reads
configuration from `process.env` only (it does **not** auto-load a `.env` file):

```bash
cd signer
PRICE_SIGNER_KEY=0x<price-signer-private-key> \
MANDATE_DEPLOYMENT_PATH=../deployments/46630.json \
npm start
```

It listens on `http://127.0.0.1:8787` and serves `GET /price?assets=0x...,0x...`.
Point `NEXT_PUBLIC_MANDATE_PRICE_URL` at `http://127.0.0.1:8787/price` only when
using this optional local signer.

---

## 3. Required environment variables

> Copy the `*.env.example` files to the real `.env.local` paths and fill in values.
> Public contract values come from `deployments/46630.json`. **Never** copy private
> keys into any `NEXT_PUBLIC_*` variable.

### Web — `web/.env.local`

Public (safe to expose in the browser bundle):

- `NEXT_PUBLIC_CHAIN_ID` = `46630`
- `NEXT_PUBLIC_DEPLOYER`, `NEXT_PUBLIC_OWNER`, `NEXT_PUBLIC_PRICE_SIGNER`
- `NEXT_PUBLIC_USDG_ADDRESS`, `NEXT_PUBLIC_TSLA_ADDRESS`, `NEXT_PUBLIC_AMD_ADDRESS`
- `NEXT_PUBLIC_AMM_ADDRESS`, `NEXT_PUBLIC_ADAPTER_ADDRESS`, `NEXT_PUBLIC_PRICE_FEED_ADDRESS`
- `NEXT_PUBLIC_MANDATE_ACCOUNT_ADDRESS`
- `NEXT_PUBLIC_ROBINHOOD_RPC_URL` — public RPC for chain 46630
- `NEXT_PUBLIC_MANDATE_PRICE_URL` = `/api/demo-price` on Vercel. For optional local
  signer development, use `http://127.0.0.1:8787/price`.

Server-only (must **never** be prefixed `NEXT_PUBLIC_`, never committed):

- `PRICE_SIGNER_KEY` — used by `GET /api/demo-price`. Must derive to
  `deployment.priceSigner` in `deployments/46630.json`.
- `MANDATE_SESSION_KEY_PRIVATE_KEY` — the session key used by the relayer route. Must
  correspond to `deployment.sessionKey`.

### Vercel environment variables

Set these four values in the Vercel project:

- `NEXT_PUBLIC_ROBINHOOD_RPC_URL`
- `NEXT_PUBLIC_MANDATE_PRICE_URL=/api/demo-price`
- `PRICE_SIGNER_KEY`
- `MANDATE_SESSION_KEY_PRIVATE_KEY`

Vercel does not need a separate price server. The Next.js route reads
`deployments/46630.json`, verifies `PRICE_SIGNER_KEY` against `deployment.priceSigner`,
and returns the same `{ domain, rows }` response shape as the standalone signer.

### Optional standalone signer environment

Only needed when running `npm --prefix signer start` locally:

- `PRICE_SIGNER_KEY` (required) — must equal `deployment.priceSigner`'s key.
- `MANDATE_DEPLOYMENT_PATH` = `../deployments/46630.json` (recommended).
- Optional overrides: `PORT` (default `8787`), `SIGNER_HOST` (default `127.0.0.1`),
  `PRICE_TTL_SECONDS` (default `3600`), `ORACLE_ADDRESS`, `USDG_ADDRESS`, `CHAIN_ID`,
  `PRICE_MAP_JSON`, `DEFAULT_PRICE_USDG_1E18`.

### Repo root — `.env.local` (Foundry / contract scripts only; not needed to run the demo)

`RPC_URL`, `CHAIN_ID`, `EXPLORER_URL`, `PRIVATE_KEY`, `OWNER`, `PRICE_SIGNER_PK`,
`SESSION_KEY`, `SESSION_KEY_PRIVATE_KEY`, `PRICE_MAX_STALENESS`.

---

## 4. Pre-flight read-only verification

Before demoing, confirm the chain state is sane (no transactions, no private keys):

```bash
npm --prefix web run verify:live-demo
```

It reads `deployments/46630.json` and a public RPC and checks: chainId 46630, bytecode
at all seven contract addresses, allowed assets (USDG/TSLA/AMD), approved adapter,
registered price oracle, the mandate policy parameters, the session key is enabled and
unexpired, and the `MandateAccount` balances. It exits non-zero on any serious
misconfiguration. To decode specific demo transactions, re-run with
`DEMO_SAFE_TX=0x... DEMO_BLOCKED_TX=0x... npm --prefix web run verify:live-demo`.

---

## 5. Final user demo flow

1. Open `http://localhost:3002/live` (or `/app`, which redirects).
2. **Connect Wallet** with the demo wallet.
3. **Switch to Robinhood Chain** (chainId 46630). The button uses
   `wallet_switchEthereumChain` first; if the wallet must add the chain, it uses
   `NEXT_PUBLIC_ROBINHOOD_RPC_URL` from configuration.
4. **Mint demo USDG** in the demo-token panel.
5. **Approve** the exact USDG amount for `MandateAccount`.
6. **Deposit** the approved USDG into `MandateAccount`.
7. Confirm the **MandateAccount balances** panel reflects the deposit.
8. Review the **Mandate policy** panel: 35% max single-asset exposure, 200 USDG max
   trade size, 20% max daily turnover, 0s cooldown.
9. Confirm the **Session authority** panel: session key enabled, role `SESSION`.
10. **Preview the safe action** (small TSLA buy) → reason code `OK`.
11. **Execute the safe action** → the server relayer submits and executes →
    decision `EXECUTED`.
12. **Preview the dangerous action** (oversized TSLA buy) → `SINGLE_ASSET_EXPOSURE_EXCEEDED`,
    decision `BLOCKED`, and **no execute CTA** appears.

---

## 6. Known policy behavior

From `deployments/46630.json` (`seed.mandate`), enforced on-chain:

| Parameter | Value | Effect |
|---|---|---|
| `maxSingleAssetExposureBps` | 3500 (35%) | Blocks if post-trade single-asset exposure > 35% → `SINGLE_ASSET_EXPOSURE_EXCEEDED` |
| `maxTradeSizeUSDG` | 200 USDG | Blocks a single trade above 200 USDG → `TRADE_SIZE_EXCEEDED` |
| `maxDailyTurnoverBps` | 2000 (20%) | Blocks if daily turnover > 20% → `DAILY_TURNOVER_EXCEEDED` |
| `cooldownSeconds` | 0 | No cooldown between actions |
| `mandateVersion` | 1 | Current policy version |

- The **dangerous** demo action is blocked by the exposure limit. The relayer still
  submits it on-chain (the contract records a `BLOCKED` decision and increments the
  nonce), but the relayer's dangerous path **never calls `executeAction`** — execution
  is impossible because `executeAction` requires an `APPROVED` decision.
- A **safe** action only executes if its preview returns `OK` *and* the on-chain
  decision is `APPROVED`. If live portfolio state has drifted (exposure already high),
  even the safe candidate can return `preview_not_ok` — deposit more USDG or reduce the
  safe amount.

---

## 7. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `/api/demo-price` returns `configuration_error` | `PRICE_SIGNER_KEY` is unset or invalid in the web/Vercel environment. |
| `/api/demo-price` returns `signer_mismatch` | `PRICE_SIGNER_KEY` does not derive to `deployment.priceSigner` in `deployments/46630.json`. |
| `/api/demo-price` returns `invalid_assets` | The `assets` query must contain only the deployment TSLA/AMD addresses. |
| `/api/demo-price` returns `stale_config` | `deployments/46630.json` is missing required price config or contains invalid addresses. |
| Optional local signer exits immediately | `PRICE_SIGNER_KEY` missing/zero, not 0x-hex, or equal to a deployer/session key. Must match `deployment.priceSigner`. |
| Optional local signer: `... priceFeed must be a valid EVM address` | `MANDATE_DEPLOYMENT_PATH` points at the wrong/missing file. |
| Relayer 500 "Demo agent relayer is not configured" | `MANDATE_SESSION_KEY_PRIVATE_KEY` is unset in `web/.env.local`. |
| Relayer `session_key_mismatch` | The configured session key ≠ `deployment.sessionKey`. |
| Relayer `session_key_inactive` | Session key disabled or expired on-chain (see verify script's session section). |
| Relayer `prices_missing` / `prices_stale` | Wrong `NEXT_PUBLIC_MANDATE_PRICE_URL`, `/api/demo-price` configuration error, or optional local signer unavailable when using the local signer URL. |
| Safe action returns `preview_not_ok` | Exposure already near the 35% cap — deposit more USDG or reduce the safe amount. |
| Wallet on wrong network | Use **Switch to Robinhood Chain**; confirm chainId 46630. |
| `verify:live-demo` exits non-zero | Read the specific `FAIL` line; it names the failing check (chain, code, asset, adapter, oracle, or session key). |
