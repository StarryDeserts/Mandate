# Mandate

Policy firewall for AI-agent finance.

Mandate lets AI agents propose financial actions without giving them unrestricted custody. User funds are held by `MandateAccount`, not by the agent. In this demo, a server-side demo agent uses a constrained session key to submit fixed actions. Mandate checks policy before funds move, then approved, executed, blocked, and failed outcomes become inspectable onchain evidence.

## What this demo proves

- The user wallet funds the account.
- The agent does not hold the owner key.
- The backend demo agent does not get unrestricted custody.
- The session key can only submit policy-checked actions.
- Policy checks happen before execution.
- A small TSLA buy can execute when preview returns `OK`.
- An aggressive TSLA buy is blocked.
- The dangerous action has no execute CTA.
- Chain receipts and transaction hashes prove outcomes.

## What this is not

- Not production custody.
- Not a real Aave integration.
- Not full ERC-4337.
- Not a trading bot.
- Not a yield optimizer.
- Not protection against owner key compromise.
- Not production session-key infrastructure.
- Demo tokens have no real value.

## Architecture

- `MandateAccount`: the policy-controlled account that holds user funds, previews actions, records decisions, and executes only approved actions.
- `MockERC20`: public-mint demo tokens for USDG, TSLA, and AMD on Robinhood Chain testnet.
- `MockAMM`: demo exchange surface for token swaps.
- `ApprovedSwapAdapter`: the only approved adapter used by the demo swap actions.
- `SignedDemoPriceFeed`: verifies EIP-712 signed demo price rows before policy checks use them.
- `/api/demo-price`: Next.js Node runtime route that signs TSLA/AMD demo price rows server-side using `PRICE_SIGNER_KEY`.
- `/api/demo-agent/action`: Next.js server-side route that uses `MANDATE_SESSION_KEY_PRIVATE_KEY` to submit the fixed safe or dangerous demo action.
- `/live`: guided frontend demo console for wallet funding, safe execution, blocked proof, and evidence review.

```text
User wallet
  └─ mint / approve / deposit
        ↓
MandateAccount holds funds
        ↓
Demo agent relayer uses session key
        ↓
Mandate preview + policy check
        ↓
Approved action executes / dangerous action blocks
        ↓
Evidence: tx hashes + decision status
```

## Live demo routes

- `/`: public landing page.
- `/live`: live demo console.
- `/app`: redirects to `/live`.

## Local development

### Prerequisites

- Node.js.
- npm.
- Foundry, if you are working on contracts.
- A browser wallet.
- Robinhood Chain testnet ETH for gas.

### Install dependencies

```bash
npm --prefix web install
npm --prefix signer install
```

The web app and optional standalone signer are separate packages. There is no root workspace install command.

### Environment variables

Create `web/.env.local` from `web/.env.example` and fill in deployment-specific values:

```bash
NEXT_PUBLIC_ROBINHOOD_RPC_URL=
NEXT_PUBLIC_MANDATE_PRICE_URL=/api/demo-price

PRICE_SIGNER_KEY=
MANDATE_SESSION_KEY_PRIVATE_KEY=
```

Rules:

- `NEXT_PUBLIC_*` values are browser-visible. Only put public URLs and public addresses there.
- `PRICE_SIGNER_KEY` is server-only. It powers `/api/demo-price` and must derive to `deployment.priceSigner` in `deployments/46630.json`.
- `MANDATE_SESSION_KEY_PRIVATE_KEY` is server-only. It powers `/api/demo-agent/action` and must derive to `deployment.sessionKey` in `deployments/46630.json`.
- Do not commit real secrets.
- Do not prefix private keys with `NEXT_PUBLIC_`.
- Do not put mainnet keys in this demo.

### Run locally

The main local path uses the in-app price signer route, matching the Vercel deployment model:

```bash
npm --prefix web run dev -- -p 3002
```

The current web script already defaults to port `3002`, so this is also sufficient:

```bash
npm --prefix web run dev
```

Open:

```text
http://localhost:3002/live
```

The older standalone signer service is optional and local-only. It is no longer required for the main Vercel-style flow. Use it only when explicitly testing `signer/`, then point `NEXT_PUBLIC_MANDATE_PRICE_URL` at `http://127.0.0.1:8787/price`.

## Vercel deployment

Recommended Vercel settings:

- Root directory: `web`.
- Framework: Next.js.
- Build command: `npm run build`.

Required Vercel environment variables:

- `NEXT_PUBLIC_ROBINHOOD_RPC_URL`
- `NEXT_PUBLIC_MANDATE_PRICE_URL=/api/demo-price`
- `PRICE_SIGNER_KEY`
- `MANDATE_SESSION_KEY_PRIVATE_KEY`

Notes:

- Vercel does not need a separate price server.
- `/api/demo-price` runs as a server-side function.
- `/api/demo-agent/action` runs as a server-side function.
- Changing Vercel environment variables requires a redeploy.
- `PRICE_SIGNER_KEY` and `MANDATE_SESSION_KEY_PRIVATE_KEY` must remain server-side only.

## Demo flow

1. Open `/live`.
2. Connect the wallet.
3. Switch to Robinhood Chain testnet.
4. Mint demo USDG.
5. Approve the exact deposit amount.
6. Deposit into `MandateAccount`.
7. Preview the small TSLA buy.
8. The demo agent relayer submits and executes the approved candidate.
9. The demo agent relayer submits the dangerous blocked proof.
10. Show evidence and result cards.

## Verification commands

```bash
npm --prefix signer test
npm --prefix web run test
npm --prefix web run lint
npm --prefix web run typecheck
npm --prefix web run build
```

Optional live-chain read-only verification:

```bash
npm --prefix web run verify:live-demo
```

## Security notes

- Demo session keys are for testnet only.
- Server-side secrets must stay in server-side environment variables.
- Do not use mainnet keys.
- Do not use real funds.
- Demo tokens are public-mint test assets with no real value.
- This repository should never contain `.env.local` files or real RPC keys.

## License

License: TBD
