// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Action} from "../types/Types.sol";

library ActionLib {
    bytes32 internal constant ACTION_TYPEHASH = keccak256(
        "Action(uint16 actionSchemaVersion,address account,uint256 nonce,uint8 actionType,address assetIn,uint256 amountIn,address assetOut,uint256 minAmountOut,address adapter,address recipient,uint64 deadline)"
    );

    function hashAction(Action memory action, bytes32 domainSeparator) internal pure returns (bytes32) {
        uint8 actionType;
        assembly {
            actionType := mload(add(action, 0x60))
        }

        bytes32 structHash = keccak256(
            abi.encode(
                ACTION_TYPEHASH,
                action.actionSchemaVersion,
                action.account,
                action.nonce,
                actionType,
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
}
