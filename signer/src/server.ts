import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';

import { getAddress, isAddress, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

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
const DEFAULT_TSLA_PRICE_USDG_1E18 = 2_000_000_000_000_000_000n;
const DEFAULT_AMD_PRICE_USDG_1E18 = 1_000_000_000_000_000_000n;
const DEFAULT_PORT = 8_787;
const DEFAULT_HOST = '127.0.0.1';

type DeploymentDefaults = {
  chainId: number;
  oracleAddress: Address;
  priceSigner: Address;
  priceMap: Map<string, bigint>;
  usdgAddress: Address;
};

type ServerConfig = {
  privateKey: string;
  oracleAddress: Address;
  chainId: number;
  validitySeconds: number;
  port: number;
  host: string;
  priceMap: Map<string, bigint>;
  defaultPriceUSDG1e18: bigint;
  usdgAddress: Address;
};

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const deployment = loadDeploymentDefaults(env.MANDATE_DEPLOYMENT_PATH);
  const oracleAddress = env.ORACLE_ADDRESS ?? deployment?.oracleAddress;
  if (oracleAddress === undefined || !isAddress(oracleAddress, { strict: false })) {
    throw new Error('ORACLE_ADDRESS must be set to the SignedDemoPriceFeed address');
  }

  const usdgAddress = env.USDG_ADDRESS ?? deployment?.usdgAddress;
  if (usdgAddress === undefined || usdgAddress.trim() === '') {
    throw new Error('USDG_ADDRESS must be set to the USDG token address');
  }
  if (!isAddress(usdgAddress, { strict: false })) {
    throw new Error('USDG_ADDRESS must be a valid EVM address');
  }

  const privateKey = normalizePrivateKey(env.PRICE_SIGNER_KEY, 'PRICE_SIGNER_KEY');
  assertIndependentSignerKey(privateKey, env);
  if (deployment) assertSignerMatchesDeployment(privateKey, deployment.priceSigner);

  return {
    privateKey,
    oracleAddress: getAddress(oracleAddress),
    chainId: parsePositiveInteger(env.CHAIN_ID ?? String(deployment?.chainId ?? DEFAULT_CHAIN_ID), 'CHAIN_ID'),
    validitySeconds: parsePositiveInteger(env.PRICE_TTL_SECONDS ?? String(DEFAULT_VALIDITY_SECONDS), 'PRICE_TTL_SECONDS'),
    port: parsePositiveInteger(env.PORT ?? String(DEFAULT_PORT), 'PORT'),
    host: parseHost(env.SIGNER_HOST ?? DEFAULT_HOST, 'SIGNER_HOST'),
    priceMap: loadPriceMap(env, deployment),
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
      if (request.method === 'OPTIONS') {
        writeJson(response, 204, null);
        return;
      }

      const url = requestUrl(request);
      if (url.pathname !== '/price') {
        writeJson(response, 404, { error: 'not_found' });
        return;
      }
      if (request.method !== 'GET') {
        writeJson(response, 405, { error: 'method_not_allowed' });
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
  server.listen(config.port, config.host, () => {
    console.log(`Mandate demo price signer listening on http://${config.host}:${config.port}`);
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

function loadDeploymentDefaults(path: string | undefined): DeploymentDefaults | null {
  if (path === undefined || path.trim() === '') return null;

  const deployment = JSON.parse(readFileSync(path, 'utf8')) as {
    chainId?: unknown;
    priceSigner?: unknown;
    contracts?: { usdg?: unknown; tsla?: unknown; amd?: unknown; priceFeed?: unknown };
  };
  const contracts = deployment.contracts ?? {};
  const usdgAddress = parseAddressValue(contracts.usdg, 'contracts.usdg');
  const tslaAddress = parseAddressValue(contracts.tsla, 'contracts.tsla');
  const amdAddress = parseAddressValue(contracts.amd, 'contracts.amd');
  const priceMap = new Map<string, bigint>([
    [tslaAddress.toLowerCase(), DEFAULT_TSLA_PRICE_USDG_1E18],
    [amdAddress.toLowerCase(), DEFAULT_AMD_PRICE_USDG_1E18],
  ]);

  return {
    chainId: parsePositiveInteger(String(deployment.chainId ?? DEFAULT_CHAIN_ID), 'deployment.chainId'),
    oracleAddress: parseAddressValue(contracts.priceFeed, 'contracts.priceFeed'),
    priceSigner: parseAddressValue(deployment.priceSigner, 'priceSigner'),
    priceMap,
    usdgAddress,
  };
}

function assertSignerMatchesDeployment(privateKey: string, expectedSigner: Address): void {
  const signerAddress = privateKeyToAccount(privateKey as `0x${string}`).address;
  if (signerAddress.toLowerCase() !== expectedSigner.toLowerCase()) {
    throw new Error('PRICE_SIGNER_KEY must match deployment priceSigner');
  }
}

function parseAddressValue(value: unknown, label: string): Address {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) {
    throw new Error(`MANDATE_DEPLOYMENT_PATH ${label} must be a valid EVM address`);
  }
  return getAddress(value);
}

function loadPriceMap(env: NodeJS.ProcessEnv, deployment: DeploymentDefaults | null = null): Map<string, bigint> {
  const priceMap = new Map<string, bigint>(deployment?.priceMap ?? []);

  if (env.PRICE_MAP_JSON !== undefined && env.PRICE_MAP_JSON.trim() !== '') {
    const parsed = JSON.parse(env.PRICE_MAP_JSON) as Record<string, unknown>;
    for (const [asset, value] of Object.entries(parsed)) {
      if (!isAddress(asset, { strict: false })) throw new Error(`PRICE_MAP_JSON contains invalid address ${asset}`);
      if (typeof value !== 'string') {
        throw new Error(`PRICE_MAP_JSON[${asset}] must be an unsigned decimal integer string`);
      }
      priceMap.set(getAddress(asset).toLowerCase(), parseUnsignedBigInt(value, `PRICE_MAP_JSON[${asset}]`));
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

function parseHost(value: string, label: string): string {
  const host = value.trim();
  if (host === '') throw new Error(`${label} must be a non-empty host`);
  return host;
}

function parseUnsignedBigInt(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error(`${label} must be an unsigned decimal integer`);
  return BigInt(value);
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(body === null ? '' : `${JSON.stringify(body)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    startServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
