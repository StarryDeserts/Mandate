// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {MandateAccount} from "../src/MandateAccount.sol";
import {ApprovedSwapAdapter} from "../src/adapters/ApprovedSwapAdapter.sol";
import {MockAMM} from "../src/mocks/MockAMM.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {SignedDemoPriceFeed} from "../src/oracle/SignedDemoPriceFeed.sol";

contract DeployScript is Script {
    struct Deployments {
        MockERC20 usdg;
        MockERC20 tsla;
        MockERC20 amd;
        MockAMM amm;
        ApprovedSwapAdapter adapter;
        SignedDemoPriceFeed priceFeed;
        MandateAccount account;
        address owner;
        address priceSigner;
        uint64 priceMaxStaleness;
        bool wired;
    }

    error PriceMaxStalenessTooLarge(uint256 value);
    error OwnerMustBeDeployer(address owner, address deployer);

    address internal constant DEFAULT_PRICE_SIGNER = 0xCEc09D1Aa4f881b79d559AF54fDBF0BD1530E070;
    uint64 internal constant DEFAULT_PRICE_MAX_STALENESS = 1 hours;

    Deployments public deployments;

    function run() external returns (Deployments memory result) {
        address deployer = msg.sender;
        address owner = vm.envOr("OWNER", _defaultOwner(deployer));
        if (owner == address(0)) owner = _defaultOwner(deployer);

        address priceSigner = vm.envOr("PRICE_SIGNER", _defaultPriceSigner(owner));
        if (priceSigner == address(0)) priceSigner = _defaultPriceSigner(owner);

        uint64 priceMaxStaleness = _priceMaxStaleness();
        if (owner != deployer) revert OwnerMustBeDeployer(owner, deployer);

        vm.startBroadcast();

        result.usdg = new MockERC20("Mandate Demo USDG", "USDG");
        result.tsla = new MockERC20("Mandate Demo TSLA", "TSLA");
        result.amd = new MockERC20("Mandate Demo AMD", "AMD");
        result.amm = new MockAMM();
        result.adapter = new ApprovedSwapAdapter(result.amm);
        result.priceFeed = new SignedDemoPriceFeed(priceSigner, priceMaxStaleness);
        result.account = new MandateAccount(owner, address(result.usdg));

        result.owner = owner;
        result.priceSigner = priceSigner;
        result.priceMaxStaleness = priceMaxStaleness;

        result.account.registerPriceOracle(result.priceFeed);
        result.account.setAdapterAllowed(address(result.adapter), true);
        result.account.setAssetAllowed(address(result.usdg), true);
        result.account.setAssetAllowed(address(result.tsla), true);
        result.account.setAssetAllowed(address(result.amd), true);
        result.wired = true;

        vm.stopBroadcast();

        deployments = result;
        _logDeployments(result);
    }

    function _priceMaxStaleness() internal view returns (uint64) {
        uint256 value = vm.envOr("PRICE_MAX_STALENESS", uint256(DEFAULT_PRICE_MAX_STALENESS));
        if (value > type(uint64).max) revert PriceMaxStalenessTooLarge(value);
        // casting to uint64 is safe because value is bounded above by type(uint64).max.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(value);
    }

    function _defaultOwner(address deployer) internal pure returns (address) {
        if (deployer != address(0)) return deployer;
        return address(uint160(uint256(keccak256("mandate.demo.owner"))));
    }

    function _defaultPriceSigner(address owner) internal pure returns (address) {
        if (DEFAULT_PRICE_SIGNER != owner) return DEFAULT_PRICE_SIGNER;
        return address(uint160(uint256(keccak256(abi.encodePacked("mandate.demo.price.signer", owner)))));
    }

    function _logDeployments(Deployments memory result) internal pure {
        console2.log("Mandate MVP deployer owner", result.owner);
        console2.log("USDG", address(result.usdg));
        console2.log("TSLA", address(result.tsla));
        console2.log("AMD", address(result.amd));
        console2.log("MockAMM", address(result.amm));
        console2.log("ApprovedSwapAdapter", address(result.adapter));
        console2.log("SignedDemoPriceFeed", address(result.priceFeed));
        console2.log("MandateAccount", address(result.account));
        console2.log("Price signer", result.priceSigner);
        console2.log("Price max staleness", uint256(result.priceMaxStaleness));
        console2.log("Account wired", result.wired);
    }
}
