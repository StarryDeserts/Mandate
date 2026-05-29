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

    function test_actionId_changes_on_every_field_mutation() public pure {
        Action memory action = _defaultAction();
        bytes32 baseline = _hash(action, 1);

        Action memory actionSchemaVersionMutated = _defaultAction();
        actionSchemaVersionMutated.actionSchemaVersion = 2;
        assertTrue(_hash(actionSchemaVersionMutated, 1) != baseline, "actionSchemaVersion mutation");

        Action memory accountMutated = _defaultAction();
        accountMutated.account = address(0xA11CE2);
        assertTrue(_hash(accountMutated, 1) != baseline, "account mutation");

        Action memory nonceMutated = _defaultAction();
        nonceMutated.nonce = 43;
        assertTrue(_hash(nonceMutated, 1) != baseline, "nonce mutation");

        Action memory actionTypeMutated = _defaultAction();
        _setActionTypeRaw(actionTypeMutated, 1);
        assertTrue(_hash(actionTypeMutated, 1) != baseline, "actionType mutation");

        Action memory assetInMutated = _defaultAction();
        assetInMutated.assetIn = address(0x1112);
        assertTrue(_hash(assetInMutated, 1) != baseline, "assetIn mutation");

        Action memory amountInMutated = _defaultAction();
        amountInMutated.amountIn = 1001 ether;
        assertTrue(_hash(amountInMutated, 1) != baseline, "amountIn mutation");

        Action memory assetOutMutated = _defaultAction();
        assetOutMutated.assetOut = address(0x2223);
        assertTrue(_hash(assetOutMutated, 1) != baseline, "assetOut mutation");

        Action memory minAmountOutMutated = _defaultAction();
        minAmountOutMutated.minAmountOut = 901 ether;
        assertTrue(_hash(minAmountOutMutated, 1) != baseline, "minAmountOut mutation");

        Action memory adapterMutated = _defaultAction();
        adapterMutated.adapter = address(0x3334);
        assertTrue(_hash(adapterMutated, 1) != baseline, "adapter mutation");

        Action memory recipientMutated = _defaultAction();
        recipientMutated.recipient = address(0x4445);
        assertTrue(_hash(recipientMutated, 1) != baseline, "recipient mutation");

        Action memory deadlineMutated = _defaultAction();
        deadlineMutated.deadline = 1_800_000_001;
        assertTrue(_hash(deadlineMutated, 1) != baseline, "deadline mutation");
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
        bytes32 structHash = keccak256(
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

        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
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

    function _setActionTypeRaw(Action memory action, uint8 rawActionType) private pure {
        assembly {
            mstore(add(action, 0x60), rawActionType)
        }
    }
}
