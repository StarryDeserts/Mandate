// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

import {ActionType} from "../../src/types/Enums.sol";
import {Action} from "../../src/types/Types.sol";
import {ActionLib} from "../../src/lib/ActionLib.sol";

contract ActionLibTest is Test {
    bytes32 private constant ACTION_TYPEHASH = keccak256(
        "Action(uint16 actionSchemaVersion,address account,uint256 nonce,uint8 actionType,address assetIn,uint256 amountIn,address assetOut,uint256 minAmountOut,address adapter,address recipient,uint64 deadline)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant NAME = "MandateAction";
    bytes32 private constant EXPECTED_DEFAULT_DOMAIN_SEPARATOR =
        0x911ef18b22cabef5f3810ba24cf7337c2f51496248af45d04bbb07387817b68d;
    bytes32 private constant EXPECTED_DEFAULT_STRUCT_HASH =
        0xd6e73cbbd4b4db7e188ef75f0cc19ac1e0dbac55b3820f7add24e9b212a6a549;
    bytes32 private constant EXPECTED_DEFAULT_ACTION_ID =
        0xdc684f6d3d8a8fcb534f0c1b7384d2707d4cb505ca675daf6f4f918364a3aaec;

    function test_actionId_matches_hardcoded_canonical_vector() public pure {
        Action memory action = _defaultAction();
        bytes32 domainSeparator = _domainSeparator(action.actionSchemaVersion, 1, action.account);

        assertEq(domainSeparator, EXPECTED_DEFAULT_DOMAIN_SEPARATOR, "domain separator");
        assertEq(_structHash(action), EXPECTED_DEFAULT_STRUCT_HASH, "struct hash");
        assertEq(ActionLib.hashAction(action, domainSeparator), EXPECTED_DEFAULT_ACTION_ID, "action id");
    }

    function test_actionId_changes_on_every_field_mutation() public pure {
        Action memory action = _defaultAction();
        bytes32 domainSeparator = _domainSeparator(action.actionSchemaVersion, 1, action.account);
        bytes32 baseline = ActionLib.hashAction(action, domainSeparator);

        Action memory actionSchemaVersionMutated = _defaultAction();
        actionSchemaVersionMutated.actionSchemaVersion = 2;
        _assertHashDiffers(actionSchemaVersionMutated, domainSeparator, baseline, "actionSchemaVersion mutation");

        Action memory accountMutated = _defaultAction();
        accountMutated.account = address(0xA11CE2);
        _assertHashDiffers(accountMutated, domainSeparator, baseline, "account mutation");

        Action memory nonceMutated = _defaultAction();
        nonceMutated.nonce = 43;
        _assertHashDiffers(nonceMutated, domainSeparator, baseline, "nonce mutation");

        Action memory assetInMutated = _defaultAction();
        assetInMutated.assetIn = address(0x1112);
        _assertHashDiffers(assetInMutated, domainSeparator, baseline, "assetIn mutation");

        Action memory amountInMutated = _defaultAction();
        amountInMutated.amountIn = 1001 ether;
        _assertHashDiffers(amountInMutated, domainSeparator, baseline, "amountIn mutation");

        Action memory assetOutMutated = _defaultAction();
        assetOutMutated.assetOut = address(0x2223);
        _assertHashDiffers(assetOutMutated, domainSeparator, baseline, "assetOut mutation");

        Action memory minAmountOutMutated = _defaultAction();
        minAmountOutMutated.minAmountOut = 901 ether;
        _assertHashDiffers(minAmountOutMutated, domainSeparator, baseline, "minAmountOut mutation");

        Action memory adapterMutated = _defaultAction();
        adapterMutated.adapter = address(0x3334);
        _assertHashDiffers(adapterMutated, domainSeparator, baseline, "adapter mutation");

        Action memory recipientMutated = _defaultAction();
        recipientMutated.recipient = address(0x4445);
        _assertHashDiffers(recipientMutated, domainSeparator, baseline, "recipient mutation");

        Action memory deadlineMutated = _defaultAction();
        deadlineMutated.deadline = 1_800_000_001;
        _assertHashDiffers(deadlineMutated, domainSeparator, baseline, "deadline mutation");
    }

    function test_actionId_stable_for_same_input() public pure {
        Action memory action = _defaultAction();
        bytes32 domainSeparator = _domainSeparator(action.actionSchemaVersion, 1, action.account);

        bytes32 first = ActionLib.hashAction(action, domainSeparator);
        bytes32 second = ActionLib.hashAction(action, domainSeparator);

        assertEq(first, second);
        assertEq(first, _manualHashAction(action, domainSeparator));
    }

    function test_actionId_differs_across_account() public pure {
        Action memory firstAccount = _defaultAction();
        Action memory secondAccount = _defaultAction();
        secondAccount.account = address(0xA11CE2);

        assertTrue(_hash(firstAccount, 1) != _hash(secondAccount, 1));
    }

    function test_actionId_differs_across_chainId() public pure {
        Action memory action = _defaultAction();

        assertTrue(_hash(action, 1) != _hash(action, 2));
    }

    function _defaultAction() private pure returns (Action memory action) {
        action = Action({
            actionSchemaVersion: 1,
            account: address(0xA11CE1),
            nonce: 42,
            actionType: ActionType.SWAP,
            assetIn: address(0x1111),
            amountIn: 1000 ether,
            assetOut: address(0x2222),
            minAmountOut: 900 ether,
            adapter: address(0x3333),
            recipient: address(0x4444),
            deadline: 1_800_000_000
        });
    }

    function _hash(Action memory action, uint256 chainId) private pure returns (bytes32) {
        return ActionLib.hashAction(action, _domainSeparator(action.actionSchemaVersion, chainId, action.account));
    }

    function _manualHashAction(Action memory action, bytes32 domainSeparator) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, _structHash(action)));
    }

    function _structHash(Action memory action) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                ACTION_TYPEHASH,
                action.actionSchemaVersion,
                action.account,
                action.nonce,
                action.actionType,
                action.assetIn,
                action.amountIn,
                action.assetOut,
                action.minAmountOut,
                action.adapter,
                action.recipient,
                action.deadline
            )
        );
    }

    function _domainSeparator(uint16 actionSchemaVersion, uint256 chainId, address verifyingContract)
        private
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(NAME)),
                keccak256(bytes(Strings.toString(uint256(actionSchemaVersion)))),
                chainId,
                verifyingContract
            )
        );
    }

    function _assertHashDiffers(Action memory action, bytes32 domainSeparator, bytes32 baseline, string memory label)
        private
        pure
    {
        assertTrue(ActionLib.hashAction(action, domainSeparator) != baseline, label);
    }
}
