import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export interface DiagnosticMessage {
  type: "error" | "warning" | "info" | "success";
  message: string;
  line?: number;
  chunkId?: string;
}

interface ErrorPanelProps {
  diagnostics: DiagnosticMessage[];
}

const ErrorPanel = ({ diagnostics }: ErrorPanelProps) => {
  const getIcon = (type: DiagnosticMessage["type"]) => {
    switch (type) {
      case "error":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <Info className="w-4 h-4 text-primary" />;
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
  };

  const getStyles = (type: DiagnosticMessage["type"]) => {
    switch (type) {
      case "error":
        return "bg-destructive/5 border-destructive/20";
      case "warning":
        return "bg-yellow-500/5 border-yellow-500/20";
      case "info":
        return "bg-primary/5 border-primary/20";
      case "success":
        return "bg-green-500/5 border-green-500/20";
    }
  };

  if (diagnostics.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground">
        <Info className="w-4 h-4" />
        <span className="text-sm">No diagnostics to display</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {diagnostics.map((diag, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 p-3 rounded-lg border ${getStyles(diag.type)}`}
        >
          {getIcon(diag.type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{diag.message}</p>
            {diag.line && (
              <p className="text-xs text-muted-foreground mt-0.5">Line {diag.line}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ErrorPanel;
