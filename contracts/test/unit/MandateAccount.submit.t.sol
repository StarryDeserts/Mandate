// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

import {MandateAccount} from "../../src/MandateAccount.sol";
import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";
import {ActionLib} from "../../src/lib/ActionLib.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {SignedDemoPriceFeed} from "../../src/oracle/SignedDemoPriceFeed.sol";
import {ActionType, DecisionStatus, ReasonCode, Role} from "../../src/types/Enums.sol";
import {
    BadActionSchema,
    BadNonce,
    DeadlinePassed,
    MissingPrice,
    NotAuthorized,
    PriceUnverified,
    SessionExpired,
    UnsortedOrDuplicateAsset,
    WrongAccount
} from "../../src/types/Errors.sol";
import {Action, MandateConfig, PriceData, SessionKey} from "../../src/types/Types.sol";

contract PreviewPriceOracle is IPriceOracle {
    address public constant PRICE_SIGNER = address(0x51A9E2);
    uint64 public constant MAX_STALENESS = 1 hours;

    function getPrice(address asset, PriceData calldata att, address)
        external
        pure
        returns (uint256 priceUSDG1e18, uint64 timestamp)
    {
        require(att.asset == asset, "wrong asset");

        priceUSDG1e18 = att.priceUSDG1e18;
        timestamp = att.timestamp;
    }

    function maxStaleness() external pure returns (uint64) {
        return MAX_STALENESS;
    }

    function signer() external pure returns (address) {
        return PRICE_SIGNER;
    }
}

contract MandateAccountSubmitTest is Test {
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

    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant ACTION_DOMAIN_NAME = "MandateAction";
    bytes32 private constant PRICE_DATA_TYPEHASH =
        keccak256("PriceData(address asset,uint256 priceUSDG1e18,uint64 timestamp,uint64 validUntil)");
    bytes32 private constant PRICE_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant PRICE_DOMAIN_NAME = "MandatePriceFeed";
    string private constant PRICE_DOMAIN_VERSION = "1";

    uint256 private constant PRICE_SIGNER_KEY = 0xA11CE;
    uint256 private constant WRONG_PRICE_SIGNER_KEY = 0xB0B;
    uint64 private constant SIGNED_PRICE_MAX_STALENESS = 1 hours;

    address private constant OWNER = address(0xA11CE);
    address private constant SESSION = address(0x5E5510);
    address private constant STRANGER = address(0xB0B);
    address private constant ADAPTER = address(0xADA);
    address private constant RECIPIENT = address(0xCAFE);

    MandateAccount private account;
    MockERC20 private usdg;
    MockERC20 private tsla;
    PreviewPriceOracle private oracle;

    function setUp() public {
        vm.warp(2_000);

        account = new MandateAccount(OWNER);
        usdg = new MockERC20("Mock USDG", "mUSDG");
        tsla = new MockERC20("Mock TSLA", "mTSLA");
        oracle = new PreviewPriceOracle();

        usdg.mint(address(account), 1_000 ether);
        tsla.mint(address(account), 100 ether);

        vm.startPrank(OWNER);
        account.setMandate(
            MandateConfig({
                mandateVersion: 0,
                maxSingleAssetExposureBps: 3_500,
                maxTradeSizeUSDG: 1_000 ether,
                maxDailyTurnoverBps: 10_000,
                cooldownSeconds: 0
            })
        );
        account.setAdapterAllowed(ADAPTER, true);
        account.registerPriceOracle(oracle);
        _allowAssetsInReverseAddressOrder();
        vm.stopPrank();
    }

    function test_previewDangerousBuyReturnsExposureReasonWithPreAndPostBps() public view {
        Action memory action = _buyTslaAction(300 ether);
        PriceData[] memory prices = _previewPrices();

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = account.previewAction(action, prices);

        assertEq(uint8(code), uint8(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED));
        assertEq(preExposureBps, 1_666);
        assertEq(postExposureBps, 4_166);
    }

    function test_previewSafeBuyReturnsOkWithPreAndPostBps() public view {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();

        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) = account.previewAction(action, prices);

        assertEq(uint8(code), uint8(ReasonCode.OK));
        assertEq(preExposureBps, 1_666);
        assertEq(postExposureBps, 2_500);
    }

    function test_previewSafeBuyIsStaticcallSafeAndDoesNotAdvanceDecisionState() public view {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();

        (bool ok, bytes memory result) =
            address(account).staticcall(abi.encodeCall(MandateAccount.previewAction, (action, prices)));

        assertTrue(ok);
        (ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) =
            abi.decode(result, (ReasonCode, uint16, uint16));
        assertEq(uint8(code), uint8(ReasonCode.OK));
        assertEq(preExposureBps, 1_666);
        assertEq(postExposureBps, 2_500);
        assertEq(account.nextNonce(), 0);
        assertEq(account.dailyTurnoverUsedUSDG(), 0);
        assertEq(account.lastTradeTimestamp(), 0);
    }

    function test_previewRevertsWhenRequiredAssetPriceIsMissing() public {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = new PriceData[](1);
        prices[0] = _priceData(address(usdg), 1 ether);

        vm.expectRevert(abi.encodeWithSelector(MissingPrice.selector, address(tsla)));
        account.previewAction(action, prices);
    }

    function test_computeActionIdUsesCanonicalActionDomain() public view {
        Action memory action = _buyTslaAction(100 ether);
        bytes32 domainSeparator = _actionDomainSeparator(action.actionSchemaVersion, block.chainid, address(account));

        assertEq(account.computeActionId(action), ActionLib.hashAction(action, domainSeparator));
    }

    function test_submitDangerousBuyStoresBlockedDecisionEmitsEventsAndConsumesNonce() public {
        Action memory action = _buyTslaAction(300 ether);
        PriceData[] memory prices = _previewPricesWithTimestamps(1_900, 1_850);
        bytes32 actionId = account.computeActionId(action);
        bytes32 priceDigest = keccak256(abi.encode(prices));

        vm.expectEmit(true, true, false, true, address(account));
        emit ActionSubmitted(actionId, OWNER, Role.OWNER, DecisionStatus.BLOCKED);
        vm.expectEmit(true, false, false, true, address(account));
        emit ActionBlocked(
            actionId, ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED, 1_666, 4_166, priceDigest, uint64(1_850)
        );

        vm.prank(OWNER);
        (bytes32 returnedActionId, ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) =
            account.submitAction(action, prices);

        assertEq(returnedActionId, actionId);
        assertEq(uint8(code), uint8(ReasonCode.SINGLE_ASSET_EXPOSURE_EXCEEDED));
        assertEq(preExposureBps, 1_666);
        assertEq(postExposureBps, 4_166);
        assertEq(account.nextNonce(), 1);
        _assertDecision(actionId, DecisionStatus.BLOCKED, 1, uint64(block.timestamp), 0, priceDigest, uint64(1_850));
    }

    function test_submitSafeBuyStoresApprovedDecisionEmitsEventsAndConsumesNonce() public {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPricesWithTimestamps(1_900, 1_850);
        bytes32 actionId = account.computeActionId(action);
        bytes32 priceDigest = keccak256(abi.encode(prices));
        uint64 expiresAt = uint64(block.timestamp) + account.APPROVAL_TTL();

        vm.expectEmit(true, true, false, true, address(account));
        emit ActionSubmitted(actionId, OWNER, Role.OWNER, DecisionStatus.APPROVED);
        vm.expectEmit(true, false, false, true, address(account));
        emit ActionApproved(actionId, expiresAt, 1_666, 2_500, priceDigest, uint64(1_850));

        vm.prank(OWNER);
        (bytes32 returnedActionId, ReasonCode code, uint16 preExposureBps, uint16 postExposureBps) =
            account.submitAction(action, prices);

        assertEq(returnedActionId, actionId);
        assertEq(uint8(code), uint8(ReasonCode.OK));
        assertEq(preExposureBps, 1_666);
        assertEq(postExposureBps, 2_500);
        assertEq(account.nextNonce(), 1);
        _assertDecision(
            actionId, DecisionStatus.APPROVED, 1, uint64(block.timestamp), expiresAt, priceDigest, uint64(1_850)
        );
    }

    function test_submitSafeBuyAllowsActiveSessionKey() public {
        _addSessionKey(SESSION, true, 2_500);
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();
        bytes32 actionId = account.computeActionId(action);

        vm.expectEmit(true, true, false, true, address(account));
        emit ActionSubmitted(actionId, SESSION, Role.SESSION, DecisionStatus.APPROVED);

        vm.prank(SESSION);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 1);
        _assertDecisionStatus(actionId, DecisionStatus.APPROVED);
    }

    function test_submitRevertsForWrongAccountAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        action.account = address(0xBAD);
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(WrongAccount.selector, address(account), address(0xBAD)));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForBadSchemaAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        action.actionSchemaVersion = 2;
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(BadActionSchema.selector, account.ACTION_SCHEMA_VERSION(), uint16(2)));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForBadNonceAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        action.nonce = 1;
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(BadNonce.selector, uint256(0), uint256(1)));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForPassedDeadlineAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        action.deadline = uint64(block.timestamp - 1);
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(DeadlinePassed.selector, action.deadline));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForUnverifiedPriceAndLeavesNonceUnchanged() public {
        SignedDemoPriceFeed signedFeed = new SignedDemoPriceFeed(vm.addr(PRICE_SIGNER_KEY), SIGNED_PRICE_MAX_STALENESS);
        vm.prank(OWNER);
        account.registerPriceOracle(signedFeed);
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _signedPrices(signedFeed, WRONG_PRICE_SIGNER_KEY);
        address expectedRejectedAsset = address(usdg) < address(tsla) ? address(usdg) : address(tsla);

        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, expectedRejectedAsset));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForMissingPriceAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = new PriceData[](1);
        prices[0] = _priceData(address(usdg), 1 ether);

        vm.expectRevert(abi.encodeWithSelector(MissingPrice.selector, address(tsla)));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForUnsortedPricesAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();
        _swapPrices(prices, 0, 1);

        vm.expectRevert(abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, prices[1].asset));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForDuplicatePricesAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();
        prices[1] = prices[0];

        vm.expectRevert(abi.encodeWithSelector(UnsortedOrDuplicateAsset.selector, prices[1].asset));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForMissingNonActionPortfolioAssetPriceAndLeavesNonceUnchanged() public {
        MockERC20 portfolioAsset = new MockERC20("Mock NVDA", "mNVDA");
        portfolioAsset.mint(address(account), 50 ether);
        vm.prank(OWNER);
        account.setAssetAllowed(address(portfolioAsset), true);
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(MissingPrice.selector, address(portfolioAsset)));
        vm.prank(OWNER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForExpiredEnabledSessionKeyAndLeavesNonceUnchanged() public {
        _addSessionKey(SESSION, true, 2_100);
        vm.warp(2_101);
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(SessionExpired.selector, SESSION));
        vm.prank(SESSION);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function test_submitRevertsForUnknownCallerAndLeavesNonceUnchanged() public {
        Action memory action = _buyTslaAction(100 ether);
        PriceData[] memory prices = _previewPrices();

        vm.expectRevert(abi.encodeWithSelector(NotAuthorized.selector, Role.NONE));
        vm.prank(STRANGER);
        account.submitAction(action, prices);

        assertEq(account.nextNonce(), 0);
    }

    function _allowAssetsInReverseAddressOrder() private {
        address assetA = address(usdg);
        address assetB = address(tsla);

        if (assetA < assetB) {
            account.setAssetAllowed(assetB, true);
            account.setAssetAllowed(assetA, true);
        } else {
            account.setAssetAllowed(assetA, true);
            account.setAssetAllowed(assetB, true);
        }
    }

    function _buyTslaAction(uint256 amountIn) private view returns (Action memory action) {
        action = Action({
            actionSchemaVersion: 1,
            account: address(account),
            nonce: 0,
            actionType: ActionType.SWAP,
            assetIn: address(usdg),
            amountIn: amountIn,
            assetOut: address(tsla),
            minAmountOut: 0,
            adapter: ADAPTER,
            recipient: RECIPIENT,
            deadline: 3_000
        });
    }

    function _previewPrices() private view returns (PriceData[] memory prices) {
        prices = _previewPricesWithTimestamps(1_900, 1_900);
    }

    function _previewPricesWithTimestamps(uint64 tslaTimestamp, uint64 usdgTimestamp)
        private
        view
        returns (PriceData[] memory prices)
    {
        prices = new PriceData[](2);
        PriceData memory tslaPrice = _priceData(address(tsla), 2 ether, tslaTimestamp);
        PriceData memory usdgPrice = _priceData(address(usdg), 1 ether, usdgTimestamp);
        if (address(tsla) < address(usdg)) {
            prices[0] = tslaPrice;
            prices[1] = usdgPrice;
        } else {
            prices[0] = usdgPrice;
            prices[1] = tslaPrice;
        }
    }

    function _swapPrices(PriceData[] memory prices, uint256 firstIndex, uint256 secondIndex) private pure {
        PriceData memory first = prices[firstIndex];
        prices[firstIndex] = prices[secondIndex];
        prices[secondIndex] = first;
    }

    function _priceData(address asset, uint256 priceUSDG1e18) private pure returns (PriceData memory price) {
        price = _priceData(asset, priceUSDG1e18, 1_900);
    }

    function _priceData(address asset, uint256 priceUSDG1e18, uint64 timestamp)
        private
        pure
        returns (PriceData memory price)
    {
        price = PriceData({
            asset: asset, priceUSDG1e18: priceUSDG1e18, timestamp: timestamp, validUntil: 2_500, signature: ""
        });
    }

    function _addSessionKey(address key, bool enabled, uint64 validUntil) private {
        vm.prank(OWNER);
        account.addSessionKey(
            key,
            SessionKey({
                enabled: enabled,
                validUntil: validUntil,
                allowedActionTypes: 0,
                maxAmountInPerAction: 0,
                scopeHash: bytes32(0)
            })
        );
    }

    function _signedPrices(SignedDemoPriceFeed signedFeed, uint256 signingKey)
        private
        view
        returns (PriceData[] memory prices)
    {
        prices = new PriceData[](2);
        PriceData memory tslaPrice = _signedPriceData(signedFeed, signingKey, address(tsla), 2 ether);
        PriceData memory usdgPrice = _signedPriceData(signedFeed, signingKey, address(usdg), 1 ether);
        if (address(tsla) < address(usdg)) {
            prices[0] = tslaPrice;
            prices[1] = usdgPrice;
        } else {
            prices[0] = usdgPrice;
            prices[1] = tslaPrice;
        }
    }

    function _signedPriceData(SignedDemoPriceFeed signedFeed, uint256 signingKey, address asset, uint256 priceUSDG1e18)
        private
        view
        returns (PriceData memory price)
    {
        uint64 timestamp = uint64(block.timestamp);
        uint64 validUntil = timestamp + 1 hours;
        price = PriceData({
            asset: asset,
            priceUSDG1e18: priceUSDG1e18,
            timestamp: timestamp,
            validUntil: validUntil,
            signature: _signPriceData(address(signedFeed), signingKey, asset, priceUSDG1e18, timestamp, validUntil)
        });
    }

    function _signPriceData(
        address signedFeed,
        uint256 signingKey,
        address asset,
        uint256 priceUSDG1e18,
        uint64 timestamp,
        uint64 validUntil
    ) private view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _priceDomainSeparator(signedFeed),
                _priceStructHash(asset, priceUSDG1e18, timestamp, validUntil)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _priceStructHash(address asset, uint256 priceUSDG1e18, uint64 timestamp, uint64 validUntil)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(PRICE_DATA_TYPEHASH, asset, priceUSDG1e18, timestamp, validUntil));
    }

    function _priceDomainSeparator(address signedFeed) private view returns (bytes32) {
        return keccak256(
            abi.encode(
                PRICE_DOMAIN_TYPEHASH,
                keccak256(bytes(PRICE_DOMAIN_NAME)),
                keccak256(bytes(PRICE_DOMAIN_VERSION)),
                block.chainid,
                signedFeed
            )
        );
    }

    function _actionDomainSeparator(uint16 actionSchemaVersion, uint256 chainId, address verifyingContract)
        private
        pure
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes(ACTION_DOMAIN_NAME)),
                keccak256(bytes(Strings.toString(uint256(actionSchemaVersion)))),
                chainId,
                verifyingContract
            )
        );
    }

    function _assertDecision(
        bytes32 actionId,
        DecisionStatus expectedStatus,
        uint64 expectedMandateVersion,
        uint64 expectedSubmittedAt,
        uint64 expectedExpiresAt,
        bytes32 expectedPriceDigest,
        uint64 expectedPriceTimestamp
    ) private view {
        (
            DecisionStatus status,
            uint64 mandateVersion,
            uint64 submittedAt,
            uint64 expiresAt,
            bytes32 priceDigest,
            uint64 priceTimestamp
        ) = account.decisions(actionId);

        assertEq(uint8(status), uint8(expectedStatus));
        assertEq(mandateVersion, expectedMandateVersion);
        assertEq(submittedAt, expectedSubmittedAt);
        assertEq(expiresAt, expectedExpiresAt);
        assertEq(priceDigest, expectedPriceDigest);
        assertEq(priceTimestamp, expectedPriceTimestamp);
    }

    function _assertDecisionStatus(bytes32 actionId, DecisionStatus expectedStatus) private view {
        (DecisionStatus status,,,,,) = account.decisions(actionId);

        assertEq(uint8(status), uint8(expectedStatus));
    }
}
