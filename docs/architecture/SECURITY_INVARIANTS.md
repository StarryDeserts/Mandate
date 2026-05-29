# Security Invariants — Mandate Account

This document enumerates the 12 security invariants that the Mandate Account system must maintain, along with their rationale, ADR references, and test handles. All invariants are stated as properties that must hold in ALL reachable states of the system.

## Trust Tier Reference

| Tier | Actor | Basis |
|------|-------|-------|
| **T0** | On-chain contracts | Strong guarantee — enforced by auditable code; permissions enumerable; asset path unique |
| **T1** | Owner | Trusted by protocol assumption; the account deployer/controller |
| **T2** | Price signer | Off-chain entity that signs price attestations; MUST be independent of AI/backend for core claim to hold |
| **T3** | Adapter (DEX) | External contract; assumed honest per trade; subject to owner whitelist |
| **T4** | Frontend / Backend / AI | Assist-only; full T4 compromise → at most propose within mandate; NEVER a security guarantee |

The core claim — **"full off-chain compromise leads to at most proposing actions within the mandate"** — holds CONDITIONAL on T2 independence (price signer is not the AI or the backend).

---

## Invariants

### INV-1 — Custody: Only executeAction or owner withdraw can remove assets

**Statement:** Assets leave `MandateAccount` ONLY via `executeAction` (through the whitelisted adapter, output delivered back to the account) or via the owner's `withdraw(asset, amount, to)` call. No other code path can cause a net outflow of assets from the account.

**Rationale:** This is the foundational custody guarantee. If any other code path could remove assets, the system's core security claim would be violated regardless of mandate enforcement.

**ADR References:** ADR-0001 (account-is-vault), ADR-0016 (owner exit = withdraw only)

**Test Handle:** `contracts/test/invariant/Invariants.t.sol::invariant_custodyOnlyViaExecuteOrWithdraw`

---

### INV-2 — Session Powerlessness: SESSION role cannot escalate

**Statement:** A caller authenticated as SESSION (a session key) can never: change the mandate or allowlists, add or revoke session keys, change the owner, call `withdraw`, or execute an action that is not in the APPROVED decision state.

**Rationale:** The session key is the AI's authorization token. Its powers must be strictly bounded to proposing/submitting actions. If the session could change the mandate, it could expand its own permissions. If it could withdraw, it would have full custody.

**ADR References:** ADR-0004 (role/actor abstraction), ADR-0009 (execute conditions)

**Test Handle:** `contracts/test/invariant/Invariants.t.sol::invariant_sessionCannotEscalate`

---

### INV-3 — No Double-Execute: A Decision reaches EXECUTED at most once

**Statement:** A `Decision` in state EXECUTED can never be re-executed. Any call to `executeAction` for an already-EXECUTED decision reverts.

**Rationale:** Re-executing an approved decision would allow the same trade to be replayed multiple times from a single approval, bypassing nonce protection and turnover limits.

**ADR References:** ADR-0009 (condition 2: not already executed)

**Test Handle:** `contracts/test/unit/MandateAccount.execute.t.sol::test_reexecute_reverts`

---

### INV-4 — Approval Integrity: executeAction succeeds only if APPROVED and all 10 re-checks pass

**Statement:** `executeAction(action)` succeeds (does not revert) if and only if `decisions[_hashAction(action)] == APPROVED` AND all 10 re-validation conditions from ADR-0009 pass at execution time.

**Rationale:** The execution-time re-check is the true enforcement point. An APPROVED decision that passes all conditions is the ONLY valid path to execution. All other paths revert.

**ADR References:** ADR-0009 (full 10-condition list)

**Test Handle:** `contracts/test/unit/MandateAccount.execute.t.sol`

---

### INV-5 — Action Binding: Distinct Actions never share an actionId; approval for A cannot execute B

**Statement:** For any two Action structs A and B where any execution-relevant field differs, `_hashAction(A) != _hashAction(B)`. Consequently, an approval recorded for action A cannot be used to execute action B.

**Rationale:** This is the anti-approval-borrowing guarantee (ADR-0006). If two distinct actions could produce the same ID, an attacker could get a safe action approved and then execute a different, unsafe action using the same approval.

**ADR References:** ADR-0006 (single hash, full typehash coverage)

**Test Handle:** `contracts/test/unit/ActionLib.t.sol::test_actionId_changes_on_every_field_mutation` and `contracts/test/unit/MandateAccount.execute.t.sol::test_borrowApproval_reverts`

---

### INV-6 — Nonce Monotonic: nextNonce increases exactly 1 per non-reverting submit; consumed nonce unusable

**Statement:** After any non-reverting call to `submitAction`, `nextNonce` increases by exactly 1. A nonce that has been consumed (by BLOCKED or APPROVED) cannot be used again.

**Rationale:** Monotonic nonce consumption prevents replay of the same action and ensures that every slot in the decision log is used exactly once.

**ADR References:** ADR-0008 (nonce model)

**Test Handle:** `contracts/test/unit/MandateAccount.submit.t.sol`

---

### INV-7 — Mandate Freshness: APPROVED decision cannot execute after mandateVersion changes

**Statement:** If `mandateVersion` changes between the time a Decision is recorded as APPROVED and the time `executeAction` is called for that Decision, `executeAction` reverts.

**Rationale:** A mandate change means the owner has updated the risk configuration. Previously-approved actions may no longer comply with the new mandate. The TOCTOU guard ensures that approvals do not outlive the mandate that granted them.

**ADR References:** ADR-0007 (schema vs mandate version), ADR-0009 (condition 4: mandate version unchanged)

**Test Handle:** `contracts/test/unit/MandateAccount.execute.t.sol::test_mandateVersionChange_reverts`

---

### INV-8 — Price Integrity: No decision/execution uses unsigned/stale price; prices[] sorted, unique, full coverage

**Statement:** No `submitAction` or `executeAction` call uses: (a) a price that was not signed by the authorized price signer, (b) a price whose `validUntil` timestamp has passed, or (c) a prices array that is not strictly ascending, contains duplicates, or fails to cover all valued assets.

**Rationale:** Price integrity is required for correct exposure calculations. A stale or unsigned price could allow an over-concentrated trade to appear within mandate bounds.

**ADR References:** ADR-0010 (price trust model), ADR-0011 (prices array discipline)

**Test Handle:** `contracts/test/unit/MandateAccount.submit.t.sol` and `contracts/test/unit/SignedDemoPriceFeed.t.sol`

---

### INV-9 — Recipient Lock: Executed swaps deliver output to the account only

**Statement:** In any successful execution, the output tokens of the swap are delivered to `address(this)` (the account itself). The `action.recipient` field is always `address(this)`, and this is re-checked at execute time.

**Rationale:** If the swap output could be delivered to an arbitrary address, the session key could effectively withdraw funds by crafting an action with `recipient = attacker`. This invariant closes that path.

**ADR References:** ADR-0009 (condition 8: recipient == account)

**Test Handle:** `contracts/test/unit/MandateAccount.execute.t.sol`

---

### INV-10 — Default-Deny: Missing config/price or engine/adapter error → BLOCK or revert, never allow

**Statement:** Under any of the following conditions, the outcome is BLOCK (for submit) or revert (for execute), never ALLOW: missing price attestation for a required asset, uninitialized or zeroed mandate, engine exception, adapter exception, version mismatch.

**Rationale:** The fail-safe must be denial, not permission. Any anomaly that prevents the system from computing a safe decision must result in the safest possible outcome.

**ADR References:** ADR-0017 (fail-safe = default-deny)

**Test Handle:** `contracts/test/invariant/Invariants.t.sol`

---

### INV-11 — Bounded Approval: Adapter approval set to exact amount then reset to 0; never left nonzero

**Statement:** In any execution path, the ERC20 allowance granted to the adapter is set to exactly `amountIn` before the swap call and reset to 0 immediately after the swap call returns (whether success or revert). The allowance is never left nonzero after `executeAction` completes.

**Rationale:** An allowance left nonzero after the trade allows the adapter (or anyone who can call it) to drain additional funds beyond the agreed trade amount.

**ADR References:** ADR-0018 (adapter containment)

**Test Handle:** `contracts/test/unit/MandateAccount.execute.t.sol::test_approvalResetToZero`

---

### INV-12 — Honest Scope: addSessionKey rejects non-default reserved scope fields

**Statement:** Any call to `addSessionKey` that passes a non-zero value for any of `allowedActionTypes`, `maxAmountInPerAction`, or `scopeHash` reverts. On any deployed account, these fields in any stored session key are always zero.

**Rationale:** Storing non-zero values for unenforced fields creates false security guarantees visible on-chain. The contract enforces honesty by construction — it is impossible to create a session key that implies an unenforced policy.

**ADR References:** ADR-0015 (session key honest enforcement)

**Test Handle:** `contracts/test/unit/MandateAccount.sessionkey.t.sol::test_rejectNonDefaultReservedFields`
