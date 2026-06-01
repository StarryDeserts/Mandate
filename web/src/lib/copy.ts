export const copy = {
  hero: {
    product: "Mandate",
    headline: "Safe Automation for Tokenized Assets",
    subheadline:
      "Mandate lets users and session keys manage tokenized asset portfolios only within user-defined risk limits — with every decision enforced and logged onchain.",
    primaryCta: "Launch Demo",
    secondaryCta: "See Onchain Evidence"
  },
  problem: {
    title: "Programmable assets need programmable safety.",
    lines: [
      "AI agents and automation can propose unsafe actions.",
      "UI limits are not an execution boundary.",
      "Offchain policies can be ignored or misreported.",
      "Users need hard constraints before funds move.",
      "Failures and denials need an auditable trail."
    ]
  },
  how: {
    title: "How Mandate works",
    subtitle:
      "Session keys can propose actions. The owner keeps authority. Policy is checked before funds move."
  },
  blocked: {
    title: "A dangerous action was blocked before execution.",
    body:
      "This was not a UI warning. The session key submitted the action, Mandate classified it as BLOCKED onchain, emitted ActionBlocked, and the portfolio balances stayed unchanged."
  },
  architecture: {
    title: "Architecture preview",
    highlights: [
      "Session key proposes.",
      "Mandate validates.",
      "Adapter executes only approved actions.",
      "Blocked actions emit events and do not move funds.",
      "Events are the audit root."
    ]
  },
  final: {
    line: "AI agents can propose. Policy decides. Events prove."
  },
  footer: {
    disclaimer:
      "Mandate is a testnet hackathon prototype. It does not provide investment advice, legal compliance, brokerage services, custody services, or real securities trading."
  }
} as const;
