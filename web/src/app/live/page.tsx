import LiveConsoleClient from "./LiveConsoleClient";
import { getMandateDeployment } from "@/lib/mandate/deployment";

export default function LivePage() {
  const deployment = getMandateDeployment();
  return <LiveConsoleClient deployment={deployment} />;
}
