import { copy } from "@/lib/copy";
import Section from "./Section";

export default function ArchitecturePreview() {
  return (
    <Section id="architecture" eyebrow="09 · Architecture" title={copy.architecture.title}>
      <div className="architecture" data-reveal>
        <svg viewBox="0 0 1120 560" role="img" aria-label="Mandate architecture flow diagram">
          <defs>
            <marker id="archArrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
              <path d="M0,0 L12,6 L0,12 Z" fill="var(--safe)" />
            </marker>
          </defs>
          <rect x="1" y="1" width="1118" height="558" rx="18" fill="rgba(5,6,8,0.72)" stroke="var(--hairline)" />
          <g className="architecture__node">
            <rect x="70" y="102" width="170" height="82" rx="12" />
            <text x="155" y="136">Session Key</text>
            <text x="155" y="160">submitAction</text>
          </g>
          <g className="architecture__node architecture__node--core">
            <rect x="390" y="82" width="220" height="122" rx="14" />
            <text x="500" y="130">MandateAccount</text>
            <text x="500" y="158">policy validation</text>
          </g>
          <g className="architecture__node">
            <rect x="770" y="102" width="210" height="82" rx="12" />
            <text x="875" y="136">ApprovedSwapAdapter</text>
            <text x="875" y="160">executeAction</text>
          </g>
          <g className="architecture__node">
            <rect x="790" y="308" width="170" height="82" rx="12" />
            <text x="875" y="342">MockAMM</text>
            <text x="875" y="366">swapExactIn</text>
          </g>
          <g className="architecture__node">
            <rect x="120" y="302" width="210" height="82" rx="12" />
            <text x="225" y="336">SignedDemoPriceFeed</text>
            <text x="225" y="360">priceData</text>
          </g>
          <g className="architecture__assets">
            <rect x="354" y="430" width="410" height="72" rx="12" />
            <text x="559" y="474">MockERC20 assets · USDG · TSLA · AMD</text>
          </g>
          <path d="M240 143 H390" markerEnd="url(#archArrow)" />
          <path d="M610 143 H770" markerEnd="url(#archArrow)" />
          <path d="M875 184 V308" markerEnd="url(#archArrow)" />
          <path d="M330 342 C390 300 422 248 458 204" markerEnd="url(#archArrow)" />
          <path d="M790 358 C704 420 626 446 559 430" markerEnd="url(#archArrow)" />
        </svg>
        <div className="architecture__notes">
          {copy.architecture.highlights.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </Section>
  );
}
