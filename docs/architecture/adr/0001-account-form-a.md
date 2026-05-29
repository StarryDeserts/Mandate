# ADR-0001 — Account Form = A (Minimal Self-Built Guarded Account)

## Status

Accepted (MVP)

## Context

Robinhood Chain testnet ERC-4337 infrastructure availability is unknown and cannot be a hard dependency for a demo whose judging criteria center on demo stability and contract quality. Choosing an account form that relies on external bundler/paymaster infrastructure risks demo failure on factors outside the team's control. Three forms were evaluated: A (self-built guarded account where the account contract is also the vault, with owner and session-key roles), B (ERC-4337 account abstraction with session key via validateUserOp), and C (EOA approval model where an EOA approves a vault to spend on its behalf). The decision must minimize external dependencies and maximize the auditable surface area of on-chain enforcement.

## Decision

MVP uses Form A: a self-built contract account where the contract is both the account and the vault, holding assets directly. Two roles are recognized — owner and session key. Form B (4337 + session key) is deferred to the post-MVP roadmap. Form C (EOA allowance/vault) is rejected outright.

## Alternatives Considered

**Form B (ERC-4337 + session key):** Depends on unknown external bundler/paymaster infrastructure on the testnet, introducing a hard liveness dependency outside the team's control. Additionally, the `validateUserOp` entrypoint enlarges the escape surface since any validateUserOp logic error could allow unauthorized operations. Deferred as a production-grade future shell (see ADR-0005).

**Form C (EOA allowance + vault):** Breaks the unique-asset-path property because the EOA can still transact independently via other approvals. Valuation becomes unreliable since portfolio balance cannot be isolated to a single account. This form also risks fake risk-control — the appearance of safety without the enforcement. Rejected permanently.

## Consequences

**Positive:** Zero external infrastructure dependencies; smallest possible audit surface; session-key powers are provable by simply counting the functions accessible to the session-key role.

**Negative:** No gasless transactions and no ERC-4337 narrative in the MVP demo. The session key must hold ETH to pay its own gas.

## Migration Path / Future Work

Form B is the intended production-grade successor (see ADR-0005). The A→B migration path is explicitly designed as a source-level reuse of gate, Action schema, Engine, Registry, and Adapter interfaces — not an in-place proxy upgrade. Funds migrate via owner-controlled `withdraw`.
