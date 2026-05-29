# ADR-0013 — (ANTI-REGRESSION) Portfolio Basis = balanceOf; Affects Risk Envelope Not Custody

## Status

Accepted — **ANTI-REGRESSION**

## Context

Anyone can call `transfer` on an ERC20 token to send tokens to any address, including the `MandateAccount`. If the contract uses only internally tracked deposit accounting, unsolicited transfers are ignored and the actual balance diverges from the tracked balance. If the contract uses `balanceOf`, unsolicited transfers inflate the portfolio value (denominator), potentially allowing a larger absolute trade than intended. However, the critical question is: can an external donation cause theft? The answer depends on whether the recipient of trades can be changed.

## Decision

MVP portfolio valuation uses `balanceOf(account)` over the enumerable valued asset set (ADR-0012). The system accepts that external donations (ERC20 transfers from anyone) can shift the allowed-trade envelope by increasing the portfolio value denominator. Critically, this cannot cause theft because `recipient == account` is a hard enforcement condition (ADR-0009, condition 8), so no donation can create an out-path for assets. Non-allowlisted token dust is ignored (not in the valued set). This trade-off must be clearly documented.

## Alternatives Considered

**Internal deposit accounting (shadow balance):** More code complexity; prevents denominator manipulation by donations; deferred to production as the more robust approach.

**Owner-confirmed deposits:** Adds friction to normal operation and is complex for the MVP. Deferred.

## Consequences

**Positive:** Simple implementation with no separate accounting layer; no bookkeeping bugs possible.

**Negative:** A donor can nudge the exposure percentage slightly by sending allowed tokens to the account — this gifts funds to the owner (the account holder) and is categorically non-theft. This must be documented clearly in the demo to prevent misunderstanding.

## Migration Path / Future Work

Production should switch to internal deposit accounting (owner-confirmed deposits) so that unsolicited transfers are ignored in the exposure calculation. This change is backward-compatible at the interface level.
