// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";

import {MockAMM} from "../../src/mocks/MockAMM.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";

contract MockAMMTest is Test {
    MockAMM private amm;
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

        amm.setRate(address(tokenIn), address(tokenOut), RATE_1E18);
        tokenIn.mint(TRADER, 100 ether);
        tokenOut.mint(address(amm), 100 ether);

        vm.prank(TRADER);
        tokenIn.approve(address(amm), type(uint256).max);
    }

    function test_quoteUsesFixedRate() public view {
        assertEq(amm.quote(address(tokenIn), AMOUNT_IN, address(tokenOut)), EXPECTED_AMOUNT_OUT);
    }

    function test_setRateRevertsWhenCallerIsNotAdmin() public {
        vm.expectRevert(abi.encodeWithSelector(MockAMM.NotRateAdmin.selector, TRADER));
        vm.prank(TRADER);
        amm.setRate(address(tokenOut), address(tokenIn), RATE_1E18);
    }

    function test_setRateRevertsWhenRateIsZero() public {
        vm.expectRevert(abi.encodeWithSelector(MockAMM.ZeroRate.selector, address(tokenIn), address(tokenOut)));
        amm.setRate(address(tokenIn), address(tokenOut), 0);
    }

    function test_quoteRevertsWhenPairRateIsUnset() public {
        vm.expectRevert(abi.encodeWithSelector(MockAMM.RateNotSet.selector, address(tokenOut), address(tokenIn)));
        amm.quote(address(tokenOut), AMOUNT_IN, address(tokenIn));
    }

    function test_swapRevertsWhenPairRateIsUnsetAndDoesNotMoveInputBalances() public {
        uint256 traderInputBefore = tokenOut.balanceOf(TRADER);
        uint256 ammInputBefore = tokenOut.balanceOf(address(amm));

        vm.expectRevert(abi.encodeWithSelector(MockAMM.RateNotSet.selector, address(tokenOut), address(tokenIn)));
        vm.prank(TRADER);
        amm.swap(address(tokenOut), AMOUNT_IN, address(tokenIn), 0, RECIPIENT);

        assertEq(tokenOut.balanceOf(TRADER), traderInputBefore);
        assertEq(tokenOut.balanceOf(address(amm)), ammInputBefore);
    }

    function test_swapAtFixedRateReturnsExpectedOutAndMovesBalances() public {
        vm.prank(TRADER);
        uint256 amountOut = amm.swap(address(tokenIn), AMOUNT_IN, address(tokenOut), EXPECTED_AMOUNT_OUT, RECIPIENT);

        assertEq(amountOut, EXPECTED_AMOUNT_OUT);
        assertEq(tokenIn.balanceOf(TRADER), 95 ether);
        assertEq(tokenIn.balanceOf(address(amm)), AMOUNT_IN);
        assertEq(tokenOut.balanceOf(RECIPIENT), EXPECTED_AMOUNT_OUT);
        assertEq(tokenOut.balanceOf(address(amm)), 90 ether);
    }

    function test_swapRevertsWhenQuoteIsBelowMinOut() public {
        uint256 minAmountOut = EXPECTED_AMOUNT_OUT + 1;

        vm.expectRevert(abi.encodeWithSelector(MockAMM.InsufficientOutput.selector, EXPECTED_AMOUNT_OUT, minAmountOut));
        vm.prank(TRADER);
        amm.swap(address(tokenIn), AMOUNT_IN, address(tokenOut), minAmountOut, RECIPIENT);
    }

    function test_swapRevertsWhenAmmIsUnderFunded() public {
        MockAMM underFundedAmm = new MockAMM();
        underFundedAmm.setRate(address(tokenIn), address(tokenOut), RATE_1E18);

        vm.prank(TRADER);
        tokenIn.approve(address(underFundedAmm), AMOUNT_IN);

        vm.expectRevert(
            abi.encodeWithSelector(MockAMM.InsufficientLiquidity.selector, address(tokenOut), 0, EXPECTED_AMOUNT_OUT)
        );
        vm.prank(TRADER);
        underFundedAmm.swap(address(tokenIn), AMOUNT_IN, address(tokenOut), 0, RECIPIENT);
    }
}
