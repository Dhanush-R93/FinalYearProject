import { Navbar } from "@/components/layout/Navbar";
import { HeroSection } from "@/components/sections/HeroSection";
import { PriceDashboard } from "@/components/sections/PriceDashboard";
import { PredictionChart } from "@/components/sections/PredictionChart";
import { HistoricalPriceChart } from "@/components/sections/HistoricalPriceChart";
import { ModelTrainingPanel } from "@/components/sections/ModelTrainingPanel";
import { WeatherSection } from "@/components/sections/WeatherSection";
import { MarketNewsSection } from "@/components/sections/MarketNewsSection";
import { PriceComparisonSection } from "@/components/sections/PriceComparisonSection";
import { MandiComparisonTable } from "@/components/sections/MandiComparisonTable";
import { NearbyMandis } from "@/components/sections/NearbyMandis";
import { ChatbotSection } from "@/components/sections/ChatbotSection";
import { MarketplaceSection } from "@/components/sections/MarketplaceSection";
import { PriceAlertsSection } from "@/components/sections/PriceAlertsSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { Footer } from "@/components/layout/Footer";

function SectionDivider() {
  return (
    <div className="flex items-center justify-center py-2">
      <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="mx-3 h-1.5 w-1.5 rounded-full bg-primary/30" />
      <div className="h-px w-16 bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="overflow-hidden">
        <HeroSection />
        <PriceDashboard />
        <NearbyMandis />
        <SectionDivider />
        <PredictionChart />
        <HistoricalPriceChart />
        <SectionDivider />
        <ModelTrainingPanel />
        <WeatherSection />
        <SectionDivider />
        <MarketNewsSection />
        <PriceComparisonSection />
        <MandiComparisonTable />
        <SectionDivider />
        <MarketplaceSection />
        <PriceAlertsSection />
        <FeaturesSection />
        <ChatbotSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
