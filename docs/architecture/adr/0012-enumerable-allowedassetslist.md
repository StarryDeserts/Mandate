# ADR-0012 — (ANTI-REGRESSION) Enumerable allowedAssetsList (Not Mapping-Only)

## Status

Accepted — **ANTI-REGRESSION**

## Context

ADR-0011 requires iterating over all valued assets in the portfolio when computing exposure. A `mapping(address => bool)` alone is not enumerable — there is no way to get the list of enabled assets from a mapping without either maintaining a separate array or requiring the caller to provide the list (which introduces a trust problem). ADR-0011 explicitly rejects caller-supplied asset lists as untrusted.

## Decision

`MandateAccount` maintains an enumerable `allowedAssetsList` (a `address[]` array) alongside the `isAssetAllowed` mapping. The two structures are kept in sync by `setAssetAllowed`: when an asset is enabled, it is appended to the array; when disabled, it is removed via the swap-and-pop pattern (O(n) search once, O(1) removal). The "valued portfolio" for exposure computation is `allowedAssetsList ∩ {assets with balanceOf > 0} ∪ {USDG}`.

## Alternatives Considered

**Mapping-only:** Cannot iterate — rejected as technically infeasible per ADR-0011's requirements.

**Caller-supplied asset list at call time:** Untrusted — the caller could omit assets to manipulate the exposure denominator. Rejected.

**Separate `portfolioAssetsList` distinct from `allowedAssetsList`:** Adds extra bookkeeping with unclear semantics. Deferred — could be useful for production internal accounting but is over-engineering for the MVP.

## Consequences

**Positive:** On-chain enumeration of valued assets requires no trusted external input; the exposure computation is fully self-contained within the contract.

**Negative:** `setAssetAllowed` must maintain the array, adding gas cost to governance operations. Gas is acceptable as long as the allowlist is small, which is expected for the MVP.

## Migration Path / Future Work

If the allowlist grows large (hundreds of assets), an iterable mapping library or on-chain pagination can be introduced. For the MVP's expected 5-20 assets, the array is sufficient.
