import { Sparkles, Zap } from "lucide-react";

const Header = () => {
  return (
    <header className="text-center mb-12">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 mb-6">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-sm text-muted-foreground">Automated ETL Transpilation Platform</span>
      </div>
      
      <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
        <span className="gradient-text">Qlik2Spark</span>
      </h1>
      
      <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
        Transform Qlik repositories into production-ready PySpark code with our
        <span className="text-foreground font-medium"> AI-powered chunk processing </span>
        using OpenAI GPT-4
      </p>

      <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          <span>LLM-Powered</span>
        </div>
        <span className="w-1 h-1 rounded-full bg-border" />
        <span>Semantic Chunking</span>
        <span className="w-1 h-1 rounded-full bg-border" />
        <span>Repository Processing</span>
      </div>
    </header>
  );
};

export default Header;
