# ADR-0017 — Fail-Safe = Default-Deny

## Status

Accepted

## Context

On configuration or input anomalies, the system must choose between failing open (allowing the action despite the anomaly) and failing closed (blocking or reverting). Failing open on anomalies is the standard category of smart contract vulnerability. Any code path that might inadvertently allow a trade under unexpected conditions represents a security failure.

## Decision

The system is default-deny: any of the following conditions causes the result to be BLOCK or revert, never ALLOW:

- Missing price (required asset not in `prices[]`)
- Uninitialized or zeroed mandate (not yet configured)
- Engine error (any exception or revert in the decision engine)
- Adapter error (any exception or revert from the DEX adapter)
- Version drift (action schema version mismatch or mandate version mismatch)

The ONLY way to fail open is for the owner (T1) to deliberately configure a permissive mandate. This is an intentional owner action, not an anomaly.

## Alternatives Considered

**Assume a default permissive value and allow:** The classic misconfiguration vulnerability — if `mandate.maxTradeSizeUSDG == 0` is interpreted as "unlimited" instead of "uninitialized", any trade would be allowed until the owner explicitly sets a limit. Rejected.

## Consequences

**Positive:** Anomalies always fail safe; a misconfigured or uninitialized account is not exploitable — it simply blocks everything until properly configured.

**Negative:** Over-strict configuration (e.g., an asset accidentally removed from the allowlist) blocks all trades. This is safe but potentially frustrating. The UI should warn the user when the mandate appears to block all reasonable actions.

## Migration Path / Future Work

Add owner-side configuration sanity warnings in the UI (e.g., "your current mandate would block all TSLA trades because the daily limit is 0"). These are assist-only (T4) and do not affect on-chain enforcement.
