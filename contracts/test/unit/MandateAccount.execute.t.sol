// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";

import {ApprovedSwapAdapter} from "../../src/adapters/ApprovedSwapAdapter.sol";
import {MandateAccount} from "../../src/MandateAccount.sol";
import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";
import {MockAMM} from "../../src/mocks/MockAMM.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ActionType, DecisionStatus, ReasonCode, Role} from "../../src/types/Enums.sol";
import {
    AdapterNotAllowedNow,
    ApprovalExpired,
    AssetNotAllowedNow,
    BadActionSchema,
    DeadlinePassed,
    MandateVersionChanged,
    NotApproved,
    NotAuthorized,
    PriceStaleOnExecute,
    RecipientNotAllowed,
    ReValidationFailed,
    SessionExpired,
    WrongAccount
} from "../../src/types/Errors.sol";
import {Action, MandateConfig, PriceData, SessionKey} from "../../src/types/Types.sol";

contract ExecutePriceOracle is IPriceOracle {
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

contract MandateAccountExecuteTest is Test {
    bytes32 private constant ACTION_EXECUTED_TOPIC =
        keccak256("ActionExecuted(bytes32,uint256,uint256,uint16,bytes32,uint64)");
    uint256 private constant USDG_BALANCE = 1_000 ether;
    uint256 private constant TSLA_BALANCE = 100 ether;
    uint256 private constant TSLA_PRICE = 2 ether;
    uint256 private constant USDG_TO_TSLA_RATE = 0.5 ether;

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant STRANGER = address(0xB0B);

    MandateAccount private account;
    MockERC20 private usdg;
    MockERC20 private tsla;
    MockAMM private amm;
    ApprovedSwapAdapter private adapter;
    ExecutePriceOracle private oracle;

    function setUp() public {
        vm.warp(10_000);

        usdg = new MockERC20("Mock USDG", "mUSDG");
        tsla = new MockERC20("Mock TSLA", "mTSLA");
        amm = new MockAMM();
        adapter = new ApprovedSwapAdapter(amm);
        account = new MandateAccount(OWNER, address(usdg));
        oracle = new ExecutePriceOracle();

        usdg.mint(address(account), USDG_BALANCE);
        tsla.mint(address(account), TSLA_BALANCE);
        tsla.mint(address(amm), 1_000 ether);
        amm.setRate(address(usdg), address(tsla), USDG_TO_TSLA_RATE);

        vm.startPrank(OWNER);
        account.setMandate(
            MandateConfig({
                mandateVersion: 0,
                maxSingleAssetExposureBps: 3_500,
                maxTradeSizeUSDG: 1_000 ether,
                maxDailyTurnoverBps: 10_000,
                cooldownSeconds: 0
            })
        );
        account.setAdapterAllowed(address(adapter), true);
        account.registerPriceOracle(oracle);
        _allowAssetsInReverseAddressOrder();
        vm.stopPrank();
    }

    function test_executeApprovedSafeActionMovesAssetsRecordsExecutionAndEmitsEvent() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        PriceData[] memory executePrices = _freshPrices();
        bytes32 actionId = _approveAction(action);
        bytes32 priceDigest = keccak256(abi.encode(executePrices));

        vm.recordLogs();
        vm.prank(OWNER);
        uint256 amountOut = account.executeAction(action, executePrices);

        assertEq(amountOut, 50 ether);
        assertEq(usdg.balanceOf(address(account)), 900 ether);
        assertEq(tsla.balanceOf(address(account)), 150 ether);
        assertEq(tsla.balanceOf(STRANGER), 0);
        assertEq(usdg.balanceOf(address(amm)), 100 ether);
        assertEq(usdg.allowance(address(account), address(adapter)), 0);
        assertEq(account.dailyTurnoverUsedUSDG(), 100 ether);
        assertEq(account.turnoverDay(), uint64(block.timestamp / 1 days));
        assertEq(account.lastTradeTimestamp(), uint64(block.timestamp));
        _assertDecisionStatus(actionId, DecisionStatus.EXECUTED);
        _assertActionExecutedLog(
            actionId, action.amountIn, amountOut, 2_500, priceDigest, uint64(block.timestamp - 100)
        );
    }

    function test_executeSameActionTwiceRevertsNotApprovedAfterFirstExecution() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        PriceData[] memory prices = _freshPrices();
        bytes32 actionId = _approveAction(action);

        vm.prank(OWNER);
        account.executeAction(action, prices);

        vm.expectRevert(abi.encodeWithSelector(NotApproved.selector, actionId, DecisionStatus.EXECUTED));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeDifferentActionThanApprovedRevertsNotApprovedForDifferentActionId() public {
        Action memory approvedAction = _buyTslaAction(100 ether, 0);
        _approveAction(approvedAction);
        Action memory differentAction = approvedAction;
        differentAction.amountIn = 101 ether;
        differentAction.minAmountOut = 50.5 ether;
        bytes32 differentActionId = account.computeActionId(differentAction);

        vm.expectRevert(abi.encodeWithSelector(NotApproved.selector, differentActionId, DecisionStatus.NONE));
        vm.prank(OWNER);
        account.executeAction(differentAction, _freshPrices());
    }

    function test_executeRevertsWhenMandateVersionChangedAfterApproval() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);

        vm.prank(OWNER);
        account.setMandate(
            MandateConfig({
                mandateVersion: 0,
                maxSingleAssetExposureBps: 4_000,
                maxTradeSizeUSDG: 1_000 ether,
                maxDailyTurnoverBps: 10_000,
                cooldownSeconds: 0
            })
        );

        vm.expectRevert(abi.encodeWithSelector(MandateVersionChanged.selector, uint64(1), uint64(2)));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsWhenApprovalExpired() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);
        uint64 expiresAt = uint64(block.timestamp) + account.APPROVAL_TTL();
        vm.warp(uint256(expiresAt) + 1);

        vm.expectRevert(abi.encodeWithSelector(ApprovalExpired.selector, account.computeActionId(action), expiresAt));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsWithExecuteSpecificStalePriceBeforeOracleVerification() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);
        uint64 staleTimestamp = uint64(block.timestamp - uint256(oracle.MAX_STALENESS()) - 1);
        PriceData[] memory stalePrices = _pricesWithTimestamp(staleTimestamp);

        vm.expectRevert(abi.encodeWithSelector(PriceStaleOnExecute.selector, address(tsla), staleTimestamp));
        vm.prank(OWNER);
        account.executeAction(action, stalePrices);
    }

    function test_executeRevertsWhenCurrentAssetOutIsNoLongerAllowed() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);

        vm.prank(OWNER);
        account.setAssetAllowed(address(tsla), false);

        vm.expectRevert(abi.encodeWithSelector(AssetNotAllowedNow.selector, address(tsla)));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsWhenCurrentAdapterIsNoLongerAllowed() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);

        vm.prank(OWNER);
        account.setAdapterAllowed(address(adapter), false);

        vm.expectRevert(abi.encodeWithSelector(AdapterNotAllowedNow.selector, address(adapter)));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsWhenRecipientIsNotTheAccount() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        action.recipient = STRANGER;
        _approveAction(action);

        vm.expectRevert(abi.encodeWithSelector(RecipientNotAllowed.selector, STRANGER));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsWhenCurrentTurnoverDriftBreaksEngineRevalidation() public {
        vm.prank(OWNER);
        account.setMandate(
            MandateConfig({
                mandateVersion: 0,
                maxSingleAssetExposureBps: 3_500,
                maxTradeSizeUSDG: 1_000 ether,
                maxDailyTurnoverBps: 1_000,
                cooldownSeconds: 0
            })
        );
        Action memory firstAction = _buyTslaAction(100 ether, 0);
        Action memory secondAction = _buyTslaAction(100 ether, 1);
        _approveAction(firstAction);
        _approveAction(secondAction);

        vm.prank(OWNER);
        account.executeAction(firstAction, _freshPrices());

        vm.expectRevert(abi.encodeWithSelector(ReValidationFailed.selector, ReasonCode.DAILY_TURNOVER_EXCEEDED));
        vm.prank(OWNER);
        account.executeAction(secondAction, _freshPrices());
    }

    function test_executeApprovesExactAmountThenResetsAllowance() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);

        vm.expectCall(address(usdg), abi.encodeWithSelector(IERC20.approve.selector, address(adapter), action.amountIn));
        vm.expectCall(address(usdg), abi.encodeWithSelector(IERC20.approve.selector, address(adapter), 0));

        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());

        assertEq(usdg.allowance(address(account), address(adapter)), 0);
    }

    function test_executeAllowsActiveSessionKey() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        bytes32 actionId = _approveAction(action);
        _addSessionKey(SESSION, true, uint64(block.timestamp + 100));

        vm.prank(SESSION);
        account.executeAction(action, _freshPrices());

        _assertDecisionStatus(actionId, DecisionStatus.EXECUTED);
    }

    function test_executeRevertsForExpiredEnabledSessionKey() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);
        _addSessionKey(SESSION, true, uint64(block.timestamp - 1));

        vm.expectRevert(abi.encodeWithSelector(SessionExpired.selector, SESSION));
        vm.prank(SESSION);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsForUnknownCaller() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        _approveAction(action);

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.NONE));
        vm.prank(STRANGER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsForWrongAccountBeforeDecisionLookup() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        action.account = STRANGER;

        vm.expectRevert(abi.encodeWithSelector(WrongAccount.selector, address(account), STRANGER));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsForBadSchemaBeforeDecisionLookup() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        action.actionSchemaVersion = 2;

        vm.expectRevert(abi.encodeWithSelector(BadActionSchema.selector, account.ACTION_SCHEMA_VERSION(), uint16(2)));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_executeRevertsForPassedDeadlineBeforeDecisionLookup() public {
        Action memory action = _buyTslaAction(100 ether, 0);
        action.deadline = uint64(block.timestamp + 50);
        _approveAction(action);
        vm.warp(uint256(action.deadline) + 1);

        vm.expectRevert(abi.encodeWithSelector(DeadlinePassed.selector, action.deadline));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function _approveAction(Action memory action) private returns (bytes32 actionId) {
        PriceData[] memory prices = _freshPrices();
        actionId = account.computeActionId(action);

        vm.prank(OWNER);
        (bytes32 returnedActionId, ReasonCode code,,) = account.submitAction(action, prices);

        assertEq(returnedActionId, actionId);
        assertEq(uint8(code), uint8(ReasonCode.OK));
        _assertDecisionStatus(actionId, DecisionStatus.APPROVED);
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
            deadline: 20_000
        });
    }

    function _freshPrices() private view returns (PriceData[] memory prices) {
        prices = _pricesWithTimestamp(uint64(block.timestamp - 100));
    }

    function _pricesWithTimestamp(uint64 tslaTimestamp) private view returns (PriceData[] memory prices) {
        prices = new PriceData[](1);
        prices[0] = PriceData({
            asset: address(tsla), priceUSDG1e18: TSLA_PRICE, timestamp: tslaTimestamp, validUntil: 20_000, signature: ""
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

    function _addSessionKey(address key, bool enabled, uint64 validUntil) private {
        vm.prank(OWNER);
        account.addSessionKey(
            key,
            SessionKey({
                enabled: enabled,
                validUntil: validUntil,
                allowedActionTypes: 0,
                maxAmountInPerAction: 0,
                scopeHash: bytes32(0)
            })
        );
    }

    function _assertDecisionStatus(bytes32 actionId, DecisionStatus expectedStatus) private view {
        (DecisionStatus status,,,,,) = account.decisions(actionId);

        assertEq(uint8(status), uint8(expectedStatus));
    }

    function _assertActionExecutedLog(
        bytes32 actionId,
        uint256 amountIn,
        uint256 amountOut,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    ) private {
        Vm.Log[] memory entries = vm.getRecordedLogs();
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
}
