import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { once } from 'node:events';

import { createPriceServer, loadServerConfig } from './server.js';

const signerKey = '0x0000000000000000000000000000000000000000000000000000000a11ce51a9';
const oracle = '0x0000000000000000000000000000000000000abc';
const assetA = '0x00000000000000000000000000000000000000aA';
const assetB = '0x00000000000000000000000000000000000000bB';

let server: Server | undefined;

afterEach(async () => {
  if (server?.listening) {
    server.close();
    await once(server, 'close');
  }
  server = undefined;
});

describe('price server', () => {
  it('rejects server configuration when the signer key matches the deployer key', () => {
    expect(() =>
      loadServerConfig({
        PRICE_SIGNER_KEY: signerKey,
        DEPLOYER_KEY: signerKey,
        ORACLE_ADDRESS: oracle,
      }),
    ).toThrow(/DEPLOYER_KEY/);
  });

  it('loads PRICE_0x-address environment overrides', () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      [`PRICE_${assetA}`]: '2000000000000000000',
    });

    expect(config.priceMap.get('0x00000000000000000000000000000000000000aa')).toBe(2_000_000_000_000_000_000n);
  });

  it('returns sorted signed rows for requested assets', async () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      PRICE_TTL_SECONDS: '60',
      PRICE_MAP_JSON: JSON.stringify({
        [assetA]: '2000000000000000000',
        [assetB]: '1000000000000000000',
      }),
    });

    server = createPriceServer({ ...config, port: 0 });
    server.listen(0);
    await once(server, 'listening');

    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('expected TCP server address');

    const response = await fetch(`http://127.0.0.1:${address.port}/price?assets=${assetB},${assetA}`);
    const body = (await response.json()) as { rows: Array<{ asset: string; timestamp: number; validUntil: number }> };

    expect(response.status).toBe(200);
    expect(body.rows.map((row) => row.asset)).toEqual([
      '0x00000000000000000000000000000000000000AA',
      '0x00000000000000000000000000000000000000bb',
    ]);
    for (const row of body.rows) {
      expect(row.validUntil - row.timestamp).toBe(60);
    }
  });
});
