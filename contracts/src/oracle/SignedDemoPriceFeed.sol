// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

import {IPriceOracle} from "../interfaces/IPriceOracle.sol";
import {PriceUnverified} from "../types/Errors.sol";
import {PriceData} from "../types/Types.sol";

contract SignedDemoPriceFeed is IPriceOracle {
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256(bytes("MandatePriceFeed"));
    bytes32 private constant VERSION_HASH = keccak256(bytes("1"));
    bytes32 private constant PRICE_DATA_TYPEHASH =
        keccak256("PriceData(address asset,uint256 priceUSDG1e18,uint64 timestamp,uint64 validUntil)");

    address public immutable signer;
    uint64 public immutable maxStaleness;

    constructor(address signer_, uint64 maxStaleness_) {
        signer = signer_;
        maxStaleness = maxStaleness_;
    }

    function getPrice(address asset, PriceData calldata att, address account)
        external
        view
        returns (uint256 priceUSDG1e18, uint64 timestamp)
    {
        account;

        if (asset != att.asset) revert PriceUnverified(asset);

        bytes32 structHash =
            keccak256(abi.encode(PRICE_DATA_TYPEHASH, att.asset, att.priceUSDG1e18, att.timestamp, att.validUntil));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (address recovered, ECDSA.RecoverError recoverError,) = ECDSA.tryRecover(digest, att.signature);

        if (recoverError != ECDSA.RecoverError.NoError || recovered != signer) revert PriceUnverified(asset);

        // ADR-0010 demo attestations are explicitly bounded by wall-clock validity windows.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > att.validUntil) revert PriceUnverified(asset);

        // ADR-0010 demo price freshness is explicitly enforced against block time.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp > uint256(att.timestamp) + uint256(maxStaleness)) revert PriceUnverified(asset);

        return (att.priceUSDG1e18, att.timestamp);
    }

    function _domainSeparator() private view returns (bytes32) {
        return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }
}
