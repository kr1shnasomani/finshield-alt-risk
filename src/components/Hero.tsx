import { Button } from "@/components/ui/button";
import { Shield, TrendingUp } from "lucide-react";

const Hero = () => {
  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -left-24 size-[420px] rounded-full blur-3xl opacity-20" style={{ backgroundImage: 'var(--gradient-primary)' }} />
        <div className="absolute -bottom-24 -right-24 size-[420px] rounded-full blur-3xl opacity-20" style={{ backgroundImage: 'var(--gradient-primary)' }} />
      </div>

      <div className="mx-auto max-w-4xl text-center py-16 md:py-24 animate-enter">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs md:text-sm bg-secondary/50 backdrop-blur">
          <Shield className="opacity-70" size={16} />
          Finshield — Alternative Data Credit Risk
        </div>
        <h1 className="mt-6 text-3xl md:text-6xl font-semibold tracking-tight">
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            Credit Risk Prediction Engine
          </span>
        </h1>
        <p className="mt-4 md:mt-6 text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
          Predict Probability of Default using alternative behavioral signals. Upload your dataset and assess risk instantly.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <a href="#analyzer">
            <Button size="lg" variant="hero" className="px-6">
              Get Started
            </Button>
          </a>
          <a className="story-link" href="#how-it-works">How it works</a>
        </div>
        <div className="mt-10 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="opacity-70" size={16} /> Real-time monitoring ready
        </div>
      </div>
    </header>
  );
};

export default Hero;
