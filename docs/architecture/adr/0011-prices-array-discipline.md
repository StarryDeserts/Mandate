# ADR-0011 — prices[] Array Discipline

## Status

Accepted

## Context

Portfolio valuation requires looking up prices for every asset with a non-zero balance in the account. The completeness and determinism of this lookup determines whether the exposure calculations are correct. If prices can be submitted in arbitrary order, or if duplicates are allowed, or if coverage is incomplete, an attacker could manipulate the denominator (total portfolio value) to make dangerous trades appear safe.

## Decision

The `prices[]` array passed to `submitAction` and `executeAction` must be strictly ascending by asset address (providing free deduplication and a deterministic canonical ordering). The contract rejects duplicate addresses. The array MUST cover `assetIn`, `assetOut`, and every asset in the enumerable `allowedAssetsList` that has a non-zero balance. USDG is hardcoded to 1e18 (no price attestation is accepted for USDG — it is always exactly 1 USDG). Any missing asset, out-of-order submission, or duplicate causes the transaction to revert.

## Alternatives Considered

**Unsorted array with mapping-based deduplication:** Higher gas cost and more complexity in the verification logic. Does not provide a canonical digest for off-chain verification. Rejected.

**Allow partial coverage:** Would allow an attacker to omit a low-value asset with a high balance, understating the portfolio value and making an over-concentrated trade appear within bounds. Rejected.

## Consequences

**Positive:** Price inputs are unmanipulable; the array has a deterministic canonical form that can be digested off-chain for verification; coverage is always complete for valued assets.

**Negative:** The submitter (AI session) must assemble and sort the full prices array, which requires knowledge of the account's current allowlist and balances.

## Migration Path / Future Work

For accounts with a very large number of allowed assets, pagination or off-chain Merkle proofs may be needed to avoid calldata gas limits. This is acceptable to defer given the small asset counts expected in the MVP.
