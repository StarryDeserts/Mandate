// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IAdapter {
    function swap(address assetIn, uint256 amountIn, address assetOut, uint256 minAmountOut, address recipient)
        external
        returns (uint256 amountOut);

    function quote(address assetIn, uint256 amountIn, address assetOut) external view returns (uint256 amountOut);
}
