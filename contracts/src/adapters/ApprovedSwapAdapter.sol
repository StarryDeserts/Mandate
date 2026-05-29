// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAdapter} from "../interfaces/IAdapter.sol";
import {MockAMM} from "../mocks/MockAMM.sol";

contract ApprovedSwapAdapter is IAdapter {
    using SafeERC20 for IERC20;

    error AdapterRecipientIsSelf();

    MockAMM public immutable amm;

    constructor(MockAMM amm_) {
        amm = amm_;
    }

    function swap(address assetIn, uint256 amountIn, address assetOut, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut)
    {
        if (recipient == address(this)) revert AdapterRecipientIsSelf();

        IERC20 tokenIn = IERC20(assetIn);

        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenIn.forceApprove(address(amm), amountIn);

        amountOut = amm.swap(assetIn, amountIn, assetOut, minAmountOut, recipient);

        tokenIn.forceApprove(address(amm), 0);
    }

    function quote(address assetIn, uint256 amountIn, address assetOut) external view returns (uint256 amountOut) {
        amountOut = amm.quote(assetIn, amountIn, assetOut);
    }
}
