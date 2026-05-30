import { getAddress, isAddress, type Address, type Hex, type TypedDataDomain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const MANDATE_PRICE_FEED_NAME = 'MandatePriceFeed';
export const MANDATE_PRICE_FEED_VERSION = '1';
export const DEFAULT_CHAIN_ID = 46_630;
export const DEFAULT_VALIDITY_SECONDS = 3_600;

export const PRICE_DATA_PRIMARY_TYPE = 'PriceData';
export const PRICE_DATA_TYPES = {
  PriceData: [
    { name: 'asset', type: 'address' },
    { name: 'priceUSDG1e18', type: 'uint256' },
    { name: 'timestamp', type: 'uint64' },
    { name: 'validUntil', type: 'uint64' },
  ],
} as const;

const MAX_UINT64 = 18_446_744_073_709_551_615n;
const MAX_UINT256 = (1n << 256n) - 1n;
const DISTINCT_SIGNER_ENV_NAMES = ['DEPLOYER', 'DEPLOYER_KEY', 'DEPLOYER_PRIVATE_KEY', 'SESSION_KEY', 'SESSION_PRIVATE_KEY'] as const;

export type PriceInput = {
  asset: Address | string;
  priceUSDG1e18: bigint | number | string;
};

export type SignPriceOptions = PriceInput & {
  privateKey: Hex | string;
  oracleAddress: Address | string;
  chainId?: number;
  timestamp?: number;
  validUntil?: number;
  validitySeconds?: number;
};

export type SortAndSignOptions = Omit<SignPriceOptions, keyof PriceInput>;

export type SignedPriceData = {
  asset: Address;
  priceUSDG1e18: bigint;
  timestamp: number;
  validUntil: number;
  signature: Hex;
};

export function normalizePrivateKey(value: string | undefined, label = 'PRICE_SIGNER_KEY'): Hex {
  if (value === undefined || value.trim() === '') {
    throw new Error(`${label} is required`);
  }

  const trimmed = value.trim();
  if (!/^0x[0-9a-fA-F]+$/.test(trimmed)) {
    throw new Error(`${label} must be a 0x-prefixed hexadecimal private key`);
  }

  const hex = trimmed.slice(2).toLowerCase();
  if (hex.length > 64) {
    throw new Error(`${label} must not exceed 32 bytes`);
  }

  const normalized = `0x${hex.padStart(64, '0')}` as Hex;
  if (BigInt(normalized) === 0n) {
    throw new Error(`${label} must not be zero`);
  }

  return normalized;
}

export function assertIndependentSignerKey(
  signerKey: string,
  env: Partial<Pick<NodeJS.ProcessEnv, (typeof DISTINCT_SIGNER_ENV_NAMES)[number]>> = process.env,
): void {
  const normalizedSignerKey = normalizePrivateKey(signerKey, 'PRICE_SIGNER_KEY').toLowerCase();
  const signerAddress = privateKeyToAccount(normalizedSignerKey as Hex).address.toLowerCase();

  for (const name of DISTINCT_SIGNER_ENV_NAMES) {
    const candidate = env[name];
    if (candidate === undefined || candidate.trim() === '') continue;

    const trimmedCandidate = candidate.trim();
    if (isAddress(trimmedCandidate, { strict: false })) {
      if (getAddress(trimmedCandidate).toLowerCase() === signerAddress) {
        throw new Error(`PRICE_SIGNER_KEY must be distinct from ${name}`);
      }
      continue;
    }

    const normalizedCandidate = normalizePrivateKey(trimmedCandidate, name).toLowerCase();
    const candidateAddress = privateKeyToAccount(normalizedCandidate as Hex).address.toLowerCase();
    if (normalizedCandidate === normalizedSignerKey || candidateAddress === signerAddress) {
      throw new Error(`PRICE_SIGNER_KEY must be distinct from ${name}`);
    }
  }
}

export function getPriceSignerAccount(privateKey = process.env.PRICE_SIGNER_KEY) {
  const normalizedPrivateKey = normalizePrivateKey(privateKey, 'PRICE_SIGNER_KEY');
  assertIndependentSignerKey(normalizedPrivateKey);
  return privateKeyToAccount(normalizedPrivateKey);
}

export function buildMandatePriceFeedDomain({
  chainId = DEFAULT_CHAIN_ID,
  verifyingContract,
}: {
  chainId?: number;
  verifyingContract: Address | string;
}): TypedDataDomain {
  return {
    name: MANDATE_PRICE_FEED_NAME,
    version: MANDATE_PRICE_FEED_VERSION,
    chainId,
    verifyingContract: normalizeAddress(verifyingContract, 'verifyingContract'),
  };
}

export async function signPriceData(options: SignPriceOptions): Promise<SignedPriceData> {
  const timestamp = normalizeUint64(options.timestamp ?? currentUnixTimestamp(), 'timestamp');
  const validUntil = normalizeUint64(
    options.validUntil ?? timestamp + normalizeValiditySeconds(options.validitySeconds ?? DEFAULT_VALIDITY_SECONDS),
    'validUntil',
  );

  if (validUntil < timestamp) {
    throw new Error('validUntil must be greater than or equal to timestamp');
  }

  const privateKey = normalizePrivateKey(options.privateKey, 'PRICE_SIGNER_KEY');
  assertIndependentSignerKey(privateKey);
  const account = privateKeyToAccount(privateKey);
  const message = {
    asset: normalizeAddress(options.asset, 'asset'),
    priceUSDG1e18: normalizeUint256(options.priceUSDG1e18, 'priceUSDG1e18'),
    timestamp,
    validUntil,
  };

  const signature = await account.signTypedData({
    domain: buildMandatePriceFeedDomain({ chainId: options.chainId, verifyingContract: options.oracleAddress }),
    types: PRICE_DATA_TYPES,
    primaryType: PRICE_DATA_PRIMARY_TYPE,
    message: {
      ...message,
      timestamp: BigInt(message.timestamp),
      validUntil: BigInt(message.validUntil),
    },
  });

  return { ...message, signature };
}

export async function sortAndSignPriceData(
  rows: PriceInput[],
  options: SortAndSignOptions,
): Promise<SignedPriceData[]> {
  const normalizedRows = rows.map((row) => ({
    asset: normalizeAddress(row.asset, 'asset'),
    priceUSDG1e18: normalizeUint256(row.priceUSDG1e18, 'priceUSDG1e18'),
  }));

  normalizedRows.sort((left, right) => compareAddresses(left.asset, right.asset));

  for (let index = 1; index < normalizedRows.length; index += 1) {
    if (normalizedRows[index - 1].asset.toLowerCase() === normalizedRows[index].asset.toLowerCase()) {
      throw new Error(`duplicate asset ${normalizedRows[index].asset}`);
    }
  }

  const timestamp = normalizeUint64(options.timestamp ?? currentUnixTimestamp(), 'timestamp');
  const validUntil = normalizeUint64(
    options.validUntil ?? timestamp + normalizeValiditySeconds(options.validitySeconds ?? DEFAULT_VALIDITY_SECONDS),
    'validUntil',
  );

  return Promise.all(
    normalizedRows.map((row) =>
      signPriceData({
        ...options,
        ...row,
        timestamp,
        validUntil,
      }),
    ),
  );
}

export function compareAddresses(left: Address, right: Address): number {
  const leftValue = BigInt(left);
  const rightValue = BigInt(right);
  if (leftValue < rightValue) return -1;
  if (leftValue > rightValue) return 1;
  return 0;
}

export function toJsonPriceData(row: SignedPriceData) {
  return {
    asset: row.asset,
    priceUSDG1e18: row.priceUSDG1e18.toString(),
    timestamp: row.timestamp,
    validUntil: row.validUntil,
    signature: row.signature,
  };
}

function currentUnixTimestamp(): number {
  return Math.floor(Date.now() / 1_000);
}

function normalizeAddress(value: Address | string, label: string): Address {
  if (!isAddress(value, { strict: false })) {
    throw new Error(`${label} must be a valid EVM address`);
  }
  return getAddress(value);
}

function normalizeUint256(value: bigint | number | string, label: string): bigint {
  const parsed = normalizeUnsignedInteger(value, label);
  if (parsed > MAX_UINT256) {
    throw new Error(`${label} exceeds uint256`);
  }
  return parsed;
}

function normalizeUint64(value: bigint | number | string, label: string): number {
  const parsed = normalizeUnsignedInteger(value, label);
  if (parsed > MAX_UINT64) {
    throw new Error(`${label} exceeds uint64`);
  }
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds JavaScript safe integer range`);
  }
  return Number(parsed);
}

function normalizeValiditySeconds(value: number): number {
  return normalizeUint64(value, 'validitySeconds');
}

function normalizeUnsignedInteger(value: bigint | number | string, label: string): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error(`${label} must be non-negative`);
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative safe integer`);
    }
    return BigInt(value);
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be an unsigned decimal integer`);
  }
  return BigInt(value);
}
