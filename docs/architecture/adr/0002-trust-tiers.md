# ADR-0002 — Trust-Minimized Enforcement Path + Trust Tiers T0–T4

## Status

Accepted

## Context

The system must clearly distinguish on-chain strong guarantees from trust assumptions. Without a shared vocabulary, threat modeling becomes ambiguous and claims of safety are either misleading or unverifiable. The core demo claim — "full off-chain compromise leads to at most proposing actions within the mandate" — requires careful articulation of what "off-chain compromise" means and what conditions it depends on. In particular, if the price signer shares infrastructure with the AI or backend, the independence claim collapses.

## Decision

Contracts form an "enforcement domain" whose trust basis rests on three properties: code is auditable, permissions are enumerable, and the asset path is unique (assets only leave via audited paths). Everything in the system is classified into one of five trust tiers:

- **T0 — On-chain strong guarantee:** enforced by contract code, no human can override without a transaction auditable on-chain.
- **T1 — Owner:** trusted by protocol assumption; the owner is the user who deployed or controls the account.
- **T2 — Price signer:** the off-chain entity that signs price attestations; must be independent of the AI/backend for the core security claim to hold.
- **T3 — Adapter:** the external DEX/swap adapter contract; assumed honest for the duration of a single trade but subject to owner whitelisting.
- **T4 — Frontend / Backend / AI:** assist-only; never a security guarantee; a full compromise of T4 at most results in proposals within the mandate.

The core claim "full off-chain compromise → at most propose within mandate" holds CONDITIONAL on T2 (price signer independent of AI/backend).

## Alternatives Considered

**Vaguely calling contracts "trusted":** Misleading because it does not distinguish what is enforced by code versus what is assumed. Rejected.

**Two-tier on/off-chain:** Hides the T2/T3 distinction, which is critical for honest threat modeling. An auditor or judge cannot understand the residual trust without seeing T2 called out explicitly.

## Consequences

**Positive:** Provides a shared vocabulary for all threat modeling discussions; ensures the team honestly labels T2 and T3 assumptions in demo materials and documentation.

**Negative:** Must explicitly disclose that T2 (price signer) and T3 (adapter) are weak assumptions in the current demo, which requires intellectual honesty in all marketing materials.

## Migration Path / Future Work

Strengthen T2 by replacing the SignedDemoPriceFeed with a decentralized oracle (e.g., Chainlink, Pyth). Strengthen T3 by deploying and auditing multiple adapters, and adding per-adapter spending limits.
