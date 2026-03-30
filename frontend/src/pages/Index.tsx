import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { HeroSection } from "@/components/sections/HeroSection";
import { PriceDashboard } from "@/components/sections/PriceDashboard";
import { NearbyMandis } from "@/components/sections/NearbyMandis";
import { PredictionChart } from "@/components/sections/PredictionChart";
import { HistoricalPriceChart } from "@/components/sections/HistoricalPriceChart";
import { ModelTrainingPanel } from "@/components/sections/ModelTrainingPanel";
import { WeatherSection } from "@/components/sections/WeatherSection";
import { MarketNewsSection } from "@/components/sections/MarketNewsSection";
import { PriceComparisonSection } from "@/components/sections/PriceComparisonSection";
import { MandiComparisonTable } from "@/components/sections/MandiComparisonTable";
import { ChatbotSection } from "@/components/sections/ChatbotSection";
import { MarketplaceSection } from "@/components/sections/MarketplaceSection";
import { PriceAlertsSection } from "@/components/sections/PriceAlertsSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { Footer } from "@/components/layout/Footer";

const Index = () => {
  const [userLocation, setUserLocation] = useState(
    localStorage.getItem("agriprice_location") || ""
  );

  return (
    <div className="min-h-screen" style={{background:"#0a0f0a"}}>
      <Navbar />
      <main>
        <HeroSection onLocationChange={setUserLocation} />
        <PriceDashboard location={userLocation} />
        <NearbyMandis />
        <PredictionChart />
        <HistoricalPriceChart />
        <ModelTrainingPanel />
        <WeatherSection />
        <MarketNewsSection />
        <PriceComparisonSection />
        <MandiComparisonTable />
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
