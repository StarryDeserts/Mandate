# ADR-0016 — (ANTI-REGRESSION) Owner Exit = withdraw Only; migrateTo NOT in MVP

## Status

Accepted — **ANTI-REGRESSION**

## Context

The owner already has full exit capability via `withdraw(asset, amount, to)`. A `migrateTo` function would be a second full-exit path — essentially allowing the owner to move all assets to a new account in a single transaction. While this might seem convenient, it introduces an additional surface that must be audited and that, if incorrectly implemented, could be exploited. This ADR exists specifically to STOP future implementers from adding `migrateTo` without a full re-review.

## Decision

The MVP implements ONLY `withdraw(asset, amount, to)` as the owner's exit mechanism. `migrateTo` is NOT implemented in the MVP. Migration from A to B means the owner calls `withdraw` per asset (or in batch if a multi-asset withdraw is implemented) to their own address, then deposits into the new B account. This is a deliberate design decision, not an oversight.

## Alternatives Considered

**migrateTo convenience function:** Provides no new capability over `withdraw` (both result in the owner controlling the assets) but adds additional audit surface and a new code path that must be reviewed for correctness. In particular, any bug in `migrateTo` that makes it callable by the session key would be catastrophic. Rejected.

**Proxy upgrade:** Rejected by ADR-0005. Proxy upgrade is the only mechanism for true in-place migration and it is categorically rejected.

## Consequences

**Positive:** Single audited exit path for owner assets; no ambiguity about how funds leave the account under owner control.

**Negative:** Multi-asset migration requires one `withdraw` call per asset (or a batch wrapper), which is slightly more friction than a single `migrateTo`. This is rare (once per account lifetime) and acceptable.

## Migration Path / Future Work

If `migrateTo` is ever added in a future version, it MUST be: owner-only, must target a non-zero and non-self address, must emit both a `Withdrawn` event per asset and a `MigratedTo` event for the destination, and must be protected by `nonReentrant`. Any implementation must go through full re-review.
