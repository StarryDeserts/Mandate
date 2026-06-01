import { copy } from "@/lib/copy";
import { evidence } from "@/lib/evidence";
import { explorerHomeUrl } from "@/lib/explorer";

export default function Footer() {
  const commit = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";

  return (
    <footer className="footer">
      <p>{copy.footer.disclaimer}</p>
      <p className="mono">commit · {commit} · chain {evidence.network.chainId}</p>
      <nav className="footer__links mono" aria-label="Footer links">
        <a href="https://github.com" rel="noreferrer">GitHub</a>
        <a href={explorerHomeUrl()}>Explorer</a>
      </nav>
    </footer>
  );
}
