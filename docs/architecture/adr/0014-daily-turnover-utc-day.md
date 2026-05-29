# ADR-0014 — Daily Turnover = UTC Day Bucket

## Status

Accepted

## Context

The mandate needs a simple explainable churn throttle — a limit on total trading volume per day — to prevent an AI session key from making many small trades that collectively exceed a reasonable risk envelope. The implementation must be cheap (low gas) and deterministic (no ambiguity about when a day starts or ends).

## Decision

`day = block.timestamp / 86400` (integer division, UTC). A lazy reset resets the daily turnover counter when the current day differs from the stored day. Turnover is incremented atomically at execute time and re-checked at execute time against the daily limit in the mandate. A single field stores `(lastDay, currentDayTurnover)`.

## Alternatives Considered

**Rolling 24-hour window:** Requires either unbounded storage for trade timestamps or significant gas for maintaining a sliding window. Complex and expensive for the MVP. Deferred.

**Sliding approximation (e.g., TWAP-style weighted average):** Complex to implement correctly and difficult to explain to judges or users. Rejected for the MVP in favor of explainability.

## Consequences

**Positive:** Cheap (one SLOAD, one comparison, one SSTORE per execute) and completely deterministic; easy to explain to users and judges.

**Negative:** The UTC midnight boundary allows approximately 2× the daily limit briefly — a large trade at 23:59 UTC followed by another large trade at 00:01 UTC the next day both count against different day buckets. This must be disclosed clearly. However, per-trade exposure and size limits are still enforced regardless of the day boundary, so this is a throttle window widening, not a theft vector.

## Migration Path / Future Work

Production should use a rolling window or dual-bucket weighted window for a more accurate churn throttle. The `turnover` field can be extended to support this without changing the Action schema.
