# ADR-0010 — (ANTI-REGRESSION) Price Trust Model + PriceData Signing; Account Binding Belongs to Action

## Status

Accepted (supersedes PriceAttestation containing account) — **ANTI-REGRESSION**

## Context

A price attestation must prevent several categories of replay: cross-oracle replay (using a price signed for one oracle contract on a different one), cross-environment replay (using a mainnet price on testnet), and cross-time replay (using an old price whose validity window has passed). An earlier design included the account address in the `PriceData` struct, which would have bound each price to a specific account. This binding is unnecessary and adds operational cost; the question of whether a specific account is allowed to act is the Action's responsibility, not the price oracle's.

## Decision

`PriceData` is a GLOBAL price fact — it describes the price of an asset at a given time, not a permission for a specific account. The EIP-712 domain for price attestations uses `name = "MandatePriceFeed"`, `chainId`, and `verifyingContract = <oracle address>`, which together bind the attestation to a specific oracle contract on a specific chain. The `PriceData` struct contains: `asset`, `priceUSDG1e18` (price in USDG with 18 decimal places), `timestamp`, and `validUntil`. The field `roundId` is production-only (not required in the demo) to avoid liveness and state cost. Account is NOT in `PriceData`. Account binding is the Action's responsibility: `action.account == address(this)`, `action.recipient == address(this)`, and the Action's EIP-712 domain `verifyingContract == MandateAccount`. The price signer is independent of the AI and backend (T2 trust tier); `SignedDemoPriceFeed` is labeled demo-grade.

## Alternatives Considered

**Account-bound price (include account in PriceData):** Requires a new signed price for every account that wants to trade, even if the price is the same for all. Adds operational overhead with no security benefit — the Action already binds the account. Rejected.

**Only MAX_STALENESS without validUntil:** The oracle signer cannot tighten the validity window below the contract's maximum staleness parameter. The `validUntil` field allows the signer to issue short-lived attestations. Rejected as less flexible.

**roundId now (production-style):** Introduces liveness dependency on round sequence and additional on-chain state. Deferred to production.

## Consequences

**Positive:** Realistic swappable oracle interface; cross-oracle replay is closed by the EIP-712 domain binding; cross-time replay is closed by `validUntil`; the price signer can be swapped for a production oracle without changing Action or account logic.

**Negative:** Within a validity window, a submitter can choose a slightly stale price (residual risk T2, mitigated by keeping windows short). The price signer is still a trusted entity — this must be disclosed clearly.

## Migration Path / Future Work

Replace `SignedDemoPriceFeed` with a decentralized oracle (Chainlink, Pyth, etc.) via the `IPriceOracle` interface. Add `roundId` / monotonic round tracking for production. All Action and account logic remains unchanged.
