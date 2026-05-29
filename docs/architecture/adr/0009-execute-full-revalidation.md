# ADR-0009 — executeAction Full Re-Validation (10 Conditions)

## Status

Accepted

## Context

State can drift between `submitAction` and `executeAction` in many ways: the mandate can change, the price can become stale, an asset can be removed from the allowlist, the daily turnover can be consumed by another trade, or the price can move such that the exposure check no longer passes. Simply trusting the APPROVED decision from submit and executing without re-checking creates a TOCTOU vulnerability where the decision was valid at submit time but the execution would violate the current mandate.

## Decision

`executeAction` reverts unless ALL of the following 10 conditions pass at execution time:

1. The decision state is APPROVED (not BLOCKED, EXECUTED, or NONE).
2. The decision has not already been executed.
3. The action has not expired (`block.timestamp <= action.deadline`).
4. The mandate version in the decision matches the current `mandateVersion`.
5. The price attestation is fresh (within the valid window).
6. The asset being sold (`assetIn`) is still on the allowlist.
7. The adapter being used is still on the allowlist.
8. The recipient is the account itself (`action.recipient == address(this)`).
9. Daily turnover, single-asset exposure, and per-trade size checks still pass under current prices.
10. Post-execution check: output received (`amountOut`) is >= `action.minOut`.

CEI (Checks-Effects-Interactions) discipline: the EXECUTED state is set BEFORE the external call to the adapter; the daily turnover is atomically incremented at the same time; the `nonReentrant` modifier is applied.

## Alternatives Considered

**Trust the submit decision and execute directly without re-checking:** Any state drift between submit and execute could result in execution that violates the current mandate. Rejected as unsafe.

**Skip re-checking the exposure condition:** A price move between submit and execute could push the post-trade exposure above the mandate cap. Rejecting this alternative is critical — exposure re-check at execute time is a genuine boundary protection.

## Consequences

**Positive:** The execution-time check is the true enforcement point; all forms of state drift fail closed with a revert; the full list of conditions is enumerable and auditable.

**Negative:** Execute gas is higher than a naive single-check design due to re-running all 10 conditions and re-fetching prices.

## Migration Path / Future Work

As new mandate fields or constraint types are added (e.g., per-session limits, time-of-day windows), they are added to this list of 10 conditions and re-checked at execute time. The list in this ADR must be kept in sync with the implementation.
