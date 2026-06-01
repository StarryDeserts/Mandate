import Link from "next/link";

export default function AppPlaceholderPage() {
  return (
    <main className="placeholder-page">
      <p className="mono">MANDATE · DEMO CONSOLE</p>
      <h1 className="display">Coming soon.</h1>
      <Link className="button button--secondary" href="/">
        Onchain proof is on the landing page →
      </Link>
    </main>
  );
}
