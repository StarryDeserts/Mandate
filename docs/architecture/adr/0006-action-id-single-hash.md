# ADR-0006 — (ANTI-REGRESSION) actionId Single Hash; Mapping Key = actionId; Drop Decision.actionHash

## Status

Accepted (supersedes Decision containing actionHash) — **ANTI-REGRESSION**

## Context

The `executeAction` function receives a full `Action` struct. A critical security property is that using one action's approval to execute a different action must be impossible. Two failure modes exist: (a) if the mapping key is something other than the full action hash, an attacker might find a collision or crafted input that reuses an approval; (b) if `Decision` stores an `actionHash` field separately from the mapping key, the two could diverge under certain implementations, creating a false sense of security or an actual exploit.

## Decision

There is exactly ONE global `_hashAction` function, shared by `submitAction`, `executeAction`, `previewAction`, and `computeActionId`. The `ACTION_TYPEHASH` covers EVERY execution-relevant field in the `Action` struct. The `decisions` mapping key is the `actionId` (= `_hashAction(action)`). In `executeAction`, the contract recomputes `actionId` from the passed `Action` and uses that recomputed value as the mapping key. The `Decision` struct has NO `actionHash` field — it is redundant. If an `actionHash` field were to be retained as a sanity check, it may only exist as an `assert(key == _hashAction(action))`, not as a security-critical field.

## Alternatives Considered

**Store full Action on-chain:** Prohibitively gas-heavy; unnecessary since the hash is sufficient for integrity.

**Accept external actionId parameter and trust stored hash:** The "borrow attack" risk — an attacker passes a legitimate actionId but a different action — is the exact attack this ADR prevents. Rejected.

**Keep redundant actionHash field in Decision:** Creates confusion about which is authoritative. If the field diverges from the mapping key due to a bug, it creates a false security indicator. Rejected.

## Consequences

**Positive:** Borrowing an approval from a different action is impossible — a different action produces a different hash, which maps to a NONE decision, causing revert. Storage is cheaper without the redundant field. Execute must resend the full Action calldata, which is acceptable.

**Negative:** Execute calldata is larger than if only the actionId were passed, but this is a deliberate security trade-off.

## Migration Path / Future Work

When new multi-field action types are introduced, they must bump `actionSchemaVersion` and extend the `ACTION_TYPEHASH` to include all new execution-relevant fields. MUST-TEST: a mutation of any single field in an Action must produce a different actionId.
