export interface CodeChunk {
  id: string;
  type: 'load' | 'transform' | 'config' | 'include' | 'comment' | 'unknown';
  content: string;
  startLine: number;
  endLine: number;
  dependencies: string[];
  context: string;
}

export interface ChunkingResult {
  chunks: CodeChunk[];
  diagnostics: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
  }>;
}

export function chunkQlikScript(qlikScript: string): ChunkingResult {
  const lines = qlikScript.split('\n');
  const chunks: CodeChunk[] = [];
  const diagnostics: ChunkingResult['diagnostics'] = [];

  let currentChunk: Partial<CodeChunk> | null = null;
  let braceCount = 0;
  let inString = false;
  let stringChar = '';
  let chunkId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Handle string literals
    if (inString) {
      if (trimmedLine.includes(stringChar)) {
        inString = false;
        stringChar = '';
      }
      currentChunk!.content += line + '\n';
      continue;
    }

    // Check for string start
    if ((trimmedLine.includes('"') || trimmedLine.includes("'")) && !inString) {
      const quoteMatch = trimmedLine.match(/["']/);
      if (quoteMatch) {
        inString = true;
        stringChar = quoteMatch[0];
      }
    }

    // Handle brace counting for complex expressions
    const openBraces = (line.match(/\(/g) || []).length;
    const closeBraces = (line.match(/\)/g) || []).length;
    braceCount += openBraces - closeBraces;

    // Detect chunk boundaries
    const isNewChunk = detectChunkStart(trimmedLine);

    if (isNewChunk && currentChunk) {
      // Finalize previous chunk
      finalizeChunk(currentChunk, chunks, chunkId++, lines);
      currentChunk = null;
    }

    if (!currentChunk) {
      // Start new chunk
      currentChunk = {
        id: '',
        type: determineChunkType(trimmedLine),
        content: '',
        startLine: i + 1,
        dependencies: [],
        context: ''
      };
    }

    // Add line to current chunk
    currentChunk.content += line + '\n';

    // Check for chunk end (semicolon or end of statement)
    if (trimmedLine.endsWith(';') && braceCount === 0 && !inString) {
      finalizeChunk(currentChunk, chunks, chunkId++, lines);
      currentChunk = null;
    }
  }

  // Finalize last chunk
  if (currentChunk) {
    finalizeChunk(currentChunk, chunks, chunkId++, lines);
  }

  // Post-process chunks for dependencies and context
  postProcessChunks(chunks, diagnostics);

  return { chunks, diagnostics };
}

function detectChunkStart(line: string): boolean {
  const chunkStarters = [
    /^SET\s+/i,
    /^LET\s+/i,
    /^LOAD/i,
    /^SELECT/i,
    /^FROM/i,
    /^JOIN/i,
    /^LEFT JOIN/i,
    /^INNER JOIN/i,
    /^OUTER JOIN/i,
    /^DROP\s+TABLE/i,
    /^STORE/i,
    /^CALL/i,
    /^\$\(include/i,
    /^\$\(must_include/i,
    /^\/\/\s*SECTION/i,
    /^\/\//i
  ];

  return chunkStarters.some(pattern => pattern.test(line));
}

function determineChunkType(line: string): CodeChunk['type'] {
  if (/^SET\s+/i.test(line)) return 'config';
  if (/^LET\s+/i.test(line)) return 'config';
  if (/^LOAD/i.test(line)) return 'load';
  if (/^\$\(include/i.test(line)) return 'include';
  if (/^\/\//i.test(line)) return 'comment';
  if (/^(SELECT|JOIN|DROP|STORE|CALL)/i.test(line)) return 'transform';
  return 'unknown';
}

function finalizeChunk(
  chunk: Partial<CodeChunk>,
  chunks: CodeChunk[],
  id: number,
  lines: string[]
): void {
  if (!chunk.content?.trim()) return;

  chunk.id = `chunk_${id}`;
  chunk.endLine = chunk.startLine + chunk.content.split('\n').length - 1;

  // Extract dependencies
  chunk.dependencies = extractDependencies(chunk.content);

  // Add context based on chunk type
  chunk.context = generateContext(chunk as CodeChunk, chunks);

  chunks.push(chunk as CodeChunk);
}

function extractDependencies(content: string): string[] {
  const dependencies: string[] = [];

  // Extract table references from RESIDENT, JOIN, etc.
  const residentMatch = content.match(/RESIDENT\s+(\w+)/gi);
  if (residentMatch) {
    residentMatch.forEach(match => {
      const table = match.replace(/RESIDENT\s+/i, '');
      dependencies.push(table);
    });
  }

  // Extract includes
  const includeMatch = content.match(/\$\(include\s*=\s*([^)]+)\)/gi);
  if (includeMatch) {
    includeMatch.forEach(match => {
      const file = match.match(/\$\(include\s*=\s*([^)]+)\)/i)?.[1];
      if (file) dependencies.push(file.replace(/['"]/g, ''));
    });
  }

  return [...new Set(dependencies)];
}

function generateContext(chunk: CodeChunk, allChunks: CodeChunk[]): string {
  const contextParts: string[] = [];

  // Add previous table definitions for context
  if (chunk.type === 'load' || chunk.type === 'transform') {
    const previousTables = allChunks
      .filter(c => c.type === 'load' && c.endLine < chunk.startLine)
      .map(c => extractTableName(c.content))
      .filter(Boolean);

    if (previousTables.length > 0) {
      contextParts.push(`Available tables: ${previousTables.join(', ')}`);
    }
  }

  // Add dependency context
  if (chunk.dependencies.length > 0) {
    contextParts.push(`Depends on: ${chunk.dependencies.join(', ')}`);
  }

  return contextParts.join('. ') || 'General Qlik script conversion';
}

function extractTableName(content: string): string | null {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*$/);
    if (match) return match[1];
  }
  return null;
}

function postProcessChunks(chunks: CodeChunk[], diagnostics: ChunkingResult['diagnostics']): void {
  // Validate dependencies exist
  const definedTables = new Set<string>();

  chunks.forEach(chunk => {
    if (chunk.type === 'load') {
      const tableName = extractTableName(chunk.content);
      if (tableName) definedTables.add(tableName);
    }
  });

  chunks.forEach(chunk => {
    chunk.dependencies.forEach(dep => {
      if (!definedTables.has(dep) && !dep.includes('.qvs') && !dep.includes('.txt')) {
        diagnostics.push({
          type: 'warning',
          message: `Dependency '${dep}' not found in current script`,
          line: chunk.startLine
        });
      }
    });
  });

  // Add chunk count info
  diagnostics.push({
    type: 'info',
    message: `Script divided into ${chunks.length} semantic chunks`
  });
}
