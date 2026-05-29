# Enforcement Matrix — Mandate Account

This document describes which fields and features are enforced on-chain versus reserved for future milestones, and provides the trust-tier mapping for all actors in the system. This is the authoritative reference for judges, auditors, and users evaluating what the MVP actually guarantees.

---

## SessionKey Field Enforcement

The `SessionKey` struct contains fields for both MVP enforcement and future reserved scope. Fields marked RESERVED are stored as zero on all deployed accounts (the contract rejects non-zero values — see ADR-0015).

| Field | Status | Enforcement Basis | Notes |
|-------|--------|-------------------|-------|
| `enabled` | **ENFORCED** | On-chain (chain) | Checked on every submit/execute call. Disabled session key cannot act. |
| `validUntil` | **ENFORCED** | On-chain (chain) | Checked on every submit/execute call. Expired session key cannot act. |
| `allowedActionTypes` | **RESERVED** | Not enforced in MVP | MVP allows SWAP only by construction (no other action types exist). `addSessionKey` rejects non-zero values. |
| `maxAmountInPerAction` | **RESERVED** | Not enforced in MVP | Trade size is capped by `mandate.maxTradeSizeUSDG` (a global mandate limit). `addSessionKey` rejects non-zero values. |
| `scopeHash` | **RESERVED** | Not enforced in MVP | No scope hashing in MVP. `addSessionKey` rejects non-zero values. |

**Reference:** ADR-0015 (SessionKey Honest Enforcement)

**Key property:** Because `addSessionKey` reverts on non-zero reserved fields, it is impossible for any session key stored on a deployed MVP account to imply an unenforced policy. The honesty is enforced by construction, not by documentation alone.

---

## Trust-Tier Mapping

The following table maps every actor in the system to a trust tier. Security properties in each tier depend on the trust basis shown.

| Tier | Actor(s) | Trust Basis | Security Claim |
|------|----------|-------------|----------------|
| **T0** | Smart contracts (MandateAccount, EquityPermissionEngine, ActionLib, SignedDemoPriceFeed) | On-chain code; permissions enumerable; asset path unique | Strong on-chain guarantee — enforced by EVM execution |
| **T1** | Account owner | Protocol assumption — the deployer/controller | Owner commands are trusted by design; owner can expand or contract the mandate |
| **T2** | Price signer | Off-chain key; MUST be independent of AI and backend | Price attestations are signed and verified on-chain; if compromised independently, worst case is stale/wrong price within the signed window — mandate limits still apply |
| **T3** | Adapter (DEX contract) | External whitelisted contract | Bounded by exact approval per trade + output post-check; compromise yields at most one trade's amountIn loss |
| **T4** | Frontend / Backend / AI session | Assist-only; no on-chain security guarantee | Full T4 compromise → at most propose actions within the current mandate; NEVER custody; all enforcement is T0 |

**Core claim (conditional):** Full off-chain compromise (T4 fully compromised) results in at most proposals within the mandate, CONDITIONAL on T2 (price signer) being independent of the AI/backend stack. If the price signer were compromised along with T4, the attacker could submit actions with crafted prices. The mandate's exposure and trade-size limits would still apply, but price-based calculations would be unreliable.

---

## Demo-Numbers Integrity Note

This section documents a deliberate integrity decision regarding the demo scenario numbers.

### The Problem

The original buildathon pitch described two demo actions:
1. A 500-USDG TSLA buy that is dangerous (TSLA exposure would go from ~32% to ~58%).
2. An 80-USDG TSLA buy that is safe (stays under a 35% cap).

A naive implementation might hardcode these numbers in the UI. However, a USDG→TSLA swap conserves total portfolio value — buying TSLA with USDG does not change the total USD value of the portfolio, only its composition. The exact numbers "TSLA 32%→58% on a 500-USDG buy" AND "80 USDG safe under a 35% cap" are not simultaneously satisfiable with a consistent portfolio state. The safe-alternative amount depends on the current portfolio composition and TSLA price, not on a hardcoded constant.

### The Decision

The UI shows **honestly computed** exposures and the safe-alternative amount is **computed from the exposure bound by the engine**, never hardcoded. The formula is:

```
safeAmount = max(0, (maxExposureFraction * totalPortfolioValueUSDG - currentTSLAValueUSDG) / (1 + maxExposureFraction * (priceUSDGperTSLA - 1) / priceUSDGperTSLA))
```

(Simplified: the maximum additional TSLA purchase that keeps TSLA exposure at or below the mandate cap, given current portfolio and price.)

### Block Reason Ordering

The 500-USDG dangerous action is blocked with reason `SINGLE_ASSET_EXPOSURE_EXCEEDED`. This is because the engine checks exposure before trade size — if both conditions would fail, the engine returns the first failing check in priority order (exposure before size). This ordering is consistent with the intent: exposure is the primary portfolio risk metric.

### Why This Matters

This is a deliberate integrity choice consistent with the project's anti-fake-architecture stance. Demo scenarios that hardcode numbers that cannot be simultaneously satisfied would undermine the credibility of the system as a genuine risk-control demonstration. The correct behavior is to show honestly computed numbers that change as the portfolio composition changes — demonstrating that the engine is actually running, not simulating a pre-scripted output.
