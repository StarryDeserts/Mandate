// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {MandateAccount} from "../src/MandateAccount.sol";
import {ApprovedSwapAdapter} from "../src/adapters/ApprovedSwapAdapter.sol";
import {MockAMM} from "../src/mocks/MockAMM.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {SignedDemoPriceFeed} from "../src/oracle/SignedDemoPriceFeed.sol";
import {ActionType, ReasonCode} from "../src/types/Enums.sol";
import {Action, MandateConfig, PriceData, SessionKey} from "../src/types/Types.sol";

contract SeedDemoScript is Script {
    struct EnvAddresses {
        address account;
        address usdg;
        address tsla;
        address amd;
        address amm;
        address adapter;
        address priceFeed;
    }

    struct DemoContracts {
        MandateAccount account;
        MockERC20 usdg;
        MockERC20 tsla;
        MockERC20 amd;
        MockAMM amm;
        ApprovedSwapAdapter adapter;
        SignedDemoPriceFeed priceFeed;
        address sessionKey;
        uint256 priceSignerPk;
        bool localDeployment;
    }

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant PRICE_DATA_TYPEHASH =
        keccak256("PriceData(address asset,uint256 priceUSDG1e18,uint64 timestamp,uint64 validUntil)");

    uint256 private constant DEFAULT_PRICE_SIGNER_PK = 0xA11CE51A9;
    address private constant DEFAULT_SESSION_KEY = address(0x5E5510);

    uint256 private constant USDG_BALANCE = 1_000 ether;
    uint256 private constant TSLA_BALANCE = 235 ether;
    uint256 private constant AMD_BALANCE = 11 ether;
    uint256 private constant AMM_TSLA_LIQUIDITY = 10_000 ether;
    uint256 private constant TSLA_PRICE = 2 ether;
    uint256 private constant AMD_PRICE = 1 ether;
    uint256 private constant USDG_TO_TSLA_RATE = 0.5 ether;
    uint256 private constant DANGEROUS_AMOUNT = 500 ether;
    uint16 private constant MAX_TSLA_EXPOSURE_BPS = 3_500;
    uint256 private constant MAX_TRADE_SIZE_USDG = 200 ether;
    uint16 private constant MAX_DAILY_TURNOVER_BPS = 2_000;
    uint64 private constant PRICE_MAX_STALENESS = 1 hours;
    uint64 private constant SESSION_TTL = 1 hours;
    uint64 private constant ACTION_TTL = 1 hours;

    error MissingEnvAddress(string name);
    error OwnerMustBeBroadcaster(address owner, address broadcaster);
    error OwnerEnvMismatch(address ownerEnv, address actualOwner);
    error AdapterAmmMismatch(address expected, address actual);
    error CannotConfigureAmmRate(address admin, address broadcaster, uint256 currentRate, uint256 requiredRate);
    error AccountBalanceAboveTarget(address token, uint256 current, uint256 target);
    error InvalidPrivateKey();
    error PriceSignerPrivateKeyMismatch(address expectedSigner, address actualSigner);
    error PriceSignerMustBeIndependent(address priceSigner, address owner, address broadcaster);
    error TimestampTooLarge(uint256 timestamp);
    error UnexpectedDangerousPreview(ReasonCode actual, uint16 postExposureBps);
    error NoSafeAmountFound();
    error SafeAmountOutOfBounds(uint256 safeAmount, uint256 maxTradeSizeUSDG);
    error UnexpectedSafePreview(ReasonCode actual, uint16 postExposureBps);
    error SafeExposureExceeded(uint16 postExposureBps, uint16 maxExposureBps);
    error PreExposureNotNearDemo(uint16 preExposureBps);

    function run() external returns (uint256 safeAmount) {
        address broadcaster = msg.sender;
        EnvAddresses memory env = _readEnvAddresses();
        uint256 priceSignerPk = _readPriceSignerPk();
        address sessionKey = vm.envOr("SESSION_KEY", DEFAULT_SESSION_KEY);

        DemoContracts memory demo;
        if (env.account == address(0)) {
            _revertIfPartialEnv(env);
            demo = _deployLocalDemo(broadcaster, priceSignerPk, sessionKey);
        } else {
            demo = _loadEnvDemo(env, priceSignerPk, sessionKey);
        }

        _assertOwnerCanSeed(demo.account, broadcaster);
        _assertPriceSignerKey(demo.priceFeed, demo.priceSignerPk, demo.account.owner(), broadcaster);
        _assertAdapterWiresAmm(demo.adapter, demo.amm);
        _logAddresses(demo);

        vm.startBroadcast();
        _seedBalances(demo);
        _configureAmm(demo, broadcaster);
        _configureMandate(demo);
        vm.stopBroadcast();

        safeAmount = _verifyDemoOutcomes(demo);
    }

    function _verifyDemoOutcomes(DemoContracts memory demo) private view returns (uint256 safeAmount) {
        PriceData[] memory prices = _freshPrices(demo);
        uint16 preExposureBps = _verifyDangerousPreview(demo, prices);
        safeAmount = _verifySafePreview(demo, prices, preExposureBps);
    }

    function _verifyDangerousPreview(DemoContracts memory demo, PriceData[] memory prices)
        private
        view
        returns (uint16 preExposureBps)
    {
        Action memory dangerousAction = _buyTslaAction(demo, DANGEROUS_AMOUNT);
        ReasonCode dangerousCode;
        uint16 dangerousPostExposureBps;
        (dangerousCode, preExposureBps, dangerousPostExposureBps) = demo.account.previewAction(dangerousAction, prices);

        console2.log("SeedDemo pre TSLA exposure bps", uint256(preExposureBps));
        console2.log("SeedDemo dangerous amount USDG", DANGEROUS_AMOUNT);
        console2.log("SeedDemo dangerous reason", uint256(dangerousCode));
        console2.log("SeedDemo dangerous post TSLA exposure bps", uint256(dangerousPostExposureBps));

        _assertPreExposureNearDemo(preExposureBps);
        if (dangerousCode != ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED) {
            revert UnexpectedDangerousPreview(dangerousCode, dangerousPostExposureBps);
        }
    }

    function _verifySafePreview(DemoContracts memory demo, PriceData[] memory prices, uint16 expectedPreExposureBps)
        private
        view
        returns (uint256 safeAmount)
    {
        safeAmount = _largestSafeBuyAmount(demo, prices);
        MandateConfig memory mandate = demo.account.getMandate();
        if (safeAmount == 0) revert NoSafeAmountFound();
        if (safeAmount > mandate.maxTradeSizeUSDG) revert SafeAmountOutOfBounds(safeAmount, mandate.maxTradeSizeUSDG);

        Action memory safeAction = _buyTslaAction(demo, safeAmount);
        ReasonCode safeCode;
        uint16 safePreExposureBps;
        uint16 safePostExposureBps;
        (safeCode, safePreExposureBps, safePostExposureBps) = demo.account.previewAction(safeAction, prices);

        console2.log("SeedDemo computed safe amount USDG", safeAmount);
        console2.log("SeedDemo safe reason", uint256(safeCode));
        console2.log("SeedDemo safe pre TSLA exposure bps", uint256(safePreExposureBps));
        console2.log("SeedDemo safe post TSLA exposure bps", uint256(safePostExposureBps));

        if (safePreExposureBps != expectedPreExposureBps) _assertPreExposureNearDemo(safePreExposureBps);
        if (safeCode != ReasonCode.OK) revert UnexpectedSafePreview(safeCode, safePostExposureBps);
        if (safePostExposureBps > mandate.maxSingleAssetExposureBps) {
            revert SafeExposureExceeded(safePostExposureBps, mandate.maxSingleAssetExposureBps);
        }
    }

    function _readEnvAddresses() private view returns (EnvAddresses memory env) {
        env.account = vm.envOr("ACCOUNT", address(0));
        env.usdg = vm.envOr("USDG", address(0));
        env.tsla = vm.envOr("TSLA", address(0));
        env.amd = vm.envOr("AMD", address(0));
        env.amm = vm.envOr("AMM", address(0));
        env.adapter = vm.envOr("ADAPTER", address(0));
        env.priceFeed = vm.envOr("PRICE_FEED", address(0));
    }

    function _readPriceSignerPk() private view returns (uint256 priceSignerPk) {
        priceSignerPk = vm.envOr("PRICE_SIGNER_PK", DEFAULT_PRICE_SIGNER_PK);
        if (priceSignerPk == 0) revert InvalidPrivateKey();
    }

    function _revertIfPartialEnv(EnvAddresses memory env) private pure {
        if (env.usdg != address(0)) revert MissingEnvAddress("ACCOUNT");
        if (env.tsla != address(0)) revert MissingEnvAddress("ACCOUNT");
        if (env.amd != address(0)) revert MissingEnvAddress("ACCOUNT");
        if (env.amm != address(0)) revert MissingEnvAddress("ACCOUNT");
        if (env.adapter != address(0)) revert MissingEnvAddress("ACCOUNT");
        if (env.priceFeed != address(0)) revert MissingEnvAddress("ACCOUNT");
    }

    function _deployLocalDemo(address broadcaster, uint256 priceSignerPk, address sessionKey)
        private
        returns (DemoContracts memory demo)
    {
        address owner = vm.envOr("OWNER", broadcaster);
        if (owner == address(0)) owner = broadcaster;
        if (owner != broadcaster) revert OwnerMustBeBroadcaster(owner, broadcaster);

        address priceSigner = vm.addr(priceSignerPk);

        vm.startBroadcast();
        demo.usdg = new MockERC20("Mandate Demo USDG", "USDG");
        demo.tsla = new MockERC20("Mandate Demo TSLA", "TSLA");
        demo.amd = new MockERC20("Mandate Demo AMD", "AMD");
        demo.amm = new MockAMM();
        demo.adapter = new ApprovedSwapAdapter(demo.amm);
        demo.priceFeed = new SignedDemoPriceFeed(priceSigner, PRICE_MAX_STALENESS);
        demo.account = new MandateAccount(owner, address(demo.usdg));
        vm.stopBroadcast();

        demo.sessionKey = sessionKey;
        demo.priceSignerPk = priceSignerPk;
        demo.localDeployment = true;
    }

    function _loadEnvDemo(EnvAddresses memory env, uint256 priceSignerPk, address sessionKey)
        private
        pure
        returns (DemoContracts memory demo)
    {
        if (env.usdg == address(0)) revert MissingEnvAddress("USDG");
        if (env.tsla == address(0)) revert MissingEnvAddress("TSLA");
        if (env.amd == address(0)) revert MissingEnvAddress("AMD");
        if (env.amm == address(0)) revert MissingEnvAddress("AMM");
        if (env.adapter == address(0)) revert MissingEnvAddress("ADAPTER");
        if (env.priceFeed == address(0)) revert MissingEnvAddress("PRICE_FEED");

        demo.account = MandateAccount(env.account);
        demo.usdg = MockERC20(env.usdg);
        demo.tsla = MockERC20(env.tsla);
        demo.amd = MockERC20(env.amd);
        demo.amm = MockAMM(env.amm);
        demo.adapter = ApprovedSwapAdapter(env.adapter);
        demo.priceFeed = SignedDemoPriceFeed(env.priceFeed);
        demo.sessionKey = sessionKey;
        demo.priceSignerPk = priceSignerPk;
        demo.localDeployment = false;
    }

    function _assertOwnerCanSeed(MandateAccount account, address broadcaster) private view {
        address ownerEnv = vm.envOr("OWNER", address(0));
        address actualOwner = account.owner();
        if (ownerEnv != address(0) && ownerEnv != actualOwner) revert OwnerEnvMismatch(ownerEnv, actualOwner);
        if (actualOwner != broadcaster) revert OwnerMustBeBroadcaster(actualOwner, broadcaster);
    }

    function _assertPriceSignerKey(
        SignedDemoPriceFeed priceFeed,
        uint256 priceSignerPk,
        address owner,
        address broadcaster
    ) private view {
        address actualSigner = vm.addr(priceSignerPk);
        address expectedSigner = priceFeed.signer();
        if (actualSigner != expectedSigner) revert PriceSignerPrivateKeyMismatch(expectedSigner, actualSigner);
        if (actualSigner == owner || actualSigner == broadcaster) {
            revert PriceSignerMustBeIndependent(actualSigner, owner, broadcaster);
        }
    }

    function _assertAdapterWiresAmm(ApprovedSwapAdapter adapter, MockAMM amm) private view {
        address actualAmm = address(adapter.amm());
        address expectedAmm = address(amm);
        if (actualAmm != expectedAmm) revert AdapterAmmMismatch(expectedAmm, actualAmm);
    }

    function _seedBalances(DemoContracts memory demo) private {
        _seedAccountBalance(demo.usdg, demo.account, USDG_BALANCE);
        _seedAccountBalance(demo.tsla, demo.account, TSLA_BALANCE);
        _seedAccountBalance(demo.amd, demo.account, AMD_BALANCE);
        _seedMinimumAmmLiquidity(demo.tsla, demo.amm, AMM_TSLA_LIQUIDITY);

        console2.log("SeedDemo account USDG balance", demo.usdg.balanceOf(address(demo.account)));
        console2.log("SeedDemo account TSLA balance", demo.tsla.balanceOf(address(demo.account)));
        console2.log("SeedDemo account AMD balance", demo.amd.balanceOf(address(demo.account)));
        console2.log("SeedDemo AMM TSLA liquidity", demo.tsla.balanceOf(address(demo.amm)));
    }

    function _seedAccountBalance(MockERC20 token, MandateAccount account, uint256 target) private {
        uint256 current = token.balanceOf(address(account));
        if (current > target) revert AccountBalanceAboveTarget(address(token), current, target);
        if (current < target) token.mint(address(account), target - current);
    }

    function _seedMinimumAmmLiquidity(MockERC20 token, MockAMM amm, uint256 minimumLiquidity) private {
        uint256 current = token.balanceOf(address(amm));
        if (current < minimumLiquidity) token.mint(address(amm), minimumLiquidity - current);
    }

    function _configureAmm(DemoContracts memory demo, address broadcaster) private {
        uint256 currentRate = demo.amm.rates(address(demo.usdg), address(demo.tsla));
        if (currentRate == USDG_TO_TSLA_RATE) return;

        address admin = demo.amm.admin();
        if (admin != broadcaster) {
            revert CannotConfigureAmmRate(admin, broadcaster, currentRate, USDG_TO_TSLA_RATE);
        }

        demo.amm.setRate(address(demo.usdg), address(demo.tsla), USDG_TO_TSLA_RATE);
        console2.log("SeedDemo AMM USDG->TSLA rate", USDG_TO_TSLA_RATE);
    }

    function _configureMandate(DemoContracts memory demo) private {
        demo.account
            .setMandate(
                MandateConfig({
                    mandateVersion: 0,
                    maxSingleAssetExposureBps: MAX_TSLA_EXPOSURE_BPS,
                    maxTradeSizeUSDG: MAX_TRADE_SIZE_USDG,
                    maxDailyTurnoverBps: MAX_DAILY_TURNOVER_BPS,
                    cooldownSeconds: 0
                })
            );
        demo.account.setAdapterAllowed(address(demo.adapter), true);
        demo.account.registerPriceOracle(demo.priceFeed);
        demo.account.setAssetAllowed(address(demo.usdg), true);
        demo.account.setAssetAllowed(address(demo.tsla), true);
        demo.account.setAssetAllowed(address(demo.amd), true);
        demo.account.addSessionKey(demo.sessionKey, _sessionKey(_futureTimestamp(SESSION_TTL)));

        console2.log("SeedDemo mandate max exposure bps", uint256(MAX_TSLA_EXPOSURE_BPS));
        console2.log("SeedDemo mandate max trade USDG", MAX_TRADE_SIZE_USDG);
        console2.log("SeedDemo mandate max daily turnover bps", uint256(MAX_DAILY_TURNOVER_BPS));
        console2.log("SeedDemo mandate cooldown", uint256(0));
        console2.log("SeedDemo session key", demo.sessionKey);
    }

    function _sessionKey(uint64 validUntil) private pure returns (SessionKey memory sessionKey) {
        sessionKey = SessionKey({
            enabled: true, validUntil: validUntil, allowedActionTypes: 0, maxAmountInPerAction: 0, scopeHash: bytes32(0)
        });
    }

    function _freshPrices(DemoContracts memory demo) private view returns (PriceData[] memory prices) {
        prices = new PriceData[](2);

        uint64 timestamp = _currentTimestamp();
        uint64 validUntil = _futureTimestamp(1 hours);

        if (address(demo.amd) < address(demo.tsla)) {
            prices[0] = _signedPriceData(demo, address(demo.amd), AMD_PRICE, timestamp, validUntil);
            prices[1] = _signedPriceData(demo, address(demo.tsla), TSLA_PRICE, timestamp, validUntil);
        } else {
            prices[0] = _signedPriceData(demo, address(demo.tsla), TSLA_PRICE, timestamp, validUntil);
            prices[1] = _signedPriceData(demo, address(demo.amd), AMD_PRICE, timestamp, validUntil);
        }

        console2.log("SeedDemo price rows", prices.length);
        console2.log("SeedDemo TSLA price USDG", TSLA_PRICE);
        console2.log("SeedDemo AMD price USDG", AMD_PRICE);
    }

    function _signedPriceData(
        DemoContracts memory demo,
        address asset,
        uint256 priceUSDG1e18,
        uint64 timestamp,
        uint64 validUntil
    ) private view returns (PriceData memory priceData) {
        bytes32 structHash = keccak256(abi.encode(PRICE_DATA_TYPEHASH, asset, priceUSDG1e18, timestamp, validUntil));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _priceFeedDomainSeparator(demo.priceFeed), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(demo.priceSignerPk, digest);

        priceData = PriceData({
            asset: asset,
            priceUSDG1e18: priceUSDG1e18,
            timestamp: timestamp,
            validUntil: validUntil,
            signature: abi.encodePacked(r, s, v)
        });
    }

    function _priceFeedDomainSeparator(SignedDemoPriceFeed priceFeed) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("MandatePriceFeed")),
                keccak256(bytes("1")),
                block.chainid,
                address(priceFeed)
            )
        );
    }

    function _largestSafeBuyAmount(DemoContracts memory demo, PriceData[] memory prices)
        private
        view
        returns (uint256 safeAmount)
    {
        MandateConfig memory mandate = demo.account.getMandate();
        uint256 upperBound = _min(mandate.maxTradeSizeUSDG, demo.usdg.balanceOf(address(demo.account)));
        uint256 step = 1 ether;
        uint256 candidate = upperBound - (upperBound % step);

        while (candidate != 0) {
            Action memory action = _buyTslaAction(demo, candidate);
            (ReasonCode code,, uint16 postExposureBps) = demo.account.previewAction(action, prices);
            if (code == ReasonCode.OK && postExposureBps <= mandate.maxSingleAssetExposureBps) return candidate;
            if (candidate <= step) return 0;
            candidate -= step;
        }
    }

    function _buyTslaAction(DemoContracts memory demo, uint256 amountIn) private view returns (Action memory action) {
        action = Action({
            actionSchemaVersion: demo.account.ACTION_SCHEMA_VERSION(),
            account: address(demo.account),
            nonce: demo.account.nextNonce(),
            actionType: ActionType.SWAP,
            assetIn: address(demo.usdg),
            amountIn: amountIn,
            assetOut: address(demo.tsla),
            minAmountOut: amountIn / 2,
            adapter: address(demo.adapter),
            recipient: address(demo.account),
            deadline: _futureTimestamp(ACTION_TTL)
        });
    }

    function _assertPreExposureNearDemo(uint16 preExposureBps) private pure {
        if (preExposureBps < 3_100 || preExposureBps > 3_300) revert PreExposureNotNearDemo(preExposureBps);
    }

    function _currentTimestamp() private view returns (uint64) {
        // Demo script validity windows are intentionally derived from the dry-run block timestamp.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > type(uint64).max) revert TimestampTooLarge(block.timestamp);
        // casting to uint64 is safe because block.timestamp is bounded above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(block.timestamp);
    }

    function _futureTimestamp(uint64 offset) private view returns (uint64) {
        // Demo script validity windows are intentionally derived from the dry-run block timestamp.
        // forge-lint: disable-next-line(block-timestamp)
        uint256 timestamp = block.timestamp + uint256(offset);
        // Timestamp is bounded before casting to uint64.
        // forge-lint: disable-next-line(block-timestamp)
        if (timestamp > type(uint64).max) revert TimestampTooLarge(timestamp);
        // casting to uint64 is safe because timestamp is bounded above.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(timestamp);
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _logAddresses(DemoContracts memory demo) private view {
        console2.log("SeedDemo local deployment", demo.localDeployment);
        console2.log("SeedDemo owner", demo.account.owner());
        console2.log("SeedDemo USDG", address(demo.usdg));
        console2.log("SeedDemo TSLA", address(demo.tsla));
        console2.log("SeedDemo AMD", address(demo.amd));
        console2.log("SeedDemo MockAMM", address(demo.amm));
        console2.log("SeedDemo ApprovedSwapAdapter", address(demo.adapter));
        console2.log("SeedDemo SignedDemoPriceFeed", address(demo.priceFeed));
        console2.log("SeedDemo MandateAccount", address(demo.account));
        console2.log("SeedDemo price signer", demo.priceFeed.signer());
    }
}
