// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MandateAccount} from "../../src/MandateAccount.sol";
import {Role} from "../../src/types/Enums.sol";
import {SessionKey} from "../../src/types/Types.sol";

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

    function _sessionKey(bool enabled, uint64 validUntil) private pure returns (SessionKey memory sessionKey) {
        sessionKey = SessionKey({
            enabled: enabled,
            validUntil: validUntil,
            allowedActionTypes: 1,
            maxAmountInPerAction: 100 ether,
            scopeHash: keccak256("scope")
        });
    }
}
