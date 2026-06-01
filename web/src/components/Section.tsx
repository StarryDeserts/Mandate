import type { ReactNode } from "react";

type SectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
};

export default function Section({ id, eyebrow, title, children, className = "" }: SectionProps) {
  const titleId = `${id}-title`;

  return (
    <section id={id} className={`section ${className}`} aria-labelledby={titleId}>
      <div className="section__inner">
        <div className="section__header" data-reveal>
          <p className="section__eyebrow mono">{eyebrow}</p>
          <h2 id={titleId} className="section__title display">
            {title}
          </h2>
        </div>
        <div className="section__body">{children}</div>
      </div>
    </section>
  );
}
