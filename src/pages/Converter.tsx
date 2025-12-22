import { useState, useCallback, useRef } from "react";
import {
  Play,
  Download,
  Copy,
  Check,
  FileCode,
  Sparkles,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CodeEditor from "@/components/CodeEditor";
import ErrorPanel, { DiagnosticMessage } from "@/components/ErrorPanel";
import { transpileRepositoryToPySpark } from "@/lib/transpiler";
import { llmClient } from "@/lib/llm-client";
import { chunkQlikScript } from "@/lib/chunker";
import { toast } from "@/hooks/use-toast";

const Converter = () => {
  const [pysparkCode, setPysparkCode] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticMessage[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(true);
  const [repositoryFiles, setRepositoryFiles] = useState<Map<string, string>>(new Map());
  const [repositoryResults, setRepositoryResults] = useState<any>(null);
  const [chunks, setChunks] = useState<any[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleConvert = useCallback(async () => {
    if (repositoryFiles.size === 0) {
      toast({
        title: "No repository files",
        description: "Please upload Qlik repository files first",
        variant: "destructive",
      });
      return;
    }

    setIsConverting(true);
    setDiagnostics([]); // Clear previous diagnostics
    setChunks([]); // Clear previous chunks

    try {
      // First, extract and display chunks from all files
      const allChunks: any[] = [];
      for (const [fileName, content] of repositoryFiles) {
        const fileChunks = chunkQlikScript(content);
        allChunks.push(...fileChunks.chunks.map(chunk => ({ ...chunk, fileName })));
      }
      setChunks(allChunks);

      // Check if LLM is configured
      if (!llmClient.isConfigured()) {
        setIsConverting(false);
        setDiagnostics([{
          type: "error",
          message: "Google Gemini API key not configured. Please set VITE_GEMINI_API_KEY environment variable.",
        }]);
        toast({
          title: "LLM not configured",
          description: "Please configure Google Gemini API key to use LLM conversion",
          variant: "destructive",
        });
        return;
      }

      // Send each chunk to LLM for conversion
      const convertedChunks: string[] = [];
      const chunkDiagnostics: DiagnosticMessage[] = [];
      let totalTokens = 0;

      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];

        try {
          const context = `File: ${chunk.fileName}, Lines: ${chunk.startLine}-${chunk.endLine}, Type: ${chunk.type}`;
          const llmResponse = await llmClient.convertQlikChunk(chunk.content, context);

          if (llmResponse.success && llmResponse.code) {
            convertedChunks.push(`# ${chunk.type.toUpperCase()}: ${chunk.fileName}:${chunk.startLine}-${chunk.endLine}`);
            convertedChunks.push(llmResponse.code.trim());
            convertedChunks.push("");

            // Add usage info
            if (llmResponse.usage) {
              totalTokens += llmResponse.usage.totalTokens;
              chunkDiagnostics.push({
                type: "info",
                message: `Chunk ${i + 1}/${allChunks.length}: ${llmResponse.usage.promptTokens} prompt + ${llmResponse.usage.completionTokens} completion tokens`,
                chunkId: `${chunk.fileName}:${chunk.startLine}-${chunk.endLine}`
              });
            }
          } else {
            chunkDiagnostics.push({
              type: "error",
              message: `LLM conversion failed for chunk ${i + 1}: ${llmResponse.error}`,
              chunkId: `${chunk.fileName}:${chunk.startLine}-${chunk.endLine}`
            });
            // Skip failed chunks
            continue;
          }
        } catch (error) {
          chunkDiagnostics.push({
            type: "error",
            message: `LLM processing error for chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            chunkId: `${chunk.fileName}:${chunk.startLine}-${chunk.endLine}`
          });
          continue;
        }
      }

      // Add PySpark header
      const pysparkCode = [
        "from pyspark.sql import SparkSession",
        "from pyspark.sql.functions import col, lit, when, concat, upper, lower, trim",
        "",
        "# Initialize Spark Session",
        'spark = SparkSession.builder.appName("Qlik2Spark").getOrCreate()',
        "",
        ...convertedChunks
      ].join("\n");

      setPysparkCode(pysparkCode);
      setDiagnostics(chunkDiagnostics);
      setIsConverting(false);

      const successCount = chunkDiagnostics.filter(d => d.type === "info").length;
      const errorCount = chunkDiagnostics.filter(d => d.type === "error").length;

      toast({
        title: "LLM conversion complete",
        description: `Processed ${allChunks.length} chunks (${successCount} successful, ${errorCount} failed), ${totalTokens} total tokens`,
      });
    } catch (error) {
      setIsConverting(false);
      setDiagnostics([{
        type: "error",
        message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }]);
      toast({
        title: "Conversion failed",
        description: "Check diagnostics for details",
        variant: "destructive",
      });
    }
  }, [repositoryFiles]);



  const handleFolderUpload = useCallback(async (files: FileList) => {
    const fileMap = new Map<string, string>();
    const qlikFiles = Array.from(files).filter(file =>
      file.name.endsWith('.qvs') || file.name.endsWith('.txt') || file.name.endsWith('.qvw')
    );

    if (qlikFiles.length === 0) {
      toast({
        title: "No Qlik files found",
        description: "Please select a folder containing .qvs, .txt, or .qvw files",
        variant: "destructive",
      });
      return;
    }

    let processedCount = 0;

    qlikFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        fileMap.set(file.name, content);
        processedCount++;

        if (processedCount === qlikFiles.length) {
          setRepositoryFiles(fileMap);
          toast({
            title: "Repository imported",
            description: `Successfully imported ${fileMap.size} Qlik files from folder`,
          });
        }
      };
      reader.readAsText(file);
    });
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(pysparkCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "PySpark code copied to clipboard",
    });
  }, [pysparkCode]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([pysparkCode], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "converted_script.py";
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded",
      description: "PySpark script saved as converted_script.py",
    });
  }, [pysparkCode]);

  const handleReset = useCallback(() => {
    setPysparkCode("");
    setDiagnostics([]);
    setRepositoryFiles(new Map());
    setRepositoryResults(null);
    setChunks([]);
  }, []);

  const handleFolderUploadClick = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="gradient-bg p-2 rounded-lg">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-text">Qlik2Spark</h1>
                <p className="text-xs text-muted-foreground">ETL Transpilation Engine</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleFolderUploadClick}>
                <Upload className="w-4 h-4 mr-1.5" />
                Import Repository
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hidden folder input */}
      <input
        type="file"
        ref={folderInputRef as any}
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
        accept=".qvs,.txt,.qvw"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            handleFolderUpload(files);
          }
        }}
        className="hidden"
        aria-label="Upload Qlik repository folder"
      />

      <main className="container max-w-7xl mx-auto px-4 py-6">
        {/* Repository Files */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* Repository Files */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <h2 className="text-sm font-semibold text-foreground">Qlik Repository</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {repositoryFiles.size} files
              </span>
            </div>
            <div className="h-[400px]">
              <div className="border rounded-lg p-4 bg-muted/20 h-full overflow-y-auto">
                {repositoryFiles.size === 0 ? (
                  <div className="text-center text-muted-foreground">
                    <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Import a Qlik repository folder</p>
                    <p className="text-xs mt-1">Files will be divided into semantic chunks</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from(repositoryFiles.entries()).map(([fileName, content]) => (
                      <div key={fileName} className="flex items-center justify-between p-2 bg-background rounded border">
                        <span className="text-sm font-medium">{fileName}</span>
                        <span className="text-xs text-muted-foreground">
                          {content.split("\n").filter(l => l.trim()).length} lines
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Extracted Chunks */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <h2 className="text-sm font-semibold text-foreground">Extracted Chunks</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                {chunks.length} chunks
              </span>
            </div>
            <div className="h-[400px]">
              <div className="border rounded-lg p-4 bg-muted/20 h-full overflow-y-auto">
                {chunks.length === 0 ? (
                  <div className="text-center text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Chunks will appear here after conversion</p>
                    <p className="text-xs mt-1">Each file is divided into semantic chunks</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chunks.map((chunk, index) => (
                      <div key={index} className="p-2 bg-background rounded border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-primary">{chunk.type.toUpperCase()}</span>
                          <span className="text-xs text-muted-foreground">
                            {chunk.fileName}:{chunk.startLine}-{chunk.endLine}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {chunk.content.replace(/\n/g, ' ').substring(0, 100)}...
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* PySpark Output */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary" />
              <h2 className="text-sm font-semibold text-foreground">PySpark Output</h2>
            </div>
            <div className="flex items-center gap-2">
              {pysparkCode && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4" />
                  </Button>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                {pysparkCode.split("\n").filter(l => l.trim()).length} lines
              </span>
            </div>
          </div>
          <div className="h-[300px]">
            <CodeEditor
              value={pysparkCode}
              onChange={() => {}}
              language="python"
              readOnly
            />
          </div>
        </div>

        {/* Convert Button */}
        <div className="flex justify-center mb-6">
          <Button
            size="lg"
            className="gradient-bg text-primary-foreground px-8 gap-2 shadow-lg hover:shadow-xl transition-shadow"
            onClick={handleConvert}
            disabled={isConverting || repositoryFiles.size === 0}
          >
            {isConverting ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Convert to PySpark
              </>
            )}
          </Button>
        </div>

        {/* Diagnostics Panel */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            onClick={() => setShowDiagnostics(!showDiagnostics)}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Diagnostics</h3>
              {diagnostics.length > 0 && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {diagnostics.length}
                </span>
              )}
            </div>
            {showDiagnostics ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showDiagnostics && (
            <div className="p-4 pt-0">
              <ErrorPanel diagnostics={diagnostics} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Converter;
