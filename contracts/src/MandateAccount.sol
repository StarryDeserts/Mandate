// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {Math} from "openzeppelin-contracts/contracts/utils/math/Math.sol";

import {IAdapter} from "./interfaces/IAdapter.sol";
import {IAdapterRegistry} from "./interfaces/IAdapterRegistry.sol";
import {IAssetRegistry} from "./interfaces/IAssetRegistry.sol";
import {IMandateRegistry} from "./interfaces/IMandateRegistry.sol";
import {IPriceOracle} from "./interfaces/IPriceOracle.sol";
import {ActionLib} from "./lib/ActionLib.sol";
import {EquityPermissionEngine} from "./lib/EquityPermissionEngine.sol";
import {DecisionStatus, ReasonCode, Role} from "./types/Enums.sol";
import {
    AdapterNotAllowedNow,
    ApprovalExpired,
    AssetNotAllowedNow,
    BadActionSchema,
    BadNonce,
    DeadlinePassed,
    MandateVersionChanged,
    MissingPrice,
    NotApproved,
    NotAuthorized,
    PostCheckFailed,
    PriceStaleOnExecute,
    RecipientNotAllowed,
    ReservedSessionKeyScope,
    ReValidationFailed,
    SessionExpired,
    UnsortedOrDuplicateAsset,
    WrongAccount
} from "./types/Errors.sol";
import {Action, Decision, EvalInput, MandateConfig, PriceData, SessionKey} from "./types/Types.sol";

contract MandateAccount is IAssetRegistry, IAdapterRegistry, IMandateRegistry, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant ACTION_SCHEMA_VERSION = 1;
    uint64 public constant APPROVAL_TTL = 15 minutes;
    uint256 private constant USDG_SCALE = 1e18;

    bytes32 private constant ACTION_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant ACTION_DOMAIN_NAME = "MandateAction";

    event MandateUpdated(uint64 mandateVersion, MandateConfig mandate);
    event AssetAllowedSet(address indexed asset, bool allowed);
    event AdapterAllowedSet(address indexed adapter, bool allowed);
    event PriceOracleRegistered(address indexed oracle, address indexed signer);
    event SessionKeyAdded(address indexed key, uint64 validUntil);
    event SessionKeyRevoked(address indexed key);
    event Withdrawn(address indexed asset, uint256 amount, address indexed to);
    event ActionSubmitted(bytes32 indexed actionId, address indexed actor, Role role, DecisionStatus status);
    event ActionBlocked(
        bytes32 indexed actionId,
        ReasonCode reason,
        uint16 preExposureBps,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    );
    event ActionApproved(
        bytes32 indexed actionId,
        uint64 expiresAt,
        uint16 preExposureBps,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    );
    event ActionExecuted(
        bytes32 indexed actionId,
        uint256 amountIn,
        uint256 amountOut,
        uint16 postExposureBps,
        bytes32 priceDigest,
        uint64 priceTimestamp
    );

    struct ActorContext {
        address actor;
        Role role;
        SessionKey sessionKey;
    }

    struct ValuationRows {
        address[] assets;
        uint256[] balances;
        uint256[] pricesUSDG1e18;
        uint64 priceTimestamp;
    }

    struct ExecuteValidation {
        uint16 postExposureBps;
        bytes32 priceDigest;
        uint64 priceTimestamp;
        uint256 assetInPriceUSDG1e18;
    }

    address public owner;
    address public immutable usdg;
    mapping(address => SessionKey) public sessionKeys;
    MandateConfig public mandate;
    mapping(address => bool) public isAssetAllowed;
    mapping(address => bool) public isAdapterAllowed;
    address[] public allowedAssetsList;
    IPriceOracle public priceOracle;
    EquityPermissionEngine private immutable permissionEngine;
    uint256 public nextNonce;
    mapping(bytes32 => Decision) public decisions;
    uint256 public dailyTurnoverUsedUSDG;
    uint64 public turnoverDay;
    uint64 public lastTradeTimestamp;

    constructor(address owner_, address usdg_) {
        owner = owner_;
        usdg = usdg_;
        permissionEngine = new EquityPermissionEngine();
    }

    function roleOf(address actor) public view returns (Role) {
        if (actor == owner) return Role.OWNER;

        SessionKey memory sessionKey = sessionKeys[actor];
        if (sessionKey.enabled && block.timestamp <= sessionKey.validUntil) return Role.SESSION;

        return Role.NONE;
    }

    function withdraw(address asset, uint256 amount, address to) external nonReentrant {
        Role role = roleOf(msg.sender);
        if (role != Role.OWNER) revert NotAuthorized(role);

        IERC20(asset).safeTransfer(to, amount);

        emit Withdrawn(asset, amount, to);
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

    function computeActionId(Action calldata action) public view returns (bytes32) {
        Action memory actionMemory = action;
        return ActionLib.hashAction(actionMemory, _actionDomainSeparator(action.actionSchemaVersion));
    }

    function submitAction(Action calldata action, PriceData[] calldata prices)
        external
        returns (bytes32 actionId, ReasonCode code, uint16 preExposureBps, uint16 postExposureBps)
    {
        ActorContext memory context = _resolveActor();
        if (context.role == Role.NONE) {
            if (context.sessionKey.enabled && block.timestamp > context.sessionKey.validUntil) {
                revert SessionExpired(context.actor);
            }

            revert NotAuthorized(context.role);
        }

        if (action.account != address(this)) revert WrongAccount(address(this), action.account);
        if (action.actionSchemaVersion != ACTION_SCHEMA_VERSION) {
            revert BadActionSchema(ACTION_SCHEMA_VERSION, action.actionSchemaVersion);
        }
        if (action.nonce != nextNonce) revert BadNonce(nextNonce, action.nonce);
        if (block.timestamp > action.deadline) revert DeadlinePassed(action.deadline);

        uint64 priceTimestamp;
        actionId = computeActionId(action);
        (code, preExposureBps, postExposureBps, priceTimestamp) = _evaluateAction(action, prices);

        bytes32 priceDigest = keccak256(abi.encode(prices));
        DecisionStatus status = code == ReasonCode.OK ? DecisionStatus.APPROVED : DecisionStatus.BLOCKED;
        uint64 submittedAt = uint64(block.timestamp);
        uint64 expiresAt = status == DecisionStatus.APPROVED ? submittedAt + APPROVAL_TTL : 0;

        decisions[actionId] = Decision({
            status: status,
            mandateVersion: mandate.mandateVersion,
            submittedAt: submittedAt,
            expiresAt: expiresAt,
            priceDigest: priceDigest,
            priceTimestamp: priceTimestamp
        });
        nextNonce++;

        emit ActionSubmitted(actionId, context.actor, context.role, status);
        if (status == DecisionStatus.APPROVED) {
            emit ActionApproved(actionId, expiresAt, preExposureBps, postExposureBps, priceDigest, priceTimestamp);
        } else {
            emit ActionBlocked(actionId, code, preExposureBps, postExposureBps, priceDigest, priceTimestamp);
        }
    }

    function executeAction(Action calldata action, PriceData[] calldata prices)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        ActorContext memory context = _resolveActor();
        if (context.role == Role.NONE) {
            if (context.sessionKey.enabled && block.timestamp > context.sessionKey.validUntil) {
                revert SessionExpired(context.actor);
            }

            revert NotAuthorized(context.role);
        }

        if (action.account != address(this)) revert WrongAccount(address(this), action.account);
        if (action.actionSchemaVersion != ACTION_SCHEMA_VERSION) {
            revert BadActionSchema(ACTION_SCHEMA_VERSION, action.actionSchemaVersion);
        }
        if (block.timestamp > action.deadline) revert DeadlinePassed(action.deadline);

        bytes32 actionId = computeActionId(action);
        Decision storage decision = decisions[actionId];
        DecisionStatus status = decision.status;
        if (status != DecisionStatus.APPROVED) revert NotApproved(actionId, status);
        if (block.timestamp > decision.expiresAt) revert ApprovalExpired(actionId, decision.expiresAt);
        if (decision.mandateVersion != mandate.mandateVersion) {
            revert MandateVersionChanged(decision.mandateVersion, mandate.mandateVersion);
        }

        ExecuteValidation memory validation = _revalidateForExecute(action, prices);

        decision.status = DecisionStatus.EXECUTED;
        _recordExecution(action, validation.assetInPriceUSDG1e18);

        amountOut = _swapViaAdapter(action);
        if (amountOut < action.minAmountOut) revert PostCheckFailed(action.minAmountOut, amountOut);

        emit ActionExecuted(
            actionId,
            action.amountIn,
            amountOut,
            validation.postExposureBps,
            validation.priceDigest,
            validation.priceTimestamp
        );
    }

    function previewAction(Action calldata action, PriceData[] calldata prices)
        external
        view
        returns (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps)
    {
        uint64 priceTimestamp;
        (code, preExposureBps, postExposureBps, priceTimestamp) = _evaluateAction(action, prices);
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

    function _revalidateForExecute(Action calldata action, PriceData[] calldata prices)
        private
        view
        returns (ExecuteValidation memory validation)
    {
        ValuationRows memory rows = _valuationRows(action, prices, true, true);
        validation.priceTimestamp = rows.priceTimestamp;
        validation.priceDigest = keccak256(abi.encode(prices));
        validation.assetInPriceUSDG1e18 = _priceInRows(rows, action.assetIn);

        if (!isAssetAllowed[action.assetIn]) revert AssetNotAllowedNow(action.assetIn);
        if (!isAssetAllowed[action.assetOut]) revert AssetNotAllowedNow(action.assetOut);
        if (!isAdapterAllowed[action.adapter]) revert AdapterNotAllowedNow(action.adapter);
        if (action.recipient != address(this)) revert RecipientNotAllowed(action.recipient);

        EvalInput memory input;
        input.action = action;
        input.assetInAllowed = true;
        input.assetOutAllowed = true;
        input.adapterAllowed = true;
        input.mandate = mandate;
        input.assets = rows.assets;
        input.balances = rows.balances;
        input.pricesUSDG1e18 = rows.pricesUSDG1e18;
        input.dailyTurnoverUsedUSDG = dailyTurnoverUsedUSDG;
        input.lastTradeTimestamp = lastTradeTimestamp;
        input.nowTimestamp = uint64(block.timestamp);

        ReasonCode code;
        (code,, validation.postExposureBps) = permissionEngine.evaluate(input);
        if (code != ReasonCode.OK) revert ReValidationFailed(code);
    }

    function _swapViaAdapter(Action calldata action) private returns (uint256 amountOut) {
        IERC20 tokenIn = IERC20(action.assetIn);
        tokenIn.forceApprove(action.adapter, action.amountIn);
        amountOut = IAdapter(action.adapter)
            .swap(action.assetIn, action.amountIn, action.assetOut, action.minAmountOut, address(this));
        tokenIn.forceApprove(action.adapter, 0);
    }

    function _evaluateAction(Action calldata action, PriceData[] calldata prices)
        private
        view
        returns (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps, uint64 priceTimestamp)
    {
        bool assetInAllowed = isAssetAllowed[action.assetIn];
        bool assetOutAllowed = isAssetAllowed[action.assetOut];
        bool adapterAllowed = isAdapterAllowed[action.adapter];

        EvalInput memory input;
        input.action = action;
        input.assetInAllowed = assetInAllowed;
        input.assetOutAllowed = assetOutAllowed;
        input.adapterAllowed = adapterAllowed;
        input.mandate = mandate;
        input.dailyTurnoverUsedUSDG = dailyTurnoverUsedUSDG;
        input.lastTradeTimestamp = lastTradeTimestamp;
        input.nowTimestamp = uint64(block.timestamp);

        bool policyInputsAllowed = assetInAllowed && assetOutAllowed && adapterAllowed;
        ValuationRows memory rows = _valuationRows(action, prices, policyInputsAllowed, false);
        priceTimestamp = rows.priceTimestamp;

        if (policyInputsAllowed) {
            input.assets = rows.assets;
            input.balances = rows.balances;
            input.pricesUSDG1e18 = rows.pricesUSDG1e18;
        }

        (code, preExposureBps, postExposureBps) = permissionEngine.evaluate(input);
    }

    function _valuationRows(
        Action calldata action,
        PriceData[] calldata prices,
        bool includeRows,
        bool checkExecuteFreshness
    ) private view returns (ValuationRows memory rows) {
        _validatePriceOrder(prices);

        address[] memory candidates = new address[](allowedAssetsList.length + 2);
        uint256 candidateCount;

        for (uint256 i; i < allowedAssetsList.length; ++i) {
            address asset = allowedAssetsList[i];
            if (IERC20(asset).balanceOf(address(this)) != 0) {
                candidateCount = _appendUniqueAsset(candidates, candidateCount, asset);
            }
        }

        candidateCount = _appendUniqueAsset(candidates, candidateCount, action.assetIn);
        candidateCount = _appendUniqueAsset(candidates, candidateCount, action.assetOut);
        _sortAssets(candidates, candidateCount);

        if (includeRows) {
            rows.assets = new address[](candidateCount);
            rows.balances = new uint256[](candidateCount);
            rows.pricesUSDG1e18 = new uint256[](candidateCount);
        }

        uint64 minTimestamp = type(uint64).max;
        bool sawOraclePrice;
        for (uint256 i; i < candidateCount; ++i) {
            address asset = candidates[i];
            (uint256 priceUSDG1e18, uint64 rowTimestamp) = _priceForAsset(asset, prices, checkExecuteFreshness);

            if (asset != usdg) {
                sawOraclePrice = true;
                if (rowTimestamp < minTimestamp) minTimestamp = rowTimestamp;
            }

            if (includeRows) {
                rows.assets[i] = asset;
                rows.balances[i] = IERC20(asset).balanceOf(address(this));
                rows.pricesUSDG1e18[i] = priceUSDG1e18;
            }
        }

        if (sawOraclePrice) rows.priceTimestamp = minTimestamp;
    }

    function _appendUniqueAsset(address[] memory assets, uint256 assetCount, address asset)
        private
        pure
        returns (uint256)
    {
        for (uint256 i; i < assetCount; ++i) {
            if (assets[i] == asset) return assetCount;
        }

        assets[assetCount] = asset;
        return assetCount + 1;
    }

    function _sortAssets(address[] memory assets, uint256 assetCount) private pure {
        for (uint256 i = 1; i < assetCount; ++i) {
            address key = assets[i];
            uint256 j = i;

            while (j != 0 && assets[j - 1] > key) {
                assets[j] = assets[j - 1];
                --j;
            }

            assets[j] = key;
        }
    }

    function _validatePriceOrder(PriceData[] calldata prices) private view {
        address previousAsset;
        for (uint256 i; i < prices.length; ++i) {
            address currentAsset = prices[i].asset;
            if (currentAsset == usdg) revert UnsortedOrDuplicateAsset(currentAsset);
            if (i != 0 && currentAsset <= previousAsset) revert UnsortedOrDuplicateAsset(currentAsset);
            previousAsset = currentAsset;
        }
    }

    function _priceForAsset(address asset, PriceData[] calldata prices, bool checkExecuteFreshness)
        private
        view
        returns (uint256 priceUSDG1e18, uint64 timestamp)
    {
        if (asset == usdg) return (1 ether, 0);

        for (uint256 i; i < prices.length; ++i) {
            if (prices[i].asset == asset) {
                if (checkExecuteFreshness) _revertIfPriceStaleOnExecute(asset, prices[i].timestamp);
                return priceOracle.getPrice(asset, prices[i], address(this));
            }
        }

        revert MissingPrice(asset);
    }

    function _revertIfPriceStaleOnExecute(address asset, uint64 timestamp) private view {
        uint64 maxStaleness = priceOracle.maxStaleness();
        if (block.timestamp > uint256(timestamp) + uint256(maxStaleness)) {
            revert PriceStaleOnExecute(asset, timestamp);
        }
    }

    function _priceInRows(ValuationRows memory rows, address asset) private pure returns (uint256 priceUSDG1e18) {
        for (uint256 i; i < rows.assets.length; ++i) {
            if (rows.assets[i] == asset) return rows.pricesUSDG1e18[i];
        }
    }

    function _recordExecution(Action calldata action, uint256 assetInPriceUSDG1e18) private {
        uint64 currentDay = uint64(block.timestamp / 1 days);
        uint256 usedTurnover = dailyTurnoverUsedUSDG;
        if (currentDay > turnoverDay) {
            turnoverDay = currentDay;
            usedTurnover = 0;
        }

        uint256 tradeValueUSDG = Math.mulDiv(action.amountIn, assetInPriceUSDG1e18, USDG_SCALE);
        dailyTurnoverUsedUSDG = usedTurnover + tradeValueUSDG;
        lastTradeTimestamp = uint64(block.timestamp);
    }

    function _actionDomainSeparator(uint16 actionSchemaVersion) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                ACTION_DOMAIN_TYPEHASH,
                keccak256(bytes(ACTION_DOMAIN_NAME)),
                keccak256(bytes(Strings.toString(uint256(actionSchemaVersion)))),
                block.chainid,
                address(this)
            )
        );
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
