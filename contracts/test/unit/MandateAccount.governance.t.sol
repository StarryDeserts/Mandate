// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MandateAccount} from "../../src/MandateAccount.sol";
import {NotAuthorized} from "../../src/types/Errors.sol";
import {Role} from "../../src/types/Enums.sol";
import {MandateConfig, SessionKey} from "../../src/types/Types.sol";

contract MandateAccountHarness is MandateAccount {
    constructor(address owner_) MandateAccount(owner_) {}

    function seedSessionKey(address key, SessionKey memory sessionKey) external {
        sessionKeys[key] = sessionKey;
    }

    function resolveActor() external view returns (ActorContext memory context) {
        context = _resolveActor();
    }
}

contract MandateAccountGovernanceTest is Test {
    event MandateUpdated(uint64 mandateVersion, MandateConfig mandate);

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant STRANGER = address(0xB0B);

    MandateAccountHarness private account;

    function setUp() public {
        vm.warp(1_000);
        account = new MandateAccountHarness(OWNER);
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

    function _assertMandateEq(MandateConfig memory actual, MandateConfig memory expected) private pure {
        assertEq(actual.mandateVersion, expected.mandateVersion);
        assertEq(actual.maxSingleAssetExposureBps, expected.maxSingleAssetExposureBps);
        assertEq(actual.maxTradeSizeUSDG, expected.maxTradeSizeUSDG);
        assertEq(actual.maxDailyTurnoverBps, expected.maxDailyTurnoverBps);
        assertEq(actual.cooldownSeconds, expected.cooldownSeconds);
    }
}
