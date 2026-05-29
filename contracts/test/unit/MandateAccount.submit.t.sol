// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MandateAccount} from "../../src/MandateAccount.sol";
import {IPriceOracle} from "../../src/interfaces/IPriceOracle.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {ActionType, ReasonCode} from "../../src/types/Enums.sol";
import {MissingPrice} from "../../src/types/Errors.sol";
import {Action, MandateConfig, PriceData} from "../../src/types/Types.sol";

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
    address private constant OWNER = address(0xA11CE);
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
        prices = new PriceData[](2);
        prices[0] = _priceData(address(tsla), 2 ether);
        prices[1] = _priceData(address(usdg), 1 ether);
    }

    function _priceData(address asset, uint256 priceUSDG1e18) private pure returns (PriceData memory price) {
        price =
            PriceData({asset: asset, priceUSDG1e18: priceUSDG1e18, timestamp: 1_900, validUntil: 2_500, signature: ""});
    }
}
