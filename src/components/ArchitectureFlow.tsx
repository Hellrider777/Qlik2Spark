import {
  Monitor,
  Server,
  FileText,
  Boxes,
  GitBranch,
  Network,
  Code2,
  Download,
} from "lucide-react";
import ArchitectureCard from "./ArchitectureCard";
import FlowArrow from "./FlowArrow";

const architectureData = [
  {
    title: "Web Frontend",
    icon: Monitor,
    color: "primary" as const,
    items: [
      "React SPA",
      "Code editor interface",
      "File upload support",
      "Repository mode",
    ],
  },
  {
    title: "Input Processing",
    icon: FileText,
    color: "primary" as const,
    items: [
      "Qlik script parsing",
      "Multi-file repository",
      "Dependency resolution",
      "Syntax validation",
    ],
  },
  {
    title: "Rule-Based Engine",
    icon: GitBranch,
    color: "secondary" as const,
    items: [
      "Deterministic transpilation",
      "Qlik → PySpark mapping",
      "No LLM dependency",
      "ETL operation rules",
    ],
  },
  {
    title: "Code Generation",
    icon: Code2,
    color: "secondary" as const,
    items: [
      "PySpark DataFrame code",
      "SparkSession initialization",
      "Error diagnostics",
      "Optimized output",
    ],
  },
  {
    title: "Output & Export",
    icon: Download,
    color: "primary" as const,
    items: [
      "Download .py files",
      "Copy to clipboard",
      "Real-time diagnostics",
      "Execution ready code",
    ],
  },
];

const ArchitectureFlow = () => {
  return (
    <div className="w-full">
      {/* Main Flow - 6 components in a responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {architectureData.map((component, index) => (
          <div key={index} className="relative">
            <ArchitectureCard
              title={component.title}
              icon={component.icon}
              items={component.items}
              index={index}
              color={component.color}
            />
            {/* Arrow overlay for larger screens */}
            {index < architectureData.length - 1 && (
              <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10">
                <svg width="24" height="16" viewBox="0 0 24 16" className="opacity-50">
                  <defs>
                    <linearGradient id={`arrowGrad${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="hsl(221, 83%, 53%)" />
                      <stop offset="100%" stopColor="hsl(263, 70%, 58%)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 8 L16 8 M12 4 L18 8 L12 12"
                    fill="none"
                    stroke={`url(#arrowGrad${index})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
        {architectureData.map((_, index) => (
          <div key={index} className="flex justify-center">
            <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Step {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchitectureFlow;
