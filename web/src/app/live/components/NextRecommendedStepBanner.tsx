import type { LiveNextRecommendedStep } from "../nextStep";

type Props = {
  step: LiveNextRecommendedStep;
};

const COMPLETE_CHECKLIST = [
  "Demo tokens minted and deposited into the MandateAccount",
  "Small TSLA buy executed after Mandate returned OK",
  "Over-limit action blocked — no funds moved, no execute path exposed"
] as const;

export default function NextRecommendedStepBanner({ step }: Props) {
  const complete = step.status === "evidence";
  return (
    <section
      className={`app-panel live-next-step live-next-step--${step.status}${complete ? " live-next-step--complete" : ""}`}
      aria-labelledby="live-next-step-title"
    >
      <div className="live-next-step__lead">
        <p className="mono">{complete ? "Demo complete" : "Next recommended step"}</p>
        <h2 id="live-next-step-title">{step.title}</h2>
        <p>{step.summary}</p>
        {complete ? (
          <ul className="live-next-step__checklist">
            {COMPLETE_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <span className={`app-chip live-chip--${step.status}`}>{complete ? "complete" : step.status}</span>
    </section>
  );
}
