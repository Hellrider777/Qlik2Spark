import { useState, useCallback } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onFileContent: (content: string, fileName: string) => void;
}

const FileUpload = ({ onFileContent }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (file.name.endsWith('.qvs') || file.name.endsWith('.txt') || file.name.endsWith('.qvw')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileContent(content, file.name);
        setFileName(file.name);
      };
      reader.readAsText(file);
    }
  }, [onFileContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearFile = () => {
    setFileName(null);
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
        isDragging
          ? "border-primary bg-primary/5"
          : fileName
          ? "border-green-500/50 bg-green-500/5"
          : "border-border hover:border-primary/50"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        accept=".qvs,.txt,.qvw"
        onChange={handleInputChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${fileName ? "bg-green-500/10" : "bg-muted"}`}>
          <Upload className={`w-4 h-4 ${fileName ? "text-green-600" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          {fileName ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Drop .qvs or .txt file here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
