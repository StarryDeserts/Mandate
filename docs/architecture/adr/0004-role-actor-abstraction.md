# ADR-0004 — Role/Actor Abstraction; Gate Never Reads msg.sender; 6 Layers

## Status

Accepted

## Context

If the gate core reads `msg.sender` directly, any change in account form (e.g., A→B migration) requires rewriting the gate logic, introducing error-prone coupling between authentication and authorization. Additionally, scattering `msg.sender` checks across multiple layers makes it difficult to reason about correctness or to test the gate in isolation.

## Decision

The system is organized into 6 layers:

1. **Auth layer:** The only layer that reads `msg.sender`. It produces an `ActorContext { actor: address, role: OWNER | SESSION | NONE }`.
2. **ActionGate layer:** Receives `ActorContext` and enforces role-based access; never reads `msg.sender` directly.
3. **Decision Engine layer:** Evaluates mandate/policy checks against the Action; receives only the processed context.
4. **Execution layer:** Performs the external call (DEX swap) under CEI discipline.
5. **Registry layer:** Maintains allowlists for assets and adapters.
6. **Audit layer:** Emits events and updates persistent decision state.

Only the Auth layer is account-form-specific. All other layers are account-form-agnostic and can be reused verbatim across A and B.

## Alternatives Considered

**msg.sender checks scattered throughout the gate:** When migrating from A to B, every occurrence would need to be updated, and testing in isolation requires complex mock setup. This pattern is rejected as error-prone and untestable.

## Consequences

**Positive:** Authentication is swappable without touching gate logic; the gate is independently testable by injecting different `ActorContext` values; the six-layer structure makes the authorization logic explicit and auditable.

**Negative:** One extra indirection exists between the EVM entry point and the gate logic, adding a small gas overhead and code-reading overhead.

## Migration Path / Future Work

For Form B (ERC-4337), the new shell's `validateUserOp` produces the same `ActorContext` from the `UserOperation`. All layers below Auth are reused without modification.
