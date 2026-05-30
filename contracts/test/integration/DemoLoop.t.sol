// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {ApprovedSwapAdapter} from "../../src/adapters/ApprovedSwapAdapter.sol";
import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";
import {MandateAccount} from "../../src/MandateAccount.sol";
import {MockAMM} from "../../src/mocks/MockAMM.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ActionType, DecisionStatus, ReasonCode, Role} from "../../src/types/Enums.sol";
import {Action, MandateConfig, PriceData, SessionKey} from "../../src/types/Types.sol";

contract DemoPriceOracle is IPriceOracle {
    address public constant PRICE_SIGNER = address(0x51A9E2);
    uint64 public constant MAX_STALENESS = 1 hours;

    function getPrice(address asset, PriceData calldata att, address)
        external
        pure
        returns (uint256 priceUSDG1e18, uint64 timestamp)
    {
        require(att.asset == asset, "wrong asset");

        priceUSDG1e18 = att.priceUSDG1e18;
        timestamp = att.timestamp;
    }

    function maxStaleness() external pure returns (uint64) {
        return MAX_STALENESS;
    }

    function signer() external pure returns (address) {
        return PRICE_SIGNER;
    }
}

contract DemoLoopTest is Test {
    event ActionSubmitted(bytes32 indexed actionId, address indexed actor, Role role, DecisionStatus status);
    event ActionBlocked(
        bytes32 indexed actionId,
        ReasonCode reason,
        uint16 preExposureBps,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    );
    event ActionApproved(
        bytes32 indexed actionId,
        uint64 expiresAt,
        uint16 preExposureBps,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    );
    event ActionExecuted(
        bytes32 indexed actionId,
        uint256 amountIn,
        uint256 amountOut,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    );

    bytes32 private constant ACTION_BLOCKED_TOPIC =
        keccak256("ActionBlocked(bytes32,uint8,uint16,uint16,bytes32,uint64)");
    bytes32 private constant ACTION_APPROVED_TOPIC =
        keccak256("ActionApproved(bytes32,uint64,uint16,uint16,bytes32,uint64)");
    bytes32 private constant ACTION_EXECUTED_TOPIC =
        keccak256("ActionExecuted(bytes32,uint256,uint256,uint16,bytes32,uint64)");

    uint256 private constant USDG_BALANCE = 1_000 ether;
    uint256 private constant TSLA_BALANCE = 235 ether;
    uint256 private constant TSLA_PRICE = 2 ether;
    uint256 private constant USDG_TO_TSLA_RATE = 0.5 ether;
    uint256 private constant DANGEROUS_AMOUNT = 500 ether;
    uint256 private constant MAX_TRADE_SIZE = 200 ether;
    uint16 private constant MAX_TSLA_EXPOSURE_BPS = 3_500;
    uint16 private constant MAX_DAILY_TURNOVER_BPS = 2_000;

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);

    MandateAccount private account;
    MockERC20 private usdg;
    MockERC20 private tsla;
    MockAMM private amm;
    ApprovedSwapAdapter private adapter;
    DemoPriceOracle private oracle;

    function setUp() public {
        vm.warp(10_000);

        usdg = new MockERC20("Mock USDG", "mUSDG");
        tsla = new MockERC20("Mock TSLA", "mTSLA");
        amm = new MockAMM();
        adapter = new ApprovedSwapAdapter(amm);
        account = new MandateAccount(OWNER, address(usdg));
        oracle = new DemoPriceOracle();

        usdg.mint(address(account), USDG_BALANCE);
        tsla.mint(address(account), TSLA_BALANCE);
        tsla.mint(address(amm), 10_000 ether);
        amm.setRate(address(usdg), address(tsla), USDG_TO_TSLA_RATE);

        vm.startPrank(OWNER);
        account.setMandate(
            MandateConfig({
                mandateVersion: 0,
                maxSingleAssetExposureBps: MAX_TSLA_EXPOSURE_BPS,
                maxTradeSizeUSDG: MAX_TRADE_SIZE,
                maxDailyTurnoverBps: MAX_DAILY_TURNOVER_BPS,
                cooldownSeconds: 0
            })
        );
        account.setAdapterAllowed(address(adapter), true);
        account.registerPriceOracle(oracle);
        _allowAssetsInReverseAddressOrder();
        account.addSessionKey(SESSION, _sessionKey(true, uint64(block.timestamp + 1 hours)));
        vm.stopPrank();
    }

    struct BlockedAudit {
        bytes32 actionId;
        uint16 preExposureBps;
        uint16 postExposureBps;
    }

    struct ApprovedAudit {
        Action action;
        bytes32 actionId;
        uint256 safeAmount;
        uint16 preExposureBps;
        uint16 postExposureBps;
        uint64 expiresAt;
    }

    function test_demoLoopBlocksDangerousSessionBuyThenExecutesComputedSafeAlternative() public {
        PriceData[] memory prices = _freshPrices();
        bytes32 priceDigest = keccak256(abi.encode(prices));
        uint64 priceTimestamp = prices[0].timestamp;

        vm.recordLogs();
        BlockedAudit memory blocked = _submitDangerousAction(prices, priceDigest, priceTimestamp);
        ApprovedAudit memory approved =
            _submitComputedSafeAction(prices, priceDigest, priceTimestamp, blocked.preExposureBps);
        uint256 amountOut = _executeSafeAction(approved, prices, priceDigest, priceTimestamp);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        _assertActionBlockedLog(
            entries,
            blocked.actionId,
            ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED,
            blocked.preExposureBps,
            blocked.postExposureBps,
            priceDigest,
            priceTimestamp
        );
        _assertActionApprovedLog(
            entries,
            approved.actionId,
            approved.expiresAt,
            approved.preExposureBps,
            approved.postExposureBps,
            priceDigest,
            priceTimestamp
        );
        _assertActionExecutedLog(
            entries,
            approved.actionId,
            approved.safeAmount,
            amountOut,
            approved.postExposureBps,
            priceDigest,
            priceTimestamp
        );
    }

    function _submitDangerousAction(PriceData[] memory prices, bytes32 priceDigest, uint64 priceTimestamp)
        private
        returns (BlockedAudit memory blocked)
    {
        {
            Action memory dangerousAction = _buyTslaAction(DANGEROUS_AMOUNT, account.nextNonce());
            (ReasonCode dangerousPreview, uint16 preExposureBps, uint16 dangerousPostExposureBps) =
                account.previewAction(dangerousAction, prices);

            assertEq(uint8(dangerousPreview), uint8(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED));
            assertEq(preExposureBps, 3_197);
            assertGt(dangerousPostExposureBps, MAX_TSLA_EXPOSURE_BPS);

            blocked = BlockedAudit({
                actionId: account.computeActionId(dangerousAction),
                preExposureBps: preExposureBps,
                postExposureBps: dangerousPostExposureBps
            });
            uint256 nonceBefore = account.nextNonce();
            vm.expectEmit(true, true, false, true, address(account));
            emit ActionSubmitted(blocked.actionId, SESSION, Role.SESSION, DecisionStatus.BLOCKED);
            vm.expectEmit(true, false, false, true, address(account));
            emit ActionBlocked(
                blocked.actionId,
                ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED,
                blocked.preExposureBps,
                blocked.postExposureBps,
                priceDigest,
                priceTimestamp
            );

            vm.prank(SESSION);
            (bytes32 returnedActionId, ReasonCode code, uint16 blockedPreBps, uint16 blockedPostBps) =
                account.submitAction(dangerousAction, prices);

            assertEq(returnedActionId, blocked.actionId);
            assertEq(uint8(code), uint8(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED));
            assertEq(blockedPreBps, blocked.preExposureBps);
            assertEq(blockedPostBps, blocked.postExposureBps);
            assertEq(account.nextNonce(), nonceBefore + 1);
        }

        _assertDecision(
            blocked.actionId,
            DecisionStatus.BLOCKED,
            account.mandateVersion(),
            uint64(block.timestamp),
            0,
            priceDigest,
            priceTimestamp
        );
    }

    function _submitComputedSafeAction(
        PriceData[] memory prices,
        bytes32 priceDigest,
        uint64 priceTimestamp,
        uint16 expectedPreExposureBps
    ) private returns (ApprovedAudit memory approved) {
        uint64 mandateVersion;
        {
            MandateConfig memory mandate = account.getMandate();
            mandateVersion = mandate.mandateVersion;
            approved.safeAmount =
                _largestSafeBuyAmount(_min(mandate.maxTradeSizeUSDG, usdg.balanceOf(address(account))), prices);
            assertGt(approved.safeAmount, 0);
            assertLe(approved.safeAmount, mandate.maxTradeSizeUSDG);

            approved.action = _buyTslaAction(approved.safeAmount, account.nextNonce());
            ReasonCode safePreview;
            (safePreview, approved.preExposureBps, approved.postExposureBps) =
                account.previewAction(approved.action, prices);
            assertEq(uint8(safePreview), uint8(ReasonCode.OK));
            assertEq(approved.preExposureBps, expectedPreExposureBps);
            assertLe(approved.postExposureBps, mandate.maxSingleAssetExposureBps);

            approved.actionId = account.computeActionId(approved.action);
            approved.expiresAt = uint64(block.timestamp) + account.APPROVAL_TTL();
            uint256 nonceBefore = account.nextNonce();
            vm.expectEmit(true, true, false, true, address(account));
            emit ActionSubmitted(approved.actionId, SESSION, Role.SESSION, DecisionStatus.APPROVED);
            vm.expectEmit(true, false, false, true, address(account));
            emit ActionApproved(
                approved.actionId,
                approved.expiresAt,
                approved.preExposureBps,
                approved.postExposureBps,
                priceDigest,
                priceTimestamp
            );

            vm.prank(SESSION);
            (bytes32 returnedActionId, ReasonCode code, uint16 approvedPreBps, uint16 approvedPostBps) =
                account.submitAction(approved.action, prices);

            assertEq(returnedActionId, approved.actionId);
            assertEq(uint8(code), uint8(ReasonCode.OK));
            assertEq(approvedPreBps, approved.preExposureBps);
            assertEq(approvedPostBps, approved.postExposureBps);
            assertEq(account.nextNonce(), nonceBefore + 1);
        }

        _assertDecision(
            approved.actionId,
            DecisionStatus.APPROVED,
            mandateVersion,
            uint64(block.timestamp),
            approved.expiresAt,
            priceDigest,
            priceTimestamp
        );
    }

    function _executeSafeAction(
        ApprovedAudit memory approved,
        PriceData[] memory prices,
        bytes32 priceDigest,
        uint64 priceTimestamp
    ) private returns (uint256 amountOut) {
        {
            uint256 usdgBefore = usdg.balanceOf(address(account));
            uint256 tslaBefore = tsla.balanceOf(address(account));
            uint256 expectedAmountOut = approved.safeAmount / 2;

            vm.expectEmit(true, false, false, true, address(account));
            emit ActionExecuted(
                approved.actionId,
                approved.safeAmount,
                expectedAmountOut,
                approved.postExposureBps,
                priceDigest,
                priceTimestamp
            );

            vm.prank(SESSION);
            amountOut = account.executeAction(approved.action, prices);

            assertEq(amountOut, expectedAmountOut);
            assertEq(usdg.balanceOf(address(account)), usdgBefore - approved.safeAmount);
            assertEq(tsla.balanceOf(address(account)), tslaBefore + expectedAmountOut);
            assertEq(tsla.balanceOf(address(amm)), 10_000 ether - expectedAmountOut);
            assertEq(usdg.balanceOf(address(amm)), approved.safeAmount);
            assertEq(IERC20(address(usdg)).allowance(address(account), address(adapter)), 0);
            assertEq(IERC20(address(usdg)).allowance(address(adapter), address(amm)), 0);
            assertEq(account.dailyTurnoverUsedUSDG(), approved.safeAmount);
        }

        _assertDecision(
            approved.actionId,
            DecisionStatus.EXECUTED,
            account.mandateVersion(),
            uint64(block.timestamp),
            approved.expiresAt,
            priceDigest,
            priceTimestamp
        );
    }

    function _largestSafeBuyAmount(uint256 upperBound, PriceData[] memory prices)
        private
        view
        returns (uint256 safeAmount)
    {
        uint256 step = 1 ether;
        uint256 candidate = upperBound - (upperBound % step);

        while (candidate != 0) {
            Action memory action = _buyTslaAction(candidate, account.nextNonce());
            (ReasonCode code,, uint16 postExposureBps) = account.previewAction(action, prices);
            if (code == ReasonCode.OK && postExposureBps <= MAX_TSLA_EXPOSURE_BPS) return candidate;
            if (candidate <= step) return 0;
            candidate -= step;
        }
    }

    function _buyTslaAction(uint256 amountIn, uint256 nonce) private view returns (Action memory action) {
        action = Action({
            actionSchemaVersion: 1,
            account: address(account),
            nonce: nonce,
            actionType: ActionType.SWAP,
            assetIn: address(usdg),
            amountIn: amountIn,
            assetOut: address(tsla),
            minAmountOut: amountIn / 2,
            adapter: address(adapter),
            recipient: address(account),
            deadline: uint64(block.timestamp + 1 hours)
        });
    }

    function _freshPrices() private view returns (PriceData[] memory prices) {
        prices = new PriceData[](1);
        prices[0] = PriceData({
            asset: address(tsla),
            priceUSDG1e18: TSLA_PRICE,
            timestamp: uint64(block.timestamp - 100),
            validUntil: uint64(block.timestamp + 1 hours),
            signature: ""
        });
    }

    function _allowAssetsInReverseAddressOrder() private {
        address assetA = address(usdg);
        address assetB = address(tsla);

        if (assetA < assetB) {
            account.setAssetAllowed(assetB, true);
            account.setAssetAllowed(assetA, true);
        } else {
            account.setAssetAllowed(assetA, true);
            account.setAssetAllowed(assetB, true);
        }
    }

    function _sessionKey(bool enabled, uint64 validUntil) private pure returns (SessionKey memory sessionKey) {
        sessionKey = SessionKey({
            enabled: enabled,
            validUntil: validUntil,
            allowedActionTypes: 0,
            maxAmountInPerAction: 0,
            scopeHash: bytes32(0)
        });
    }

    function _assertDecision(
        bytes32 actionId,
        DecisionStatus expectedStatus,
        uint64 expectedMandateVersion,
        uint64 expectedSubmittedAt,
        uint64 expectedExpiresAt,
        bytes32 expectedPriceDigest,
        uint64 expectedPriceTimestamp
    ) private view {
        (
            DecisionStatus status,
            uint64 mandateVersion,
            uint64 submittedAt,
            uint64 expiresAt,
            bytes32 priceDigest,
            uint64 priceTimestamp
        ) = account.decisions(actionId);

        assertEq(uint8(status), uint8(expectedStatus));
        assertEq(mandateVersion, expectedMandateVersion);
        assertEq(submittedAt, expectedSubmittedAt);
        assertEq(expiresAt, expectedExpiresAt);
        assertEq(priceDigest, expectedPriceDigest);
        assertEq(priceTimestamp, expectedPriceTimestamp);
    }

    function _assertActionBlockedLog(
        Vm.Log[] memory entries,
        bytes32 actionId,
        ReasonCode reason,
        uint16 preExposureBps,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    ) private {
        bytes memory expectedData = abi.encode(reason, preExposureBps, postExposureBps, priceDigest, priceTimestamp);

        for (uint256 i; i < entries.length; ++i) {
            if (
                entries[i].emitter == address(account) && entries[i].topics.length == 2
                    && entries[i].topics[0] == ACTION_BLOCKED_TOPIC && entries[i].topics[1] == actionId
                    && keccak256(entries[i].data) == keccak256(expectedData)
            ) {
                return;
            }
        }

        fail("missing ActionBlocked event");
    }

    function _assertActionApprovedLog(
        Vm.Log[] memory entries,
        bytes32 actionId,
        uint64 expiresAt,
        uint16 preExposureBps,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    ) private {
        bytes memory expectedData = abi.encode(expiresAt, preExposureBps, postExposureBps, priceDigest, priceTimestamp);

        for (uint256 i; i < entries.length; ++i) {
            if (
                entries[i].emitter == address(account) && entries[i].topics.length == 2
                    && entries[i].topics[0] == ACTION_APPROVED_TOPIC && entries[i].topics[1] == actionId
                    && keccak256(entries[i].data) == keccak256(expectedData)
            ) {
                return;
            }
        }

        fail("missing ActionApproved event");
    }

    function _assertActionExecutedLog(
        Vm.Log[] memory entries,
        bytes32 actionId,
        uint256 amountIn,
        uint256 amountOut,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    ) private {
        bytes memory expectedData = abi.encode(amountIn, amountOut, postExposureBps, priceDigest, priceTimestamp);

        for (uint256 i; i < entries.length; ++i) {
            if (
                entries[i].emitter == address(account) && entries[i].topics.length == 2
                    && entries[i].topics[0] == ACTION_EXECUTED_TOPIC && entries[i].topics[1] == actionId
                    && keccak256(entries[i].data) == keccak256(expectedData)
            ) {
                return;
            }
        }

        fail("missing ActionExecuted event");
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
