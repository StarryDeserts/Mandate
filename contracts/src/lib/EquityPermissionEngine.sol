// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {IEquityPermissionEngine} from "../interfaces/IEquityPermissionEngine.sol";
import {ReasonCode} from "../types/Enums.sol";
import {EvalInput} from "../types/Types.sol";

contract EquityPermissionEngine is IEquityPermissionEngine {
    uint256 private constant USDG_SCALE = 1e18;
    uint256 private constant BPS_DENOMINATOR = 10_000;

    struct Valuation {
        uint256 totalValueUSDG;
        uint256 assetInValueUSDG;
        uint256 assetOutValueUSDG;
        uint256 assetInPriceUSDG1e18;
        bool foundAssetIn;
        bool foundAssetOut;
    }

    /// @dev Decision priority: asset allowlist, adapter allowlist, price data, exposure, trade size, turnover, cooldown.
    function evaluate(EvalInput calldata input)
        external
        pure
        override
        returns (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps)
    {
        if (!input.assetInAllowed || !input.assetOutAllowed) {
            return (ReasonCode.ASSET_NOT_ALLOWED, 0, 0);
        }

        if (!input.adapterAllowed) {
            return (ReasonCode.ADAPTER_NOT_ALLOWED, 0, 0);
        }

        (bool priceDataPresent, Valuation memory valuation) = _valuePortfolio(input);
        if (!priceDataPresent) {
            return (ReasonCode.PRICE_STALE, 0, 0);
        }

        uint256 tradeValueUSDG = Math.mulDiv(input.action.amountIn, valuation.assetInPriceUSDG1e18, USDG_SCALE);
        (uint256 postAssetOutValueUSDG, uint256 postTotalValueUSDG) =
            _postExposureValues(input, valuation, tradeValueUSDG);
        preExposureBps = _exposureBps(valuation.assetOutValueUSDG, valuation.totalValueUSDG);
        postExposureBps = _exposureBps(postAssetOutValueUSDG, postTotalValueUSDG);

        if (_exposureExceeded(postAssetOutValueUSDG, postTotalValueUSDG, input.mandate.maxSingleAssetExposureBps)) {
            return (ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED, preExposureBps, postExposureBps);
        }

        if (tradeValueUSDG > input.mandate.maxTradeSizeUSDG) {
            return (ReasonCode.TRADE_SIZE_EXCEEDED, preExposureBps, postExposureBps);
        }

        if (_turnoverExceeded(input, valuation.totalValueUSDG, tradeValueUSDG)) {
            return (ReasonCode.DAILY_TURNOVER_EXCEEDED, preExposureBps, postExposureBps);
        }

        if (
            input.mandate.cooldownSeconds != 0 && input.lastTradeTimestamp != 0
                && uint256(input.nowTimestamp)
                    < uint256(input.lastTradeTimestamp) + uint256(input.mandate.cooldownSeconds)
        ) {
            return (ReasonCode.COOLDOWN_ACTIVE, preExposureBps, postExposureBps);
        }

        return (ReasonCode.OK, preExposureBps, postExposureBps);
    }

    function _valuePortfolio(EvalInput calldata input) private pure returns (bool ok, Valuation memory valuation) {
        uint256 assetCount = input.assets.length;
        if (assetCount != input.balances.length || assetCount != input.pricesUSDG1e18.length) {
            return (false, valuation);
        }

        for (uint256 i = 0; i < assetCount; ++i) {
            address asset = input.assets[i];
            if (i != 0 && asset <= input.assets[i - 1]) {
                return (false, valuation);
            }

            uint256 priceUSDG1e18 = input.pricesUSDG1e18[i];
            if (priceUSDG1e18 == 0) {
                return (false, valuation);
            }

            uint256 valueUSDG = Math.mulDiv(input.balances[i], priceUSDG1e18, USDG_SCALE);
            valuation.totalValueUSDG += valueUSDG;

            if (asset == input.action.assetIn) {
                valuation.foundAssetIn = true;
                valuation.assetInPriceUSDG1e18 = priceUSDG1e18;
                valuation.assetInValueUSDG += valueUSDG;
            }

            if (asset == input.action.assetOut) {
                valuation.foundAssetOut = true;
                valuation.assetOutValueUSDG += valueUSDG;
            }
        }

        return (valuation.foundAssetIn && valuation.foundAssetOut, valuation);
    }

    function _postExposureValues(EvalInput calldata input, Valuation memory valuation, uint256 tradeValueUSDG)
        private
        pure
        returns (uint256 postAssetOutValueUSDG, uint256 postTotalValueUSDG)
    {
        if (input.action.assetIn == input.action.assetOut) {
            return (valuation.assetOutValueUSDG, valuation.totalValueUSDG);
        }

        uint256 assetInReductionUSDG =
            tradeValueUSDG > valuation.assetInValueUSDG ? valuation.assetInValueUSDG : tradeValueUSDG;
        postTotalValueUSDG = valuation.totalValueUSDG - assetInReductionUSDG + tradeValueUSDG;
        postAssetOutValueUSDG = valuation.assetOutValueUSDG + tradeValueUSDG;
    }

    function _turnoverExceeded(EvalInput calldata input, uint256 totalValueUSDG, uint256 tradeValueUSDG)
        private
        pure
        returns (bool)
    {
        uint256 allowedDailyTurnoverUSDG =
            Math.mulDiv(totalValueUSDG, input.mandate.maxDailyTurnoverBps, BPS_DENOMINATOR);

        return input.dailyTurnoverUsedUSDG > allowedDailyTurnoverUSDG
            || tradeValueUSDG > allowedDailyTurnoverUSDG - input.dailyTurnoverUsedUSDG;
    }

    function _exposureExceeded(uint256 assetValueUSDG, uint256 totalValueUSDG, uint16 maxExposureBps)
        private
        pure
        returns (bool)
    {
        if (totalValueUSDG == 0) {
            return false;
        }

        return Math.mulDiv(assetValueUSDG, BPS_DENOMINATOR, totalValueUSDG, Math.Rounding.Ceil) > maxExposureBps;
    }

    function _exposureBps(uint256 assetValueUSDG, uint256 totalValueUSDG) private pure returns (uint16) {
        if (totalValueUSDG == 0) {
            return 0;
        }

        return uint16(Math.mulDiv(assetValueUSDG, BPS_DENOMINATOR, totalValueUSDG));
    }
}
