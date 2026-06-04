import { txUrl } from "@/lib/explorer";
import { shortAddress } from "@/lib/mandate/format";
import { humanizeReasonCode } from "@/lib/mandate/reasons";
import type { LiveWalletState } from "../hooks/useLiveWallet";

type Props = {
  wallet: LiveWalletState;
};

export default function LiveResultSummaryCards({ wallet }: Props) {
  const cards = [depositCard(wallet), safeCard(wallet), dangerousCard(wallet)].filter((card): card is NonNullable<typeof card> => card !== null);
  if (cards.length === 0) return null;

  return (
    <section className="live-result-summaries" aria-label="Live result summaries">
      {cards.map((card) => (
        <article className={`app-panel live-result-card live-result-card--${card.tone}`} key={card.title}>
          <div className="live-result-card__head">
            <p className="mono">{card.eyebrow}</p>
            <span className={`app-chip live-chip--${card.status}`}>{card.status}</span>
          </div>
          <h3>{card.title}</h3>
          <p>{card.summary}</p>
          <div className="app-state-grid">
            {card.rows.map(([label, value]) => (
              <div className="app-state-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {card.note ? <p className="live-result-card__note">{card.note}</p> : null}
          {card.links.length > 0 ? (
            <div className="live-result-card__links">
              {card.links.map(([label, hash]) => (
                <a className="live-result-card__link" href={txUrl(hash)} target="_blank" rel="noreferrer" key={label} title={hash}>
                  <span>{label}</span>
                  <span className="live-result-card__link-hash">{shortAddress(hash, 6, 6)}</span>
                </a>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function depositCard(wallet: LiveWalletState) {
  if (!wallet.depositTxHash) return null;
  return {
    tone: "success",
    status: "confirmed",
    eyebrow: "USER FUNDING RESULT",
    title: "Deposit confirmed",
    summary: `Deposited ${wallet.selectedMintAmountLabel} into MandateAccount.`,
    rows: [
      ["TOKEN", wallet.selectedMintToken.label],
      ["AMOUNT", wallet.selectedMintAmountLabel],
      ["BALANCE CHANGE", `-${wallet.selectedMintAmountLabel} wallet / +${wallet.selectedMintAmountLabel} MandateAccount`]
    ] as const,
    note: null,
    links: [["Deposit tx", wallet.depositTxHash]] as const
  };
}

function safeCard(wallet: LiveWalletState) {
  if (!wallet.safeExecuteTxHash) return null;
  return {
    tone: "success",
    status: "executed",
    eyebrow: "MANDATE EXECUTION RESULT",
    title: "Safe action executed",
    summary: "Small TSLA buy candidate executed only after Mandate preview and approval.",
    rows: [
      ["ACTION", "48 USDG → TSLA"],
      ["DECISION", wallet.safeDecisionStatusLabel],
      ["BALANCE CHANGE", "MandateAccount balances updated"]
    ] as const,
    note: null,
    links: [["Submit tx", wallet.safeSubmitTxHash ?? wallet.safeExecuteTxHash], ["Execute tx", wallet.safeExecuteTxHash]] as const
  };
}

function dangerousCard(wallet: LiveWalletState) {
  if (!wallet.dangerousActionResult) return null;
  const reason = wallet.dangerousActionResult.blockedReason ?? wallet.dangerousActionResult.previewReason;
  return {
    tone: "blocked",
    status: "blocked",
    eyebrow: "BOUNDARY PROOF RESULT",
    title: "Dangerous action blocked",
    summary: "Mandate blocked the aggressive TSLA increase. Funds moved: no.",
    rows: [
      ["ACTION", "500 USDG → TSLA"],
      ["FUNDS MOVED", "No"]
    ] as const,
    note: `Blocked by Mandate: ${reason ? humanizeReasonCode(wallet.dangerousActionResult.preview.code) : "policy limit exceeded"}`,
    links: [["Blocked submit tx", wallet.dangerousActionResult.submitTxHash]] as const
  };
}
