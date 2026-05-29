# Mandate Account MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **On execution, also copy this plan to** `docs/superpowers/plans/2026-05-29-mandate-account-mvp.md`.

**Goal:** Ship a Robinhood Chain testnet demo where a user-defined on-chain *mandate* lets an AI session key only *propose* tokenized-stock swaps — blocking an unsafe action on-chain (auditable) and executing a safe one (auditable), with no AI custody.

**Architecture:** Account form **A** (minimal self-built Guarded Account, ADR-0001): one `MandateAccount` contract custodies funds and is the sole asset-movement path; a stateless `EquityPermissionEngine` computes mandate decisions; `SignedDemoPriceFeed` (demo-grade, ADR-0010) supplies signed prices; `ApprovedSwapAdapter` wraps a `MockAMM` swap venue (ADR-0018). Two on-chain entrypoints: `submitAction` (records BLOCKED/APPROVED, never reverts on policy, ADR-0003) and `executeAction` (10-condition re-validation, reverts on any failure, ADR-0009). Off-chain price signer + Next.js UI for Action Review and Audit Trail.

**Tech Stack:** Solidity 0.8.24 + Foundry (forge/cast/anvil) + OpenZeppelin (IERC20, SafeERC20, ReentrancyGuard, EIP712, ECDSA); TypeScript + viem for the price signer; Next.js (App Router) + wagmi + viem for the UI; Robinhood Chain testnet (chainId **46630**).

---

## Context (why this exists)

AI automation of tokenized-stock workflows is valuable but giving an AI custody is unacceptable. Mandate Account separates **proposal** (AI/session key, untrusted) from **authorization** (user's on-chain mandate, enforced atomically inside the account). The strong claim — *even if frontend+backend+AI+session key are fully compromised, the attacker can at most propose within-mandate trades, never move funds outside the gated path nor change the mandate* — holds **conditional on the price signer being independent** (ADR-0002, trust tier T2). This plan builds the smallest system that demonstrates that claim end-to-end on testnet, optimized for a 2-week hackathon (submission 2026-06-14) judged on smart-contract quality and real problem-solving.

## Out of Scope / FORBIDDEN (enforced by ADRs — do NOT introduce)

Per ADR-0001/0005/0016 and Phase 8 constraint #8, the implementation MUST NOT contain:
- ERC-4337 / `validateUserOp` / EntryPoint / Bundler / Paymaster / Gas Manager
- `executeBatch` or any batch entrypoint
- `migrateTo` (only `withdraw` is the owner exit — ADR-0016)
- arbitrary calldata / generic `execute(dest,value,calldata)` / low-level call with caller-controlled target
- upgradeable proxy / delegatecall-based upgradeability
- production oracle integration (only `SignedDemoPriceFeed`, clearly labeled demo — ADR-0010)
- real investment advice (AI = proposal/translation/explanation only)

A task that needs any of the above is wrong; stop and re-check the ADRs.

---

## 1. Repo Structure

```
mandate-account/
├── README.md
├── docs/architecture/
│   ├── adr/0001..0018-*.md + README.md (index)
│   ├── SECURITY_INVARIANTS.md
│   └── enforcement-matrix.md        # judges: chain-enforced vs reserved; demo-numbers integrity note
├── docs/superpowers/plans/2026-05-29-mandate-account-mvp.md   # copy of this plan
├── contracts/                       # Foundry
│   ├── foundry.toml · remappings.txt
│   ├── src/
│   │   ├── types/ Enums.sol · Types.sol · Errors.sol
│   │   ├── interfaces/ IPriceOracle.sol · IAdapter.sol · IAssetRegistry.sol · IAdapterRegistry.sol · IMandateRegistry.sol · IEquityPermissionEngine.sol
│   │   ├── lib/ ActionLib.sol · EquityPermissionEngine.sol
│   │   ├── MandateAccount.sol
│   │   ├── oracle/SignedDemoPriceFeed.sol
│   │   ├── adapters/ApprovedSwapAdapter.sol
│   │   └── mocks/ MockERC20.sol · MockAMM.sol
│   ├── test/ unit/*.t.sol · invariant/Invariants.t.sol · integration/DemoLoop.t.sol
│   └── script/ Deploy.s.sol · SeedDemo.s.sol
├── signer/                          # off-chain price signer (TS + viem)
│   └── src/ sign-price.ts · server.ts
└── web/                             # Next.js + wagmi/viem
    └── src/ lib/{contracts,eip712,prices}.ts · components/{PolicyPanel,ActionReview,AuditTrail}.tsx · app/page.tsx
```

Each contract file = one responsibility (ADR-0004 layers). `MandateAccount.sol` co-locates Auth + ActionGate + Execution + Audit + registry storage so the unique asset path is in one auditable file; Engine is a stateless library (single decision source, staticcall-able); oracle and adapter are separate swappable contracts.

## 2. Milestone Plan

| M | Title | Outcome | Demo-critical |
|---|---|---|---|
| M0 | Foundation & ADRs | Repo + ADRs + SECURITY_INVARIANTS + Foundry scaffold | prerequisite |
| M1 | Types/Interfaces/ActionLib | Enums, structs, errors, interfaces; EIP-712 `_hashAction` (red→green) | ★ |
| M2 | EquityPermissionEngine | Stateless `evaluate()` decision math | ★ |
| M3 | SignedDemoPriceFeed | Signed price verify + staleness/validUntil | ★ |
| M4 | Mocks & Adapter | MockERC20, MockAMM (fixed-rate), ApprovedSwapAdapter | ★ |
| M5 | MandateAccount governance | owner/roles, enumerable asset list, mandate, session keys, withdraw | ★ |
| M6 | submitAction | decision-record path (no revert), nonce, events | ★ |
| M7 | executeAction | 10-condition re-validation, CEI, adapter call, post-check | ★ |
| M8 | Invariants & Integration | INV-1..12 tests + DemoLoop 9-step test | ★ (proves loop on-chain) |
| M9 | Deploy & Signer | Deploy/Seed scripts, price signer, testnet addresses | ★ |
| M10 | Frontend | Policy panel, Action Review (preview), Audit Trail | ★ (visible loop) |
| M11 | Demo | Testnet rehearsal, checklist, README/demo script | ★ |

**Critical path to the demo closed-loop:** M0→M1→M2→M3→M4→M5→M6→M7→(M8 proves it in Solidity)→M9→M10→M11. M2/M3/M4 depend only on M1 and may be built in any order.

## 3. Task Dependency Order

```
M0: T01 → T02,T03,T04 (docs, parallel) ; T05 (foundry scaffold)
M1: T05 → T06 → T07 → T08 → T09 ; (T06,T07) → T10 (ActionLib)
M2: T07,T09 → T11 (Engine)
M3: T07,T09 → T12 (PriceFeed)
M4: T05 → T13 (MockERC20) → T14 (MockAMM) ; T09,T14 → T15 (Adapter)
M5: T07,T08,T09 → T16 → {T17,T18,T19,T20,T21}
M6: T10,T11,T12,T16,T18,T19 → T22 (preview) → T23 (submit) → T24 (prices discipline)
M7: T15,T23 → T25 (execute) → T26 (cancelApproved)
M8: T17..T26 → T27 (invariants) ; T21,T25 → T28 (DemoLoop)
M9: all contracts → T29 (Deploy) → T30 (Seed) ; T12 → T31 (signer) ; T29,T30 → T32 (testnet deploy)
M10: T32,T31 → T33 → T34 → {T35,T36,T37}
M11: T35,T36,T37 → T38 (rehearsal) → T39 (README/demo script)
```

## Security Invariants (source of truth — become M8 tests)

Authored in `docs/architecture/SECURITY_INVARIANTS.md` (T03). Each maps to ADRs and an invariant test (T27):
- **INV-1 Custody:** assets leave `MandateAccount` ONLY via `executeAction`→adapter or owner `withdraw`. (ADR-0001/0016)
- **INV-2 Session powerlessness:** a SESSION caller can never change mandate/allowlists/session keys/owner, never withdraw, never execute a non-APPROVED action. (ADR-0004/0009)
- **INV-3 No double-execute:** a Decision reaches EXECUTED at most once; re-execute reverts. (ADR-0009)
- **INV-4 Approval integrity:** `executeAction(action)` succeeds only if `decisions[_hashAction(action)]==APPROVED` AND all 10 re-checks pass. (ADR-0009)
- **INV-5 Action binding:** distinct Actions never share an actionId; an approval for A cannot execute B. (ADR-0006)
- **INV-6 Nonce monotonic:** `nextNonce` increases by exactly 1 per non-reverting submit; consumed nonce unusable. (ADR-0008)
- **INV-7 Mandate freshness:** an APPROVED decision cannot execute after `mandateVersion` changes. (ADR-0007/0009)
- **INV-8 Price integrity:** no decision/execution uses an unsigned/stale price; `prices[]` must be sorted, unique, and cover all valued assets. (ADR-0010/0011)
- **INV-9 Recipient lock:** executed swaps deliver output to the account only (`recipient==account`). (ADR-0009)
- **INV-10 Default-deny:** missing config/price or engine/adapter error → BLOCK or revert, never allow. (ADR-0017)
- **INV-11 Bounded approval:** adapter approval set to exact amount then reset to 0; never left nonzero. (ADR-0018)
- **INV-12 Honest scope:** `addSessionKey` rejects non-default reserved scope fields. (ADR-0015)

---

## 4. Detailed Task List

> Per-task fields: **Purpose · Files · Dependencies · Implementation notes · Tests · Acceptance**. TDD order inside each code task: write failing test → run red → minimal impl → run green → commit. Do **not** write code in this plan; write the spec/tests/criteria, the implementer writes bodies. Reference Phase 5 signatures and the ADR/INV docs created in M0.

### Milestone 0 — Foundation & ADRs

#### T01 — Initialize monorepo
- **Purpose:** Create repo root, git, top-level dirs, root README stub.
- **Files:** Create `mandate-account/README.md`, `.gitignore`, dir tree from §1.
- **Dependencies:** none.
- **Implementation notes:** `.gitignore` for node, foundry `out/`/`cache/`, `.env`. README: one-paragraph product + "demo-grade, testnet only" disclaimer.
- **Tests:** n/a (scaffold).
- **Acceptance:** `git status` clean after initial commit; dir tree matches §1.

#### T02 — Author ADRs 0001–0018
- **Purpose:** Persist Phase-7 decisions as the binding design record.
- **Files:** Create `docs/architecture/adr/0001-*.md` … `0018-*.md` + `adr/README.md` index.
- **Dependencies:** T01.
- **Implementation notes:** Copy Phase 7 ADRs verbatim, each with Status/Context/Decision/Alternatives/Consequences/Migration. Index links all 18 and marks the 5 anti-regression ones (0006/0010/0012/0013/0016).
- **Tests:** n/a (docs); a markdown link-check is sufficient.
- **Acceptance:** All 18 ADRs present; index resolves; forbidden list (this plan) reconciles with ADR-0005/0016.

#### T03 — Author SECURITY_INVARIANTS.md
- **Purpose:** Single source of truth for INV-1..12 that M8 tests enforce.
- **Files:** Create `docs/architecture/SECURITY_INVARIANTS.md`.
- **Dependencies:** T01.
- **Implementation notes:** Each invariant: statement, rationale, ADR ref, and "test handle" (which test file/case will assert it). Include the trust-tier table T0–T4 (ADR-0002).
- **Tests:** n/a.
- **Acceptance:** All 12 invariants documented with a named test handle each.

#### T04 — Author enforcement-matrix.md (judges) + demo-numbers integrity note
- **Purpose:** Prevent misleading judges about what is chain-enforced; lock demo honesty.
- **Files:** Create `docs/architecture/enforcement-matrix.md`.
- **Dependencies:** T01.
- **Implementation notes:** Table of SessionKey fields (enabled/validUntil = enforced; allowedActionTypes/maxAmountInPerAction/scopeHash = reserved, not enforced — ADR-0015). Trust-tier mapping of FE/BE/AI = T4 non-guarantees. **Demo-numbers integrity note:** a USDG→TSLA swap conserves portfolio value, so the pitch's exact "32%→58%" and "80 USDG safe under 35%" are not simultaneously satisfiable; the UI shows **honestly computed** exposures and the safe-alternative amount is **computed by the engine bound**, never hardcoded (consistent with anti-fake-architecture stance).
- **Tests:** n/a.
- **Acceptance:** Matrix matches ADR-0015; integrity note present and referenced by T30/T36.

#### T05 — Scaffold Foundry project
- **Purpose:** Compilable contracts workspace with deps.
- **Files:** Create `contracts/foundry.toml`, `remappings.txt`; install `forge-std`, `openzeppelin-contracts`.
- **Dependencies:** T01.
- **Implementation notes:** Solidity 0.8.24; `optimizer=true`. No upgradeable OZ packages. Add `solc` pin.
- **Tests:** `forge build` on empty project succeeds.
- **Acceptance:** `forge build` and `forge test` run (0 tests) without error.

### Milestone 1 — Types, Interfaces, Errors, ActionLib

#### T06 — Enums.sol
- **Purpose:** Canonical enums.
- **Files:** Create `contracts/src/types/Enums.sol`.
- **Dependencies:** T05.
- **Implementation notes:** Declare `Role{NONE,SESSION,OWNER}`, `ActionType{SWAP}`, `DecisionStatus{NONE,BLOCKED,APPROVED,EXECUTED,EXPIRED,CANCELLED}`, `ReasonCode{OK,ASSET_NOT_ALLOWED,ADAPTER_NOT_ALLOWED,SINGLE_ASSET_EXPOSURE_EXCEEDED,TRADE_SIZE_EXCEEDED,DAILY_TURNOVER_EXCEEDED,COOLDOWN_ACTIVE,PRICE_STALE,SESSION_EXPIRED,RECIPIENT_NOT_ALLOWED,SLIPPAGE}` (Phase 5 §2). Declarations only.
- **Tests:** compile-only.
- **Acceptance:** `forge build` green; enum order matches Phase 5 (NONE=0).

#### T07 — Types.sol (structs)
- **Purpose:** Canonical data model.
- **Files:** Create `contracts/src/types/Types.sol`.
- **Dependencies:** T06.
- **Implementation notes:** Declare `Action` (with `actionSchemaVersion`, `account`, `nonce`, `actionType`, `assetIn`, `amountIn`, `assetOut`, `minAmountOut`, `adapter`, `recipient`, `deadline`), `PriceData` (asset, priceUSDG1e18, timestamp, validUntil, signature — **no account field**, ADR-0010), `Decision` (status, mandateVersion, submittedAt, expiresAt, priceDigest, priceTimestamp — **no actionHash**, ADR-0006), `SessionKey` (enabled, validUntil, allowedActionTypes, maxAmountInPerAction, scopeHash), `MandateConfig` (mandateVersion, maxSingleAssetExposureBps, maxTradeSizeUSDG, maxDailyTurnoverBps, cooldownSeconds), `EvalInput` (Phase 5 §3). Declarations only.
- **Tests:** compile-only.
- **Acceptance:** `forge build` green; `Decision` has no `actionHash`; `PriceData` has no `account`.

#### T08 — Errors.sol
- **Purpose:** Custom errors (submit-revert set + execute-revert set).
- **Files:** Create `contracts/src/types/Errors.sol`.
- **Dependencies:** T06.
- **Implementation notes:** Declare submit errors (`NotAuthorized`, `WrongAccount`, `BadActionSchema`, `BadNonce`, `DeadlinePassed`, `PriceUnverified`, `SessionExpired`) and execute errors (`ActionHashMismatch`, `NotApproved`, `ApprovalExpired`, `MandateVersionChanged`, `PriceStaleOnExecute`, `AssetNotAllowedNow`, `AdapterNotAllowedNow`, `RecipientNotAllowed`, `ReValidationFailed`, `PostCheckFailed`) plus prices errors (`UnsortedOrDuplicateAsset`, `MissingPrice`) (Phase 5 §8, Phase 6 §3).
- **Tests:** compile-only.
- **Acceptance:** All errors from Phase 5 §8 + prices discipline present.

#### T09 — Interfaces
- **Purpose:** Swappable contracts (ADR-0010/0018, req #7).
- **Files:** Create `contracts/src/interfaces/{IPriceOracle,IAdapter,IAssetRegistry,IAdapterRegistry,IMandateRegistry,IEquityPermissionEngine}.sol`.
- **Dependencies:** T07.
- **Implementation notes:** Signatures from Phase 5 §5: `IPriceOracle.getPrice(asset,PriceData,account)→(price,ts)` + `maxStaleness()` + `signer()`; `IAdapter.swap(...)→amountOut` + `quote(...)`; registry membership getters; `IEquityPermissionEngine.evaluate(EvalInput)→(ReasonCode,uint16,uint16)`.
- **Tests:** compile-only.
- **Acceptance:** `forge build` green; signatures match Phase 5.

#### T10 — ActionLib (EIP-712 `_hashAction`) [INV-5, ADR-0006/0007]
- **Purpose:** The single canonical hashing used everywhere; guarantees approval/execute binding.
- **Files:** Create `contracts/src/lib/ActionLib.sol`; Test `contracts/test/unit/ActionLib.t.sol`.
- **Dependencies:** T07.
- **Implementation notes:** `ACTION_TYPEHASH` covering **every** Action field; domain `version` carries `actionSchemaVersion`, `verifyingContract` = account. Expose `hashAction(action, domainSeparator)→bytes32`. One function only; reused by submit/execute/preview/computeActionId.
- **Tests (TDD):**
  - [ ] `test_actionId_changes_on_every_field_mutation` — mutate each field individually; id must change (covers INV-5; prevents amountIn-omission theft).
  - [ ] `test_actionId_stable_for_same_input`.
  - [ ] `test_actionId_differs_across_account` and `across_chainId`.
- **Acceptance:** Mutation test passes for all fields; id deterministic; red-before-green commit history.

### Milestone 2 — EquityPermissionEngine

#### T11 — `evaluate()` decision math [ADR-0011 inputs; reason priority]
- **Purpose:** Pure mandate decision (exposure/size/turnover/cooldown/asset/adapter/price).
- **Files:** Create `contracts/src/lib/EquityPermissionEngine.sol`; Test `contracts/test/unit/EquityPermissionEngine.t.sol`.
- **Dependencies:** T07, T09.
- **Implementation notes:** `pure` `evaluate(EvalInput)`. Compute pre/post single-asset exposure in bps using USDG-denominated values (USDG=1e18). **Documented check priority** (so the demo's 500-USDG action returns `SINGLE_ASSET_EXPOSURE_EXCEEDED`): asset-allowed → adapter-allowed → price-present → **exposure** → trade-size → turnover → cooldown; return first failing `ReasonCode`, else `OK`. Value only assets in `EvalInput.assets` (caller passes the enumerable set, ADR-0012). No state, no `block.timestamp` reads (passed in).
- **Tests (TDD):**
  - [ ] exposure over cap → `SINGLE_ASSET_EXPOSURE_EXCEEDED` with correct pre/post bps.
  - [ ] trade-size over cap (when exposure ok) → `TRADE_SIZE_EXCEEDED`.
  - [ ] turnover over cap → `DAILY_TURNOVER_EXCEEDED`; cooldown active → `COOLDOWN_ACTIVE`.
  - [ ] asset/adapter not allowed → respective code.
  - [ ] in-bounds action → `OK`.
  - [ ] priority test: action violating BOTH exposure and size → returns `SINGLE_ASSET_EXPOSURE_EXCEEDED`.
- **Acceptance:** All cases pass; engine is `pure`; bps math matches hand-computed fixtures.

### Milestone 3 — SignedDemoPriceFeed

#### T12 — SignedDemoPriceFeed [ADR-0010]
- **Purpose:** Demo-grade signed price source, swappable via `IPriceOracle`.
- **Files:** Create `contracts/src/oracle/SignedDemoPriceFeed.sol`; Test `contracts/test/unit/SignedDemoPriceFeed.t.sol`.
- **Dependencies:** T07, T09.
- **Implementation notes:** EIP-712 domain `name="MandatePriceFeed", chainId, verifyingContract=oracle` (binds oracle+chainId, ADR-0010). `getPrice(asset, PriceData, account)`: `ECDSA` recover == `signer`; `require(now<=validUntil)` AND `require(now<=timestamp+maxStaleness)`; return `(priceUSDG1e18, timestamp)`. `signer` is an immutable independent key (≠ deployer/session). No `roundId` in MVP (documented production hardening).
- **Tests (TDD):**
  - [ ] valid signature + fresh → returns price.
  - [ ] wrong signer → `PriceUnverified`.
  - [ ] `now>validUntil` → revert; `now>timestamp+maxStaleness` → revert.
  - [ ] signature from a different oracle domain → rejected (cross-oracle replay closed).
- **Acceptance:** Signature/staleness/validUntil/cross-oracle cases pass; `signer()` independent of test deployer.

### Milestone 4 — Mocks & Adapter

#### T13 — MockERC20
- **Purpose:** Local test stand-ins for TSLA/AMD/USDG (18 decimals).
- **Files:** Create `contracts/src/mocks/MockERC20.sol`.
- **Dependencies:** T05.
- **Implementation notes:** Minimal mintable ERC20 (OZ ERC20). Used in tests and as MockAMM liquidity locally. On testnet, faucet tokens are used instead.
- **Tests:** mint/transfer sanity in a shared test helper.
- **Acceptance:** compiles; mint works in tests.

#### T14 — MockAMM (fixed-rate venue)
- **Purpose:** Deterministic swap venue (avoids AMM slippage surprises in demo).
- **Files:** Create `contracts/src/mocks/MockAMM.sol`; Test `contracts/test/unit/MockAMM.t.sol`.
- **Dependencies:** T13.
- **Implementation notes:** Admin-set fixed rate per (assetIn,assetOut) in USDG terms; `swap(assetIn,amountIn,assetOut,minOut,to)` pulls `amountIn`, sends `amountOut` at fixed rate to `to`, reverts if `out<minOut` or under-funded. **Not** a production AMM; purely a demo counterparty. Seed rate = demo feed price so executes succeed.
- **Tests (TDD):**
  - [ ] swap at fixed rate returns expected out; under-min reverts; under-funded reverts.
- **Acceptance:** deterministic swap; reverts on min/funding failure.

#### T15 — ApprovedSwapAdapter [ADR-0018, INV-11]
- **Purpose:** The only adapter; wraps MockAMM behind `IAdapter`.
- **Files:** Create `contracts/src/adapters/ApprovedSwapAdapter.sol`; Test `contracts/test/unit/ApprovedSwapAdapter.t.sol`.
- **Dependencies:** T09, T14.
- **Implementation notes:** `swap(...)` forwards to MockAMM and returns actual out; `quote(...)` reads MockAMM rate. Adapter holds no funds between calls. (Bounded approval + reset is done by the **account**, T25; adapter just executes.)
- **Tests (TDD):**
  - [ ] adapter swap delivers to `recipient`, returns amountOut; quote matches.
- **Acceptance:** conforms to `IAdapter`; no residual balances.

### Milestone 5 — MandateAccount governance

#### T16 — MandateAccount skeleton (auth, roles, enumerable assets) [ADR-0004/0012]
- **Purpose:** Account shell: custody, owner, role resolution, storage, enumerable asset list.
- **Files:** Create `contracts/src/MandateAccount.sol`; Test `contracts/test/unit/MandateAccount.governance.t.sol`.
- **Dependencies:** T07, T08, T09.
- **Implementation notes:** Storage: `owner`, `sessionKeys` mapping, `mandate` (MandateConfig), `isAssetAllowed`/`isAdapterAllowed` mappings **plus `allowedAssetsList` array** kept in sync (ADR-0012), `priceOracle`, `nextNonce`, `decisions` mapping, `dailyTurnoverUsedUSDG`, `turnoverDay`, `lastTradeTimestamp`. `roleOf(addr)→Role`; internal `_resolveActor()→ActorContext` reading `msg.sender` (ADR-0004 seam). Views from Phase 5 §6.1. `nonReentrant` guard available.
- **Tests (TDD):**
  - [ ] `roleOf` returns OWNER/SESSION/NONE correctly; `nextNonce` starts 0.
- **Acceptance:** roles resolve; storage compiles; gate logic (later tasks) will read role not msg.sender.

#### T17 — setMandate / getMandate [ADR-0007]
- **Purpose:** Owner sets risk config; bumps `mandateVersion`.
- **Files:** Modify `MandateAccount.sol`; extend governance test.
- **Dependencies:** T16.
- **Implementation notes:** `setMandate(MandateConfig)` owner-only; increments `mandateVersion`; emits `MandateUpdated`. `getMandate()`/`mandateVersion()` views.
- **Tests (TDD):**
  - [ ] non-owner → `NotAuthorized`; owner sets → version++ + event; getMandate reflects.
- **Acceptance:** version monotonic; event emitted; INV-7 precondition available.

#### T18 — setAssetAllowed / setAdapterAllowed (+ enumerable list) [ADR-0012]
- **Purpose:** Owner-curated allowlists; maintain enumerable asset list.
- **Files:** Modify `MandateAccount.sol`; extend governance test.
- **Dependencies:** T16.
- **Implementation notes:** `setAssetAllowed(asset,bool)` updates mapping AND `allowedAssetsList` (append on enable, swap-pop on disable); emits `AssetAllowedSet`. `setAdapterAllowed` updates mapping + `AdapterAllowedSet`. Owner-only.
- **Tests (TDD):**
  - [ ] enable adds to list once (no dup); disable removes; mapping and list stay consistent; non-owner reverts.
- **Acceptance:** list enumerable and consistent with mapping (supports T24 coverage check).

#### T19 — registerPriceOracle
- **Purpose:** Owner sets the `IPriceOracle`.
- **Files:** Modify `MandateAccount.sol`; extend test.
- **Dependencies:** T16.
- **Implementation notes:** `registerPriceOracle(IPriceOracle)` owner-only; emits `PriceOracleRegistered(oracle, signer)`.
- **Tests (TDD):** non-owner reverts; set reflects in view; event includes signer.
- **Acceptance:** oracle swappable (ADR-0010 seam) via owner only.

#### T20 — addSessionKey / revokeSessionKey [ADR-0015, INV-12]
- **Purpose:** Manage session keys; enforce honest scope.
- **Files:** Modify `MandateAccount.sol`; Test `contracts/test/unit/MandateAccount.sessionkey.t.sol`.
- **Dependencies:** T16.
- **Implementation notes:** `addSessionKey(key, SessionKey)` owner-only; **revert unless reserved fields are default** (`allowedActionTypes==0`, `maxAmountInPerAction==0`, `scopeHash==0`) so chain data never implies an unenforced policy. Store `enabled`,`validUntil`. `revokeSessionKey` sets enabled=false. Emit `SessionKeyAdded(key,validUntil)`/`SessionKeyRevoked`.
- **Tests (TDD):**
  - [ ] non-default reserved field → revert (INV-12).
  - [ ] valid add → SESSION role; revoke → NONE; expired validUntil treated as inactive.
- **Acceptance:** reserved-field rejection enforced; enforcement-matrix (T04) matches behavior.

#### T21 — deposit / withdraw (owner exit; NO migrateTo) [ADR-0016, INV-1]
- **Purpose:** Fund the account; single owner exit.
- **Files:** Modify `MandateAccount.sol`; extend governance test.
- **Dependencies:** T16.
- **Implementation notes:** Receiving tokens = plain ERC20 transfer in (no special deposit fn needed; document that balances are `balanceOf`, ADR-0013). `withdraw(asset,amount,to)` owner-only, `SafeERC20`, `nonReentrant`, emits `Withdrawn`. **Do NOT add `migrateTo`** (ADR-0016).
- **Tests (TDD):**
  - [ ] owner withdraw works + event; non-owner reverts; no other code path transfers out (INV-1 supported here, asserted in T27).
- **Acceptance:** withdraw is the only governance exit; `migrateTo` absent.

### Milestone 6 — submitAction (decision path)

#### T22 — previewAction (staticcall) 
- **Purpose:** Off-chain UI preview (32%→post%) via the same engine logic.
- **Files:** Modify `MandateAccount.sol`; Test `contracts/test/unit/MandateAccount.submit.t.sol`.
- **Dependencies:** T10, T11, T12, T16, T18, T19.
- **Implementation notes:** `previewAction(action, PriceData[]) view returns (ReasonCode, uint16 pre, uint16 post)`. Build `EvalInput` from `allowedAssetsList`∩nonzero balance (+USDG=1e18), verified prices (view-verify), current turnover/cooldown, `block.timestamp`. Call engine. No state change.
- **Tests (TDD):**
  - [ ] preview of dangerous action returns exposure reason + pre/post; safe action returns OK.
- **Acceptance:** matches engine result; pure read (staticcall-safe).

#### T23 — submitAction (decision record, no revert on policy) [ADR-0003/0008, INV-6]
- **Purpose:** Record BLOCKED/APPROVED persistently; consume nonce.
- **Files:** Modify `MandateAccount.sol`; extend submit test.
- **Dependencies:** T22.
- **Implementation notes:** Caller role ∈{OWNER,SESSION} else `NotAuthorized`. **Revert (garbage input):** wrong account/schema/nonce/deadline/unverifiable price/session expired. Else compute `id=ActionLib.hashAction`, run engine; `OK`→APPROVED (set `expiresAt=now+APPROVAL_TTL`, `mandateVersion`, `priceDigest=keccak(abi.encode(prices))`, `priceTimestamp`), else BLOCKED. **`nextNonce++` on both BLOCKED and APPROVED** (not on revert). Emit `ActionSubmitted` + (`ActionBlocked`|`ActionApproved`) with pre/post bps + priceDigest/timestamp (ADR-0010/Phase5 §7). Store control fields only (no actionHash).
- **Tests (TDD):**
  - [ ] dangerous → BLOCKED event, `SINGLE_ASSET_EXPOSURE_EXCEEDED`, **tx succeeds**, nonce++.
  - [ ] safe → APPROVED event, nonce++.
  - [ ] bad nonce/schema/account/deadline/sig → revert, nonce unchanged (INV-6).
  - [ ] NONE caller → `NotAuthorized`.
- **Acceptance:** BLOCKED is a successful, queryable event; nonce semantics per ADR-0008.

#### T24 — prices[] discipline [ADR-0011, INV-8]
- **Purpose:** Reject manipulable/incomplete price sets.
- **Files:** Modify `MandateAccount.sol` (shared `_loadPrices` helper used by preview/submit/execute); extend submit test.
- **Dependencies:** T23.
- **Implementation notes:** Require `prices` strictly ascending by `asset` (free dedup), reject duplicates (`UnsortedOrDuplicateAsset`); USDG hardcoded 1e18 (excluded from array); require coverage of `assetIn`,`assetOut` and every nonzero-balance allowed asset, else `MissingPrice`; verify each via `IPriceOracle`.
- **Tests (TDD):**
  - [ ] unsorted/dup → revert; missing portfolio asset price → revert; complete+sorted → ok.
- **Acceptance:** all INV-8 cases enforced in preview/submit/execute via shared helper.

### Milestone 7 — executeAction (enforcement path)

#### T25 — executeAction (10-condition re-validation) [ADR-0009/0014/0018; INV-3/4/7/9/11]
- **Purpose:** The hard enforcement point; only path that moves assets via adapter.
- **Files:** Modify `MandateAccount.sol`; Test `contracts/test/unit/MandateAccount.execute.t.sol`.
- **Dependencies:** T15, T23, T24.
- **Implementation notes:** `executeAction(action, PriceData[])` `nonReentrant`. Recompute `id=hashAction(action)`; the **mapping key IS the recomputed id** (ADR-0006). Enforce, reverting on any failure (Phase 5 §6.2 table): caller authorized; status==APPROVED (covers not-executed); `now<=expiresAt`; `decision.mandateVersion==mandateVersion()`; prices fresh (T24 helper); assetIn/assetOut allowed now; adapter allowed now; `recipient==address(this)`; engine re-eval on **current** state ==OK (turnover/exposure/size); then **CEI**: set status=EXECUTED **before** external call, update `dailyTurnoverUsedUSDG` (UTC-day bucket reset if `block.timestamp/86400 > turnoverDay`, ADR-0014) + `lastTradeTimestamp`; **approve exact → adapter.swap → approve 0** (INV-11); post-check `amountOut>=minAmountOut` else `PostCheckFailed`. Emit `ActionExecuted(id, amountIn, amountOut, postBps, priceDigest, priceTimestamp)`.
- **Tests (TDD):**
  - [ ] APPROVED safe action executes; balances move; output to account (INV-9); approval reset to 0 (INV-11).
  - [ ] re-execute → revert `NotApproved` (INV-3).
  - [ ] execute with a **different** action than approved → `NotApproved` (different id) (INV-5).
  - [ ] after owner `setMandate` (version bump) → `MandateVersionChanged` (INV-7).
  - [ ] expired approval → `ApprovalExpired`; stale price → `PriceStaleOnExecute`.
  - [ ] turnover/exposure drift makes re-eval fail → `ReValidationFailed`.
- **Acceptance:** all 10 conditions enforced; no double-execute; bounded approval verified.

#### T26 — cancelApproved (owner)
- **Purpose:** Owner can invalidate a pending APPROVED decision.
- **Files:** Modify `MandateAccount.sol`; extend execute test.
- **Dependencies:** T25.
- **Implementation notes:** `cancelApproved(actionId)` owner-only; APPROVED→CANCELLED; emit `ApprovalCancelled`. Cancelled cannot execute.
- **Tests (TDD):** cancel then execute → `NotApproved`; non-owner cancel reverts.
- **Acceptance:** owner override works; terminal state respected.

### Milestone 8 — Invariants & Integration

#### T27 — Invariant tests (INV-1..12)
- **Purpose:** Prove the security invariants under fuzzing.
- **Files:** Create `contracts/test/invariant/Invariants.t.sol`.
- **Dependencies:** T17–T26.
- **Implementation notes:** Foundry invariant/handler harness with bounded actors (owner, session, attacker). Assert: total custody only changes via execute/withdraw (INV-1); session can never reach governance/withdraw/non-approved-execute (INV-2); no double-execute (INV-3); nonce monotonic (INV-6); approval-binding (INV-5); default-deny on missing price/config (INV-10); approval never nonzero post-execute (INV-11); addSessionKey reserved-field rejection (INV-12).
- **Tests:** the invariants themselves.
- **Acceptance:** `forge test` invariant runs pass with the configured runs/depth; each INV has a named assertion.

#### T28 — DemoLoop integration test (9-step closed loop) [req #9]
- **Purpose:** Prove the full demo on-chain before any UI.
- **Files:** Create `contracts/test/integration/DemoLoop.t.sol`.
- **Dependencies:** T21, T25.
- **Implementation notes:** Script the 9 steps with MockERC20/MockAMM: deploy+wire; fund account (seed amounts so pre-TSLA≈32%); setMandate {exposure 3500 bps, size 200e18, turnover 2000 bps, cooldown}; addSessionKey; preview dangerous (500 USDG) shows post>35%; submit dangerous → `ActionBlocked(SINGLE_ASSET_EXPOSURE_EXCEEDED)`; submit safe (engine-bound amount ≤ size and ≤ exposure) → `ActionApproved`; execute safe → `ActionExecuted`; assert both events present in logs.
- **Tests:** the loop assertions (events, statuses, balances).
- **Acceptance:** loop passes; dangerous BLOCKED with exposure reason; safe APPROVED+EXECUTED; both events emitted (audit reconstructable).

### Milestone 9 — Deploy & Signer

#### T29 — Deploy.s.sol
- **Purpose:** Deploy + wire all contracts.
- **Files:** Create `contracts/script/Deploy.s.sol`.
- **Dependencies:** all contracts.
- **Implementation notes:** Deploy Engine(lib), SignedDemoPriceFeed(signer addr from env), MockAMM, ApprovedSwapAdapter, MandateAccount(owner). Output addresses to a json broadcast artifact. No EntryPoint/proxy.
- **Tests:** `forge script` dry-run on anvil wires without revert.
- **Acceptance:** all addresses produced; account references oracle/adapter.

#### T30 — SeedDemo.s.sol [T04 integrity note]
- **Purpose:** Configure the demo state deterministically.
- **Files:** Create `contracts/script/SeedDemo.s.sol`.
- **Dependencies:** T29.
- **Implementation notes:** Fund account with USDG/TSLA/AMD (testnet faucet tokens or MockERC20 locally) at amounts giving pre-TSLA≈32%; seed MockAMM liquidity + rate = demo feed price; setMandate; allow assets/adapter; addSessionKey; register oracle. Compute the **safe-alternative amount from the exposure bound** (do not hardcode 80); document actual numbers in run output.
- **Tests:** post-seed asserts: pre-exposure≈32%; 500 USDG would block; computed safe amount approves.
- **Acceptance:** seeded state reproduces DemoLoop outcomes on a live chain.

#### T31 — Price signer (TS + viem)
- **Purpose:** Off-chain independent signer producing EIP-712 `PriceData`.
- **Files:** Create `signer/src/sign-price.ts`, `signer/src/server.ts`, `signer/package.json`.
- **Dependencies:** T12.
- **Implementation notes:** Sign `PriceData` with `MandatePriceFeed` domain (chainId 46630, verifyingContract=oracle) using a **dedicated key** (env `PRICE_SIGNER_KEY`, ≠ deployer/session). `server.ts` exposes `/price?assets=...` returning sorted, fresh signed attestations covering required assets. Document demo-grade.
- **Tests:** unit: signed payload verifies against on-chain `SignedDemoPriceFeed` in a fork/anvil test; staleness honored.
- **Acceptance:** signatures verify on-chain; signer key independent.

#### T32 — Deploy to Robinhood Chain testnet
- **Purpose:** Live addresses for the UI.
- **Files:** Update a `web/src/lib/contracts.ts` address map + `deployments/46630.json`.
- **Dependencies:** T29, T30.
- **Implementation notes:** Run Deploy+Seed against RH testnet (RPC/explorer from official docs); fund deployer/session with faucet ETH; record addresses + tx hashes. If a swap venue is unavailable on testnet, MockAMM IS the venue (seeded).
- **Tests:** read-back: on-chain mandate matches seed; explorer shows seed txs.
- **Acceptance:** account live + funded + configured on 46630; addresses recorded.

### Milestone 10 — Frontend

#### T33 — web scaffold + wagmi/viem
- **Purpose:** Next.js app connected to chain 46630.
- **Files:** Create `web/` (Next App Router), `web/src/lib/contracts.ts` (ABIs+addresses), wagmi config.
- **Dependencies:** T32.
- **Implementation notes:** Custom chain 46630 (RPC/explorer). Wallet connect. Import ABIs from forge `out/`.
- **Tests:** app boots; reads `mandateVersion()` from chain.
- **Acceptance:** UI connects and reads account state.

#### T34 — eip712 + prices client libs
- **Purpose:** Build Action typed-data + fetch signed prices.
- **Files:** Create `web/src/lib/eip712.ts`, `web/src/lib/prices.ts`.
- **Dependencies:** T33, T31.
- **Implementation notes:** Action domain (chainId 46630, verifyingContract=account) + types matching `ACTION_TYPEHASH`; `nonce` from `nextNonce()`. prices.ts calls signer `/price`, returns sorted attestations.
- **Tests:** typed-data hash matches on-chain `computeActionId` for a fixture (parity test via viem read).
- **Acceptance:** client actionId == on-chain id; prices fetched sorted/fresh.

#### T35 — PolicyPanel
- **Purpose:** Show mandate, allowed assets, session key, **enforcement matrix**.
- **Files:** Create `web/src/components/PolicyPanel.tsx`.
- **Dependencies:** T33.
- **Implementation notes:** Render mandate config + allowedAssetsList + session key with **clear "chain-enforced vs reserved" badges** (ADR-0015/T04). Label price feed "Signed Demo Feed" (ADR-0010).
- **Tests:** component renders chain data; reserved fields visibly marked non-enforced.
- **Acceptance:** no field implies a guarantee it lacks; matches enforcement-matrix.md.

#### T36 — ActionReview (preview + submit) [req #9]
- **Purpose:** Preview 32%→post%, submit, show decision.
- **Files:** Create `web/src/components/ActionReview.tsx`.
- **Dependencies:** T34, T35.
- **Implementation notes:** Build a candidate Action; call `previewAction` (staticcall) → show **honestly computed** pre/post exposure + predicted reason; "Submit" sends `submitAction` (session key); render BLOCKED (reason code) or APPROVED. For BLOCKED, surface AI "safe alternative" = engine-bound amount (computed, not hardcoded — T04 integrity note). For APPROVED, enable "Execute".
- **Tests:** dangerous shows BLOCKED + reason; safe shows APPROVED; numbers equal on-chain preview.
- **Acceptance:** UI mirrors chain decisions exactly; no fabricated numbers.

#### T37 — AuditTrail [req #9]
- **Purpose:** Show BLOCKED + EXECUTED from events.
- **Files:** Create `web/src/components/AuditTrail.tsx`.
- **Dependencies:** T33.
- **Implementation notes:** Read `ActionBlocked`/`ActionApproved`/`ActionExecuted` logs; render timeline with reason codes, pre/post bps, priceDigest/timestamp, and explorer links. Reconstruct purely from events (ADR-0003).
- **Tests:** after the loop, both the blocked and executed entries appear with correct reason/amounts.
- **Acceptance:** trail shows the unsafe BLOCKED action and the safe EXECUTED action side by side.

### Milestone 11 — Demo

#### T38 — Testnet rehearsal + checklist verification
- **Purpose:** Run the full loop on 46630 via the UI.
- **Files:** none (operational); record results in `docs/`.
- **Dependencies:** T35–T37.
- **Implementation notes:** Execute §6 checklist on testnet; capture explorer links for BLOCKED and EXECUTED txs.
- **Tests:** the §6 checklist.
- **Acceptance:** every checklist row passes on live testnet.

#### T39 — README + demo script
- **Purpose:** Reproducible run + 3-minute demo narrative.
- **Files:** Update `README.md`; add `docs/demo-script.md`.
- **Dependencies:** T38.
- **Implementation notes:** Setup, deploy, seed, signer, UI run steps; demo narrative tying to the 9 steps; explicit "demo-grade price feed / testnet only / honest numbers" disclaimers.
- **Tests:** a fresh clone can follow README to a working loop (smoke).
- **Acceptance:** README reproducible; demo script matches live behavior.

---

## 5. Test Plan

- **Layers:** (a) **Unit** (Foundry) per contract — ActionLib mutation, Engine cases, PriceFeed sig/staleness, MockAMM, Adapter, MandateAccount governance/submit/execute/sessionkey; (b) **Invariant** (T27) — INV-1..12 under fuzzing; (c) **Integration** (T28) — the 9-step DemoLoop; (d) **Cross-layer parity** (T34) — client `computeActionId` == on-chain; (e) **Signer↔oracle** (T31) — off-chain signature verifies on-chain.
- **TDD discipline:** every code task is red→green→commit; tests written before implementation; no task marked done with failing/partial tests (verification-before-completion).
- **Mandatory security tests (must exist & pass):** per-field actionId mutation (INV-5); borrow-approval (execute B with A's approval) → revert; double-execute → revert (INV-3); mandate-version-change invalidates approval (INV-7); stale/over-validUntil price → revert; prices unsorted/dup/missing → revert (INV-8); session cannot govern/withdraw/execute-unapproved (INV-2); addSessionKey reserved-field rejection (INV-12); bounded approval reset (INV-11); default-deny on missing config/price (INV-10).
- **Coverage goal:** 100% of `MandateAccount` execute/submit branches and Engine branches; `forge coverage` reported in README.
- **Out-of-scope tests (do not write):** anything touching ERC-4337/paymaster/executeBatch/migrateTo/proxy (forbidden).

## 6. Final Demo Checklist (the closed loop)

- [ ] Connect wallet to Robinhood Chain testnet (chainId 46630).
- [ ] **Create** MandateAccount deployed & owned by user (explorer link).
- [ ] **Fund** account with USDG / TSLA / AMD (balances visible in PolicyPanel).
- [ ] **Configure mandate**: TSLA exposure ≤35%, single trade ≤200 USDG, daily turnover ≤20%, cooldown — shows `MandateUpdated` (mandateVersion).
- [ ] **Add session key** (AI) — reserved scope fields shown as *reserved/not enforced* (honesty).
- [ ] **Preview** dangerous action (Buy TSLA with 500 USDG) → UI shows honest pre→post exposure (post >35%) and predicted reason.
- [ ] **Submit** dangerous action → **succeeds as a tx** emitting `ActionBlocked(SINGLE_ASSET_EXPOSURE_EXCEEDED)` (explorer-verifiable, persistent).
- [ ] **Submit** safe alternative (engine-bound amount, ≤200 USDG, keeps ≤35%) → `ActionApproved`.
- [ ] **Execute** safe action → `ActionExecuted` (TSLA received by account; adapter approval reset to 0).
- [ ] **Audit Trail** displays BOTH the blocked unsafe action and the executed safe action, with reason code, pre/post exposure, price digest/timestamp, and explorer links.
- [ ] Bonus integrity: attempt `executeAction` on the blocked action → reverts (`NotApproved`); attempt re-execute of the safe action → reverts (no double-execute).

## Verification (end-to-end)

1. `cd contracts && forge test` — all unit + invariant + integration green (incl. mandatory security tests).
2. `forge coverage` — execute/submit/engine branches covered.
3. `forge script script/Deploy.s.sol` + `SeedDemo.s.sol` against anvil — DemoLoop reproduces.
4. Start `signer/` — `/price` returns attestations that verify on-chain.
5. Deploy+seed to testnet (46630); run `web/`; perform §6 checklist; capture explorer links for the BLOCKED and EXECUTED txs.
6. Confirm forbidden list (§Out of Scope) absent from the codebase (grep for `validateUserOp`, `EntryPoint`, `executeBatch`, `migrateTo`, `delegatecall`, proxy patterns → none).
```
