// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IAdapterRegistry {
    function isAdapterAllowed(address adapter) external view returns (bool);
}
