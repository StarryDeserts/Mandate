# Architecture Decision Records — Index

This directory contains all Architecture Decision Records (ADRs) for the Mandate Account project.

ADRs marked **[ANTI-REGRESSION]** document decisions that explicitly guard against regressions or past mistakes. These must not be reversed without a full re-review and a superseding ADR.

| ADR | Title | Status | Anti-Regression |
|-----|-------|--------|-----------------|
| [0001](0001-account-form-a.md) | Account Form = A (Minimal Self-Built Guarded Account) | Accepted (MVP) | |
| [0002](0002-trust-tiers.md) | Trust-Minimized Enforcement Path + Trust Tiers T0–T4 | Accepted | |
| [0003](0003-two-path-submit-execute.md) | Two-Path Decision/Execution; Review Off-Chain | Accepted | |
| [0004](0004-role-actor-abstraction.md) | Role/Actor Abstraction; Gate Never Reads msg.sender; 6 Layers | Accepted | |
| [0005](0005-a-to-b-migration.md) | A→B = Source-Level Reuse + Owner Migration (No Proxy) | Accepted | |
| [0006](0006-action-id-single-hash.md) | actionId Single Hash; Mapping Key = actionId; Drop Decision.actionHash | Accepted | **[ANTI-REGRESSION]** |
| [0007](0007-schema-vs-mandate-version.md) | actionSchemaVersion vs mandateVersion (Separate) | Accepted | |
| [0008](0008-nonce-monotonic.md) | Nonce Monotonic Model | Accepted | |
| [0009](0009-execute-full-revalidation.md) | executeAction Full Re-Validation (10 Conditions) | Accepted | |
| [0010](0010-price-trust-model.md) | Price Trust Model + PriceData Signing; Account Binding Belongs to Action | Accepted | **[ANTI-REGRESSION]** |
| [0011](0011-prices-array-discipline.md) | prices[] Array Discipline | Accepted | |
| [0012](0012-enumerable-allowedassetslist.md) | Enumerable allowedAssetsList (Not Mapping-Only) | Accepted | **[ANTI-REGRESSION]** |
| [0013](0013-portfolio-basis-balanceof.md) | Portfolio Basis = balanceOf; Affects Risk Envelope Not Custody | Accepted | **[ANTI-REGRESSION]** |
| [0014](0014-daily-turnover-utc-day.md) | Daily Turnover = UTC Day Bucket | Accepted | |
| [0015](0015-session-key-honest-enforcement.md) | SessionKey Honest Enforcement | Accepted | |
| [0016](0016-owner-exit-withdraw-only.md) | Owner Exit = withdraw Only; migrateTo NOT in MVP | Accepted | **[ANTI-REGRESSION]** |
| [0017](0017-fail-safe-default-deny.md) | Fail-Safe = Default-Deny | Accepted | |
| [0018](0018-adapter-containment.md) | Adapter Containment | Accepted | |

## Anti-Regression ADRs Summary

The five anti-regression ADRs (bolded above) document decisions that guard against specific dangerous patterns:

- **ADR-0006:** Prevents approval borrowing attacks via consistent single-hash action identity.
- **ADR-0010:** Prevents cross-oracle and cross-account price replay attacks.
- **ADR-0012:** Ensures portfolio valuation can enumerate all valued assets without trusting external input.
- **ADR-0013:** Clarifies that `balanceOf`-based portfolio valuation affects risk envelope only, not custody.
- **ADR-0016:** Prevents the introduction of a second full-exit path (`migrateTo`) without full re-review.
