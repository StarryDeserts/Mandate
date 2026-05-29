// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MandateAccount} from "../../src/MandateAccount.sol";
import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {NotAuthorized} from "../../src/types/Errors.sol";
import {Role} from "../../src/types/Enums.sol";
import {MandateConfig, PriceData, SessionKey} from "../../src/types/Types.sol";

contract MandateAccountHarness is MandateAccount {
    constructor(address owner_, address usdg_) MandateAccount(owner_, usdg_) {}

    function seedSessionKey(address key, SessionKey memory sessionKey) external {
        sessionKeys[key] = sessionKey;
    }

    function resolveActor() external view returns (ActorContext memory context) {
        context = _resolveActor();
    }
}

contract MockPriceOracle is IPriceOracle {
    address public immutable signer;
    uint64 public immutable maxStaleness;

    constructor(address signer_, uint64 maxStaleness_) {
        signer = signer_;
        maxStaleness = maxStaleness_;
    }

    function getPrice(address, PriceData calldata, address)
        external
        pure
        returns (uint256 priceUSDG1e18, uint64 timestamp)
    {
        priceUSDG1e18 = 1 ether;
        timestamp = 1;
    }
}

contract MandateAccountGovernanceTest is Test {
    event MandateUpdated(uint64 mandateVersion, MandateConfig mandate);
    event AssetAllowedSet(address indexed asset, bool allowed);
    event AdapterAllowedSet(address indexed adapter, bool allowed);
    event PriceOracleRegistered(address indexed oracle, address indexed signer);
    event Withdrawn(address indexed asset, uint256 amount, address indexed to);

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant STRANGER = address(0xB0B);
    address private constant RECIPIENT = address(0xCAFE);
    address private constant ASSET_A = address(0xA55E7A);
    address private constant ASSET_B = address(0xA55E7B);
    address private constant ADAPTER = address(0xADA);
    address private constant PRICE_SIGNER = address(0x51A9E2);
    address private constant SECOND_PRICE_SIGNER = address(0x51A9E3);
    uint256 private constant DEPOSIT_AMOUNT = 1_000 ether;
    uint256 private constant WITHDRAW_AMOUNT = 125 ether;

    MandateAccountHarness private account;
    MockERC20 private token;

    function setUp() public {
        vm.warp(1_000);
        token = new MockERC20("Mock USDG", "mUSDG");
        account = new MandateAccountHarness(OWNER, address(token));
    }

    function test_roleOfReturnsOwnerForOwner() public view {
        assertEq(uint8(account.roleOf(OWNER)), uint8(Role.OWNER));
    }

    function test_roleOfReturnsSessionForEnabledNonExpiredSessionKey() public {
        account.seedSessionKey(SESSION, _sessionKey(true, 1_000));

        assertEq(uint8(account.roleOf(SESSION)), uint8(Role.SESSION));
    }

    function test_roleOfReturnsNoneForUnknownActor() public view {
        assertEq(uint8(account.roleOf(STRANGER)), uint8(Role.NONE));
    }

    function test_roleOfReturnsNoneForDisabledSessionKey() public {
        account.seedSessionKey(SESSION, _sessionKey(false, 2_000));

        assertEq(uint8(account.roleOf(SESSION)), uint8(Role.NONE));
    }

    function test_roleOfReturnsNoneForExpiredSessionKey() public {
        account.seedSessionKey(SESSION, _sessionKey(true, 999));

        assertEq(uint8(account.roleOf(SESSION)), uint8(Role.NONE));
    }

    function test_nextNonceStartsAtZero() public view {
        assertEq(account.nextNonce(), 0);
    }

    function test_plainTransferDepositsFundsIntoAccount() public {
        token.mint(OWNER, DEPOSIT_AMOUNT);

        vm.prank(OWNER);
        bool transferred = token.transfer(address(account), DEPOSIT_AMOUNT);

        assertTrue(transferred);
        assertEq(token.balanceOf(address(account)), DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(OWNER), 0);
    }

    function test_ownerWithdrawTransfersTokensAndEmitsEvent() public {
        _depositTokens(DEPOSIT_AMOUNT);

        vm.expectEmit(true, true, false, true, address(account));
        emit Withdrawn(address(token), WITHDRAW_AMOUNT, RECIPIENT);

        vm.prank(OWNER);
        account.withdraw(address(token), WITHDRAW_AMOUNT, RECIPIENT);

        assertEq(token.balanceOf(address(account)), DEPOSIT_AMOUNT - WITHDRAW_AMOUNT);
        assertEq(token.balanceOf(RECIPIENT), WITHDRAW_AMOUNT);
    }

    function test_withdrawRevertsForSessionKeyWithRoleBasedError() public {
        account.seedSessionKey(SESSION, _sessionKey(true, 2_000));
        _depositTokens(DEPOSIT_AMOUNT);

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.SESSION));
        vm.prank(SESSION);
        account.withdraw(address(token), WITHDRAW_AMOUNT, RECIPIENT);

        assertEq(token.balanceOf(address(account)), DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(RECIPIENT), 0);
    }

    function test_withdrawRevertsForStrangerWithRoleBasedError() public {
        _depositTokens(DEPOSIT_AMOUNT);

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.NONE));
        vm.prank(STRANGER);
        account.withdraw(address(token), WITHDRAW_AMOUNT, RECIPIENT);

        assertEq(token.balanceOf(address(account)), DEPOSIT_AMOUNT);
        assertEq(token.balanceOf(RECIPIENT), 0);
    }

    function test_resolveActorUsesMsgSenderAndCopiesSessionKey() public {
        SessionKey memory sessionKey = _sessionKey(true, 2_000);
        account.seedSessionKey(SESSION, sessionKey);

        vm.prank(SESSION);
        MandateAccount.ActorContext memory context = account.resolveActor();

        assertEq(context.actor, SESSION);
        assertEq(uint8(context.role), uint8(Role.SESSION));
        assertEq(context.sessionKey.enabled, sessionKey.enabled);
        assertEq(context.sessionKey.validUntil, sessionKey.validUntil);
        assertEq(context.sessionKey.allowedActionTypes, sessionKey.allowedActionTypes);
        assertEq(context.sessionKey.maxAmountInPerAction, sessionKey.maxAmountInPerAction);
        assertEq(context.sessionKey.scopeHash, sessionKey.scopeHash);
    }

    function test_setMandateRevertsForSessionKeyWithRoleBasedError() public {
        account.seedSessionKey(SESSION, _sessionKey(true, 2_000));
        MandateConfig memory config = _mandateConfig(99, 2_500, 1_000 ether, 5_000, 60);

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.SESSION));
        vm.prank(SESSION);
        account.setMandate(config);
    }

    function test_setMandateCanonicalizesVersionAndEmitsUpdatedEvent() public {
        MandateConfig memory callerConfig = _mandateConfig(99, 2_500, 1_000 ether, 5_000, 60);
        MandateConfig memory expectedConfig = _mandateConfig(1, 2_500, 1_000 ether, 5_000, 60);

        vm.expectEmit(false, false, false, true, address(account));
        emit MandateUpdated(1, expectedConfig);

        vm.prank(OWNER);
        account.setMandate(callerConfig);

        assertEq(account.mandateVersion(), 1);
    }

    function test_getMandateReflectsOwnerSetConfig() public {
        MandateConfig memory callerConfig = _mandateConfig(42, 1_200, 750 ether, 3_500, 120);
        MandateConfig memory expectedConfig = _mandateConfig(1, 1_200, 750 ether, 3_500, 120);

        vm.prank(OWNER);
        account.setMandate(callerConfig);

        _assertMandateEq(account.getMandate(), expectedConfig);
    }

    function test_setMandateIncrementsVersionMonotonicallyOnRepeatedOwnerCalls() public {
        MandateConfig memory firstConfig = _mandateConfig(99, 1_200, 750 ether, 3_500, 120);
        MandateConfig memory secondConfig = _mandateConfig(0, 2_400, 1_500 ether, 4_500, 300);

        vm.prank(OWNER);
        account.setMandate(firstConfig);
        assertEq(account.mandateVersion(), 1);

        vm.prank(OWNER);
        account.setMandate(secondConfig);
        assertEq(account.mandateVersion(), 2);

        MandateConfig memory expectedConfig = _mandateConfig(2, 2_400, 1_500 ether, 4_500, 300);
        _assertMandateEq(account.getMandate(), expectedConfig);
    }

    function test_setAssetAllowedEnablesAssetAndAddsToEnumerableListOnce() public {
        vm.expectEmit(true, false, false, true, address(account));
        emit AssetAllowedSet(ASSET_A, true);
        _setAssetAllowedAsOwner(ASSET_A, true);

        vm.expectEmit(true, false, false, true, address(account));
        emit AssetAllowedSet(ASSET_A, true);
        _setAssetAllowedAsOwner(ASSET_A, true);

        assertTrue(account.isAssetAllowed(ASSET_A));
        assertEq(account.allowedAssetsCount(), 1);
        address[] memory allowedAssets = account.getAllowedAssets();
        assertEq(allowedAssets.length, 1);
        assertEq(allowedAssets[0], ASSET_A);
    }

    function test_setAssetAllowedDisablesAssetAndRemovesFromEnumerableList() public {
        _setAssetAllowedAsOwner(ASSET_A, true);
        _setAssetAllowedAsOwner(ASSET_B, true);

        vm.expectEmit(true, false, false, true, address(account));
        emit AssetAllowedSet(ASSET_A, false);
        _setAssetAllowedAsOwner(ASSET_A, false);

        assertFalse(account.isAssetAllowed(ASSET_A));
        assertTrue(account.isAssetAllowed(ASSET_B));
        assertEq(account.allowedAssetsCount(), 1);
        _assertAllowedAssetOccurrences(ASSET_A, 0);
        _assertAllowedAssetOccurrences(ASSET_B, 1);
    }

    function test_setAssetAllowedDisableIsIdempotentForEnumerableList() public {
        _setAssetAllowedAsOwner(ASSET_A, true);
        _setAssetAllowedAsOwner(ASSET_A, false);

        vm.expectEmit(true, false, false, true, address(account));
        emit AssetAllowedSet(ASSET_A, false);
        _setAssetAllowedAsOwner(ASSET_A, false);

        assertFalse(account.isAssetAllowed(ASSET_A));
        assertEq(account.allowedAssetsCount(), 0);
        _assertAllowedAssetOccurrences(ASSET_A, 0);
    }

    function test_setAssetAllowedRevertsForSessionKeyWithRoleBasedError() public {
        account.seedSessionKey(SESSION, _sessionKey(true, 2_000));

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.SESSION));
        vm.prank(SESSION);
        account.setAssetAllowed(ASSET_A, true);
    }

    function test_setAdapterAllowedUpdatesMappingAndEmitsEventOnEachCall() public {
        vm.expectEmit(true, false, false, true, address(account));
        emit AdapterAllowedSet(ADAPTER, true);
        _setAdapterAllowedAsOwner(ADAPTER, true);
        assertTrue(account.isAdapterAllowed(ADAPTER));

        vm.expectEmit(true, false, false, true, address(account));
        emit AdapterAllowedSet(ADAPTER, true);
        _setAdapterAllowedAsOwner(ADAPTER, true);
        assertTrue(account.isAdapterAllowed(ADAPTER));

        vm.expectEmit(true, false, false, true, address(account));
        emit AdapterAllowedSet(ADAPTER, false);
        _setAdapterAllowedAsOwner(ADAPTER, false);
        assertFalse(account.isAdapterAllowed(ADAPTER));
    }

    function test_setAdapterAllowedRevertsForStrangerWithRoleBasedError() public {
        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.NONE));
        vm.prank(STRANGER);
        account.setAdapterAllowed(ADAPTER, true);
    }

    function test_registerPriceOracleRevertsForSessionKeyWithRoleBasedError() public {
        account.seedSessionKey(SESSION, _sessionKey(true, 2_000));
        MockPriceOracle oracle = new MockPriceOracle(PRICE_SIGNER, 1 hours);

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.SESSION));
        vm.prank(SESSION);
        account.registerPriceOracle(oracle);
    }

    function test_registerPriceOracleStoresOracleAndEmitsSigner() public {
        MockPriceOracle oracle = new MockPriceOracle(PRICE_SIGNER, 1 hours);

        vm.expectEmit(true, true, false, true, address(account));
        emit PriceOracleRegistered(address(oracle), PRICE_SIGNER);

        vm.prank(OWNER);
        account.registerPriceOracle(oracle);

        assertEq(address(account.priceOracle()), address(oracle));
    }

    function test_registerPriceOracleAllowsOwnerToSwapOracle() public {
        MockPriceOracle firstOracle = new MockPriceOracle(PRICE_SIGNER, 1 hours);
        MockPriceOracle secondOracle = new MockPriceOracle(SECOND_PRICE_SIGNER, 2 hours);

        vm.startPrank(OWNER);
        account.registerPriceOracle(firstOracle);
        account.registerPriceOracle(secondOracle);
        vm.stopPrank();

        assertEq(address(account.priceOracle()), address(secondOracle));
    }

    function _sessionKey(bool enabled, uint64 validUntil) private pure returns (SessionKey memory sessionKey) {
        sessionKey = SessionKey({
            enabled: enabled,
            validUntil: validUntil,
            allowedActionTypes: 1,
            maxAmountInPerAction: 100 ether,
            scopeHash: keccak256("scope")
        });
    }

    function _mandateConfig(
        uint64 mandateVersion_,
        uint16 maxSingleAssetExposureBps_,
        uint256 maxTradeSizeUSDG_,
        uint16 maxDailyTurnoverBps_,
        uint64 cooldownSeconds_
    ) private pure returns (MandateConfig memory config) {
        config = MandateConfig({
            mandateVersion: mandateVersion_,
            maxSingleAssetExposureBps: maxSingleAssetExposureBps_,
            maxTradeSizeUSDG: maxTradeSizeUSDG_,
            maxDailyTurnoverBps: maxDailyTurnoverBps_,
            cooldownSeconds: cooldownSeconds_
        });
    }

    function _setAssetAllowedAsOwner(address asset, bool allowed) private {
        vm.prank(OWNER);
        account.setAssetAllowed(asset, allowed);
    }

    function _setAdapterAllowedAsOwner(address adapter, bool allowed) private {
        vm.prank(OWNER);
        account.setAdapterAllowed(adapter, allowed);
    }

    function _depositTokens(uint256 amount) private {
        token.mint(OWNER, amount);

        vm.prank(OWNER);
        token.transfer(address(account), amount);
    }

    function _assertAllowedAssetOccurrences(address asset, uint256 expectedCount) private view {
        address[] memory allowedAssets = account.getAllowedAssets();
        uint256 actualCount;

        for (uint256 i; i < allowedAssets.length; ++i) {
            if (allowedAssets[i] == asset) actualCount++;
        }

        assertEq(actualCount, expectedCount);
    }

    function _assertMandateEq(MandateConfig memory actual, MandateConfig memory expected) private pure {
        assertEq(actual.mandateVersion, expected.mandateVersion);
        assertEq(actual.maxSingleAssetExposureBps, expected.maxSingleAssetExposureBps);
        assertEq(actual.maxTradeSizeUSDG, expected.maxTradeSizeUSDG);
        assertEq(actual.maxDailyTurnoverBps, expected.maxDailyTurnoverBps);
        assertEq(actual.cooldownSeconds, expected.cooldownSeconds);
    }
}
