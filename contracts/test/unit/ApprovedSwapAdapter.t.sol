// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {ApprovedSwapAdapter} from "../../src/adapters/ApprovedSwapAdapter.sol";
import {MockAMM} from "../../src/mocks/MockAMM.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract ApprovedSwapAdapterTest is Test {
    MockAMM private amm;
    ApprovedSwapAdapter private adapter;
    MockERC20 private tokenIn;
    MockERC20 private tokenOut;

    address private constant TRADER = address(0xA11CE);
    address private constant RECIPIENT = address(0xB0B);
    uint256 private constant RATE_1E18 = 2 ether;
    uint256 private constant AMOUNT_IN = 5 ether;
    uint256 private constant EXPECTED_AMOUNT_OUT = 10 ether;

    function setUp() public {
        tokenIn = new MockERC20("Input Token", "IN");
        tokenOut = new MockERC20("Output Token", "OUT");
        amm = new MockAMM();
        adapter = new ApprovedSwapAdapter(amm);

        amm.setRate(address(tokenIn), address(tokenOut), RATE_1E18);
        tokenIn.mint(TRADER, 100 ether);
        tokenOut.mint(address(amm), 100 ether);

        vm.prank(TRADER);
        tokenIn.approve(address(adapter), AMOUNT_IN);
    }

    function test_quoteMatchesMockAMMQuote() public view {
        uint256 ammQuote = amm.quote(address(tokenIn), AMOUNT_IN, address(tokenOut));

        assertEq(adapter.quote(address(tokenIn), AMOUNT_IN, address(tokenOut)), ammQuote);
    }

    function test_swapDeliversToRecipientReturnsActualOutAndLeavesNoResiduals() public {
        vm.expectCall(address(tokenIn), abi.encodeWithSelector(tokenIn.approve.selector, address(amm), AMOUNT_IN));
        vm.expectCall(address(tokenIn), abi.encodeWithSelector(tokenIn.approve.selector, address(amm), 0));

        vm.prank(TRADER);
        uint256 amountOut = adapter.swap(address(tokenIn), AMOUNT_IN, address(tokenOut), EXPECTED_AMOUNT_OUT, RECIPIENT);

        assertEq(amountOut, EXPECTED_AMOUNT_OUT);
        assertEq(tokenIn.balanceOf(TRADER), 95 ether);
        assertEq(tokenIn.balanceOf(address(amm)), AMOUNT_IN);
        assertEq(tokenOut.balanceOf(RECIPIENT), EXPECTED_AMOUNT_OUT);
        assertEq(tokenOut.balanceOf(address(amm)), 90 ether);
        assertEq(tokenIn.balanceOf(address(adapter)), 0);
        assertEq(tokenOut.balanceOf(address(adapter)), 0);
        assertEq(tokenIn.allowance(address(adapter), address(amm)), 0);
    }

    function test_swapRevertsWhenRecipientIsAdapterAndKeepsBalancesUnchanged() public {
        uint256 traderInputBefore = tokenIn.balanceOf(TRADER);
        uint256 ammInputBefore = tokenIn.balanceOf(address(amm));
        uint256 ammOutputBefore = tokenOut.balanceOf(address(amm));
        uint256 adapterInputBefore = tokenIn.balanceOf(address(adapter));
        uint256 adapterOutputBefore = tokenOut.balanceOf(address(adapter));

        vm.expectRevert(bytes4(keccak256("AdapterRecipientIsSelf()")));
        vm.prank(TRADER);
        adapter.swap(address(tokenIn), AMOUNT_IN, address(tokenOut), EXPECTED_AMOUNT_OUT, address(adapter));

        assertEq(tokenIn.balanceOf(TRADER), traderInputBefore);
        assertEq(tokenIn.balanceOf(address(amm)), ammInputBefore);
        assertEq(tokenOut.balanceOf(address(amm)), ammOutputBefore);
        assertEq(tokenIn.balanceOf(address(adapter)), adapterInputBefore);
        assertEq(tokenOut.balanceOf(address(adapter)), adapterOutputBefore);
        assertEq(tokenIn.allowance(address(adapter), address(amm)), 0);
    }

    function test_swapRevertsWhenQuoteIsBelowMinOutAndKeepsBalancesUnchanged() public {
        uint256 traderInputBefore = tokenIn.balanceOf(TRADER);
        uint256 ammInputBefore = tokenIn.balanceOf(address(amm));
        uint256 ammOutputBefore = tokenOut.balanceOf(address(amm));
        uint256 recipientOutputBefore = tokenOut.balanceOf(RECIPIENT);
        uint256 adapterInputBefore = tokenIn.balanceOf(address(adapter));
        uint256 adapterOutputBefore = tokenOut.balanceOf(address(adapter));
        uint256 minAmountOut = EXPECTED_AMOUNT_OUT + 1;

        vm.expectRevert(abi.encodeWithSelector(MockAMM.InsufficientOutput.selector, EXPECTED_AMOUNT_OUT, minAmountOut));
        vm.prank(TRADER);
        adapter.swap(address(tokenIn), AMOUNT_IN, address(tokenOut), minAmountOut, RECIPIENT);

        assertEq(tokenIn.balanceOf(TRADER), traderInputBefore);
        assertEq(tokenIn.balanceOf(address(amm)), ammInputBefore);
        assertEq(tokenOut.balanceOf(address(amm)), ammOutputBefore);
        assertEq(tokenOut.balanceOf(RECIPIENT), recipientOutputBefore);
        assertEq(tokenIn.balanceOf(address(adapter)), adapterInputBefore);
        assertEq(tokenOut.balanceOf(address(adapter)), adapterOutputBefore);
        assertEq(tokenIn.allowance(address(adapter), address(amm)), 0);
    }
}
