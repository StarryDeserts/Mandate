import { evidence, formatPct } from "@/lib/evidence";
import Section from "./Section";

export default function PolicyBoundary() {
  const { policy } = evidence;
  const rows = [
    ["MAX_SINGLE_ASSET_EXPOSURE", formatPct(policy.maxSingleAssetExposurePct)],
    ["MAX_TRADE_SIZE_USDG", String(policy.maxTradeSizeUsdg)],
    ["MAX_TURNOVER", `${policy.maxTurnoverPct}%`],
    ["COOLDOWN_SEC", String(policy.cooldownSec)],
    ["ALLOWED_ASSETS", policy.allowedAssets.join(", ")],
    ["ADAPTER_ALLOWED", String(policy.adapterAllowed)],
    ["PRICE_ORACLE_REGISTERED", String(policy.priceOracleRegistered)],
    ["SESSION_KEY_ENABLED", String(policy.sessionKeyEnabled)]
  ];

  return (
    <Section id="policy-boundary" eyebrow="07 · Policy boundary" title="The policy is explicit before execution.">
      <div className="telemetry" data-reveal>
        {rows.map(([label, value]) => (
          <div key={label} className="telemetry__row mono">
            <span>{label}</span>
            <i aria-hidden="true" />
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </Section>
  );
}
