// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {DeployScript} from "../../script/Deploy.s.sol";

contract DeployScriptHarness is DeployScript {
    function exposedDefaultPriceSigner(address owner) external pure returns (address) {
        return _defaultPriceSigner(owner);
    }
}

contract DeploySeedCompatibilityTest is Test {
    uint256 private constant SEED_DEMO_DEFAULT_PRICE_SIGNER_PK = 0xA11CE51A9;

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
}
