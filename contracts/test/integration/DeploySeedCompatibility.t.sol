// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {DeployScript} from "../../script/Deploy.s.sol";
import {SeedDemoScript} from "../../script/SeedDemo.s.sol";
import {MandateAccount} from "../../src/MandateAccount.sol";
import {ApprovedSwapAdapter} from "../../src/adapters/ApprovedSwapAdapter.sol";
import {MockAMM} from "../../src/mocks/MockAMM.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {SignedDemoPriceFeed} from "../../src/oracle/SignedDemoPriceFeed.sol";

contract DeployScriptHarness is DeployScript {
    function exposedDefaultPriceSigner(address owner) external pure returns (address) {
        return _defaultPriceSigner(owner);
    }
}

contract DeploySeedCompatibilityTest is Test {
    uint256 private constant SEED_DEMO_DEFAULT_PRICE_SIGNER_PK = 0xA11CE51A9;
    uint256 private constant AMM_TSLA_LIQUIDITY = 10_000 ether;
    uint256 private constant USDG_TO_TSLA_RATE = 0.5 ether;
    address private constant DEFAULT_SESSION_KEY = address(0x5E5510);

    function test_defaultDeployPriceSignerMatchesSeedDemoDefaultPrivateKey() public {
        DeployScriptHarness deploy = new DeployScriptHarness();
        address seedDemoDefaultSigner = vm.addr(SEED_DEMO_DEFAULT_PRICE_SIGNER_PK);
        address unrelatedOwner = address(0xA11CE);

        assertNotEq(unrelatedOwner, seedDemoDefaultSigner);
        assertEq(deploy.exposedDefaultPriceSigner(unrelatedOwner), seedDemoDefaultSigner);
    }

    function test_defaultDeployPriceSignerUsesDeterministicAlternateWhenOwnerIsDefaultSigner() public {
        DeployScriptHarness deploy = new DeployScriptHarness();
        address seedDemoDefaultSigner = vm.addr(SEED_DEMO_DEFAULT_PRICE_SIGNER_PK);
        address expectedAlternate =
            address(uint160(uint256(keccak256(abi.encodePacked("mandate.demo.price.signer", seedDemoDefaultSigner)))));

        assertNotEq(expectedAlternate, seedDemoDefaultSigner);
        assertEq(deploy.exposedDefaultPriceSigner(seedDemoDefaultSigner), expectedAlternate);
    }

    function test_seedDemoConfiguresPublicDemoWithoutDirectAccountFundingByDefault() public {
        MockERC20 usdg = new MockERC20("Mandate Demo USDG", "USDG");
        MockERC20 tsla = new MockERC20("Mandate Demo TSLA", "TSLA");
        MockERC20 amd = new MockERC20("Mandate Demo AMD", "AMD");
        MockAMM amm = new MockAMM();
        ApprovedSwapAdapter adapter = new ApprovedSwapAdapter(amm);
        SignedDemoPriceFeed priceFeed = new SignedDemoPriceFeed(vm.addr(SEED_DEMO_DEFAULT_PRICE_SIGNER_PK), 1 hours);
        MandateAccount account = new MandateAccount(address(this), address(usdg));

        vm.setEnv("ACCOUNT", vm.toString(address(account)));
        vm.setEnv("USDG", vm.toString(address(usdg)));
        vm.setEnv("TSLA", vm.toString(address(tsla)));
        vm.setEnv("AMD", vm.toString(address(amd)));
        vm.setEnv("AMM", vm.toString(address(amm)));
        vm.setEnv("ADAPTER", vm.toString(address(adapter)));
        vm.setEnv("PRICE_FEED", vm.toString(address(priceFeed)));

        SeedDemoScript seed = new SeedDemoScript();
        uint256 safeAmount = seed.run();

        assertEq(safeAmount, 0);
        assertEq(usdg.balanceOf(address(account)), 0);
        assertEq(tsla.balanceOf(address(account)), 0);
        assertEq(amd.balanceOf(address(account)), 0);
        assertEq(tsla.balanceOf(address(amm)), AMM_TSLA_LIQUIDITY);
        assertEq(amm.rates(address(usdg), address(tsla)), USDG_TO_TSLA_RATE);
        assertTrue(account.isAssetAllowed(address(usdg)));
        assertTrue(account.isAssetAllowed(address(tsla)));
        assertTrue(account.isAssetAllowed(address(amd)));
        assertTrue(account.isAdapterAllowed(address(adapter)));
        assertEq(address(account.priceOracle()), address(priceFeed));
        assertEq(uint8(account.roleOf(DEFAULT_SESSION_KEY)), 1);
    }
}
