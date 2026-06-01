import data from "../../public/evidence.json";

export type EvidenceShape = typeof data;
export const evidence: EvidenceShape = data;

export const shortenHash = (hex: string, head = 6, tail = 4): string =>
  hex.length <= head + tail + 2 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;

export const formatPct = (value: number): string => `${value.toFixed(2)}%`;
