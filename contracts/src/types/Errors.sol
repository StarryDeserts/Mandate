// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Enums.sol";

// ---------------------------------------------------------------------------
// Submit-path errors (garbage / unauthorized input)
// ---------------------------------------------------------------------------

/// Caller does not hold the required role.
error NotAuthorized(Role role);

/// Action.account does not match the target account contract.
error WrongAccount(address expected, address got);

/// Action uses an unrecognised schema version.
error BadActionSchema(uint16 expected, uint16 got);

/// Action nonce is not the next expected nonce.
error BadNonce(uint256 expected, uint256 got);

/// Action deadline has already passed.
error DeadlinePassed(uint64 deadline);

/// Price attestation for the given asset could not be verified.
error PriceUnverified(address asset);

/// The session key has expired.
error SessionExpired(address key);

// ---------------------------------------------------------------------------
// Execute-path errors (re-validation failures)
// ---------------------------------------------------------------------------

/// The action hash on re-entry does not match the stored digest.
error ActionHashMismatch(bytes32 expected, bytes32 got);

/// The stored decision is not in APPROVED state.
error NotApproved(bytes32 actionId, DecisionStatus status);

/// The approval window for the action has passed.
error ApprovalExpired(bytes32 actionId, uint64 expiresAt);

/// MandateConfig changed between approval and execution.
error MandateVersionChanged(uint64 approved, uint64 current);

/// A price used at execute-time is too stale.
error PriceStaleOnExecute(address asset, uint64 timestamp);

/// An asset that was allowed at approve-time is no longer allowed.
error AssetNotAllowedNow(address asset);

/// The adapter that was allowed at approve-time is no longer allowed.
error AdapterNotAllowedNow(address adapter);

/// The recipient is not on the allowlist.
error RecipientNotAllowed(address recipient);

/// EquityPermissionEngine re-validation returned a non-OK reason code.
error ReValidationFailed(ReasonCode code);

/// Post-swap balance check failed: actual output was below the minimum.
error PostCheckFailed(uint256 minOut, uint256 actualOut);

// ---------------------------------------------------------------------------
// Prices discipline errors
// ---------------------------------------------------------------------------

/// The PriceData array is not sorted ascending by asset address, or contains a duplicate.
error UnsortedOrDuplicateAsset(address asset);

/// A required price for the given asset was not supplied.
error MissingPrice(address asset);
