// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {IAdapterRegistry} from "./interfaces/IAdapterRegistry.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IMandateRegistry} from "./interfaces/IMandateRegistry.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {Role} from "./types/Enums.sol";
import {Decision, MandateConfig, SessionKey} from "./types/Types.sol";

contract MandateAccount is IAssetRegistry, IAdapterRegistry, IMandateRegistry, ReentrancyGuard {
    struct ActorContext {
        address actor;
        Role role;
        SessionKey sessionKey;
    }

    address public owner;
    mapping(address => SessionKey) public sessionKeys;
    MandateConfig public mandate;
    mapping(address => bool) public isAssetAllowed;
    mapping(address => bool) public isAdapterAllowed;
    address[] public allowedAssetsList;
    IPriceOracle public priceOracle;
    uint256 public nextNonce;
    mapping(bytes32 => Decision) public decisions;
    uint256 public dailyTurnoverUsedUSDG;
    uint64 public turnoverDay;
    uint64 public lastTradeTimestamp;

    constructor(address owner_) {
        owner = owner_;
    }

    function roleOf(address actor) public view returns (Role) {
        if (actor == owner) return Role.OWNER;

        SessionKey memory sessionKey = sessionKeys[actor];
        if (sessionKey.enabled && block.timestamp <= sessionKey.validUntil) return Role.SESSION;

        return Role.NONE;
    }

    function getMandate() external view returns (MandateConfig memory) {
        return mandate;
    }

    function mandateVersion() external view returns (uint64) {
        return mandate.mandateVersion;
    }

    function allowedAssetsCount() external view returns (uint256) {
        return allowedAssetsList.length;
    }

    function getAllowedAssets() external view returns (address[] memory) {
        return allowedAssetsList;
    }

    function _resolveActor() internal view returns (ActorContext memory context) {
        address actor = msg.sender;
        context.actor = actor;
        context.role = roleOf(actor);
        context.sessionKey = sessionKeys[actor];
    }
}
