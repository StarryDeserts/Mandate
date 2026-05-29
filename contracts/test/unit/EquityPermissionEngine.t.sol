// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {EquityPermissionEngine} from "../../src/lib/EquityPermissionEngine.sol";
import {ActionType, ReasonCode} from "../../src/types/Enums.sol";
import {Action, EvalInput, MandateConfig} from "../../src/types/Types.sol";

contract EquityPermissionEngineTest is Test {
    address private constant ACCOUNT = address(0xA11CE1);
    address private constant USDG = address(0x1000);
    address private constant TSLA = address(0x2000);
    address private constant AMD = address(0x3000);
    address private constant ADAPTER = address(0x4000);
    address private constant RECIPIENT = address(0x5000);

    EquityPermissionEngine private engine;

    function setUp() public {
        engine = new EquityPermissionEngine();
    }

    function test_exposureOverCapReturnsExposureReasonWithPreAndPostBps() public view {
        EvalInput memory input = _baseInput();
        input.mandate.maxSingleAssetExposureBps = 3_500;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED));
        assertEq(preExposureBps, 3_000);
        assertEq(postExposureBps, 4_000);
    }

    function test_tradeSizeOverCapReturnsTradeSizeWhenExposurePasses() public view {
        EvalInput memory input = _baseInput();
        input.action.amountIn = 60 ether;
        input.mandate.maxSingleAssetExposureBps = 10_000;
        input.mandate.maxTradeSizeUSDG = 50 ether;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.TRADE_SIZE_EXCEEDED));
        assertEq(preExposureBps, 3_000);
        assertEq(postExposureBps, 3_600);
    }

    function test_turnoverOverCapReturnsDailyTurnoverWhenEarlierChecksPass() public view {
        EvalInput memory input = _baseInput();
        input.action.amountIn = 60 ether;
        input.mandate.maxSingleAssetExposureBps = 10_000;
        input.mandate.maxTradeSizeUSDG = 100 ether;
        input.mandate.maxDailyTurnoverBps = 1_000;
        input.dailyTurnoverUsedUSDG = 50 ether;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.DAILY_TURNOVER_EXCEEDED));
        assertEq(preExposureBps, 3_000);
        assertEq(postExposureBps, 3_600);
    }

    function test_cooldownActiveReturnsCooldownWhenEarlierChecksPass() public view {
        EvalInput memory input = _baseInput();
        input.mandate.maxSingleAssetExposureBps = 10_000;
        input.mandate.maxTradeSizeUSDG = 200 ether;
        input.mandate.maxDailyTurnoverBps = 10_000;
        input.mandate.cooldownSeconds = 1 hours;
        input.lastTradeTimestamp = 1_000;
        input.nowTimestamp = 1_200;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.COOLDOWN_ACTIVE));
        assertEq(preExposureBps, 3_000);
        assertEq(postExposureBps, 4_000);
    }

    function test_assetNotAllowedReturnsAssetNotAllowedBeforeValuation() public view {
        EvalInput memory input = _baseInput();
        input.assetOutAllowed = false;
        input.assets = new address[](0);
        input.balances = new uint256[](0);
        input.pricesUSDG1e18 = new uint256[](0);

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.ASSET_NOT_ALLOWED));
        assertEq(preExposureBps, 0);
        assertEq(postExposureBps, 0);
    }

    function test_adapterNotAllowedReturnsAdapterNotAllowedBeforeValuation() public view {
        EvalInput memory input = _baseInput();
        input.adapterAllowed = false;
        input.assets = new address[](0);
        input.balances = new uint256[](0);
        input.pricesUSDG1e18 = new uint256[](0);

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.ADAPTER_NOT_ALLOWED));
        assertEq(preExposureBps, 0);
        assertEq(postExposureBps, 0);
    }

    function test_missingRequiredPriceDataReturnsPriceStaleBeforeExposure() public view {
        EvalInput memory input = _baseInput();
        input.pricesUSDG1e18[1] = 0;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.PRICE_STALE));
        assertEq(preExposureBps, 0);
        assertEq(postExposureBps, 0);
    }

    function test_inBoundsActionReturnsOkWithComputedBps() public view {
        EvalInput memory input = _baseInput();
        input.mandate.maxSingleAssetExposureBps = 5_000;
        input.mandate.maxTradeSizeUSDG = 200 ether;
        input.mandate.maxDailyTurnoverBps = 2_000;
        input.dailyTurnoverUsedUSDG = 50 ether;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.OK));
        assertEq(preExposureBps, 3_000);
        assertEq(postExposureBps, 4_000);
    }

    function test_exposureHasPriorityOverTradeSizeWhenBothFail() public view {
        EvalInput memory input = _baseInput();
        input.mandate.maxSingleAssetExposureBps = 3_500;
        input.mandate.maxTradeSizeUSDG = 50 ether;

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = engine.evaluate(input);

        assertEq(uint8(code), uint8(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED));
        assertEq(preExposureBps, 3_000);
        assertEq(postExposureBps, 4_000);
    }

    function _baseInput() private pure returns (EvalInput memory input) {
        input.action = Action({
            actionSchemaVersion: 1,
            account: ACCOUNT,
            nonce: 1,
            actionType: ActionType.SWAP,
            assetIn: USDG,
            amountIn: 100 ether,
            assetOut: TSLA,
            minAmountOut: 0,
            adapter: ADAPTER,
            recipient: RECIPIENT,
            deadline: 1_800_000_000
        });
        input.assetInAllowed = true;
        input.assetOutAllowed = true;
        input.adapterAllowed = true;
        input.mandate = MandateConfig({
            mandateVersion: 1,
            maxSingleAssetExposureBps: 10_000,
            maxTradeSizeUSDG: 1_000 ether,
            maxDailyTurnoverBps: 10_000,
            cooldownSeconds: 0
        });
        input.assets = new address[](3);
        input.assets[0] = USDG;
        input.assets[1] = TSLA;
        input.assets[2] = AMD;
        input.balances = new uint256[](3);
        input.balances[0] = 600 ether;
        input.balances[1] = 30 ether;
        input.balances[2] = 20 ether;
        input.pricesUSDG1e18 = new uint256[](3);
        input.pricesUSDG1e18[0] = 1 ether;
        input.pricesUSDG1e18[1] = 10 ether;
        input.pricesUSDG1e18[2] = 5 ether;
        input.nowTimestamp = 2_000;
    }
}
