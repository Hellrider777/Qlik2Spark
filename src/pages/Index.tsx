import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Zap, GitBranch, Code2, Database, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import ArchitectureFlow from "@/components/ArchitectureFlow";
import FutureExtensions from "@/components/FutureExtensions";

const Index = () => {
  return (
    <div className="min-h-screen bg-background grid-pattern">
      <div className="container max-w-7xl mx-auto py-12 px-4">
        <Header />
        
        {/* CTA Button */}
        <div className="flex justify-center mb-12">
          <Link to="/converter">
            <Button size="lg" className="gradient-bg text-primary-foreground gap-2 shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <Zap className="w-5 h-5" />
              Launch Converter
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: Sparkles,
              title: "LLM-Powered Conversion",
              desc: "AI-driven transpilation using OpenAI GPT-4. Intelligent semantic understanding for complex transformations.",
            },
            {
              icon: GitBranch,
              title: "Repository Processing",
              desc: "Import entire Qlik repositories, extract files, and process them as cohesive ETL pipelines.",
            },
            {
              icon: Code2,
              title: "Semantic Chunking",
              desc: "Automatically divides Qlik scripts into meaningful chunks (LOAD, TRANSFORM, CONFIG) for precise conversion.",
            },
            {
              icon: Database,
              title: "Chunk-by-Chunk LLM Processing",
              desc: "Each semantic chunk sent individually to GPT-4 with context, ensuring accurate PySpark generation.",
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-card rounded-xl p-6 card-shadow border border-border/50 hover:border-primary/30 transition-colors"
            >
              <div className="inline-flex p-3 rounded-lg bg-primary/10 mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
        
        {/* Architecture Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              System Architecture
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          </div>
          
          <ArchitectureFlow />
        </div>

        <FutureExtensions />

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Qlik2Spark — LLM-Powered ETL Transpilation Engine
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Repository-based chunk processing with OpenAI GPT-4 integration
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Index;
