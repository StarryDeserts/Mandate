export const ROBINHOOD_CHAIN_ID_DECIMAL = 46630;
export const ROBINHOOD_CHAIN_ID_HEX = "0xb626";
export const ROBINHOOD_EXPLORER_URL = "https://explorer.testnet.chain.robinhood.com";

type RequestArgs = {
  method: string;
  params?: unknown[];
};

export type DirectProvider = {
  request(args: RequestArgs): Promise<unknown>;
  on?: (event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", listener: (value: unknown) => void) => void;
};

export type HexAddress = `0x${string}`;

type RequestError = Error & { code?: number };

export type NativeBalanceResult = {
  address: HexAddress;
  chainId: number;
  rawWeiHex: string;
  wei: bigint;
  formattedEth: string;
};

export async function connectWalletDirect(provider: DirectProvider): Promise<HexAddress | null> {
  return firstAddress(await provider.request({ method: "eth_requestAccounts" }));
}

export async function readChainIdDirect(provider: DirectProvider): Promise<number | null> {
  return parseChainId(await provider.request({ method: "eth_chainId" }));
}

export async function switchToRobinhoodChainDirect(provider: DirectProvider, publicRpcUrl: string): Promise<void> {
  try {
    await requestSwitch(provider);
  } catch (caught) {
    const requestError = caught as RequestError;
    if (requestError.code !== 4902) throw caught;

    const rpcUrl = publicRpcUrl.trim();
    if (!rpcUrl) throw new Error("Public Robinhood RPC is not configured. Set NEXT_PUBLIC_ROBINHOOD_RPC_URL and restart the web server.");

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: ROBINHOOD_CHAIN_ID_HEX,
          chainName: "Robinhood Chain Testnet",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: [ROBINHOOD_EXPLORER_URL]
        }
      ]
    });
    await requestSwitch(provider);
  }
}

export async function readNativeBalanceDirect(provider: DirectProvider): Promise<NativeBalanceResult> {
  const address = firstAddress(await provider.request({ method: "eth_accounts" }));
  if (!address) throw new Error("No connected account. Click Connect Wallet first.");

  const chainId = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (chainId !== ROBINHOOD_CHAIN_ID_DECIMAL) throw new Error(`Wrong chain ${chainId ?? "unknown"}; expected ${ROBINHOOD_CHAIN_ID_HEX}.`);

  const rawWei = await provider.request({ method: "eth_getBalance", params: [address, "latest"] });
  if (typeof rawWei !== "string" || !rawWei.startsWith("0x")) throw new Error("Native balance response was not a wei hex string.");

  const wei = BigInt(rawWei);
  return {
    address,
    chainId,
    rawWeiHex: rawWei,
    wei,
    formattedEth: weiToEthString(wei)
  };
}

export function firstAddress(accounts: unknown): HexAddress | null {
  const first = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null;
  return first && first.startsWith("0x") ? (first as HexAddress) : null;
}

export function parseChainId(value: unknown): number | null {
  if (typeof value === "string") return Number.parseInt(value, 16);
  if (typeof value === "number") return value;
  return null;
}

export function weiToEthString(wei: bigint): string {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} ETH` : `${whole} ETH`;
}

function requestSwitch(provider: DirectProvider): Promise<unknown> {
  return provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ROBINHOOD_CHAIN_ID_HEX }] });
}
