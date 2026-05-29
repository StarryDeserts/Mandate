// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../types/Types.sol";

interface IPriceOracle {
    function getPrice(address asset, PriceData calldata att, address account)
        external
        view
        returns (uint256 priceUSDG1e18, uint64 timestamp);

    function maxStaleness() external view returns (uint64);

    function signer() external view returns (address);
}
