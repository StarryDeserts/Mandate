import { describe, expect, it } from 'vitest';
import { recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import {
  PRICE_DATA_PRIMARY_TYPE,
  PRICE_DATA_TYPES,
  assertIndependentSignerKey,
  buildMandatePriceFeedDomain,
  normalizePrivateKey,
  signPriceData,
  sortAndSignPriceData,
} from './sign-price.js';

const signerKey = '0x0000000000000000000000000000000000000000000000000000000a11ce51a9';
const oracle = '0x0000000000000000000000000000000000000abc';
const chainId = 46_630;

const assetA = '0x00000000000000000000000000000000000000aA';
const assetB = '0x00000000000000000000000000000000000000bB';

describe('price signing', () => {
  it('signs PriceData that recovers to the signer for the SignedDemoPriceFeed domain', async () => {
    const signer = privateKeyToAccount(signerKey).address;
    const row = await signPriceData({
      privateKey: signerKey,
      chainId,
      oracleAddress: oracle,
      asset: assetA,
      priceUSDG1e18: 2_000_000_000_000_000_000n,
      timestamp: 1_700_000_000,
      validUntil: 1_700_003_600,
    });

    const recovered = await recoverTypedDataAddress({
      domain: buildMandatePriceFeedDomain({ chainId, verifyingContract: oracle }),
      types: PRICE_DATA_TYPES,
      primaryType: PRICE_DATA_PRIMARY_TYPE,
      message: {
        asset: row.asset,
        priceUSDG1e18: row.priceUSDG1e18,
        timestamp: BigInt(row.timestamp),
        validUntil: BigInt(row.validUntil),
      },
      signature: row.signature,
    });

    expect(recovered).toBe(signer);
    expect(row.signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });

  it('sorts signed rows strictly ascending by asset address', async () => {
    const rows = await sortAndSignPriceData(
      [
        { asset: assetB, priceUSDG1e18: 1n },
        { asset: assetA, priceUSDG1e18: 2n },
      ],
      {
        privateKey: signerKey,
        chainId,
        oracleAddress: oracle,
        timestamp: 100,
        validUntil: 200,
      },
    );

    expect(rows.map((row) => row.asset)).toEqual([
      '0x00000000000000000000000000000000000000AA',
      '0x00000000000000000000000000000000000000bb',
    ]);
  });

  it('derives validUntil from timestamp and validity seconds when omitted', async () => {
    const row = await signPriceData({
      privateKey: signerKey,
      chainId,
      oracleAddress: oracle,
      asset: assetA,
      priceUSDG1e18: 1n,
      timestamp: 123,
      validitySeconds: 45,
    });

    expect(row.timestamp).toBe(123);
    expect(row.validUntil).toBe(168);
  });

  it('rejects a price signer key that matches deployer or session identities', () => {
    const signerAddress = privateKeyToAccount(signerKey).address;

    expect(() =>
      assertIndependentSignerKey(signerKey, {
        DEPLOYER_KEY: signerKey,
      }),
    ).toThrow(/DEPLOYER_KEY/);

    expect(() =>
      assertIndependentSignerKey(signerKey, {
        DEPLOYER: signerAddress,
      }),
    ).toThrow(/DEPLOYER/);

    expect(() =>
      assertIndependentSignerKey(signerKey, {
        SESSION_KEY: signerAddress,
      }),
    ).toThrow(/SESSION_KEY/);

    expect(normalizePrivateKey('0xA11CE51A9')).toBe(signerKey);
  });
});
