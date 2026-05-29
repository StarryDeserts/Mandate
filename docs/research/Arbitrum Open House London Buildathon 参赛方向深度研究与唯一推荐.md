# Arbitrum Open House London Buildathon 参赛方向深度研究与唯一推荐

## Executive Summary

如果你的目标是**最大化获奖概率**，同时做出一个**后续还能申请 milestone grant、拿到生态合作、甚至继续融资**的方向，我的结论非常明确：**不要做“又一个 AI trading copilot”，也不要做“只会看板不执行”的数据产品，更不要做“概念上很酷但 7 天做不出闭环”的 RWA 大叙事。最优解是做一个“可执行、可验证、可商业化”的**Robinhood Chain 原生**风险与政策执行层。**我的唯一推荐是：`Mandate`——一个面向 Robinhood Chain tokenized stocks / ETFs 的合规感知型 onchain policy vault。它让用户、团队和 AI agent 只能在预设的风险、仓位、交易频率、资产白名单和回撤边界内执行动作。**这个方向同时踩中 Arbitrum 当前最强叙事——可编程金融、机构级控制、合规、性能、Stylus 计算能力——也踩中 Robinhood Chain 当前最想证明的东西：**tokenized assets 不只是能上链展示，而是能在开放、可编程、自托管环境里安全地被使用。**citeturn20view0turn20view1turn20view2turn20view3turn5view3turn32view0turn30view0

从黑客松赔率角度看，这个方向比“泛 AI”更聪明。HackQuest 官方页面写得很直接：评审看的是**智能合约质量、产品市场契合、创新性、真实问题解决**；而且**总奖前三至少保留 1 个给 Robinhood Chain 项目，至少保留 1 个给 Arbitrum 项目**。换句话说，**最优策略不是只做 Robinhood narrative，也不是只做 Arbitrum infra，而是做一个“Robinhood Chain native + Arbitrum 特性明显”的项目**。如果你在 Robinhood Chain 上部署，并且把 **Stylus 的 Rust 风险引擎**、**ERC-4337/Smart Wallet**、**gas sponsorship**、**可选 agentic 自动执行**组合起来，就会天然同时满足 sponsor narrative、评审标准和 demo 表现力。citeturn12view1turn32view0turn23view1turn42view0

为什么不是“通用 AI 投顾”或者“再做一个 index token”？因为这两个方向都已经显著拥挤。NYC Buildathon 获奖项目里，**Tilt Protocol**做的是 AI-native hedge fund rails，**EqualFi**做的是 Robinhood testnet 上的 stock basket / index primitive，Founder House 特别奖里还有 **Bond.Credit** 这种 agentic credit infrastructure；London 当前可见提交里又已经出现了 agent accountability、treasury firewall、confidential RWA deal room、自然语言支付 agent 等项目。继续沿这些既有轮廓硬切进去，容易被评委看成“叙事贴合，但不够新”或“只是旧题新包装”。而**风险/政策执行层**恰好处在一个更强的位置：它不是 dashboard，不是纯 agent，不是单一资产包装，而是**任何 tokenized finance 产品都能复用的控制平面**。citeturn27view0turn28view0turn16view0turn16view3turn16view1turn35search0turn35search6turn35search8turn35search10

还有一个很现实但很多人会忽略的点：**后续 grant 路线不能想当然。**Arbitrum Foundation 当前公开 grants 页面显示此前的 **Foundation Grant Program 处于 complete / inactive** 状态；真正更现实的资金与资源入口，是 **Open House 自带的 milestone-based grants**、Founder House、以及后续 Mentorship Program 的投资人介绍与生态分发。也就是说，你现在做的 idea 一定要服务于这条链路：**从 Buildathon 获奖，到 Founder House，到 Mentorship，再到设计伙伴与融资。**从这个角度看，`Mandate` 比“炫技但孤立”的协议更强，因为它很容易长成 API/SDK、钱包插件、RWA risk layer 或 agent compliance middleware。citeturn12view1turn5view4turn18search0

## Evidence Map

| 分类 | 关键判断 | 研究结论 |
|---|---|---|
| 已验证事实 | London Online Buildathon 奖池为 **$115,000**，包含 **$70,000 overall prize**、**$15,000 Best Agentic Project**、**$30,000 grants**；项目必须部署在 Arbitrum chain 上；评审标准是智能合约质量、PMF、创新性、真实问题解决；至少一个前三名席位保留给 Robinhood Chain 项目。提交截止为 **2026 年 6 月 14 日**。 | 这不是单纯拼 demo 的活动，而是明显要求**可落地产品方向**的 buildathon。citeturn12view1 |
| 已验证事实 | Robinhood Chain 官方将自己定义为**permissionless、EVM-compatible、面向 financial services 与 tokenized RWAs 的 L2**；Testnet 已公开，Chain ID 为 **46630**；官方开发端点支持 **ERC-4337 Bundler API、Smart Wallets、Gas Manager**；官网强调 **100ms block times**；官方 faucet 当前可领 **ETH、TSLA、AMZN、PLTR、NFLX、AMD**，另有 Paxos 的 **USDG faucet**。 | Robinhood Chain 已经提供了做**consumer finance + smart wallet + tokenized stocks + automation**所需的最小原语。citeturn6view0turn32view0turn30view0turn30view1turn8search2turn11search0 |
| 已验证事实 | Robinhood Chain 官方文档写明，该 testnet 是 **Arbitrum Orbit Layer-2**，使用 **Ethereum blobs** 做数据可用性，ETH 为 gas token；Robinhood 与 Arbitrum 官方都强调这是一个**先在 Arbitrum One 验证需求，再迁移到专用链**的 phased roadmap。 | Robinhood Chain 当前最想证明的不是“链能跑”，而是**tokenized finance 的 demand、workflows、developer ecosystem 能成立**。citeturn32view0turn5view3turn10view0 |
| 已验证事实 | Arbitrum 在 2026 年反复对外输出的官方叙事是 **programmable economy**，核心关键词包括 **compliance、customization、confidentiality、performance、institutional adoption**；Foundation 同时持续强调对**早期 category-leading teams**提供 mentorship、分发和投资人连接。 | Arbitrum 当前不是在追逐“任何流量题材”，而是在押注**机构级可编程金融基础设施**与能跑出 PMF 的应用层。citeturn20view0turn20view1turn20view2turn20view3turn5view4turn5view1turn5view2 |
| 强信号 | NYC Buildathon 的官方复盘写明，获胜项目是基于**technical execution、product clarity、ecosystem alignment、long-term potential**评出来的；Founder House 获奖项目和特别奖则明显偏向**payment trust、tokenized asset infrastructure、AI-driven management layer**。 | 评委不仅要“技术能做”，还要**看得见用户、商业化和后续发展路径**。citeturn27view0turn28view0 |
| 强信号 | Arbitrum 官方把 **AI + Stylus、ERC-8004 agent identity、x402 machine payments、Open Wallet Standard、EIP-7702** 放进连续的 Builder newsletter 与技术文章里；Hackathon 资源页还专门给了 **ZeroDev**。 | “Agentic” 有奖，但更准确地说，Arbitrum想看到的是**可控、可支付、可验证、可落地的 agent workflows**，而不是“加一个聊天框就算 AI”。citeturn12view1turn42view0turn20view4turn19search0 |
| 合理推断 | 结合 Robinhood Chain 的 AA/gas sponsorship 能力、Arbitrum 对合规/性能/可配置环境的强调，以及 Robinhood “crypto stays in the background”的表述，最优项目类型应该是**把复杂金融流程抽象掉，但把风控与规则上链做硬约束**。 | 最佳参赛方向是**政策执行层 / 风险控制层 / 安全自动化层**，不是纯行情工具。citeturn5view3turn20view0turn20view1turn32view0 |
| 未验证假设 | Robinhood 主网在公开索引材料里仍未给出足够细的开放路线与外部协议接口标准；公开资料未显示正式主网版 oracle/compliance provider 标准接口。 | 商业化上要假设**早期先服务测试网和生态原型团队**，主网标准化集成要等待更多官方接口与合作开放。citeturn31view0turn29search7 |
| 需要 MVP 验证的风险点 | 用户是否真的愿意为“政策约束型自动化”付费；在没有官方生产级价格与合规接口时，MVP 的风控可信度如何传达；风险规则是否足够简单到 3 分钟 demo 内讲清楚。 | 最小可行打法必须把**规则约束、执行闭环、可解释日志**做成一个直观故事，而不是试图做完备投顾系统。 | 

## 链方与主办方真正想看到什么

Arbitrum 官方最近几个月的外部表达高度一致：它把自己定位为**finance-native、机构可用、适合可编程市场结构的基础设施平台**。官方连续发布的“Welcome to the Programmable Economy”“Compliance for the Programmable Economy”“Customization for the Programmable Economy”“Confidentiality for the Programmable Economy”“Performance for the Programmable Economy”几篇文章，几乎把他们希望 builder 围绕什么构建说透了：**不是泛娱乐 demo，而是能把市场规则、准入条件、隐私边界、性能要求和运营控制写进软件的产品**。与此同时，Foundation 公开写明 2025 年的关键主题是 institutional adoption，支持对象是能成长为 category-leading applications 的团队。citeturn20view0turn20view1turn20view2turn20view3turn5view1turn5view4

Robinhood Chain 的官方叙事也非常清晰。它不是一个“为了发链而发链”的 rollup，而是 Robinhood 在**tokenized assets / onchain financial services**上的专用基础设施尝试。Arbitrum 官方与 ArbitrumDAO factsheet 都把它描述成**先在 Arbitrum One 上通过 Stock Tokens 验证需求，再走向 dedicated chain** 的 phased model；Robinhood 官网和文档则强调 permissionless、developer-friendly、native issuance、24/7 可编程、自托管与现代开发工具。更重要的是，Arbitrum 官方直接引用 Robinhood 的共同愿景：**用户不应该理解区块链底层，crypto 应该退到后台，体验得像普通 app。**这意味着 Robinhood Chain 当前最想证明的，并不是“会写 Solidity 的人能部署个 Hello World”，而是：**开放金融体验能不能比传统券商工作流更流畅，但又不失控制。**citeturn5view3turn6view0turn30view0turn32view0

Hackathon 自身的奖项与措辞也给了很强的隐含偏好。官方不仅单列了 **Best Agentic Project**，还把总奖前三里**至少一个名额保留给 Robinhood Chain 项目**。更关键的是，Buildathon 页面没有把“最酷技术栈”当作评审维度，而是重复强调**Smart contract quality、Product-Market Fit、Innovation and Creativity、Real Problem Solving**。NYC Buildathon 官方复盘进一步补了一刀：他们真正用来评估优胜项目的是**technical execution、product clarity、ecosystem alignment、long-term potential**。这意味着最符合 sponsor narrative 的，并不是“概念很先进”的协议，而是**能解释清楚谁会用、为什么会用、为什么必须建在这里、以及后续怎么继续长大**的产品。citeturn12view1turn27view0

从 NYC 的结果看，表面热门但可能只是“表面契合”的项目类型主要有四类。第一类是**通用 AI copilot**：NYC 已经出现 Tilt Protocol 和 Robinhood Chain AI Trading Copilot，说明这条 narrative 已被占坑。第二类是**单纯 stock token 包装 / index**：EqualFi 已经把篮子、分割和抵押贷款讲得很满。第三类是**只讲隐私/保密但缺少明确工作流的 RWA 项目**：London 已经能看到 Obscura Finance、Prova 这类方向。第四类是**纯工具类 dashboard / analytics**：它们满足不了官方反复强调的“real problem solving + PMF + long-term potential”。反过来，**“安全执行 + 政策约束 + 用户体验抽象”**这个交叉区，既贴 sponsor 叙事，又尚未严重同质化。citeturn16view0turn15search16turn16view3turn35search10turn35search2turn27view0

## 生态真实需求

站在开发者视角，Robinhood Chain 当前最缺的不是“还能不能部署合约”，而是**围绕 tokenized assets 的高质量应用原语**。官方文档已经给了网络配置、合约地址、桥、Explorer、Foundry 部署教程、Alchemy endpoint、AA bundler、Gas Manager、Smart Wallets，说明链底层的 builder on-ramp 已经到位；但文档层并没有提供“如何做 tokenized-stock portfolio policies、risk controls、consumer order constraints、safe automation”等更上层的标准模块。这种空白，恰恰是黑客松最好的切入点，因为你做的不再是“基建补课”，而是**Robinhood Chain 原生金融产品的缺失组件**。citeturn32view0turn30view2turn8search2

站在普通用户和 tokenized asset 用户视角，真正的痛点也不是“我没有第二个图表界面”，而是**我如何在链上安全地持有、配置、自动化和解释这些资产行为**。Robinhood Chain 自身的愿景是 programmatic trading、自托管和 24/7 access；但 Robinhood 现有欧盟 Stock Tokens 产品页面同时告诉我们，当前面向消费者的 Stock Tokens 仍然是**与底层股票/ETP 价格挂钩的 derivative contracts**，而且**暂时不能发送到其他钱包或平台**。这说明自己做链的核心动机之一，就是把今天相对封闭的 tokenized asset exposure，推进到更开放的可编程环境。也就是说，**最真实的需求是“从价格敞口产品”走向“可组合、可托管、可约束、可自动执行的资产工作流”**。citeturn8search0turn33search0turn33search8

站在 DeFi 用户和 RWA 协议视角，Arbitrum 侧的真实机会是**把 tokenized assets 拉进现有 DeFi 流动性与自动化框架，但不能牺牲风控和可解释性**。Arbitrum 官方在 DRIP Season 1 中明确展示了它还在主动推动 lending、yield-bearing stablecoins、DEX liquidity、tokenized yield 生态；这意味着“资产侧是 tokenized stocks / RWAs，资金侧是 Arbitrum DeFi 现金与收益策略”的组合很符合平台方向。但 Robinhood Chain testnet 当前只公开了少量 stock tokens、ETH、USDG、AA 和桥接能力，并没有现成成熟的 risk layer。**真正缺的是 tokenized assets 的安全使用层，而不是再造一个 DEX 前端。**citeturn40view0turn32view0turn8search2

站在 agent 用户和团队运营视角，最严重的痛点也不是“agent 不够聪明”，而是**agent 一旦有钱包、可以自动调用 userOps 或合约，它到底在什么边界内行动、谁审计它、谁解释失败与放行原因**。Arbitrum 一边在推 ERC-8004 agent identity、x402 machine payments、Open Wallet Standard、EIP-7702，一边又在对机构讲 compliance、selective disclosure、onchain trust for offchain workflows，这组合在一起非常像一个明确需求：**agent 需要的不只是身份和支付，更需要能约束金融动作的 policy layer。**因此，从需求强度上看，**“安全自动化”比“更聪明的自动化”更刚需。**citeturn42view1turn42view0turn20view0turn21view0

把这些信号收束到一起，当前 Arbitrum / Robinhood 生态中最值得做、也最容易在黑客松里讲通的空白，不是再发明一个新资产，而是做一个**围绕 tokenized assets 的执行控制面**：它能把**风险限制、资产白名单、额度控制、交易节奏、agent 权限、审计日志**变成链上的硬约束，并让用户看到清晰的“为什么可以执行 / 为什么被阻止”。这既是链方愿意资助的问题，也是用户更可能愿意使用乃至付费的问题。citeturn20view0turn20view1turn5view3turn27view0

## 候选项目评分表

下面的评分不是“技术酷炫度”排名，而是基于**官方评审标准、Robinhood Chain 当前能力、Arbitrum 最近的官方叙事、NYC 获奖模式，以及 London 当前可见竞品拥挤度**综合得出的实战分数。判断依据来自 HackQuest Buildathon 页面、Arbitrum Foundation 对 NYC Buildathon 与 Founder House 的获奖总结、Robinhood Chain 官方文档，以及当前 London 可见提交项目。citeturn12view1turn27view0turn28view0turn32view0turn35search0turn35search8turn35search10

| Idea | 契合 | 痛点 | 夺奖 | MVP | Demo | 差异 | 链需 | 商业 | Grant | 风控 | 总分 | 简因 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| **Mandate**：合规感知型 tokenized portfolio policy vault | 10 | 9 | 9 | 8 | 8 | 8 | 9 | 9 | 9 | 7 | **86** | 最贴合 Arbitrum“可编程金融 + 合规 + 风控”与 Robinhood Chain“tokenized assets + background crypto”双叙事 |
| **RepoLink**：Robinhood securities × Arbitrum stablecoin 的 repo 结算层 | 10 | 8 | 8 | 5 | 7 | 9 | 10 | 9 | 9 | 4 | **79** | sponsor narrative 极强，但跨链原子性与 demo 风险都偏高 |
| **Rulebook Wallet**：Robinhood Chain 规则型 smart wallet | 9 | 8 | 8 | 9 | 8 | 7 | 8 | 8 | 8 | 8 | **81** | 强 UX、好 demo、可商业化，但故事更偏 consumer infra，略弱于风险控制大命题 |
| **Margin Sentinel**：面向 tokenized assets 的风险路由与清算前哨 | 9 | 8 | 8 | 7 | 6 | 8 | 9 | 8 | 8 | 6 | **77** | 适合协议层，但用户故事不如 Mandate 直观 |
| **IndexPilot**：固定权重 stock/ETF basket + DCA + 风险上限 | 8 | 7 | 7 | 8 | 8 | 5 | 7 | 7 | 7 | 7 | **71** | 容易做，但 EqualFi 已经占了 stock basket 心智 |
| **MarketClerk**：交易时间/公司行为/窗口期规则引擎 | 8 | 7 | 6 | 8 | 6 | 7 | 8 | 6 | 7 | 7 | **70** | 有真实需求，但 demo 爆发力不足 |
| **Paycheck-to-Portfolio**：消费金融自动化买入 stock tokens | 7 | 8 | 6 | 6 | 8 | 6 | 6 | 8 | 7 | 5 | **67** | 商业想象不错，但当前 testnet 环境对消费金融闭环支持不够 |
| **DealRoom Lite**：带 selective disclosure 的 tokenized private credit room | 8 | 7 | 6 | 5 | 7 | 8 | 8 | 8 | 7 | 4 | **68** | 叙事对，但 London 当前 privacy/RWA 方向已明显拥挤 |
| **Agent Broker Passport**：finance agent 身份、权限与支付护照 | 8 | 6 | 7 | 7 | 7 | 8 | 7 | 7 | 7 | 6 | **70** | 贴 ERC-8004 与 x402，但离 Robinhood tokenized asset 的主线还差半步 |
| **Generic AI Trading Copilot**：自然语言买卖 stock tokens | 8 | 7 | 6 | 8 | 8 | 4 | 6 | 7 | 6 | 7 | **67** | 直观但已拥挤，且容易被认作“又一个 agent 聊天壳” |

把表格翻译成一句话就是：**最值得押注的，不是最性感的 repo，也不是最好做的钱包，而是“风险与政策执行层”这个既能讲机构叙事、又能讲 consumer safety、还能讲 agent control 的交叉点。**RepoLink 是高天花板备选，Rulebook Wallet 是高完成度备选，但真正最平衡的项目仍然是 `Mandate`。与此同时，**Generic AI Copilot、隐私 Deal Room、stock basket clone** 这些方向不是不能赢，而是你要跟已有优胜项目和当前可见提交正面撞车。citeturn28view0turn16view3turn16view0turn35search10

## Top 3 深挖

**Mandate**。一句话产品：**一个运行在 Robinhood Chain 上的 onchain policy vault，让用户、团队和 AI agent 只能在预设的风险与合规边界内管理 tokenized stock / ETF 组合。**目标用户不是笼统的“DeFi users”，而是三类非常具体的人：第一类是**有自托管倾向、愿意尝试 tokenized equities、但不愿把全部决策交给黑盒 agent 的个人用户**；第二类是**做 tokenized asset 产品的钱包、经纪型应用、RWA 协议团队**；第三类是**想让 AI 自动执行 DCA、再平衡或风险降档，但必须保留政策边界的团队和小型基金**。它解决的问题很直接：今天链上自动化要么太自由，要么只是提醒，不够“硬”；而 Robinhood/Arbitrum 当前叙事恰好都在强调**把规则写进系统**。MVP 可以只做四件事：创建 Mandate、接收一个提议交易、用 Stylus 风险引擎校验、执行或拒绝并生成审计日志。技术架构上，**Robinhood Chain 部署 PolicyVault + Solidity Executor，Rust/Stylus Risk Engine 负责组合暴露与规则计算，前端提供策略模板与解释面板，可选接一个轻量 agent 作为“提议者”而不是“最终决策者”。**商业模式清晰：SDK/API 订阅 + 企业版审计与权限管理 + 每个执行账户的 seat fee。它可能赢，因为它同时满足**PMF、上链必要性、Robinhood narrative、Arbitrum narrative、agentic bonus 机会**；它也可能输，因为如果 demo 里“政策规则”过于抽象、trade flow 不够顺滑，评委会误以为这是 B2B 中间件而非用户产品。citeturn20view0turn20view1turn5view3turn32view0turn23view1turn27view0

**RepoLink**。一句话产品：**把 Robinhood Chain 上的 securities leg 与 Arbitrum 上的 stablecoin cash leg 连接起来，做一个面向 tokenized stocks 的 cross-chain repo / financing primitive。**目标用户是**做 tokenized securities 做市、结构化资金、prime brokerage 模拟、机构型资产配置的高级用户与协议团队**。真实问题是：**Arbitrum 有 DeFi 现金与流动性，Robinhood Chain 有 tokenized financial assets，但两边缺少一个“证券腿和现金腿能一起成交/一起失败”的安全框架。**生态价值非常高，因为它几乎就是 Arbitrum “shared liquidity + dedicated chain” 模型的产品化展示。MVP 范围应极度收缩：仅做固定期限 repo、单一证券篮子、双边撮合、单次开仓/到期回购，不做开放订单簿。技术架构上需要两边 escrow vault、到期逻辑和跨链消息层。商业模式有真实空间，但黑客松里**工程复杂度和跨链原子 demo 风险很大**，所以它更像“如果你团队特别强，可以搏大奖；否则容易把自己做死”的第二选择。它可能赢，因为 sponsor 会一眼看懂“Robinhood 资产 + Arbitrum 现金”的大图景；它也可能输，因为 7 天里最容易因为边界条件太多而 demo 不稳定。citeturn5view3turn10view0turn40view0turn41search7

**Rulebook Wallet**。一句话产品：**为 Robinhood Chain 做一个面向 tokenized assets 的规则型 smart wallet：gasless、批量操作、周期性买入、额度上限、session key、失败解释。**目标用户是**第一次接触 tokenized stocks 的零售用户、面向消费者的钱包与 broker-like app、以及想把复杂链操作藏起来的产品团队**。核心问题是 Robinhood 自己所说的：“crypto should stay in the background”；官方文档也已经给了 Smart Wallet、Bundler、Gas Manager 和 Robinhood Wallet testnet mode，这说明 UX/AA 是现成战场。MVP 非常可控：钱包创建、资产接入、规则保存、周期性买入、批量再平衡、失败解释、gas sponsor 展示。商业模式也合理，可以走 wallet SDK 与 B2B API。它之所以不是我的第一推荐，不是因为它不好，而是因为它更偏**钱包体验基础设施**，对“真实问题解决”的评委冲击力略弱于 `Mandate` 那种“安全自动化控制层”的故事；换句话说，它更像一个很好卖的产品，而不是最尖锐的黑客松命题。citeturn32view0turn30view1turn5view3turn20view4

## 唯一推荐想法

**项目名称**：**Mandate**

**一句话 Pitch**：**Mandate 是一个部署在 Robinhood Chain 上的 compliance-aware onchain policy vault，让用户或 AI agent 只能在预设的风险、仓位、额度、节奏与资产白名单下执行 tokenized stock / ETF 组合操作。**

**目标用户**：第一层是**Robinhood Chain 上试验 tokenized stocks 的早期用户**，尤其是愿意尝试自动化但不接受“黑盒全权代管”的人；第二层是**做 tokenized asset 钱包、broker-like app、RWA 协议、agent 产品的开发团队**；第三层是**需要“可验证执行边界”的小型基金、DAO treasury、家族办公室试验型团队**。这些用户不只是“DeFi users”，而是对**控制、解释、审计和安全自动化**有刚需的人。citeturn5view3turn20view0turn21view0

**用户痛点**：今天 tokenized asset 的 demo 往往停在“我能买卖/我能聊天”，但真实使用场景很快就会遇到五个问题：**仓位过度集中、自动化失控、规则只能口头约束、出问题后无法解释、普通用户不想管理 gas 和复杂链动作**。Arbitrum 的官方材料一直在讲 compliance、customization、confidentiality、performance；Robinhood Chain 文档则给了 AA、smart wallets、gas sponsorship 和 tokenized stock test assets。这些信号共同说明，生态里最缺的不是 another chart，而是**能把风险约束写成执行前置条件的产品层**。citeturn20view0turn20view1turn20view2turn32view0turn11search0

**为什么现在做**：因为时机几乎是为这个方向量身定制的。Robinhood Chain public testnet 已开放，官方 faucet、Explorer、AA、Gas Manager、Foundry 教程都齐了；Buildathon 明确保留 Robinhood Chain 获奖席位，还额外有 Agentic 奖；Arbitrum 则在同一时间窗口里公开把 narrative 推向“programmable economy”“onchain trust”“AI + Stylus”“wallet standards”。这类方向现在做，不是在逆着链方跑，而是在顺着他们已经公开铺好的轨道跑。citeturn12view1turn32view0turn42view0turn20view3

**为什么是 Arbitrum / Robinhood Chain**：因为这个产品既需要**便宜、快速、可与 EVM 兼容的执行环境**，又需要**面向 tokenized assets 的原生叙事与消费者体验基因**。Robinhood Chain 已经给出 100ms block time、AA bundler、smart wallets、gas sponsorship、stock token faucet；Arbitrum 则给出 Stylus、多 VM 互操作、BoLD、动态定价、与 Ethereum 的安全锚定。更关键的是，Arbitrum 官方明确认为**信用评分、风险评估、资格校验**这类“本来在后端黑盒里的逻辑”适合被搬到链上并做成可验证的软件规则，这几乎就是 `Mandate` 的设计宣言。citeturn30view0turn32view0turn23view1turn23view0turn43search0turn21view0

**为什么它符合黑客松评审标准**：它天然对应四个官方分项。智能合约质量方面，`Mandate` 不是只有一个 vault，而是有清晰的**PolicyVault / Executor / RiskEngine** 模块边界；PMF 方面，它解决的是自动化金融产品都会遇到的**控制与责任问题**；创新性方面，它把 Robinhood Chain tokenized assets、Arbitrum Stylus、AA wallet、可选 agentic automation 组合成一个新的控制平面；真实问题解决方面，它不是提醒用户，而是在**执行前阻止不符合 mandate 的动作**。这比“看板产品”或“聊天界面”更符合 Real Problem Solving 的原意。citeturn12view1turn27view0

**为什么它比其他候选 idea 更强**：比 RepoLink 强在**MVP 风险小得多**，不需要证明复杂跨链原子性就能讲通价值；比 Rulebook Wallet 强在**问题更锋利**，从 UX 提升上升到了“资产安全与规则执行”；比 IndexPilot 强在**没有直接撞上 EqualFi 获奖路径**；比 Generic AI Copilot 强在**不是拥挤赛道**，也不会被评委视为“又一个 agent shell”。它是一个很少见的甜点位：**叙事贴合度极高，但题目本身还没被做烂。**citeturn16view3turn16view0turn27view0turn28view0

**MVP 功能范围**：第一，用户连接 Robinhood Chain 钱包并导入 faucet token。第二，创建一个 onchain mandate，至少含有**允许资产列表、单笔最大交易额、单日最大换手、单资产最大仓位、最大回撤触发降档、冷却时间**。第三，系统接收一个 trade proposal，来源可以是**规则模板、手动输入、或轻量 AI**。第四，合约在链上校验后执行或拒绝。第五，前端给出**可解释日志**：为什么放行、为什么拒绝、当前暴露度、Explorer 链接。只要这 5 件事做通，项目就已经具备完整闭环。citeturn12view1turn32view0turn11search0

**具体技术架构**：前端用 **Next.js + wagmi/viem**；执行层在 Robinhood Chain testnet。合约层分三部分：**PolicyVault.sol** 负责存储 mandate 与所有权；**Executor.sol** 负责实际 token 调用与事件记录；**RiskEngine.stylus.rs** 用 Rust/Stylus 计算组合暴露、日内额度和规则命中情况。账户层接 Robinhood Chain 支持的 **ERC-4337 bundler / smart wallets / gas manager**，把 gasless 与批量调用做进去。自动化层不要做成不可控的“交易大脑”，而应该做成一个**proposal generator**：它只负责提出“建议执行什么”，真正的 allow/deny 永远由链上的 mandate 决定。citeturn32view0turn23view1turn30view2

**智能合约部分应该做什么**：`PolicyVault` 存 mandate 配置与版本；`RiskEngine` 提供 `validate(proposal, holdings, prices)` 与 `record(postState)` 两阶段接口；`Executor` 只在 `validate == true` 时继续执行 token transfer / swap / rebalance 模块；所有失败原因都 emit 成可读 event code。最小化原则是：**不要在黑客松里写复杂撮合或做市逻辑**，只要把“任何动作都先过 policy gate”这件事做对。这样最符合“smart contract quality”。citeturn12view1turn23view1turn43search0

**前端部分应该做什么**：前端不是仪表盘，而是一个**policy builder + action console**。用户进入后看到：当前资产、当前 mandate、风险条、历史执行。然后可以一键选择模板，例如“保守 DCA”“最大单股仓位 25%”“日内换手不超过 20%”。再展示一笔待执行动作，并让用户看见系统如何解释：**如果执行，组合会怎样；如果不执行，为什么。**评委最喜欢这种“逻辑一眼能看懂”的界面，因为它天然支持 3 分钟 demo。citeturn27view0turn12view1

**AI agent / automation 部分如果有，应该做什么**：建议把 AI 明确降级为**proposal / explanation / automation adapter**，而不是“替用户拍板”。它可以做三件事：一是把自然语言转成 mandate 模板，比如“我不想任何一只股票超过 30%”；二是把预定义策略转成具体 proposal，比如“每周把 10% 现金 DCA 到 TSLA 与 AMD”；三是把失败原因翻译成人话。这样你既能争取 Agentic Project 奖，又不会落入“AI 是噱头”的陷阱。citeturn12view1turn42view0

**数据来源**：基础数据来自 **Robinhood Chain 官方 RPC、Explorer、已公布的 stock token / USDG / WETH 合约地址**；账户数据来自用户钱包与链上事件；价格与回撤逻辑在 MVP 阶段建议使用**签名的 offchain demo feed 或 mock oracle**，而不要假装自己已经接入官方生产级证券行情。这样诚实、可控，也不会引入不可验证外部依赖。生产化之后再替换成正式行情与合规提供方。citeturn32view0turn8search2turn29search10

**三分钟 Demo Script**：第一幕，用户在 Robinhood Chain testnet 连接钱包并导入 TSLA、AMD、USDG。第二幕，用户创建一个 mandate：单股仓位不超过 35%，单日总换手不超过 20%，只允许交易 TSLA/AMD/USDG，回撤阈值触发自动转入 USDG。第三幕，AI 或规则引擎提出一笔动作，例如“把 40% 仓位从 USDG 买入 TSLA”。第四幕，RiskEngine 在链上计算并提示：这会使 TSLA 暴露超过 35%，所以交易被拒绝。第五幕，系统自动给出一个可执行替代方案，例如只买入 15%。第六幕，用户点执行，交易上链成功，同时审计日志显示 mandate id、风险检查结果、交易 hash 和执行后仓位。这个脚本的关键不是炫酷，而是**让评委看到规则真正拦住了风险，且整个闭环发生在链上。**citeturn12view1turn32view0turn23view1

**商业模式**：短期做 **B2B2C SDK** 最现实。向钱包、agent 平台、RWA apps、tokenized broker app 提供 policy engine、审计日志和 smart account control。收费方式可以是**每账户月费 + 执行量计费 + 企业审计模块订阅**。长期可以扩到两个方向：一个是做**Mandate-as-a-Service** 的规则中间层；另一个是做**risk/compliance execution network**，为不同 tokenized asset 产品提供可插拔的政策模块。这个模式比“卖一个零售 app”更有 grant 和 partnership 想象，也更符合 Arbitrum 当前对 category-leading infrastructure/apps 的偏好。citeturn5view4turn20view0turn20view1

**后续 grant / partnership 路线**：第一步是冲击 London Buildathon overall prize 与 Best Agentic Project；第二步争取进入 **Founder House**；第三步对接 **Mentorship Program**，因为 Foundation 已明确给出产品、GTM、分发与投资人介绍支持。合作上最现实的对象不是空泛地说“找基金”，而是**Robinhood Chain 团队、Alchemy、OpenZeppelin、Dune、LayerZero、Variational、Pendle、GMX 等在 Mentorship 与 Open House 里已出现的生态方**。需要特别提醒：不要把“去申请 Arbitrum Foundation 开放 grant”作为主路径，因为公开 grants 页面显示过去的基金项目目前是 inactive；真正近端可抓的是 **Open House milestone grants + mentorship + sponsor introductions**。citeturn5view4turn12view1turn18search0

**最大的五个风险**：第一，用户是否真的愿意为了“政策限制”而牺牲一点自由度；第二，MVP 阶段没有正式生产级价格与合规 provider，风险分数的可信度如何建立；第三，项目会不会被误解成“只是 treasury firewall”，而不是 Robinhood tokenized asset 产品；第四，AA / gas sponsorship 接入会不会在短时开发里拖慢进度；第五，agentic 成分若做得太多，会不会重新掉进“泛 AI copilot”拥挤赛道。citeturn35search8turn16view0turn15search16

**每个风险如何在 MVP 中验证或规避**：对第一个风险，MVP 不卖“限制”，而卖“可托管地自动化”，并用一笔真实被拒绝的超限交易 demo 证明价值。对第二个风险，明确在 demo 中标注“价格 feed 为 signed demo feed / mock oracle”，把重点放在**规则执行框架**而不是行情真伪。对第三个风险，前端必须围绕**个人/小团队 portfolio mandate**展开，而不是 DAO treasury 面板。对第四个风险，ERC-4337 只接最小 happy path；如果时间不够，允许第一版先用普通 EOAs，最后再补 gas sponsor 展示。对第五个风险，AI 只做 proposal 与解释，不做最终决策。这样无论 agent 失败还是模型表现一般，主故事都不会塌。citeturn32view0turn12view1

**如果只有七天开发时间，应该如何取舍功能**：一定优先做这五件事：**Robinhood Chain 部署、Mandate 创建、Stylus 风险校验、动作执行/拒绝、可解释审计日志**。可以延后或删掉的功能有：高级回测、复杂 VaR、跨链、隐私模块、完整多策略 agent、华丽图表、正式 oracle、完整 session key 管理、细粒度权限系统。最好的 7 天版本应该看起来像这样：**一个非常清楚的单链产品，能把 1 笔危险交易挡下来，再把 1 笔安全交易放过去。**如果你做到这一步，已经足够拿高分；相反，试图同时做 repo、agent、钱包、隐私和多链，只会让每个点都不够强。citeturn12view1turn27view0

## 关键来源与局限

本报告中，**最关键的判断**主要建立在四组一手来源上。第一组是 **HackQuest / Open House 官方页面**，用于确认奖项、评审标准、时间、提交要求与 Robinhood Chain 保底名额；第二组是 **Arbitrum Foundation 对 NYC Buildathon 与 Founder House 的官方复盘**，用于倒推出真实评审偏好和获奖项目类型；第三组是 **Robinhood Chain 官网与开发文档**，用于确认链的定位、testnet 状态、合约、AA、钱包、gas sponsorship 与 stock token test assets；第四组是 **Arbitrum 官方博客与文档**，用于确认当前“programmable economy / 合规 / 可配置 / 隐私 / 性能 / Stylus / AI”叙事。citeturn12view1turn27view0turn28view0turn32view0turn30view0turn20view0turn20view1turn20view2turn20view3turn23view1turn21view0

关于**当前 competition landscape**，我额外参考了可公开访问的 HackQuest 项目页，包括 NYC 既有优胜/特别奖项目与 London 当前可索引提交。它们足以证明几个方向已经明显拥挤：**AI trading copilot、stock token basket、agent accountability、treasury firewall、confidential RWA rooms**。但需要坦率说明：HackQuest 的公开搜索结果**不保证等于完整提交列表**，因此本报告对“拥挤度”的判断是**公开页面可见范围内的高置信推断**，不是对全量提交数据库的穷尽统计。citeturn16view0turn16view1turn16view3turn35search0turn35search8turn35search10

还有两点局限需要明确。其一，**Robinhood Chain 主网开放时间、正式生产级 tokenized asset 标准接口、官方 oracle / compliance provider 集成规范**在可公开索引的一手资料里仍然不充分，因此任何“主网上线后一定怎样”的判断都应视为推断，而不是事实。其二，官方论坛里引用了 Arbitrum 与 Robinhood 的 X 帖子，但当前公开检索对这些帖子本身的可访问性有限，所以本报告优先使用可稳定访问的官网、文档、论坛和 HackQuest 页面，而没有把社交媒体猜测当成事实。citeturn10view0turn29search7

综合以上，**唯一推荐不变：做 `Mandate`，把它做成 Robinhood Chain 上的 tokenized asset policy vault，而不是 another AI copilot。**如果你要的是获奖概率、后续合作潜力和 7 天能做出来的胜率，这就是当前最稳、最尖、也最符合 sponsor 真实需求的项目方向。