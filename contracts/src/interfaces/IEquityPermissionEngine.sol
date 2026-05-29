// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../types/Types.sol";
import "../types/Enums.sol";

interface IEquityPermissionEngine {
    function evaluate(EvalInput calldata input)
        external
        pure
        returns (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps);
}
