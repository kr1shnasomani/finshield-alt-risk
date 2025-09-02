import Hero from "@/components/Hero";
import CreditRiskAnalyzer from "@/components/CreditRiskAnalyzer";
import FloatingChatbot from "@/components/FloatingChatbot";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    document.title = "Finshield Credit Risk Engine";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Finshield predicts borrower default risk using alternative data.");
  }, []);

  return (
    <main>
      <Hero />
      <section className="pb-16 md:pb-24">
        <div className="container">
          <CreditRiskAnalyzer />
        </div>
      </section>
      <section id="how-it-works" className="py-12 md:py-16">
        <div className="container max-w-5xl text-center">
          <h2 className="text-2xl md:text-3xl font-semibold">How it works</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Upload a CSV containing behavioral and transactional signals. Select a user to compute Probability of Default. In production, connect a model API or Supabase Edge function to replace the heuristic with your trained pipeline.
          </p>
        </div>
      </section>
      <FloatingChatbot />
    </main>
  );
};

export default Index;
