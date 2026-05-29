// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockAMM {
    using SafeERC20 for IERC20;

    uint256 private constant RATE_SCALE = 1e18;

    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);
    error InsufficientLiquidity(address assetOut, uint256 available, uint256 required);
    error NotRateAdmin(address caller);
    error ZeroRate(address assetIn, address assetOut);
    error RateNotSet(address assetIn, address assetOut);

    address public immutable admin;

    mapping(address assetIn => mapping(address assetOut => uint256 rate1e18)) public rates;

    constructor() {
        admin = msg.sender;
    }

    function setRate(address assetIn, address assetOut, uint256 rate1e18) external {
        if (msg.sender != admin) {
            revert NotRateAdmin(msg.sender);
        }
        if (rate1e18 == 0) {
            revert ZeroRate(assetIn, assetOut);
        }

        rates[assetIn][assetOut] = rate1e18;
    }

    function quote(address assetIn, uint256 amountIn, address assetOut) public view returns (uint256 amountOut) {
        uint256 rate1e18 = rates[assetIn][assetOut];
        if (rate1e18 == 0) {
            revert RateNotSet(assetIn, assetOut);
        }

        amountOut = amountIn * rate1e18 / RATE_SCALE;
    }

    function swap(address assetIn, uint256 amountIn, address assetOut, uint256 minAmountOut, address to)
        external
        returns (uint256 amountOut)
    {
        amountOut = quote(assetIn, amountIn, assetOut);
        if (amountOut < minAmountOut) {
            revert InsufficientOutput(amountOut, minAmountOut);
        }

        uint256 available = IERC20(assetOut).balanceOf(address(this));
        if (available < amountOut) {
            revert InsufficientLiquidity(assetOut, available, amountOut);
        }

        IERC20(assetIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(assetOut).safeTransfer(to, amountOut);
    }
}
