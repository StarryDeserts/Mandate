# ADR-0015 — SessionKey Honest Enforcement

## Status

Accepted

## Context

The `SessionKey` struct may contain fields that represent desirable future functionality (fine-grained scope, per-action amount caps, action type filtering) but that are not enforced in the MVP. If these fields are stored on-chain with non-default values, on-chain data implies a security guarantee that does not exist. This is a form of false advertising in the smart contract itself — an auditor or judge reading the chain state might believe a field is enforced when it is not.

## Decision

Form A enforces ONLY `enabled` (bool) and `validUntil` (timestamp). The fields `allowedActionTypes`, `maxAmountInPerAction`, and `scopeHash` are RESERVED — they are stored in the struct but not evaluated during enforcement. Critically, `addSessionKey` REJECTS any call that passes non-default (non-zero) values for these reserved fields. This ensures that the on-chain data never implies an unenforced policy — if the field is non-zero, the call reverts, so the field can only ever be zero on a deployed account. The UI distinguishes enforced fields from reserved fields (see enforcement-matrix.md).

## Alternatives Considered

**Store but not check rich fields:** On-chain data implies a false guarantee. An audit trail showing `maxAmountInPerAction = 1000 USDG` in a session key would mislead anyone reading chain state into believing that cap is enforced. Rejected.

**Half-enforce maxAmountInPerAction in MVP:** Partial enforcement is worse than no enforcement — it creates a partial guarantee that is easy to misunderstand or rely on incorrectly. Rejected.

## Consequences

**Positive:** Honesty by construction — the contract cannot store a session key with implied-but-unenforced policies; UI and docs can honestly state which fields are enforced without needing a separate disclaimer layer.

**Negative:** Coarser session granularity in the MVP — the session can use any swap within the global mandate limits. The mandate's global limits (max trade size, max exposure, daily turnover) provide the necessary bounds.

## Migration Path / Future Work

Form B lifts the reject-non-default rule and enforces fine-grained scope within `validateUserOp`. The struct fields remain the same; the enforcement logic is added in the B shell without any migration of on-chain session key data (new account, new session keys).
