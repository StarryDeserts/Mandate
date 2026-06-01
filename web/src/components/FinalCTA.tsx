import { copy } from "@/lib/copy";
import { explorerHomeUrl } from "@/lib/explorer";
import BoundaryField from "./BoundaryField";

export default function FinalCTA() {
  return (
    <section id="final-cta" className="final-cta" aria-labelledby="final-cta-title">
      <div className="final-cta__field" aria-hidden="true">
        <BoundaryField variant="echo" />
      </div>
      <div className="final-cta__content">
        <p className="section__eyebrow mono">10 · Close</p>
        <h2 id="final-cta-title" className="final-cta__title display">
          {copy.final.line}
        </h2>
        <div className="hero__ctas final-cta__buttons">
          <a className="button button--primary" href="/app">Launch Demo</a>
          <a className="button button--secondary" href={explorerHomeUrl()}>View Contracts</a>
        </div>
      </div>
    </section>
  );
}
