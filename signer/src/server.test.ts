import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPriceServer, loadServerConfig, startServer } from './server.js';

const signerKey = '0x0000000000000000000000000000000000000000000000000000000a11ce51a9';
const deploymentSignerKey = '0x00000000000000000000000000000000000000000000000000000000b0bd3a01';
const deploymentSignerAddress = '0xE1678d78f747D949fdFde93bbf8e2bBBdfFB34B9';
const oracle = '0x0000000000000000000000000000000000000abc';
const usdg = '0x000000000000000000000000000000000000dEaD';
const assetA = '0x00000000000000000000000000000000000000aA';
const assetB = '0x00000000000000000000000000000000000000bB';

let server: Server | undefined;
let tempDirs: string[] = [];

afterEach(async () => {
  if (server?.listening) {
    server.close();
    await once(server, 'close');
  }
  server = undefined;
  for (const directory of tempDirs) rmSync(directory, { force: true, recursive: true });
  tempDirs = [];
});

describe('price server', () => {
  it('rejects server configuration when the signer key matches the deployer key', () => {
    expect(() =>
      loadServerConfig({
        PRICE_SIGNER_KEY: signerKey,
        DEPLOYER_KEY: signerKey,
        ORACLE_ADDRESS: oracle,
        USDG_ADDRESS: usdg,
      }),
    ).toThrow(/DEPLOYER_KEY/);
  });

  it('requires USDG_ADDRESS so signed price arrays can exclude USDG', () => {
    expect(() =>
      loadServerConfig({
        PRICE_SIGNER_KEY: signerKey,
        ORACLE_ADDRESS: oracle,
      }),
    ).toThrow(/USDG_ADDRESS/);
  });

  it('defaults the signer host to localhost', () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
    });

    expect((config as { host?: string }).host).toBe('127.0.0.1');
  });

  it('allows SIGNER_HOST to opt into all-interface binding', () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
      SIGNER_HOST: '0.0.0.0',
    });

    expect((config as { host?: string }).host).toBe('0.0.0.0');
  });

  it('starts the server on the configured host', async () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
      SIGNER_HOST: '127.0.0.1',
    });

    server = startServer({ ...config, port: 0 });
    await once(server, 'listening');

    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('expected TCP server address');

    expect(address.address).toBe('127.0.0.1');
  });

  it('loads PRICE_0x-address environment overrides', () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
      [`PRICE_${assetA}`]: '2000000000000000000',
    });

    expect(config.priceMap.get('0x00000000000000000000000000000000000000aa')).toBe(2_000_000_000_000_000_000n);
  });

  it('rejects unsafe numeric PRICE_MAP_JSON entries instead of rounding them', () => {
    expect(() =>
      loadServerConfig({
        PRICE_SIGNER_KEY: signerKey,
        ORACLE_ADDRESS: oracle,
        USDG_ADDRESS: usdg,
        PRICE_MAP_JSON: `{ "${assetA}": 9007199254740993 }`,
      }),
    ).toThrow(/PRICE_MAP_JSON/);
  });

  it('loads decimal string PRICE_MAP_JSON entries exactly', () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
      PRICE_MAP_JSON: JSON.stringify({
        [assetA]: '9007199254740993',
      }),
    });

    expect(config.priceMap.get('0x00000000000000000000000000000000000000aa')).toBe(9_007_199_254_740_993n);
  });

  it('loads oracle, USDG, chain, and demo prices from a deployment file', () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: deploymentSignerKey,
      MANDATE_DEPLOYMENT_PATH: writeDeploymentFixture(),
    });

    expect(config.chainId).toBe(46630);
    expect(config.oracleAddress.toLowerCase()).toBe(oracle.toLowerCase());
    expect(config.usdgAddress.toLowerCase()).toBe(usdg.toLowerCase());
    expect(config.priceMap.get(assetA.toLowerCase())).toBe(2_000_000_000_000_000_000n);
    expect(config.priceMap.get(assetB.toLowerCase())).toBe(1_000_000_000_000_000_000n);
  });

  it('rejects a deployment signer key that does not match the deployment priceSigner', () => {
    expect(() =>
      loadServerConfig({
        PRICE_SIGNER_KEY: signerKey,
        MANDATE_DEPLOYMENT_PATH: writeDeploymentFixture(),
      }),
    ).toThrow(/deployment priceSigner/);
  });

  it('returns CORS headers for frontend price fetches', async () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
    });

    server = createPriceServer({ ...config, port: 0 });
    server.listen(0);
    await once(server, 'listening');

    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('expected TCP server address');

    const response = await fetch(`http://127.0.0.1:${address.port}/price?assets=${assetA}`);

    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns sorted signed rows for requested assets', async () => {
    const config = loadServerConfig({
      PRICE_SIGNER_KEY: signerKey,
      ORACLE_ADDRESS: oracle,
      USDG_ADDRESS: usdg,
      PRICE_TTL_SECONDS: '60',
      PRICE_MAP_JSON: JSON.stringify({
        [assetA]: '2000000000000000000',
        [assetB]: '1000000000000000000',
        [usdg]: '1000000000000000000',
      }),
    });

    server = createPriceServer({ ...config, port: 0 });
    server.listen(0);
    await once(server, 'listening');

    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('expected TCP server address');

    const response = await fetch(`http://127.0.0.1:${address.port}/price?assets=${assetB},${usdg.toLowerCase()},${assetA}`);
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

function writeDeploymentFixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'mandate-price-signer-'));
  tempDirs.push(directory);
  const path = join(directory, '46630.json');
  writeFileSync(
    path,
    JSON.stringify({
      chainId: 46630,
      priceSigner: deploymentSignerAddress,
      contracts: {
        usdg,
        tsla: assetA,
        amd: assetB,
        priceFeed: oracle,
      },
    }),
  );
  return path;
}
