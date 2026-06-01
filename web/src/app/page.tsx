import ArchitecturePreview from "@/components/ArchitecturePreview";
import BlockedAction from "@/components/BlockedAction";
import DemoPaths from "@/components/DemoPaths";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import PolicyBoundary from "@/components/PolicyBoundary";
import ProblemSection from "@/components/ProblemSection";
import SecurityBoundary from "@/components/SecurityBoundary";
import TestnetProof from "@/components/TestnetProof";

export default function Page() {
  return (
    <main>
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <DemoPaths />
      <TestnetProof />
      <BlockedAction />
      <PolicyBoundary />
      <SecurityBoundary />
      <ArchitecturePreview />
      <FinalCTA />
      <Footer />
    </main>
  );
}
