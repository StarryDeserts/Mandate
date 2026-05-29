# ADR-0003 — Two-Path Decision/Execution; Review Off-Chain

## Status

Accepted

## Context

A naive single-path design where a revert constitutes a "block" is non-auditable: reverting transactions are often never mined in production, and even when they are, the revert rolls back all state including any events, leaving no persistent on-chain record that a block occurred. Auditors and judges need to be able to verify that the system actually blocked a dangerous action — not just that the action wasn't executed. Additionally, TOCTOU (time-of-check-time-of-use) drift is a real concern: state can change between the decision point and the execution point.

## Decision

Three distinct operations serve different purposes:

1. **`submitAction`:** Records the decision persistently (BLOCKED or APPROVED) and does NOT revert on policy violation. A BLOCKED decision is a successful transaction that emits a durable on-chain event, making it explorer-verifiable.

2. **`executeAction`:** Enforces the decision and REVERTS on any safety failure. This is the true enforcement point. It re-checks all conditions at execution time to handle TOCTOU drift.

3. **`reviewAction`:** An off-chain-only operation implemented as an `eth_call` to `previewAction`. It reuses the exact same engine logic as submit/execute so the preview is authoritative — not a separate implementation that could diverge.

## Alternatives Considered

**Revert-only (single path):** Events are lost on revert. The block is never recorded on-chain in a durable way. Rejected for auditability reasons.

**Submit-then-execute-in-one-transaction:** No audit trail of the decision, and no TOCTOU recheck window between decision and execution. Rejected.

**On-chain review (separate `reviewAction` contract call):** Would require duplicating the engine logic in a separate function/contract, creating risk of divergence between what review shows and what submit/execute actually does. Rejected in favor of `eth_call` to `previewAction`.

## Consequences

**Positive:** BLOCKED is a persistent event in a successful transaction, making it verifiable on any explorer. Decision and execution are decoupled, and execute re-checks at execution time. UI can show honest block reasons without relying on revert messages.

**Negative:** The canonical happy path requires two transactions (submit then execute), slightly increasing gas costs and UX friction.

## Migration Path / Future Work

An optional `submitAndExecute` convenience function may be added in future milestones. Even with a convenience wrapper, the decision must be recorded before execution proceeds — the two-path invariant must not be violated.
