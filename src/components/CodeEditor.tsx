import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  placeholder?: string;
}

const CodeEditor = ({ value, onChange, language = "sql", readOnly = false, placeholder }: CodeEditorProps) => {
  return (
    <div className="h-full w-full rounded-lg overflow-hidden border border-border bg-card">
      <Editor
        height="100%"
        language={language}
        value={value}
        onChange={(val) => onChange(val || "")}
        theme="vs-light"
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          readOnly,
          wordWrap: "on",
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "line",
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
      {!value && placeholder && (
        <div className="absolute top-3 left-14 text-muted-foreground text-sm pointer-events-none opacity-50">
          {placeholder}
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
