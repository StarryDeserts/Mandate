/**
 * Read-only live-demo verifier for Mandate (Robinhood Chain testnet, chainId 46630).
 *
 * Reads `../deployments/46630.json` and a public RPC, then prints a concise demo
 * evidence report and exits non-zero on serious misconfiguration (wrong chain,
 * missing code, session key inactive, adapter not approved, oracle not
 * registered, allowed assets missing).
 *
 * It NEVER sends transactions and NEVER needs a private key. The only secret it
 * touches is the public RPC URL (read from the environment, then from
 * .env.local as a fallback) — and it prints only the RPC host, never the keyed
 * path.
 *
 * Run from the `web/` directory:
 *   npm run verify:live-demo
 * Optionally decode specific demo action txs (no log-range scan needed):
 *   DEMO_SAFE_TX=0x... DEMO_BLOCKED_TX=0x... npm run verify:live-demo
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  formatUnits,
  getAddress,
  http,
  type Address,
  type Hex
} from "viem";

const EXPECTED_CHAIN_ID = 46630;

type Deployment = {
  chainId: number;
  network?: string;
  owner: string;
  priceSigner: string;
  sessionKey: string;
  contracts: {
    usdg: string;
    tsla: string;
    amd: string;
    amm: string;
    adapter: string;
    priceFeed: string;
    mandateAccount: string;
  };
  seed?: {
    mandate?: {
      mandateVersion?: number;
      maxSingleAssetExposureBps?: number;
      maxTradeSizeUSDG?: string;
      maxDailyTurnoverBps?: number;
      cooldownSeconds?: number;
    };
  };
};

const mandateAbi = [
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "nextNonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "priceOracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "getMandate",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "mandateVersion", type: "uint64" },
          { name: "maxSingleAssetExposureBps", type: "uint16" },
          { name: "maxTradeSizeUSDG", type: "uint256" },
          { name: "maxDailyTurnoverBps", type: "uint16" },
          { name: "cooldownSeconds", type: "uint64" }
        ]
      }
    ]
  },
  { type: "function", name: "getAllowedAssets", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
  { type: "function", name: "isAssetAllowed", stateMutability: "view", inputs: [{ name: "asset", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "isAdapterAllowed", stateMutability: "view", inputs: [{ name: "adapter", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "roleOf", stateMutability: "view", inputs: [{ name: "actor", type: "address" }], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "sessionKeys",
    stateMutability: "view",
    inputs: [{ name: "key", type: "address" }],
    outputs: [
      { name: "enabled", type: "bool" },
      { name: "validUntil", type: "uint64" },
      { name: "allowedActionTypes", type: "uint8" },
      { name: "maxAmountInPerAction", type: "uint256" },
      { name: "scopeHash", type: "bytes32" }
    ]
  },
  {
    type: "function",
    name: "decisions",
    stateMutability: "view",
    inputs: [{ name: "actionId", type: "bytes32" }],
    outputs: [
      { name: "status", type: "uint8" },
      { name: "mandateVersion", type: "uint64" },
      { name: "submittedAt", type: "uint64" },
      { name: "expiresAt", type: "uint64" },
      { name: "priceDigest", type: "bytes32" },
      { name: "priceTimestamp", type: "uint64" }
    ]
  },
  {
    type: "event",
    name: "ActionExecuted",
    inputs: [
      { name: "actionId", type: "bytes32", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "postExposureBps", type: "uint16", indexed: false },
      { name: "priceDigest", type: "bytes32", indexed: false },
      { name: "priceTimestamp", type: "uint64", indexed: false }
    ]
  },
  {
    type: "event",
    name: "ActionBlocked",
    inputs: [
      { name: "actionId", type: "bytes32", indexed: true },
      { name: "reason", type: "uint8", indexed: false },
      { name: "preExposureBps", type: "uint16", indexed: false },
      { name: "postExposureBps", type: "uint16", indexed: false },
      { name: "priceDigest", type: "bytes32", indexed: false },
      { name: "priceTimestamp", type: "uint64", indexed: false }
    ]
  }
] as const;

const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }
] as const;

const ROLE_LABEL: Record<number, string> = { 0: "NONE", 1: "SESSION", 2: "OWNER" };
const STATUS_LABEL: Record<number, string> = { 0: "NONE", 1: "BLOCKED", 2: "APPROVED", 3: "EXECUTED", 4: "EXPIRED", 5: "CANCELLED" };
const REASON_LABEL: Record<number, string> = {
  0: "OK",
  1: "ASSET_NOT_ALLOWED",
  2: "ADAPTER_NOT_ALLOWED",
  3: "SINGLE_ASSET_EXPOSURE_EXCEEDED",
  4: "TRADE_SIZE_EXCEEDED",
  5: "DAILY_TURNOVER_EXCEEDED",
  6: "COOLDOWN_ACTIVE",
  7: "PRICE_STALE",
  8: "SESSION_EXPIRED",
  9: "RECIPIENT_NOT_ALLOWED",
  10: "SLIPPAGE"
};

const failures: string[] = [];
const warnings: string[] = [];

function pass(label: string, value?: string): void {
  console.log(`  PASS  ${label}${value !== undefined ? `: ${value}` : ""}`);
}
function fail(label: string, detail?: string): void {
  console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  failures.push(label);
}
function warn(label: string, detail?: string): void {
  console.log(`  WARN  ${label}${detail ? `: ${detail}` : ""}`);
  warnings.push(label);
}
function info(label: string, value: string): void {
  console.log(`  ${label.padEnd(26)} ${value}`);
}
function heading(title: string): void {
  console.log(`\n== ${title} ==`);
}
function short(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function readEnvVarFromFile(path: string, key: string): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && match[1] === key) {
      return match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return undefined;
}

function resolveRpcUrl(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ||
    process.env.MANDATE_RPC_URL ||
    readEnvVarFromFile(join(process.cwd(), ".env.local"), "NEXT_PUBLIC_ROBINHOOD_RPC_URL") ||
    readEnvVarFromFile(join(process.cwd(), "..", ".env.local"), "RPC_URL") ||
    undefined
  );
}

function rpcHost(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "(unparseable RPC URL)";
  }
}

async function main(): Promise<void> {
  console.log("Mandate live-demo read-only verification");
  console.log("(read-only — no transactions, no private keys)");

  const deploymentPath = join(process.cwd(), "..", "deployments", "46630.json");
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as Deployment;

  const rpcUrl = resolveRpcUrl();
  if (!rpcUrl) {
    console.error(
      "\nNo RPC URL found. Set NEXT_PUBLIC_ROBINHOOD_RPC_URL (or MANDATE_RPC_URL), " +
        "or add NEXT_PUBLIC_ROBINHOOD_RPC_URL to web/.env.local."
    );
    process.exitCode = 1;
    return;
  }

  const chain = defineChain({
    id: deployment.chainId,
    name: deployment.network ?? "robinhood-testnet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } }
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const c = deployment.contracts;
  const mandateAccount = getAddress(c.mandateAccount);

  heading("Deployment");
  info("RPC host", rpcHost(rpcUrl));
  info("deployment file chainId", String(deployment.chainId));

  const onchainChainId = await client.getChainId();
  if (onchainChainId === EXPECTED_CHAIN_ID && deployment.chainId === EXPECTED_CHAIN_ID) {
    pass("chainId", String(onchainChainId));
  } else {
    fail("chainId", `expected ${EXPECTED_CHAIN_ID}, rpc=${onchainChainId}, file=${deployment.chainId}`);
  }

  const codeTargets: Array<[string, string]> = [
    ["USDG (MockERC20)", c.usdg],
    ["TSLA (MockERC20)", c.tsla],
    ["AMD (MockERC20)", c.amd],
    ["MockAMM", c.amm],
    ["ApprovedSwapAdapter", c.adapter],
    ["SignedDemoPriceFeed", c.priceFeed],
    ["MandateAccount", c.mandateAccount]
  ];
  for (const [label, addr] of codeTargets) {
    try {
      const code = await client.getCode({ address: getAddress(addr) });
      if (code && code !== "0x") {
        pass(`code @ ${label}`, `${short(addr)} (${(code.length - 2) / 2} bytes)`);
      } else {
        fail(`code @ ${label}`, `no bytecode at ${addr}`);
      }
    } catch (error) {
      fail(`code @ ${label}`, `read error at ${addr}: ${(error as Error).message}`);
    }
  }

  heading("MandateAccount configuration");
  const read = <T>(functionName: string, args?: unknown[]): Promise<T> =>
    client.readContract({ address: mandateAccount, abi: mandateAbi, functionName, args }) as Promise<T>;

  try {
    const owner = (await read<Address>("owner"));
    if (getAddress(owner) === getAddress(deployment.owner)) pass("owner", owner);
    else warn("owner", `onchain ${owner} != deployment ${deployment.owner}`);
  } catch (error) {
    fail("owner", (error as Error).message);
  }

  info("USDG address", `${c.usdg}`);

  try {
    const allowed = await read<readonly Address[]>("getAllowedAssets");
    info("getAllowedAssets()", allowed.length ? allowed.map(short).join(", ") : "(none)");
  } catch (error) {
    warn("getAllowedAssets", (error as Error).message);
  }

  for (const [label, addr] of [
    ["USDG", c.usdg],
    ["TSLA", c.tsla],
    ["AMD", c.amd]
  ] as Array<[string, string]>) {
    try {
      const isAllowed = await read<boolean>("isAssetAllowed", [getAddress(addr)]);
      if (isAllowed) pass(`allowed asset ${label}`, short(addr));
      else fail(`allowed asset ${label}`, `isAssetAllowed=false (${addr})`);
    } catch (error) {
      fail(`allowed asset ${label}`, (error as Error).message);
    }
  }

  try {
    const adapterAllowed = await read<boolean>("isAdapterAllowed", [getAddress(c.adapter)]);
    if (adapterAllowed) pass("approved adapter", short(c.adapter));
    else fail("approved adapter", `isAdapterAllowed=false (${c.adapter})`);
  } catch (error) {
    fail("approved adapter", (error as Error).message);
  }

  try {
    const oracle = await read<Address>("priceOracle");
    if (oracle && oracle !== "0x0000000000000000000000000000000000000000") {
      if (getAddress(oracle) === getAddress(c.priceFeed)) pass("price oracle registered", oracle);
      else warn("price oracle registered", `onchain ${oracle} != deployment priceFeed ${c.priceFeed}`);
    } else {
      fail("price oracle registered", "priceOracle() is the zero address");
    }
  } catch (error) {
    fail("price oracle registered", (error as Error).message);
  }

  try {
    const m = await read<{
      mandateVersion: bigint;
      maxSingleAssetExposureBps: number;
      maxTradeSizeUSDG: bigint;
      maxDailyTurnoverBps: number;
      cooldownSeconds: bigint;
    }>("getMandate");
    info("mandate version", String(m.mandateVersion));
    info("max single-asset exposure", `${m.maxSingleAssetExposureBps} bps (${m.maxSingleAssetExposureBps / 100}%)`);
    info("max trade size", `${formatUnits(m.maxTradeSizeUSDG, 18)} USDG`);
    info("max daily turnover", `${m.maxDailyTurnoverBps} bps (${m.maxDailyTurnoverBps / 100}%)`);
    info("cooldown", `${m.cooldownSeconds}s`);
  } catch (error) {
    warn("getMandate", (error as Error).message);
  }

  let nextNonce: bigint | undefined;
  try {
    nextNonce = await read<bigint>("nextNonce");
    info("nextNonce", String(nextNonce));
  } catch (error) {
    warn("nextNonce", (error as Error).message);
  }

  heading("Session key");
  const sessionKey = getAddress(deployment.sessionKey);
  info("deployment sessionKey", sessionKey);
  const latestBlock = await client.getBlock();
  const nowSeconds = Number(latestBlock.timestamp);
  info("current block.timestamp", `${nowSeconds} (block ${latestBlock.number})`);

  try {
    const role = Number(await read<number>("roleOf", [sessionKey]));
    if (role === 1) pass("roleOf(sessionKey)", `${role} (${ROLE_LABEL[role]})`);
    else warn("roleOf(sessionKey)", `${role} (${ROLE_LABEL[role] ?? "?"}) — expected 1 (SESSION)`);
  } catch (error) {
    fail("roleOf(sessionKey)", (error as Error).message);
  }

  try {
    const sk = await read<readonly [boolean, bigint, number, bigint, Hex]>("sessionKeys", [sessionKey]);
    const enabled = sk[0];
    const validUntil = Number(sk[1]);
    const activeNow = enabled && validUntil >= nowSeconds;
    info("enabled", String(enabled));
    info("validUntil", `${validUntil} (${new Date(validUntil * 1000).toISOString()})`);
    const remainingDays = (validUntil - nowSeconds) / 86_400;
    info("remaining validity", `${remainingDays.toFixed(1)} days`);
    if (activeNow) pass("session key activeNow", "enabled & not expired");
    else fail("session key activeNow", enabled ? "validUntil < now (expired)" : "session key disabled");
  } catch (error) {
    fail("session key state", (error as Error).message);
  }

  heading("MandateAccount balances");
  for (const [label, addr] of [
    ["USDG", c.usdg],
    ["TSLA", c.tsla],
    ["AMD", c.amd]
  ] as Array<[string, string]>) {
    try {
      const [bal, decimals, symbol] = await Promise.all([
        client.readContract({ address: getAddress(addr), abi: erc20Abi, functionName: "balanceOf", args: [mandateAccount] }) as Promise<bigint>,
        client.readContract({ address: getAddress(addr), abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
        client.readContract({ address: getAddress(addr), abi: erc20Abi, functionName: "symbol" }) as Promise<string>
      ]);
      info(`${label} balance`, `${formatUnits(bal, Number(decimals))} ${symbol}`);
    } catch (error) {
      warn(`${label} balance`, (error as Error).message);
    }
  }

  heading("Latest demo outcomes");
  const safeTx = process.env.DEMO_SAFE_TX as Hex | undefined;
  const blockedTx = process.env.DEMO_BLOCKED_TX as Hex | undefined;
  if (!safeTx && !blockedTx) {
    info("nextNonce (submitted actions)", nextNonce !== undefined ? String(nextNonce) : "unknown");
    console.log(
      "  Note: per-action EXECUTED/BLOCKED evidence is not auto-discoverable here.\n" +
        "        This RPC (Alchemy free tier) caps eth_getLogs at a 10-block range, so\n" +
        "        scanning ActionExecuted / ActionBlocked across chain history is infeasible.\n" +
        "        To decode the real demo outcomes, re-run with the tx hashes captured\n" +
        "        during the live demo (the relayer returns submit/execute hashes):\n" +
        "          DEMO_SAFE_TX=0x... DEMO_BLOCKED_TX=0x... npm run verify:live-demo\n" +
        "        Or point NEXT_PUBLIC_ROBINHOOD_RPC_URL at a PAYG/archive RPC without the\n" +
        "        10-block getLogs cap. Do NOT use web/public/evidence.json — it is from an\n" +
        "        older deployment and its addresses do not match deployments/46630.json."
    );
  } else {
    for (const [label, hash] of [
      ["SAFE", safeTx],
      ["DANGEROUS", blockedTx]
    ] as Array<[string, Hex | undefined]>) {
      if (!hash) continue;
      await decodeDemoTx(client, mandateAccount, label, hash);
    }
  }

  heading("Summary");
  console.log(`  warnings: ${warnings.length}`);
  console.log(`  serious failures: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`  -> ${failures.join("; ")}`);
    console.log("\nRESULT: FAIL (serious misconfiguration)");
    process.exitCode = 1;
  } else {
    console.log("\nRESULT: PASS (demo prerequisites satisfied)");
  }
}

async function decodeDemoTx(
  client: ReturnType<typeof createPublicClient>,
  mandateAccount: Address,
  label: string,
  hash: Hex
): Promise<void> {
  console.log(`\n  [${label}] tx ${hash}`);
  try {
    const receipt = await client.getTransactionReceipt({ hash });
    info("block number", String(receipt.blockNumber));
    info("receipt status", receipt.status);
    let decodedAny = false;
    for (const log of receipt.logs) {
      if (getAddress(log.address) !== mandateAccount) continue;
      let decoded: { eventName: string; args: Record<string, unknown> } | undefined;
      try {
        decoded = decodeEventLog({ abi: mandateAbi, data: log.data, topics: log.topics }) as typeof decoded;
      } catch {
        continue;
      }
      if (!decoded) continue;
      if (decoded.eventName === "ActionExecuted") {
        decodedAny = true;
        const a = decoded.args;
        info("event", "ActionExecuted");
        info("actionId", String(a.actionId));
        info("amountIn / amountOut", `${a.amountIn} / ${a.amountOut}`);
        info("postExposureBps", `${a.postExposureBps} (${Number(a.postExposureBps) / 100}%)`);
        info("priceDigest", String(a.priceDigest));
        info("priceTimestamp", String(a.priceTimestamp));
        await reportDecision(client, mandateAccount, a.actionId as Hex);
      } else if (decoded.eventName === "ActionBlocked") {
        decodedAny = true;
        const a = decoded.args;
        const reason = Number(a.reason);
        info("event", "ActionBlocked");
        info("actionId", String(a.actionId));
        info("reason", `${reason} (${REASON_LABEL[reason] ?? "?"})`);
        info("preExposureBps", `${a.preExposureBps} (${Number(a.preExposureBps) / 100}%)`);
        info("postExposureBps", `${a.postExposureBps} (${Number(a.postExposureBps) / 100}%)`);
        info("priceDigest", String(a.priceDigest));
        info("priceTimestamp", String(a.priceTimestamp));
        await reportDecision(client, mandateAccount, a.actionId as Hex);
      }
    }
    if (!decodedAny) {
      warn(`${label} tx`, "no ActionExecuted / ActionBlocked log from MandateAccount in this receipt");
    }
  } catch (error) {
    warn(`${label} tx`, `could not fetch/decode: ${(error as Error).message}`);
  }
}

async function reportDecision(
  client: ReturnType<typeof createPublicClient>,
  mandateAccount: Address,
  actionId: Hex
): Promise<void> {
  try {
    const d = (await client.readContract({
      address: mandateAccount,
      abi: mandateAbi,
      functionName: "decisions",
      args: [actionId]
    })) as readonly [number, bigint, bigint, bigint, Hex, bigint];
    const status = Number(d[0]);
    info("decisions().status", `${status} (${STATUS_LABEL[status] ?? "?"})`);
  } catch (error) {
    warn("decisions()", (error as Error).message);
  }
}

main().catch((error) => {
  console.error("\nverify-live-demo crashed:", error);
  process.exitCode = 1;
});
