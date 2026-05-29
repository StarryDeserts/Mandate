// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../types/Types.sol";

interface IMandateRegistry {
    function getMandate() external view returns (MandateConfig memory);

    function mandateVersion() external view returns (uint64);
}
