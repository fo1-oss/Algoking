import Navbar from "@/components/Navbar";
import GridBackground from "@/components/GridBackground";
import HeroSection from "@/components/HeroSection";
import StatsBar from "@/components/StatsBar";
import LiveTicker from "@/components/LiveTicker";
import FeaturesSection from "@/components/FeaturesSection";
import AlgoShowcase from "@/components/AlgoShowcase";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main style={{ position: "relative", minHeight: "100vh" }}>
      <GridBackground />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Navbar />
        <HeroSection />
        <StatsBar />
        <LiveTicker />
        <FeaturesSection />
        <AlgoShowcase />
        <CTASection />
        <Footer />
      </div>
    </main>
  );
}
