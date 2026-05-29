// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

import {IAdapterRegistry} from "./interfaces/IAdapterRegistry.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IMandateRegistry} from "./interfaces/IMandateRegistry.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {Role} from "./types/Enums.sol";
import {NotAuthorized, ReservedSessionKeyScope} from "./types/Errors.sol";
import {Decision, MandateConfig, SessionKey} from "./types/Types.sol";

contract MandateAccount is IAssetRegistry, IAdapterRegistry, IMandateRegistry, ReentrancyGuard {
    event MandateUpdated(uint64 mandateVersion, MandateConfig mandate);
    event AssetAllowedSet(address indexed asset, bool allowed);
    event AdapterAllowedSet(address indexed adapter, bool allowed);
    event PriceOracleRegistered(address indexed oracle, address indexed signer);
    event SessionKeyAdded(address indexed key, uint64 validUntil);
    event SessionKeyRevoked(address indexed key);

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

    function addSessionKey(address key, SessionKey memory sessionKey) external {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);
        if (
            sessionKey.allowedActionTypes != 0 || sessionKey.maxAmountInPerAction != 0
                || sessionKey.scopeHash != bytes32(0)
        ) revert ReservedSessionKeyScope();

        sessionKeys[key] = SessionKey({
            enabled: sessionKey.enabled,
            validUntil: sessionKey.validUntil,
            allowedActionTypes: 0,
            maxAmountInPerAction: 0,
            scopeHash: bytes32(0)
        });

        emit SessionKeyAdded(key, sessionKey.validUntil);
    }

    function revokeSessionKey(address key) external {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);

        sessionKeys[key].enabled = false;

        emit SessionKeyRevoked(key);
    }

    function setMandate(MandateConfig memory config) external {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);

        uint64 nextMandateVersion = mandate.mandateVersion + 1;
        config.mandateVersion = nextMandateVersion;
        mandate = config;

        emit MandateUpdated(nextMandateVersion, config);
    }

    function setAssetAllowed(address asset, bool allowed) external {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);

        if (isAssetAllowed[asset] != allowed) {
            isAssetAllowed[asset] = allowed;

            if (allowed) {
                allowedAssetsList.push(asset);
            } else {
                _removeAllowedAsset(asset);
            }
        }

        emit AssetAllowedSet(asset, allowed);
    }

    function setAdapterAllowed(address adapter, bool allowed) external {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);

        isAdapterAllowed[adapter] = allowed;

        emit AdapterAllowedSet(adapter, allowed);
    }

    function registerPriceOracle(IPriceOracle oracle) external {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);

        priceOracle = oracle;

        emit PriceOracleRegistered(address(oracle), oracle.signer());
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

    function _removeAllowedAsset(address asset) internal {
        uint256 allowedAssetsLength = allowedAssetsList.length;

        for (uint256 i; i < allowedAssetsLength; ++i) {
            if (allowedAssetsList[i] == asset) {
                allowedAssetsList[i] = allowedAssetsList[allowedAssetsLength - 1];
                allowedAssetsList.pop();
                return;
            }
        }
    }

    function _resolveActor() internal view returns (ActorContext memory context) {
        address actor = msg.sender;
        context.actor = actor;
        context.role = roleOf(actor);
        context.sessionKey = sessionKeys[actor];
    }
}
