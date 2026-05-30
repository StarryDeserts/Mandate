import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPublicClient, createWalletClient, defineChain, http, type Abi, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { signPriceData, type SignedPriceData } from './sign-price.js';

const chainId = 46_630;
const genesisTimestamp = 1_800_000_000;
const maxStaleness = 60;
const signerKey = '0x0000000000000000000000000000000000000000000000000000000a11ce51a9';
const deployerKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const deployer = privateKeyToAccount(deployerKey);
const asset = '0x00000000000000000000000000000000000000AA';
const account = '0x000000000000000000000000000000000000beef';
const priceUSDG1e18 = 123_450_000_000_000_000_000n;

type SignedDemoPriceFeedArtifact = {
  abi: Abi;
  bytecode: { object: Hex };
};

type AnvilRpcResult = {
  error?: { message: string };
  result?: unknown;
};

const chain = defineChain({
  id: chainId,
  name: 'Mandate Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1'] } },
});

let anvil: ChildProcess | undefined;
let rpcUrl: string;
let feedAddress: Address;
let publicClient: ReturnType<typeof createPublicClient>;
let walletClient: ReturnType<typeof createWalletClient>;
let anvilStderr = '';

beforeAll(async () => {
  buildContracts();

  const port = await getFreePort();
  rpcUrl = `http://127.0.0.1:${port}`;
  const anvilProcess = spawn(
    'anvil',
    [
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--chain-id',
      String(chainId),
      '--timestamp',
      String(genesisTimestamp),
      '--silent',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  anvil = anvilProcess;
  anvilProcess.stderr.on('data', (chunk: Buffer) => {
    anvilStderr += chunk.toString('utf8');
  });

  publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  walletClient = createWalletClient({ account: deployer, chain, transport: http(rpcUrl) });

  await waitForAnvil();
  await deployFeed();
}, 30_000);

afterAll(async () => {
  if (anvil === undefined || anvil.killed) return;
  anvil.kill('SIGTERM');
  await Promise.race([once(anvil, 'exit'), delay(1_000)]);
});

describe('SignedDemoPriceFeed on-chain verification', () => {
  it('accepts a fresh TypeScript-produced PriceData signature', async () => {
    const timestamp = await latestTimestamp();
    const row = await signPriceData({
      privateKey: signerKey,
      chainId,
      oracleAddress: feedAddress,
      asset,
      priceUSDG1e18,
      timestamp,
      validUntil: timestamp + maxStaleness,
    });

    const [price, returnedTimestamp] = (await publicClient.readContract({
      address: feedAddress,
      abi: await feedAbi(),
      functionName: 'getPrice',
      args: [asset, toSolidityPriceData(row), account],
    })) as readonly [bigint, bigint];

    expect(price).toBe(priceUSDG1e18);
    expect(returnedTimestamp).toBe(BigInt(timestamp));
  });

  it('rejects an expired TypeScript-produced PriceData signature', async () => {
    const timestamp = await latestTimestamp();
    const row = await signPriceData({
      privateKey: signerKey,
      chainId,
      oracleAddress: feedAddress,
      asset,
      priceUSDG1e18,
      timestamp,
      validUntil: timestamp + 1,
    });
    await mineAt(timestamp + 2);

    await expect(
      publicClient.readContract({
        address: feedAddress,
        abi: await feedAbi(),
        functionName: 'getPrice',
        args: [asset, toSolidityPriceData(row), account],
      }),
    ).rejects.toThrow(/PriceUnverified/);
  });

  it('rejects a stale TypeScript-produced PriceData signature before validUntil', async () => {
    const timestamp = (await latestTimestamp()) - maxStaleness - 1;
    const row = await signPriceData({
      privateKey: signerKey,
      chainId,
      oracleAddress: feedAddress,
      asset,
      priceUSDG1e18,
      timestamp,
      validUntil: timestamp + maxStaleness + 1_000,
    });

    await expect(
      publicClient.readContract({
        address: feedAddress,
        abi: await feedAbi(),
        functionName: 'getPrice',
        args: [asset, toSolidityPriceData(row), account],
      }),
    ).rejects.toThrow(/PriceUnverified/);
  });
});

function buildContracts(): void {
  const contractsDir = fileURLToPath(new URL('../../contracts/', import.meta.url));
  const result = spawnSync('forge', ['build'], { cwd: contractsDir, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`forge build failed before on-chain signer test\n${result.stdout}\n${result.stderr}`);
  }
}

async function deployFeed(): Promise<void> {
  const artifact = await feedArtifact();
  const signer = privateKeyToAccount(signerKey).address;
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode.object,
    account: deployer,
    chain,
    args: [signer, BigInt(maxStaleness)] as const,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.contractAddress === null || receipt.contractAddress === undefined) {
    throw new Error('SignedDemoPriceFeed deployment did not return a contract address');
  }
  feedAddress = receipt.contractAddress;
}

async function feedArtifact(): Promise<SignedDemoPriceFeedArtifact> {
  const artifactPath = fileURLToPath(
    new URL('../../contracts/out/SignedDemoPriceFeed.sol/SignedDemoPriceFeed.json', import.meta.url),
  );
  return JSON.parse(await readFile(artifactPath, 'utf8')) as SignedDemoPriceFeedArtifact;
}

async function feedAbi(): Promise<Abi> {
  return (await feedArtifact()).abi;
}

function toSolidityPriceData(row: SignedPriceData) {
  return {
    asset: row.asset,
    priceUSDG1e18: row.priceUSDG1e18,
    timestamp: BigInt(row.timestamp),
    validUntil: BigInt(row.validUntil),
    signature: row.signature,
  };
}

async function getFreePort(): Promise<number> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('expected TCP server address');
  server.close();
  await once(server, 'close');
  return address.port;
}

async function waitForAnvil(): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (anvil?.exitCode !== null) throw new Error(`anvil exited before tests started: ${anvilStderr}`);
    try {
      await publicClient.getChainId();
      return;
    } catch {
      await delay(100);
    }
  }
  throw new Error(`anvil did not become ready: ${anvilStderr}`);
}

async function latestTimestamp(): Promise<number> {
  return Number((await publicClient.getBlock()).timestamp);
}

async function mineAt(timestamp: number): Promise<void> {
  await anvilRpc('evm_setNextBlockTimestamp', [timestamp]);
  await anvilRpc('evm_mine');
}

async function anvilRpc(method: string, params: unknown[] = []): Promise<unknown> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await response.json()) as AnvilRpcResult;
  if (!response.ok || body.error !== undefined) {
    throw new Error(`anvil RPC ${method} failed: ${body.error?.message ?? response.statusText}`);
  }
  return body.result;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
