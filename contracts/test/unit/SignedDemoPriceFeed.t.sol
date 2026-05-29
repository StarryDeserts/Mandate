// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {SignedDemoPriceFeed} from "../../src/oracle/SignedDemoPriceFeed.sol";
import {PriceUnverified} from "../../src/types/Errors.sol";
import {PriceData} from "../../src/types/Types.sol";

contract SignedDemoPriceFeedTest is Test {
    uint256 private constant PRICE_SIGNER_KEY = 0xA11CE;
    uint256 private constant WRONG_SIGNER_KEY = 0xB0B;
    uint64 private constant MAX_STALENESS = 1 hours;
    address private constant ACCOUNT = address(0xA11CE1);
    address private constant ASSET = address(0x2000);
    address private constant OTHER_ASSET = address(0x3000);
    uint256 private constant PRICE_USDG_1E18 = 123.45 ether;

    bytes32 private constant PRICE_DATA_TYPEHASH =
        keccak256("PriceData(address asset,uint256 priceUSDG1e18,uint64 timestamp,uint64 validUntil)");
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    string private constant NAME = "MandatePriceFeed";
    string private constant VERSION = "1";

    SignedDemoPriceFeed private feed;
    address private priceSigner;

    function setUp() public {
        priceSigner = vm.addr(PRICE_SIGNER_KEY);
        feed = new SignedDemoPriceFeed(priceSigner, MAX_STALENESS);
        vm.warp(1_800_000_000);
    }

    function test_validSignatureFreshReturnsPriceAndTimestamp() public view {
        uint64 timestamp = uint64(block.timestamp);
        PriceData memory att =
            _priceData(address(feed), PRICE_SIGNER_KEY, ASSET, PRICE_USDG_1E18, timestamp, timestamp + 2 hours);

        (uint256 priceUSDG1e18, uint64 returnedTimestamp) = feed.getPrice(ASSET, att, ACCOUNT);

        assertEq(priceUSDG1e18, PRICE_USDG_1E18);
        assertEq(returnedTimestamp, timestamp);
    }

    function test_signerGetterIsIndependentOfTestDeployer() public view {
        assertEq(feed.signer(), priceSigner);
        assertNotEq(feed.signer(), address(this));
    }

    function test_wrongSignerRevertsPriceUnverified() public {
        uint64 timestamp = uint64(block.timestamp);
        PriceData memory att =
            _priceData(address(feed), WRONG_SIGNER_KEY, ASSET, PRICE_USDG_1E18, timestamp, timestamp + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, ASSET));
        feed.getPrice(ASSET, att, ACCOUNT);
    }

    function test_validUntilExpiryRevertsPriceUnverified() public {
        uint64 timestamp = uint64(block.timestamp - 1);
        PriceData memory att = _priceData(address(feed), PRICE_SIGNER_KEY, ASSET, PRICE_USDG_1E18, timestamp, timestamp);
        vm.warp(uint256(timestamp) + 1);

        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, ASSET));
        feed.getPrice(ASSET, att, ACCOUNT);
    }

    function test_maxStalenessExpiryRevertsPriceUnverified() public {
        uint64 timestamp = uint64(block.timestamp - MAX_STALENESS - 1);
        PriceData memory att = _priceData(
            address(feed), PRICE_SIGNER_KEY, ASSET, PRICE_USDG_1E18, timestamp, uint64(block.timestamp + 1 hours)
        );

        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, ASSET));
        feed.getPrice(ASSET, att, ACCOUNT);
    }

    function test_signatureFromDifferentOracleDomainIsRejected() public {
        SignedDemoPriceFeed otherFeed = new SignedDemoPriceFeed(priceSigner, MAX_STALENESS);
        uint64 timestamp = uint64(block.timestamp);
        PriceData memory att =
            _priceData(address(feed), PRICE_SIGNER_KEY, ASSET, PRICE_USDG_1E18, timestamp, timestamp + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, ASSET));
        otherFeed.getPrice(ASSET, att, ACCOUNT);
    }

    function test_assetMismatchRevertsPriceUnverified() public {
        uint64 timestamp = uint64(block.timestamp);
        PriceData memory att =
            _priceData(address(feed), PRICE_SIGNER_KEY, OTHER_ASSET, PRICE_USDG_1E18, timestamp, timestamp + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(PriceUnverified.selector, ASSET));
        feed.getPrice(ASSET, att, ACCOUNT);
    }

    function _priceData(
        address oracle,
        uint256 signingKey,
        address asset,
        uint256 priceUSDG1e18,
        uint64 timestamp,
        uint64 validUntil
    ) private view returns (PriceData memory att) {
        att = PriceData({
            asset: asset,
            priceUSDG1e18: priceUSDG1e18,
            timestamp: timestamp,
            validUntil: validUntil,
            signature: _signPriceData(oracle, signingKey, asset, priceUSDG1e18, timestamp, validUntil)
        });
    }

    function _signPriceData(
        address oracle,
        uint256 signingKey,
        address asset,
        uint256 priceUSDG1e18,
        uint64 timestamp,
        uint64 validUntil
    ) private view returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01", _domainSeparator(oracle), _structHash(asset, priceUSDG1e18, timestamp, validUntil)
            )
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signingKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _structHash(address asset, uint256 priceUSDG1e18, uint64 timestamp, uint64 validUntil)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(PRICE_DATA_TYPEHASH, asset, priceUSDG1e18, timestamp, validUntil));
    }

    function _domainSeparator(address oracle) private view returns (bytes32) {
        return keccak256(
            abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(NAME)), keccak256(bytes(VERSION)), block.chainid, oracle)
        );
    }
}
