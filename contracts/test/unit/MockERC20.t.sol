// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract MockERC20Test is Test {
    MockERC20 private token;

    address private constant USER = address(0xA11CE);
    address private constant RECIPIENT = address(0xB0B);
    uint256 private constant MINT_AMOUNT = 1_000 ether;
    uint256 private constant TRANSFER_AMOUNT = 125 ether;

    function setUp() public {
        token = new MockERC20("Mock Tesla", "mTSLA");
    }

    function test_decimalsDefaultToEighteen() public view {
        assertEq(token.decimals(), 18);
    }

    function test_mintAndTransferUpdateBalances() public {
        token.mint(USER, MINT_AMOUNT);

        assertEq(token.balanceOf(USER), MINT_AMOUNT);

        vm.prank(USER);
        bool transferred = token.transfer(RECIPIENT, TRANSFER_AMOUNT);

        assertTrue(transferred);
        assertEq(token.balanceOf(USER), MINT_AMOUNT - TRANSFER_AMOUNT);
        assertEq(token.balanceOf(RECIPIENT), TRANSFER_AMOUNT);
    }
}
