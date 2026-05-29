# ADR-0007 — actionSchemaVersion vs mandateVersion (Separate)

## Status

Accepted

## Context

Two kinds of versioning are needed: (1) a version for the action encoding format, which determines how action structs are hashed and verified; and (2) a version for the risk configuration (mandate), which determines what limits and allowlists apply at execution time. These are orthogonal concerns — the action encoding can change without the mandate changing, and the mandate can change without any change to the action encoding.

## Decision

`actionSchemaVersion` lives in the `Action` struct itself and in the EIP-712 domain's `version` field. `submitAction` checks that the action's schema version matches the contract's current schema version. `mandateVersion` lives in `MandateConfig` and increments by 1 each time `setMandate` is called. `executeAction` checks that the mandate version stored in the APPROVED decision matches the current mandate version — any change to the mandate between submit and execute causes the execute to revert.

## Alternatives Considered

**A single shared version for both action encoding and mandate config:** Mutual interference — a mandate change would invalidate pending approved actions that are still valid under the unchanged action encoding, and vice versa. Rejected.

## Consequences

**Positive:** Action encoding and risk configuration can evolve independently. The mandate version check in execute provides a clean TOCTOU guard — if the owner changes the mandate after an action is approved, the approval is automatically invalidated.

**Negative:** Two versioning counters must be managed and documented separately, adding a small cognitive overhead.

## Migration Path / Future Work

When Form B extends the `Action` struct with new fields (e.g., for ERC-4337 or additional swap parameters), the `actionSchemaVersion` is bumped. The `mandateVersion` semantics remain unchanged regardless of which form is in use.
