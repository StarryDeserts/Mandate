// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MandateAccount} from "../../src/MandateAccount.sol";
import {Role} from "../../src/types/Enums.sol";
import {NotAuthorized, ReservedSessionKeyScope} from "../../src/types/Errors.sol";
import {SessionKey} from "../../src/types/Types.sol";

contract MandateAccountSessionKeyTest is Test {
    event SessionKeyAdded(address indexed key, uint64 validUntil);
    event SessionKeyRevoked(address indexed key);

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant STRANGER = address(0xB0B);
    address private constant USDG = address(0xA55E7);

    MandateAccount private account;

    function setUp() public {
        vm.warp(1_000);
        account = new MandateAccount(OWNER, USDG);
    }

    function test_addSessionKeyRejectsNonDefaultReservedScopeFields() public {
        SessionKey memory withAllowedActionTypes = _sessionKey(true, 2_000);
        withAllowedActionTypes.allowedActionTypes = 1;

        vm.expectRevert(ReservedSessionKeyScope.selector);
        vm.prank(OWNER);
        account.addSessionKey(SESSION, withAllowedActionTypes);

        SessionKey memory withMaxAmountInPerAction = _sessionKey(true, 2_000);
        withMaxAmountInPerAction.maxAmountInPerAction = 1 ether;

        vm.expectRevert(ReservedSessionKeyScope.selector);
        vm.prank(OWNER);
        account.addSessionKey(SESSION, withMaxAmountInPerAction);

        SessionKey memory withScopeHash = _sessionKey(true, 2_000);
        withScopeHash.scopeHash = keccak256("reserved scope");

        vm.expectRevert(ReservedSessionKeyScope.selector);
        vm.prank(OWNER);
        account.addSessionKey(SESSION, withScopeHash);
    }

    function test_addSessionKeyStoresEnforcedFieldsAndGrantsSessionRole() public {
        vm.expectEmit(true, false, false, true, address(account));
        emit SessionKeyAdded(SESSION, 2_000);

        vm.prank(OWNER);
        account.addSessionKey(SESSION, _sessionKey(true, 2_000));

        assertEq(uint8(account.roleOf(SESSION)), uint8(Role.SESSION));

        (bool enabled, uint64 validUntil, uint8 allowedActionTypes, uint256 maxAmountInPerAction, bytes32 scopeHash) =
            account.sessionKeys(SESSION);
        assertTrue(enabled);
        assertEq(validUntil, 2_000);
        assertEq(allowedActionTypes, 0);
        assertEq(maxAmountInPerAction, 0);
        assertEq(scopeHash, bytes32(0));
    }

    function test_revokeSessionKeyDisablesSessionRole() public {
        vm.prank(OWNER);
        account.addSessionKey(SESSION, _sessionKey(true, 2_000));

        vm.expectEmit(true, false, false, true, address(account));
        emit SessionKeyRevoked(SESSION);

        vm.prank(OWNER);
        account.revokeSessionKey(SESSION);

        assertEq(uint8(account.roleOf(SESSION)), uint8(Role.NONE));

        (bool enabled,,,,) = account.sessionKeys(SESSION);
        assertFalse(enabled);
    }

    function test_addSessionKeyWithExpiredValidUntilIsInactive() public {
        vm.prank(OWNER);
        account.addSessionKey(SESSION, _sessionKey(true, 999));

        assertEq(uint8(account.roleOf(SESSION)), uint8(Role.NONE));
    }

    function test_addSessionKeyRevertsForStrangerWithRoleBasedError() public {
        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.NONE));
        vm.prank(STRANGER);
        account.addSessionKey(SESSION, _sessionKey(true, 2_000));
    }

    function test_revokeSessionKeyRevertsForSessionKeyWithRoleBasedError() public {
        vm.prank(OWNER);
        account.addSessionKey(SESSION, _sessionKey(true, 2_000));

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.SESSION));
        vm.prank(SESSION);
        account.revokeSessionKey(SESSION);
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
}
