// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./Enums.sol";

struct Action {
    uint16 actionSchemaVersion;
    address account;
    uint256 nonce;
    ActionType actionType;
    address assetIn;
    uint256 amountIn;
    address assetOut;
    uint256 minAmountOut;
    address adapter;
    address recipient;
    uint64 deadline;
}

// ADR-0010: no account field
struct PriceData {
    address asset;
    uint256 priceUSDG1e18;
    uint64 timestamp;
    uint64 validUntil;
    bytes signature;
}

// ADR-0006: no actionHash field
struct Decision {
    DecisionStatus status;
    uint64 mandateVersion;
    uint64 submittedAt;
    uint64 expiresAt;
    bytes32 priceDigest;
    uint64 priceTimestamp;
}

struct SessionKey {
    bool enabled;
    uint64 validUntil;
    uint8 allowedActionTypes;
    uint256 maxAmountInPerAction;
    bytes32 scopeHash;
}

struct MandateConfig {
    uint64 mandateVersion;
    uint16 maxSingleAssetExposureBps;
    uint256 maxTradeSizeUSDG;
    uint16 maxDailyTurnoverBps;
    uint64 cooldownSeconds;
}

struct EvalInput {
    Action action;
    bool assetInAllowed;
    bool assetOutAllowed;
    bool adapterAllowed;
    MandateConfig mandate;
    address[] assets;
    uint256[] balances;
    uint256[] pricesUSDG1e18;
    uint256 dailyTurnoverUsedUSDG;
    uint64 lastTradeTimestamp;
    uint64 nowTimestamp;
}
