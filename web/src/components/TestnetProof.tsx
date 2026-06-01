import { contractRows, contracts } from "@/lib/addresses";
import { evidence, shortenHash } from "@/lib/evidence";
import { addressUrl } from "@/lib/explorer";
import Section from "./Section";

export default function TestnetProof() {
  return (
    <Section id="testnet-proof" eyebrow="05 · Live testnet proof" title="Verified deployment wall.">
      <div className="proof-wall" data-reveal>
        <div className="proof-wall__header mono">
          Network · {evidence.network.name} · chainId {evidence.network.chainId}
        </div>
        <div className="proof-wall__rows">
          {contractRows.map(({ key, label }) => (
            <a key={key} className="proof-row" href={addressUrl(contracts[key])}>
              <strong>{label}</strong>
              <span className="mono">{shortenHash(contracts[key], 8, 6)}</span>
              <em className="mono">verified</em>
            </a>
          ))}
        </div>
      </div>
    </Section>
  );
}
