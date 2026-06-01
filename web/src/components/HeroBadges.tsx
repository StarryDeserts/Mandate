import { evidence } from "@/lib/evidence";

const badges = [
  `LIVE · ${evidence.network.name}`,
  `CHAIN ID · ${evidence.network.chainId}`,
  "SESSION-KEY ACTION BLOCKED ONCHAIN",
  `MAX EXPOSURE POLICY · ${evidence.policy.maxSingleAssetExposurePct}%`
];

export default function HeroBadges() {
  return (
    <div className="hero-badges" aria-label="Mandate status badges">
      {badges.map((badge) => (
        <span key={badge} className={badge.includes("BLOCKED") ? "hero-badge hero-badge--blocked mono" : "hero-badge mono"}>
          {badge}
        </span>
      ))}
    </div>
  );
}
