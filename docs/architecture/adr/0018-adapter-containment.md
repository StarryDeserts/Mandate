# ADR-0018 — Adapter Containment

## Status

Accepted

## Context

Adapters and external DEX contracts are T3 trust — they are not part of the audited core. A compromised or malicious adapter could, without containment, drain the account by receiving an unlimited ERC20 approval. Additionally, if the adapter fails silently or delivers fewer tokens than expected, the system must detect this and revert rather than recording a successful trade that delivered less than agreed.

## Decision

The execution pattern is:

1. `approve(adapter, amountIn)` — exact approval for exactly the input amount, no more.
2. `adapter.swap(...)` — execute the swap.
3. `approve(adapter, 0)` — reset approval to zero immediately after the swap call returns.
4. Post-check: verify that `amountOut >= action.minOut`. If not, revert.

Additionally, adapters must be on the owner-controlled whitelist (enforced in the 10-condition re-check per ADR-0009). If the adapter/DEX interface changes and the swap call reverts, the entire execute reverts, which is the correct fail-closed behavior.

## Alternatives Considered

**Unlimited approval to the adapter:** If the adapter is compromised or behaves maliciously, it could drain the entire token balance from the account in a single call. Rejected.

**No post-check on output amount:** Under-delivery by the adapter (e.g., MEV sandwich, bad price, adapter bug) would go unnoticed and the trade would be recorded as successful with less output than the user agreed to. Rejected.

## Consequences

**Positive:** The maximum single-trade exposure is exactly `amountIn` — a compromised adapter can only take the approved amount; it cannot drain the account beyond the current trade's input. Interface drift (adapter changes its swap signature) causes a revert, which is fail-closed.

**Negative:** Two ERC20 `approve` calls per trade add gas overhead. This is acceptable given the security benefit.

## Migration Path / Future Work

Multiple audited adapters can be added to the whitelist over time. Per-adapter spending limits (a separate `adapterDailyLimit`) can be added as an additional constraint in a future milestone.
