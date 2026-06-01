import Section from "./Section";

const enforced = [
  "session key cannot bypass policy",
  "unsafe action is blocked before execution",
  "adapter must be explicitly allowed",
  "assets must be explicitly allowed",
  "exposure limit is checked onchain",
  "blocked action keeps balances unchanged",
  "audit events are emitted onchain"
];

const notClaimed = [
  "not real stock trading",
  "not investment advice",
  "not legal compliance software",
  "not full ERC-4337",
  "not production custody",
  "not protection against owner-key compromise",
  "frontend is not a security boundary"
];

export default function SecurityBoundary() {
  return (
    <Section id="security-boundary" eyebrow="08 · Security boundary" title="Precise claims. No hype surface.">
      <div className="security-grid" data-reveal>
        <div>
          <h3 className="mono security-grid__safe">ENFORCED BY MANDATE</h3>
          <ul>{enforced.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h3 className="mono">NOT CLAIMED</h3>
          <ul>{notClaimed.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>
    </Section>
  );
}
