export const actionComponents = [
  { name: "actionSchemaVersion", type: "uint16" },
  { name: "account", type: "address" },
  { name: "nonce", type: "uint256" },
  { name: "actionType", type: "uint8" },
  { name: "assetIn", type: "address" },
  { name: "amountIn", type: "uint256" },
  { name: "assetOut", type: "address" },
  { name: "minAmountOut", type: "uint256" },
  { name: "adapter", type: "address" },
  { name: "recipient", type: "address" },
  { name: "deadline", type: "uint64" }
] as const;

export const priceDataComponents = [
  { name: "asset", type: "address" },
  { name: "priceUSDG1e18", type: "uint256" },
  { name: "timestamp", type: "uint64" },
  { name: "validUntil", type: "uint64" },
  { name: "signature", type: "bytes" }
] as const;

export const mandateAccountAbi = [
  { type: "function", name: "ACTION_SCHEMA_VERSION", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "APPROVAL_TTL", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "nextNonce", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "priceOracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "dailyTurnoverUsedUSDG", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastTradeTimestamp", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
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
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "asset", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
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
  { type: "function", name: "computeActionId", stateMutability: "view", inputs: [{ name: "action", type: "tuple", components: actionComponents }], outputs: [{ type: "bytes32" }] },
  {
    type: "function",
    name: "previewAction",
    stateMutability: "view",
    inputs: [
      { name: "action", type: "tuple", components: actionComponents },
      { name: "prices", type: "tuple[]", components: priceDataComponents }
    ],
    outputs: [
      { name: "code", type: "uint8" },
      { name: "preExposureBps", type: "uint16" },
      { name: "postExposureBps", type: "uint16" }
    ]
  },
  {
    type: "function",
    name: "submitAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "action", type: "tuple", components: actionComponents },
      { name: "prices", type: "tuple[]", components: priceDataComponents }
    ],
    outputs: [
      { name: "actionId", type: "bytes32" },
      { name: "code", type: "uint8" },
      { name: "preExposureBps", type: "uint16" },
      { name: "postExposureBps", type: "uint16" }
    ]
  },
  {
    type: "function",
    name: "executeAction",
    stateMutability: "nonpayable",
    inputs: [
      { name: "action", type: "tuple", components: actionComponents },
      { name: "prices", type: "tuple[]", components: priceDataComponents }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "asset", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "from", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "ActionSubmitted",
    inputs: [
      { name: "actionId", type: "bytes32", indexed: true },
      { name: "actor", type: "address", indexed: true },
      { name: "role", type: "uint8", indexed: false },
      { name: "status", type: "uint8", indexed: false }
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
  }
] as const;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }
] as const;

export const erc20FundingAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }
] as const;
