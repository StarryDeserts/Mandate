import Image from "next/image";
import Link from "next/link";
import { shortAddress } from "@/lib/mandate/format";

type Props = {
  address: `0x${string}` | null;
  chainId: number | null;
  expectedChainId: number;
};

export default function LiveTopbar({ address, chainId, expectedChainId }: Props) {
  const status = !address ? "disconnected" : chainId === expectedChainId ? "correct chain" : "wrong chain";

  return (
    <header className="app-console__topbar">
      <Link className="live-topbar__brand" href="/" aria-label="Go to Mandate landing page">
        <Image
          className="live-topbar__logo"
          src="/brand/mandate-logo-plus-text.png"
          alt="Mandate"
          width={200}
          height={50}
          priority
        />
      </Link>
      <div className="app-topbar__status" aria-label="Wallet status">
        <span className="app-chip">{address ? shortAddress(address) : "disconnected"}</span>
        <span className="app-chip">chain {chainId ?? "unknown"} / expected {expectedChainId}</span>
        <span className={`app-chip app-chip--${status === "correct chain" ? "safe" : "neutral"}`}>{status}</span>
      </div>
    </header>
  );
}
