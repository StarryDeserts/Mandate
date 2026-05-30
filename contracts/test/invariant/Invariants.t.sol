// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";

import {ApprovedSwapAdapter} from "../../src/adapters/ApprovedSwapAdapter.sol";
import {IAdapter} from "../../src/interfaces/IAdapter.sol";
import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";
import {MandateAccount} from "../../src/MandateAccount.sol";
import {MockAMM} from "../../src/mocks/MockAMM.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {SignedDemoPriceFeed} from "../../src/oracle/SignedDemoPriceFeed.sol";
import {ActionType, DecisionStatus, ReasonCode} from "../../src/types/Enums.sol";
import {
    AdapterNotAllowedNow,
    BadNonce,
    MandateVersionChanged,
    MissingPrice,
    NotApproved,
    PriceStaleOnExecute,
    PriceUnverified,
    RecipientNotAllowed,
    ReservedSessionKeyScope,
    UnsortedOrDuplicateAsset
} from "../../src/types/Errors.sol";
import {Action, MandateConfig, PriceData, SessionKey} from "../../src/types/Types.sol";

contract InvariantPriceOracle is IPriceOracle {
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

contract RevertingAdapter is IAdapter {
    error AdapterBoom();

    function swap(address, uint256, address, uint256, address) external pure returns (uint256) {
        revert AdapterBoom();
    }

    function quote(address, uint256, address) external pure returns (uint256) {
        revert AdapterBoom();
    }
}

contract InvariantHandler is Test {
    uint256 private constant MAX_TRACKED_ACTIONS = 32;
    uint256 private constant MAX_HANDLER_TRADE = 10 ether;

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant ATTACKER = address(0xB0B);
    address private constant WITHDRAW_RECIPIENT = address(0xCAFE);

    MandateAccount private immutable account;
    MockERC20 private immutable usdg;
    MockERC20 private immutable tsla;
    ApprovedSwapAdapter private immutable adapter;
    IPriceOracle private immutable oracle;

    Action[] private trackedActions;
    bytes32[] private trackedActionIds;
    mapping(bytes32 actionId => bool executed) public executed;

    uint256 public successfulSubmits;
    uint256 public sessionEscalationSuccesses;
    uint256 public sessionNonApprovedExecuteSuccesses;
    uint256 public unauthorizedWithdrawSuccesses;
    uint256 public reexecuteSuccesses;
    uint256 public expectedAccountUsdg;
    uint256 public expectedAccountTsla;
    uint256 public ownerWithdrawnUsdg;
    uint256 public ownerWithdrawnTsla;

    constructor(
        MandateAccount account_,
        MockERC20 usdg_,
        MockERC20 tsla_,
        ApprovedSwapAdapter adapter_,
        IPriceOracle oracle_
    ) {
        account = account_;
        usdg = usdg_;
        tsla = tsla_;
        adapter = adapter_;
        oracle = oracle_;
        expectedAccountUsdg = usdg.balanceOf(address(account));
        expectedAccountTsla = tsla.balanceOf(address(account));
    }

    function submitOwner(uint256 amountSeed) external {
        _submit(OWNER, amountSeed);
    }

    function submitSession(uint256 amountSeed) external {
        _submit(SESSION, amountSeed);
    }

    function executeOwner(uint256 actionSeed) external {
        _execute(actionSeed, OWNER);
    }

    function executeSession(uint256 actionSeed) external {
        _execute(actionSeed, SESSION);
    }

    function cancelOwner(uint256 actionSeed) external {
        uint256 actionCount = trackedActions.length;
        if (actionCount == 0) return;

        uint256 index = bound(actionSeed, 0, actionCount - 1);
        bytes32 actionId = trackedActionIds[index];
        (DecisionStatus status,,,,,) = account.decisions(actionId);
        if (status != DecisionStatus.APPROVED) return;

        vm.prank(OWNER);
        try account.cancelApproved(actionId) {} catch {}
    }

    function withdrawOwner(uint8 assetSeed, uint256 amountSeed) external {
        MockERC20 asset = assetSeed % 2 == 0 ? usdg : tsla;
        uint256 available = asset.balanceOf(address(account));
        if (available == 0) return;

        uint256 amount = bound(amountSeed, 1, _min(available, 5 ether));

        vm.prank(OWNER);
        try account.withdraw(address(asset), amount, WITHDRAW_RECIPIENT) {
            if (address(asset) == address(usdg)) {
                expectedAccountUsdg -= amount;
                ownerWithdrawnUsdg += amount;
            } else {
                expectedAccountTsla -= amount;
                ownerWithdrawnTsla += amount;
            }
        } catch {}
    }

    function withdrawSession(uint8 assetSeed, uint256 amountSeed) external {
        _unauthorizedWithdraw(SESSION, assetSeed, amountSeed);
    }

    function withdrawAttacker(uint8 assetSeed, uint256 amountSeed) external {
        _unauthorizedWithdraw(ATTACKER, assetSeed, amountSeed);
    }

    function sessionAttemptsGovernance(uint8 op) external {
        if (op % 6 == 0) {
            vm.prank(SESSION);
            try account.setMandate(_safeMandateConfig()) {
                sessionEscalationSuccesses++;
            } catch {}
        } else if (op % 6 == 1) {
            vm.prank(SESSION);
            try account.setAssetAllowed(address(tsla), false) {
                sessionEscalationSuccesses++;
            } catch {}
        } else if (op % 6 == 2) {
            vm.prank(SESSION);
            try account.setAdapterAllowed(address(adapter), false) {
                sessionEscalationSuccesses++;
            } catch {}
        } else if (op % 6 == 3) {
            vm.prank(SESSION);
            try account.registerPriceOracle(oracle) {
                sessionEscalationSuccesses++;
            } catch {}
        } else if (op % 6 == 4) {
            vm.prank(SESSION);
            try account.addSessionKey(ATTACKER, _sessionKey(true, uint64(block.timestamp + 1 hours))) {
                sessionEscalationSuccesses++;
            } catch {}
        } else {
            vm.prank(SESSION);
            try account.revokeSessionKey(SESSION) {
                sessionEscalationSuccesses++;
            } catch {}
        }
    }

    function sessionExecuteUnapproved(uint256 nonceSeed) external {
        Action memory action =
            _validAction(bound(nonceSeed, account.nextNonce() + 1, account.nextNonce() + 1_000), 1 ether);

        vm.prank(SESSION);
        try account.executeAction(action, _freshPrices()) {
            sessionNonApprovedExecuteSuccesses++;
        } catch {}
    }

    function reexecuteOne(uint256 actionSeed) external {
        uint256 actionCount = trackedActions.length;
        if (actionCount == 0) return;

        uint256 index = bound(actionSeed, 0, actionCount - 1);
        bytes32 actionId = trackedActionIds[index];
        if (!executed[actionId]) return;

        Action memory action = trackedActions[index];
        vm.prank(OWNER);
        try account.executeAction(action, _freshPrices()) {
            reexecuteSuccesses++;
        } catch {}
    }

    function trackedActionCount() external view returns (uint256) {
        return trackedActionIds.length;
    }

    function trackedActionId(uint256 index) external view returns (bytes32) {
        return trackedActionIds[index];
    }

    function _submit(address actor, uint256 amountSeed) private {
        uint256 available = usdg.balanceOf(address(account));
        if (available == 0) return;

        uint256 amount = bound(amountSeed, 1, _min(available, MAX_HANDLER_TRADE));
        Action memory action = _validAction(account.nextNonce(), amount);
        PriceData[] memory prices = _freshPrices();
        uint256 beforeNonce = account.nextNonce();
        bytes32 actionId = account.computeActionId(action);

        vm.prank(actor);
        try account.submitAction(action, prices) returns (
            bytes32 returnedActionId, ReasonCode code, uint16 preExposureBps, uint16 postExposureBps
        ) {
            preExposureBps;
            postExposureBps;
            assertEq(returnedActionId, actionId);
            assertEq(account.nextNonce(), beforeNonce + 1);
            successfulSubmits++;

            if (code == ReasonCode.OK && trackedActions.length < MAX_TRACKED_ACTIONS) {
                trackedActions.push(action);
                trackedActionIds.push(actionId);
            }
        } catch {
            assertEq(account.nextNonce(), beforeNonce);
        }
    }

    function _execute(uint256 actionSeed, address actor) private {
        uint256 actionCount = trackedActions.length;
        if (actionCount == 0) return;

        uint256 index = bound(actionSeed, 0, actionCount - 1);
        bytes32 actionId = trackedActionIds[index];
        if (executed[actionId]) return;

        (DecisionStatus status,,,,,) = account.decisions(actionId);
        if (status != DecisionStatus.APPROVED) return;

        Action memory action = trackedActions[index];
        vm.prank(actor);
        try account.executeAction(action, _freshPrices()) returns (uint256 amountOut) {
            executed[actionId] = true;
            expectedAccountUsdg -= action.amountIn;
            expectedAccountTsla += amountOut;
        } catch {}
    }

    function _unauthorizedWithdraw(address actor, uint8 assetSeed, uint256 amountSeed) private {
        MockERC20 asset = assetSeed % 2 == 0 ? usdg : tsla;
        uint256 available = asset.balanceOf(address(account));
        if (available == 0) available = 1;
        uint256 amount = bound(amountSeed, 1, _min(available, 5 ether));

        vm.prank(actor);
        try account.withdraw(address(asset), amount, actor) {
            unauthorizedWithdrawSuccesses++;
        } catch {}
    }

    function _validAction(uint256 nonce, uint256 amountIn) private view returns (Action memory action) {
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
            priceUSDG1e18: 2 ether,
            timestamp: uint64(block.timestamp - 100),
            validUntil: uint64(block.timestamp + 1 hours),
            signature: ""
        });
    }

    function _safeMandateConfig() private pure returns (MandateConfig memory config) {
        config = MandateConfig({
            mandateVersion: 0,
            maxSingleAssetExposureBps: 10_000,
            maxTradeSizeUSDG: 1_000 ether,
            maxDailyTurnoverBps: 10_000,
            cooldownSeconds: 0
        });
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

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}

contract MandateAccountInvariantsTest is Test {
    bytes32 private constant PRICE_DATA_TYPEHASH =
        keccak256("PriceData(address asset,uint256 priceUSDG1e18,uint64 timestamp,uint64 validUntil)");
    bytes32 private constant PRICE_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant PRICE_DOMAIN_NAME = "MandatePriceFeed";
    string private constant PRICE_DOMAIN_VERSION = "1";

    uint256 private constant PRICE_SIGNER_KEY = 0xA11CE;
    uint256 private constant WRONG_PRICE_SIGNER_KEY = 0xB0B;
    uint256 private constant USDG_BALANCE = 1_000 ether;
    uint256 private constant TSLA_BALANCE = 100 ether;
    uint256 private constant AMM_TSLA_LIQUIDITY = 10_000 ether;
    uint256 private constant TSLA_PRICE = 2 ether;
    uint256 private constant USDG_TO_TSLA_RATE = 0.5 ether;

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant ATTACKER = address(0xB0B);
    address private constant WITHDRAW_RECIPIENT = address(0xCAFE);

    MandateAccount private account;
    MockERC20 private usdg;
    MockERC20 private tsla;
    MockAMM private amm;
    ApprovedSwapAdapter private adapter;
    InvariantPriceOracle private oracle;
    InvariantHandler private handler;

    function setUp() public {
        vm.warp(10_000);

        usdg = new MockERC20("Mock USDG", "mUSDG");
        tsla = new MockERC20("Mock TSLA", "mTSLA");
        amm = new MockAMM();
        adapter = new ApprovedSwapAdapter(amm);
        account = new MandateAccount(OWNER, address(usdg));
        oracle = new InvariantPriceOracle();

        usdg.mint(address(account), USDG_BALANCE);
        tsla.mint(address(account), TSLA_BALANCE);
        tsla.mint(address(amm), AMM_TSLA_LIQUIDITY);
        amm.setRate(address(usdg), address(tsla), USDG_TO_TSLA_RATE);

        vm.startPrank(OWNER);
        account.setMandate(_safeMandateConfig());
        account.setAdapterAllowed(address(adapter), true);
        account.registerPriceOracle(oracle);
        _allowAssetsInReverseAddressOrder();
        account.addSessionKey(SESSION, _sessionKey(true, uint64(block.timestamp + 1 hours)));
        vm.stopPrank();

        handler = new InvariantHandler(account, usdg, tsla, adapter, oracle);

        bytes4[] memory selectors = new bytes4[](11);
        selectors[0] = InvariantHandler.submitOwner.selector;
        selectors[1] = InvariantHandler.submitSession.selector;
        selectors[2] = InvariantHandler.executeOwner.selector;
        selectors[3] = InvariantHandler.executeSession.selector;
        selectors[4] = InvariantHandler.cancelOwner.selector;
        selectors[5] = InvariantHandler.withdrawOwner.selector;
        selectors[6] = InvariantHandler.withdrawSession.selector;
        selectors[7] = InvariantHandler.withdrawAttacker.selector;
        selectors[8] = InvariantHandler.sessionAttemptsGovernance.selector;
        selectors[9] = InvariantHandler.sessionExecuteUnapproved.selector;
        selectors[10] = InvariantHandler.reexecuteOne.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_custodyOnlyViaExecuteOrWithdraw() public view {
        assertEq(usdg.balanceOf(address(account)), handler.expectedAccountUsdg(), "account USDG");
        assertEq(tsla.balanceOf(address(account)), handler.expectedAccountTsla(), "account TSLA");
        assertEq(usdg.balanceOf(WITHDRAW_RECIPIENT), handler.ownerWithdrawnUsdg(), "withdrawn USDG");
        assertEq(tsla.balanceOf(WITHDRAW_RECIPIENT), handler.ownerWithdrawnTsla(), "withdrawn TSLA");
        assertEq(usdg.balanceOf(SESSION), 0, "session USDG");
        assertEq(tsla.balanceOf(SESSION), 0, "session TSLA");
        assertEq(usdg.balanceOf(ATTACKER), 0, "attacker USDG");
        assertEq(tsla.balanceOf(ATTACKER), 0, "attacker TSLA");
        assertEq(handler.unauthorizedWithdrawSuccesses(), 0, "unauthorized withdraw");
    }

    function invariant_sessionCannotGovernOrWithdraw() public view {
        assertEq(handler.sessionEscalationSuccesses(), 0, "session escalation");
        assertEq(handler.sessionNonApprovedExecuteSuccesses(), 0, "session unapproved execute");
        assertEq(handler.unauthorizedWithdrawSuccesses(), 0, "session withdraw");
        assertEq(account.owner(), OWNER, "owner changed");

        (bool enabled,, uint8 allowedActionTypes, uint256 maxAmountInPerAction, bytes32 scopeHash) =
            account.sessionKeys(SESSION);
        assertTrue(enabled, "session disabled");
        assertEq(allowedActionTypes, 0, "reserved action types");
        assertEq(maxAmountInPerAction, 0, "reserved max amount");
        assertEq(scopeHash, bytes32(0), "reserved scope hash");
    }

    function invariant_noExecutedDecisionExecutesTwice() public view {
        assertEq(handler.reexecuteSuccesses(), 0, "reexecute succeeded");

        uint256 trackedActionCount = handler.trackedActionCount();
        for (uint256 i; i < trackedActionCount; ++i) {
            bytes32 actionId = handler.trackedActionId(i);
            if (!handler.executed(actionId)) continue;

            (DecisionStatus status,,,,,) = account.decisions(actionId);
            assertEq(uint8(status), uint8(DecisionStatus.EXECUTED), "executed status");
        }
    }

    function invariant_nonceMatchesSuccessfulSubmits() public view {
        assertEq(account.nextNonce(), handler.successfulSubmits(), "nonce model");
    }

    function test_invariantApprovalIntegrityRejectsNonApprovedAndRecheckedFailures() public {
        Action memory unapprovedAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 unapprovedActionId = account.computeActionId(unapprovedAction);

        vm.expectRevert(abi.encodeWithSelector(NotApproved.selector, unapprovedActionId, DecisionStatus.NONE));
        vm.prank(OWNER);
        account.executeAction(unapprovedAction, _freshPrices());

        Action memory approvedAction = _buyTslaAction(100 ether, account.nextNonce());
        _approveAction(approvedAction);

        vm.prank(OWNER);
        account.setAdapterAllowed(address(adapter), false);

        vm.expectRevert(abi.encodeWithSelector(AdapterNotAllowedNow.selector, address(adapter)));
        vm.prank(OWNER);
        account.executeAction(approvedAction, _freshPrices());
    }

    function test_invariantActionBindingRejectsDifferentAction() public {
        Action memory approvedAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 approvedActionId = _approveAction(approvedAction);

        Action memory differentAction = approvedAction;
        differentAction.amountIn = 101 ether;
        differentAction.minAmountOut = differentAction.amountIn / 2;
        bytes32 differentActionId = account.computeActionId(differentAction);

        assertTrue(differentActionId != approvedActionId);
        vm.expectRevert(abi.encodeWithSelector(NotApproved.selector, differentActionId, DecisionStatus.NONE));
        vm.prank(OWNER);
        account.executeAction(differentAction, _freshPrices());
    }

    function test_invariantConsumedNonceUnusable() public {
        Action memory firstAction = _buyTslaAction(100 ether, account.nextNonce());
        _approveAction(firstAction);

        Action memory replayedNonceAction = _buyTslaAction(10 ether, firstAction.nonce);
        vm.expectRevert(abi.encodeWithSelector(BadNonce.selector, uint256(1), firstAction.nonce));
        vm.prank(OWNER);
        account.submitAction(replayedNonceAction, _freshPrices());
    }

    function test_invariantMandateFreshnessRejectsAfterVersionChange() public {
        Action memory action = _buyTslaAction(100 ether, account.nextNonce());
        _approveAction(action);

        vm.prank(OWNER);
        account.setMandate(_safeMandateConfig());

        vm.expectRevert(abi.encodeWithSelector(MandateVersionChanged.selector, uint64(1), uint64(2)));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_invariantPriceDisciplineRejectsMalformedPricesAndKeepsUSDGFixed() public {
        SignedDemoPriceFeed signedFeed = new SignedDemoPriceFeed(vm.addr(PRICE_SIGNER_KEY), 1 hours);
        vm.prank(OWNER);
        account.registerPriceOracle(signedFeed);

        Action memory action = _buyTslaAction(100 ether, account.nextNonce());

        PriceData[] memory unsignedPrices = new PriceData[](1);
        unsignedPrices[0] =
            _priceData(address(tsla), TSLA_PRICE, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, unsignedPrices);
        assertEq(account.nextNonce(), 0);

        PriceData[] memory stalePrices = new PriceData[](1);
        stalePrices[0] = _signedPriceData(
            signedFeed,
            PRICE_SIGNER_KEY,
            address(tsla),
            TSLA_PRICE,
            uint64(block.timestamp - 1 hours - 1),
            uint64(block.timestamp + 1 hours)
        );
        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, stalePrices);
        assertEq(account.nextNonce(), 0);

        PriceData[] memory expiredPrices = new PriceData[](1);
        expiredPrices[0] = _signedPriceData(
            signedFeed,
            PRICE_SIGNER_KEY,
            address(tsla),
            TSLA_PRICE,
            uint64(block.timestamp),
            uint64(block.timestamp - 1)
        );
        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, expiredPrices);
        assertEq(account.nextNonce(), 0);

        PriceData[] memory wronglySignedPrices = new PriceData[](1);
        wronglySignedPrices[0] = _signedPriceData(
            signedFeed,
            WRONG_PRICE_SIGNER_KEY,
            address(tsla),
            TSLA_PRICE,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 hours)
        );
        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, wronglySignedPrices);
        assertEq(account.nextNonce(), 0);

        PriceData[] memory unsortedPrices = _unsortedNonUSDGPrices();
        vm.expectRevert(abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, unsortedPrices[1].asset));
        vm.prank(OWNER);
        account.submitAction(action, unsortedPrices);
        assertEq(account.nextNonce(), 0);

        PriceData[] memory duplicatePrices = _duplicateTslaPrices();
        vm.expectRevert(abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, duplicatePrices);
        assertEq(account.nextNonce(), 0);

        vm.expectRevert(abi.encodeWithSelector(MissingPrice.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, new PriceData[](0));
        assertEq(account.nextNonce(), 0);

        PriceData[] memory usdgPrices = new PriceData[](1);
        usdgPrices[0] = _priceData(address(usdg), 1 ether, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
        vm.expectRevert(abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, address(usdg)));
        vm.prank(OWNER);
        account.submitAction(action, usdgPrices);
        assertEq(account.nextNonce(), 0);

        vm.prank(OWNER);
        account.setAssetAllowed(address(tsla), false);

        Action memory usdgOnlyAction = _usdgToUsdgAction(100 ether, account.nextNonce());
        PriceData[] memory noPrices = new PriceData[](0);
        bytes32 actionId = account.computeActionId(usdgOnlyAction);
        vm.prank(OWNER);
        (bytes32 returnedActionId, ReasonCode code,,) = account.submitAction(usdgOnlyAction, noPrices);

        assertEq(returnedActionId, actionId);
        assertEq(uint8(code), uint8(ReasonCode.OK));
        _assertDecisionStatus(actionId, DecisionStatus.APPROVED);
        (,,,,, uint64 priceTimestamp) = account.decisions(actionId);
        assertEq(priceTimestamp, 0);
    }

    function test_invariantExecutePriceDisciplineRejectsMalformedPricesAndKeepsDecisionApproved() public {
        Action memory missingPriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 missingPriceActionId = _approveAction(missingPriceAction);
        _assertExecuteRevertKeepsApproved(
            missingPriceAction,
            missingPriceActionId,
            new PriceData[](0),
            abi.encodeWithSelector(MissingPrice.selector, address(tsla))
        );

        Action memory unsortedPriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 unsortedPriceActionId = _approveAction(unsortedPriceAction);
        PriceData[] memory unsortedPrices = _unsortedNonUSDGPrices();
        _assertExecuteRevertKeepsApproved(
            unsortedPriceAction,
            unsortedPriceActionId,
            unsortedPrices,
            abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, unsortedPrices[1].asset)
        );

        Action memory duplicatePriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 duplicatePriceActionId = _approveAction(duplicatePriceAction);
        _assertExecuteRevertKeepsApproved(
            duplicatePriceAction,
            duplicatePriceActionId,
            _duplicateTslaPrices(),
            abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, address(tsla))
        );

        Action memory usdgPriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 usdgPriceActionId = _approveAction(usdgPriceAction);
        PriceData[] memory usdgPrices = new PriceData[](1);
        usdgPrices[0] = _priceData(address(usdg), 1 ether, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
        _assertExecuteRevertKeepsApproved(
            usdgPriceAction,
            usdgPriceActionId,
            usdgPrices,
            abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, address(usdg))
        );

        Action memory stalePriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 stalePriceActionId = _approveAction(stalePriceAction);
        uint64 staleTimestamp = uint64(block.timestamp - 1 hours - 1);
        PriceData[] memory stalePrices = new PriceData[](1);
        stalePrices[0] = _priceData(address(tsla), TSLA_PRICE, staleTimestamp, uint64(block.timestamp + 1 hours));
        _assertExecuteRevertKeepsApproved(
            stalePriceAction,
            stalePriceActionId,
            stalePrices,
            abi.encodeWithSelector(PriceStaleOnExecute.selector, address(tsla), staleTimestamp)
        );

        SignedDemoPriceFeed signedFeed = new SignedDemoPriceFeed(vm.addr(PRICE_SIGNER_KEY), 1 hours);
        vm.prank(OWNER);
        account.registerPriceOracle(signedFeed);

        Action memory unsignedPriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 unsignedPriceActionId =
            _approveActionWithPrices(unsignedPriceAction, _signedTslaPrices(signedFeed, PRICE_SIGNER_KEY));
        _assertExecuteRevertKeepsApproved(
            unsignedPriceAction,
            unsignedPriceActionId,
            _freshPrices(),
            abi.encodeWithSelector(PriceUnverified.selector, address(tsla))
        );

        Action memory wrongSignerPriceAction = _buyTslaAction(100 ether, account.nextNonce());
        bytes32 wrongSignerPriceActionId =
            _approveActionWithPrices(wrongSignerPriceAction, _signedTslaPrices(signedFeed, PRICE_SIGNER_KEY));
        _assertExecuteRevertKeepsApproved(
            wrongSignerPriceAction,
            wrongSignerPriceActionId,
            _signedTslaPrices(signedFeed, WRONG_PRICE_SIGNER_KEY),
            abi.encodeWithSelector(PriceUnverified.selector, address(tsla))
        );
    }

    function test_invariantRecipientLockRejectsExternalRecipient() public {
        Action memory action = _buyTslaAction(100 ether, account.nextNonce());
        action.recipient = ATTACKER;
        _approveAction(action);

        vm.expectRevert(abi.encodeWithSelector(RecipientNotAllowed.selector, ATTACKER));
        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());
    }

    function test_invariantMissingPriceAndAdapterErrorsDefaultDeny() public {
        Action memory missingPriceAction = _buyTslaAction(100 ether, account.nextNonce());
        vm.expectRevert(abi.encodeWithSelector(MissingPrice.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(missingPriceAction, new PriceData[](0));
        assertEq(account.nextNonce(), 0);

        vm.prank(OWNER);
        account.setMandate(
            MandateConfig({
                mandateVersion: 0,
                maxSingleAssetExposureBps: 0,
                maxTradeSizeUSDG: 0,
                maxDailyTurnoverBps: 0,
                cooldownSeconds: 0
            })
        );
        Action memory zeroConfigAction = _buyTslaAction(1 ether, account.nextNonce());
        bytes32 zeroConfigActionId = account.computeActionId(zeroConfigAction);
        vm.prank(OWNER);
        (, ReasonCode code,,) = account.submitAction(zeroConfigAction, _freshPrices());
        assertTrue(code != ReasonCode.OK);
        _assertDecisionStatus(zeroConfigActionId, DecisionStatus.BLOCKED);

        vm.prank(OWNER);
        account.setMandate(_safeMandateConfig());
        RevertingAdapter revertingAdapter = new RevertingAdapter();
        vm.prank(OWNER);
        account.setAdapterAllowed(address(revertingAdapter), true);

        Action memory adapterErrorAction = _buyTslaAction(100 ether, account.nextNonce());
        adapterErrorAction.adapter = address(revertingAdapter);
        bytes32 adapterErrorActionId = _approveAction(adapterErrorAction);

        vm.expectRevert(RevertingAdapter.AdapterBoom.selector);
        vm.prank(OWNER);
        account.executeAction(adapterErrorAction, _freshPrices());

        _assertDecisionStatus(adapterErrorActionId, DecisionStatus.APPROVED);
        assertEq(usdg.allowance(address(account), address(revertingAdapter)), 0);
    }

    function test_invariantApprovalResetAfterExecute() public {
        Action memory action = _buyTslaAction(100 ether, account.nextNonce());
        _approveAction(action);

        vm.expectCall(address(usdg), abi.encodeWithSelector(IERC20.approve.selector, address(adapter), action.amountIn));
        vm.expectCall(address(usdg), abi.encodeWithSelector(IERC20.approve.selector, address(adapter), 0));

        vm.prank(OWNER);
        account.executeAction(action, _freshPrices());

        assertEq(usdg.allowance(address(account), address(adapter)), 0);
    }

    function test_invariantReservedSessionScopeRejected() public {
        SessionKey memory withAllowedActionTypes = _sessionKey(true, uint64(block.timestamp + 1 hours));
        withAllowedActionTypes.allowedActionTypes = 1;
        vm.expectRevert(ReservedSessionKeyScope.selector);
        vm.prank(OWNER);
        account.addSessionKey(ATTACKER, withAllowedActionTypes);

        SessionKey memory withMaxAmountInPerAction = _sessionKey(true, uint64(block.timestamp + 1 hours));
        withMaxAmountInPerAction.maxAmountInPerAction = 1 ether;
        vm.expectRevert(ReservedSessionKeyScope.selector);
        vm.prank(OWNER);
        account.addSessionKey(ATTACKER, withMaxAmountInPerAction);

        SessionKey memory withScopeHash = _sessionKey(true, uint64(block.timestamp + 1 hours));
        withScopeHash.scopeHash = keccak256("scope");
        vm.expectRevert(ReservedSessionKeyScope.selector);
        vm.prank(OWNER);
        account.addSessionKey(ATTACKER, withScopeHash);

        vm.prank(OWNER);
        account.addSessionKey(ATTACKER, _sessionKey(true, uint64(block.timestamp + 1 hours)));
        (bool enabled,, uint8 allowedActionTypes, uint256 maxAmountInPerAction, bytes32 scopeHash) =
            account.sessionKeys(ATTACKER);
        assertTrue(enabled);
        assertEq(allowedActionTypes, 0);
        assertEq(maxAmountInPerAction, 0);
        assertEq(scopeHash, bytes32(0));
    }

    function _approveAction(Action memory action) private returns (bytes32 actionId) {
        actionId = _approveActionWithPrices(action, _freshPrices());
    }

    function _approveActionWithPrices(Action memory action, PriceData[] memory prices)
        private
        returns (bytes32 actionId)
    {
        actionId = account.computeActionId(action);

        vm.prank(OWNER);
        (bytes32 returnedActionId, ReasonCode code,,) = account.submitAction(action, prices);

        assertEq(returnedActionId, actionId);
        assertEq(uint8(code), uint8(ReasonCode.OK));
        _assertDecisionStatus(actionId, DecisionStatus.APPROVED);
    }

    function _assertExecuteRevertKeepsApproved(
        Action memory action,
        bytes32 actionId,
        PriceData[] memory prices,
        bytes memory expectedRevert
    ) private {
        vm.expectRevert(expectedRevert);
        vm.prank(OWNER);
        account.executeAction(action, prices);

        _assertDecisionApprovedNotExecuted(actionId);
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

    function _usdgToUsdgAction(uint256 amountIn, uint256 nonce) private view returns (Action memory action) {
        action = Action({
            actionSchemaVersion: 1,
            account: address(account),
            nonce: nonce,
            actionType: ActionType.SWAP,
            assetIn: address(usdg),
            amountIn: amountIn,
            assetOut: address(usdg),
            minAmountOut: 0,
            adapter: address(adapter),
            recipient: address(account),
            deadline: uint64(block.timestamp + 1 hours)
        });
    }

    function _freshPrices() private view returns (PriceData[] memory prices) {
        prices = new PriceData[](1);
        prices[0] =
            _priceData(address(tsla), TSLA_PRICE, uint64(block.timestamp - 100), uint64(block.timestamp + 1 hours));
    }

    function _signedTslaPrices(SignedDemoPriceFeed signedFeed, uint256 signingKey)
        private
        view
        returns (PriceData[] memory prices)
    {
        prices = new PriceData[](1);
        prices[0] = _signedPriceData(
            signedFeed,
            signingKey,
            address(tsla),
            TSLA_PRICE,
            uint64(block.timestamp),
            uint64(block.timestamp + 1 hours)
        );
    }

    function _duplicateTslaPrices() private view returns (PriceData[] memory prices) {
        prices = new PriceData[](2);
        prices[0] = _priceData(address(tsla), TSLA_PRICE, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
        prices[1] = _priceData(address(tsla), TSLA_PRICE, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
    }

    function _unsortedNonUSDGPrices() private returns (PriceData[] memory prices) {
        MockERC20 extra = new MockERC20("Mock Extra", "mEXT");
        PriceData memory tslaPrice =
            _priceData(address(tsla), TSLA_PRICE, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
        PriceData memory extraPrice =
            _priceData(address(extra), 3 ether, uint64(block.timestamp), uint64(block.timestamp + 1 hours));
        prices = new PriceData[](2);

        if (address(tsla) > address(extra)) {
            prices[0] = tslaPrice;
            prices[1] = extraPrice;
        } else {
            prices[0] = extraPrice;
            prices[1] = tslaPrice;
        }
    }

    function _priceData(address asset, uint256 priceUSDG1e18, uint64 timestamp, uint64 validUntil)
        private
        pure
        returns (PriceData memory price)
    {
        price = PriceData({
            asset: asset, priceUSDG1e18: priceUSDG1e18, timestamp: timestamp, validUntil: validUntil, signature: ""
        });
    }

    function _signedPriceData(
        SignedDemoPriceFeed signedFeed,
        uint256 signingKey,
        address asset,
        uint256 priceUSDG1e18,
        uint64 timestamp,
        uint64 validUntil
    ) private view returns (PriceData memory price) {
        price = PriceData({
            asset: asset,
            priceUSDG1e18: priceUSDG1e18,
            timestamp: timestamp,
            validUntil: validUntil,
            signature: _signPriceData(address(signedFeed), signingKey, asset, priceUSDG1e18, timestamp, validUntil)
        });
    }

    function _signPriceData(
        address signedFeed,
        uint256 signingKey,
        address asset,
        uint256 priceUSDG1e18,
        uint64 timestamp,
        uint64 validUntil
    ) private view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _priceDomainSeparator(signedFeed),
                keccak256(abi.encode(PRICE_DATA_TYPEHASH, asset, priceUSDG1e18, timestamp, validUntil))
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _priceDomainSeparator(address signedFeed) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                PRICE_DOMAIN_TYPEHASH,
                keccak256(bytes(PRICE_DOMAIN_NAME)),
                keccak256(bytes(PRICE_DOMAIN_VERSION)),
                block.chainid,
                signedFeed
            )
        );
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

    function _safeMandateConfig() private pure returns (MandateConfig memory config) {
        config = MandateConfig({
            mandateVersion: 0,
            maxSingleAssetExposureBps: 10_000,
            maxTradeSizeUSDG: 1_000 ether,
            maxDailyTurnoverBps: 10_000,
            cooldownSeconds: 0
        });
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

    function _assertDecisionStatus(bytes32 actionId, DecisionStatus expectedStatus) private view {
        (DecisionStatus status,,,,,) = account.decisions(actionId);

        assertEq(uint8(status), uint8(expectedStatus));
    }

    function _assertDecisionApprovedNotExecuted(bytes32 actionId) private view {
        (DecisionStatus status,,,,,) = account.decisions(actionId);

        assertEq(uint8(status), uint8(DecisionStatus.APPROVED));
        assertTrue(status != DecisionStatus.EXECUTED);
    }
}
