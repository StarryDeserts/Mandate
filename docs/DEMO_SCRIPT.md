# Mandate Demo Runbook and Speaking Script

This document is for running the public Mandate demo and narrating it clearly in English.

## Part 1: Operator runbook

### Before demo

- Start the web dev server or open the deployed Vercel URL.
  - Local: `npm --prefix web run dev -- -p 3002`
  - Local default script also uses port `3002`: `npm --prefix web run dev`
- Verify `web/.env.local` locally, or the Vercel project env vars in production:
  - `NEXT_PUBLIC_ROBINHOOD_RPC_URL`
  - `NEXT_PUBLIC_MANDATE_PRICE_URL=/api/demo-price`
  - `PRICE_SIGNER_KEY`
  - `MANDATE_SESSION_KEY_PRIVATE_KEY`
- Verify the wallet has Robinhood Chain testnet ETH for gas.
- Verify `/api/demo-price` works before opening the live console.
  - Expected: a JSON response with `domain` and signed `rows` when called with TSLA/AMD asset addresses.
  - If it returns a JSON error, fix env configuration before demoing.
- Verify `/live` opens.
- Clear activity in the live console if you want a clean story.
- Ensure no private keys, `.env.local` files, local shell history, or deployment dashboards with secrets are visible on screen.

### Demo actions

1. Open the landing page and introduce Mandate.
2. Open `/live`.
3. Connect the funding wallet.
4. Switch to Robinhood Chain testnet if prompted.
5. Mint demo USDG.
6. Approve the exact deposit amount.
7. Deposit into `MandateAccount`.
8. Explain that funds are in `MandateAccount`, not in the agent wallet.
9. Preview the small TSLA buy.
10. Submit and execute the approved candidate through the demo agent relayer.
11. Show the executed result card and transaction evidence.
12. Submit the dangerous blocked candidate.
13. Show the blocked result and say: “Funds moved: no.”
14. Close with the summary: user funds stay in `MandateAccount`, the agent acts through a constrained session key, approved actions execute, dangerous actions block, and receipts prove the outcome.

### Troubleshooting

| Symptom | What to check |
|---|---|
| Price rows failed | Confirm `NEXT_PUBLIC_MANDATE_PRICE_URL=/api/demo-price`, `PRICE_SIGNER_KEY` is set server-side, and `PRICE_SIGNER_KEY` derives to `deployment.priceSigner` in `deployments/46630.json`. |
| `/api/demo-price` returns `configuration_error` | `PRICE_SIGNER_KEY` is missing or malformed in the web/Vercel environment. |
| `/api/demo-price` returns `signer_mismatch` | The configured price signer key does not match `deployments/46630.json`. |
| Preview returns `DAILY_TURNOVER_EXCEEDED` | Demo state has already used too much daily turnover. Use a fresh account state, wait for the policy window, or explain that Mandate is correctly blocking due to policy. |
| Safe preview does not return `OK` | The account may already have too much TSLA exposure or insufficient USDG. Deposit more USDG or reset to a cleaner demo state. |
| Wallet does not open | Check browser wallet extension state, popup blocking, locked wallet, and whether the page is loaded over the expected origin. |
| Wrong chain | Use the “Switch to Robinhood Chain” control. If the wallet needs to add the chain, confirm `NEXT_PUBLIC_ROBINHOOD_RPC_URL` is configured. |
| Session key relayer error | Confirm `MANDATE_SESSION_KEY_PRIVATE_KEY` is set server-side and derives to `deployment.sessionKey`. Confirm the session key is active onchain. |
| Vercel env missing | Add the env var in Vercel project settings and redeploy. Existing deployments do not automatically pick up changed env vars. |
| Port already in use | Stop the process using port `3002`, or run Next on another port and open that URL manually. |

## Part 2: English demo script

### 0:00–0:20 — Landing page

“Mandate is a policy firewall for AI-agent finance. The core idea is simple: an AI agent can propose an action, but it cannot freely move funds. Funds only move after onchain policy checks, and every outcome becomes evidence.”

Pause on the landing page long enough for the audience to read the headline and understand the promise: agent automation with enforceable boundaries.

### 0:20–0:45 — Open live demo

“Now I’ll open the live demo console. This is running on Robinhood Chain testnet, and the demo tokens have no real value. The user wallet funds the account. The demo agent does not hold the owner key; it only has a constrained session key on the server.”

Open `/live`. Point out the wallet status and chain status chips in the topbar.

### 0:45–1:30 — Funding flow

“First, I fund `MandateAccount` from the user wallet. This is not giving funds to the agent. The agent does not receive custody. The user wallet mints demo tokens, approves the exact amount, and deposits into `MandateAccount`.”

Mint USDG, approve the exact amount, and deposit. As the UI updates, emphasize that the funds are held by `MandateAccount`, where policy is enforced before execution.

### 1:30–2:15 — Policy preview

“Now the agent proposes a small TSLA buy. Before anything moves, Mandate previews the action against policy: allowed asset, approved adapter, max trade size, turnover, exposure, nonce, deadline, and signed price rows.”

Preview the safe action. If the preview returns `OK`, call out that this is only approval to proceed through the controlled path, not a bypass.

### 2:15–3:00 — Approved execution

“The preview returns OK, so the demo agent relayer submits the action using the server-side session key. Mandate approves it, then executes it. The important point is that the agent did not bypass policy; the action executed because policy allowed it.”

Submit and execute the safe candidate. Show the result card, decision status, and transaction hash. If useful, open the transaction in the explorer to show receipt-level evidence.

### 3:00–3:45 — Blocked dangerous path

“Now I submit a dangerous action: 500 USDG into TSLA. This exceeds the exposure boundary. Mandate blocks it. There is no execute button for this path, and funds moved: no.”

Submit the dangerous blocked proof. Point to the blocked decision and the absence of any execute CTA. Keep the explanation simple: the action was submitted for evidence, not executed.

### 3:45–4:15 — Evidence close

“The result is the full boundary story: user funds stay in `MandateAccount`, the agent acts only through a constrained session key, approved actions execute, dangerous actions are blocked, and the receipts prove what happened.”

Show the activity/evidence section. Summarize the safe path and blocked path side by side.

### 4:15–4:30 — Final one-liner

“Agents can propose. Mandate decides. Receipts prove.”
