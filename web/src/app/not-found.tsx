import Link from "next/link";

export default function NotFound() {
  return (
    <main className="placeholder-page">
      <p className="mono">ROUTE NOT FOUND</p>
      <h1 className="display">404</h1>
      <Link className="button button--secondary" href="/">
        Return to Mandate
      </Link>
    </main>
  );
}
