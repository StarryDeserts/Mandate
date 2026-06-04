import { shortAddress } from "@/lib/mandate/format";

type Props = {
  value: string;
  head?: number;
  tail?: number;
};

export default function MonoValue({ value, head = 6, tail = 4 }: Props) {
  return (
    <span className="live-mono-value" title={value}>
      {shortAddress(value, head, tail)}
    </span>
  );
}
