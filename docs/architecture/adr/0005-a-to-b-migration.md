# ADR-0005 — A→B = Source-Level Reuse + Owner Migration (No Proxy, No Instance Upgrade)

## Status

Accepted (supersedes earlier "swap front door without migration")

## Context

A plain non-upgradeable contract cannot gain `validateUserOp` without a proxy or a new deployment. The MVP explicitly avoids proxy patterns (for security reasons). The question is: what exactly does the "seam" between A and B promise? An earlier framing implied in-place upgrade, which is technically impossible without a proxy. This ADR clarifies the actual promise.

## Decision

The seam promises only source-level reuse: the gate logic, Action schema, Decision Engine, Registry, Adapter interfaces, and Audit events are all reusable source modules that B imports. The seam does NOT promise in-place upgrade of a deployed A instance. Form B is a newly deployed production shell. Funds migrate via the owner-controlled `withdraw` function. The owner deploys a B account, withdraws from the A account to themselves, and deposits into the new B account.

## Alternatives Considered

**Upgradeable proxy:** Significantly enlarges the attack surface. If the proxy's upgrade mechanism is reachable by the session key (even indirectly), it creates a catastrophic failure mode. Rejected categorically.

**Pre-building AA hooks into the MVP:** Pollutes the MVP with unimplemented or partially-implemented 4337 logic, increasing the audit surface of the demo without delivering any value.

## Consequences

**Positive:** The MVP is simple and non-upgradeable; there is no proxy risk; all layers below Auth are auditable as standalone modules.

**Negative:** A→B migration requires deploying a new account and manually migrating funds. This is a one-time event that is rare and acceptable for the scenarios described.

## Migration Path / Future Work

Form B reuses all types and interfaces from Form A unchanged. The migration procedure is: (1) owner deploys a new B-form account, (2) owner calls `withdraw` on the A account to transfer assets to themselves, (3) owner deposits into the B account. The B shell's `validateUserOp` produces the same `ActorContext` used by all layers.
