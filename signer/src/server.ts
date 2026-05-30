import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { getAddress, isAddress, type Address } from 'viem';

import {
  DEFAULT_CHAIN_ID,
  DEFAULT_VALIDITY_SECONDS,
  assertIndependentSignerKey,
  normalizePrivateKey,
  sortAndSignPriceData,
  toJsonPriceData,
  type PriceInput,
} from './sign-price.js';

const DEFAULT_PRICE_USDG_1E18 = 1_000_000_000_000_000_000n;
const DEFAULT_PORT = 8_787;

type ServerConfig = {
  privateKey: string;
  oracleAddress: Address;
  chainId: number;
  validitySeconds: number;
  port: number;
  priceMap: Map<string, bigint>;
  defaultPriceUSDG1e18: bigint;
  usdgAddress: Address;
};

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const oracleAddress = env.ORACLE_ADDRESS;
  if (oracleAddress === undefined || !isAddress(oracleAddress, { strict: false })) {
    throw new Error('ORACLE_ADDRESS must be set to the SignedDemoPriceFeed address');
  }

  const usdgAddress = env.USDG_ADDRESS;
  if (usdgAddress === undefined || usdgAddress.trim() === '') {
    throw new Error('USDG_ADDRESS must be set to the USDG token address');
  }
  if (!isAddress(usdgAddress, { strict: false })) {
    throw new Error('USDG_ADDRESS must be a valid EVM address');
  }

  const privateKey = normalizePrivateKey(env.PRICE_SIGNER_KEY, 'PRICE_SIGNER_KEY');
  assertIndependentSignerKey(privateKey, env);

  return {
    privateKey,
    oracleAddress: getAddress(oracleAddress),
    chainId: parsePositiveInteger(env.CHAIN_ID ?? String(DEFAULT_CHAIN_ID), 'CHAIN_ID'),
    validitySeconds: parsePositiveInteger(env.PRICE_TTL_SECONDS ?? String(DEFAULT_VALIDITY_SECONDS), 'PRICE_TTL_SECONDS'),
    port: parsePositiveInteger(env.PORT ?? String(DEFAULT_PORT), 'PORT'),
    priceMap: loadPriceMap(env),
    defaultPriceUSDG1e18: parseUnsignedBigInt(
      env.DEFAULT_PRICE_USDG_1E18 ?? DEFAULT_PRICE_USDG_1E18.toString(),
      'DEFAULT_PRICE_USDG_1E18',
    ),
    usdgAddress: getAddress(usdgAddress),
  };
}

export function createPriceServer(config: ServerConfig) {
  return createServer(async (request, response) => {
    try {
      const url = requestUrl(request);
      if (url.pathname !== '/price') {
        writeJson(response, 404, { error: 'not_found' });
        return;
      }

      const assets = parseAssets(url.searchParams.get('assets'), config.usdgAddress);
      const rows = await sortAndSignPriceData(resolvePrices(assets, config), {
        privateKey: config.privateKey,
        oracleAddress: config.oracleAddress,
        chainId: config.chainId,
        validitySeconds: config.validitySeconds,
      });

      writeJson(response, 200, {
        domain: {
          name: 'MandatePriceFeed',
          version: '1',
          chainId: config.chainId,
          verifyingContract: config.oracleAddress,
        },
        rows: rows.map(toJsonPriceData),
      });
    } catch (error) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

export function startServer(config = loadServerConfig()) {
  const server = createPriceServer(config);
  server.listen(config.port, () => {
    console.log(`Mandate demo price signer listening on http://127.0.0.1:${config.port}`);
  });
  return server;
}

function requestUrl(request: IncomingMessage): URL {
  return new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
}

function parseAssets(rawAssets: string | null, usdgAddress: Address): Address[] {
  if (rawAssets === null || rawAssets.trim() === '') {
    throw new Error('assets query parameter is required');
  }

  return rawAssets
    .split(',')
    .map((asset) => asset.trim())
    .filter((asset) => asset !== '')
    .map((asset) => {
      if (!isAddress(asset, { strict: false })) throw new Error(`invalid asset address ${asset}`);
      return getAddress(asset);
    })
    .filter((asset) => asset.toLowerCase() !== usdgAddress.toLowerCase());
}

function resolvePrices(assets: Address[], config: ServerConfig): PriceInput[] {
  return assets.map((asset) => ({
    asset,
    priceUSDG1e18: config.priceMap.get(asset.toLowerCase()) ?? config.defaultPriceUSDG1e18,
  }));
}

function loadPriceMap(env: NodeJS.ProcessEnv): Map<string, bigint> {
  const priceMap = new Map<string, bigint>();

  if (env.PRICE_MAP_JSON !== undefined && env.PRICE_MAP_JSON.trim() !== '') {
    const parsed = JSON.parse(env.PRICE_MAP_JSON) as Record<string, unknown>;
    for (const [asset, value] of Object.entries(parsed)) {
      if (!isAddress(asset, { strict: false })) throw new Error(`PRICE_MAP_JSON contains invalid address ${asset}`);
      priceMap.set(getAddress(asset).toLowerCase(), parseUnsignedBigInt(String(value), `PRICE_MAP_JSON[${asset}]`));
    }
  }

  for (const [name, value] of Object.entries(env)) {
    if (value === undefined || !name.startsWith('PRICE_')) continue;
    const maybeAddress = name.slice('PRICE_'.length);
    const addressCandidate = maybeAddress.toLowerCase().startsWith('0x') ? maybeAddress : `0x${maybeAddress}`;
    if (!isAddress(addressCandidate, { strict: false })) continue;
    priceMap.set(getAddress(addressCandidate).toLowerCase(), parseUnsignedBigInt(value, name));
  }

  return priceMap;
}

function parsePositiveInteger(value: string, label: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be a positive integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive safe integer`);
  return parsed;
}

function parseUnsignedBigInt(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an unsigned decimal integer`);
  return BigInt(value);
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(`${JSON.stringify(body)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
