import { copy } from "@/lib/copy";
import Section from "./Section";

export default function ProblemSection() {
  return (
    <Section id="problem" eyebrow="02 · Problem" title={copy.problem.title}>
      <ul className="problem-list">
        {copy.problem.lines.map((line) => (
          <li key={line} data-reveal>
            {line}
          </li>
        ))}
      </ul>
    </Section>
  );
}
