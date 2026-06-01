"use client";

import { useEffect } from "react";
import { copy } from "@/lib/copy";
import Section from "./Section";

const rungs = [
  ["01", "USER MANDATE", "MandateAccount.sol"],
  ["02", "SESSION KEY PROPOSAL", "submitAction()"],
  ["03", "PRICE ATTESTATION", "SignedDemoPriceFeed"],
  ["04", "POLICY VALIDATION", "executeAction · 10 conditions"],
  ["05", "SAFE EXEC | BLOCKED DECISION", "ActionExecuted | ActionBlocked"],
  ["06", "ONCHAIN AUDIT EVENT", "events as audit root"]
] as const;

export default function HowItWorks() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const node = entry.target as HTMLElement;
          node.style.transitionDelay = `${Number(node.dataset.stagger ?? "0") * 80}ms`;
          node.classList.add("is-visible");
          observer.unobserve(node);
        }
      },
      { threshold: 0.2 }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <Section id="how-it-works" eyebrow="03 · Flow" title={copy.how.title}>
      <p className="section-lede" data-reveal>
        {copy.how.subtitle} Dangerous actions can be recorded as blocked without execution, and balances remain unchanged after blocked actions.
      </p>
      <ol className="ladder">
        {rungs.map(([num, label, chip], index) => (
          <li key={num} className="ladder__rung" data-reveal data-stagger={index}>
            <span className="ladder__num mono">{num}</span>
            <strong>{label}</strong>
            <span className="ladder__chip mono">{chip}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
