import { Database, FileCode, Cloud } from "lucide-react";

const extensions = [
  { icon: Database, label: "SQL Generator", desc: "Standard SQL output" },
  { icon: FileCode, label: "Pandas Generator", desc: "Python DataFrames" },
  { icon: Cloud, label: "Cloud Deployment", desc: "AWS EMR / Databricks" },
];

const FutureExtensions = () => {
  return (
    <div className="mt-12">
      <div className="text-center mb-6">
        <span className="inline-block px-4 py-1.5 rounded-full bg-secondary/10 text-secondary text-xs font-medium">
          Future Extensions
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {extensions.map((ext, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-5 py-3 rounded-xl bg-muted/50 border border-border/50 hover:border-secondary/30 transition-colors"
          >
            <ext.icon className="w-4 h-4 text-secondary" />
            <div>
              <p className="text-sm font-medium text-foreground">{ext.label}</p>
              <p className="text-xs text-muted-foreground">{ext.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FutureExtensions;
