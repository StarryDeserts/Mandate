# ADR-0008 — Nonce Monotonic Model

## Status

Accepted

## Context

The system needs reliable logical replay protection to prevent the same action from being submitted twice or a stale action from being replayed after a different action has already consumed the slot. The simplest possible model is preferred for the MVP — complexity can be introduced later if the use case demands it.

## Decision

A per-account monotonic `nextNonce` counter is maintained. `submitAction` requires `action.nonce == nextNonce` at the time of submission. BOTH BLOCKED and APPROVED decisions consume the nonce (increment `nextNonce` by 1). A transaction that reverts does NOT consume a nonce. If a safe alternative is needed after a block, the safe action must use a new nonce (the blocked action's nonce was already consumed).

## Alternatives Considered

**2D nonce (per-slot parallel nonce model):** Allows parallelism but is significantly more complex and over-engineered for a single-AI-session account where actions are inherently serial. Deferred to future work if needed.

**Not consuming the nonce on BLOCKED:** Would allow the same illegal action to repeatedly occupy a nonce slot, potentially filling the decision log with replays of the same blocked action. Rejected.

## Consequences

**Positive:** Minimal and deterministic replay protection; easy to reason about and test; no unbounded storage growth.

**Negative:** Submissions are serialized — a single AI session cannot submit two actions in parallel (the second must wait for the first to be mined). This is acceptable for the MVP's single-session use case.

## Migration Path / Future Work

A 2D nonce model (e.g., Permit2-style parallel slots) can be introduced for parallelism in future milestones without changing the Action schema, by extending the nonce field to encode slot + sequence.
