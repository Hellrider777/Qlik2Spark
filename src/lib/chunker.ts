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

    // Skip empty lines and comment-only lines
    if (!trimmedLine || isCommentLine(trimmedLine)) continue;

    // Handle string literals
    if (inString) {
      if (trimmedLine.includes(stringChar)) {
        inString = false;
        stringChar = '';
      }
      if (currentChunk) {
        currentChunk.content += line + '\n';
      }
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

    // Detect significant chunk boundaries (major operations only)
    const isNewChunk = detectSignificantChunkStart(trimmedLine, currentChunk);

    if (isNewChunk && currentChunk && currentChunk.content?.trim()) {
      // Finalize previous chunk only if it has meaningful content
      finalizeChunk(currentChunk, chunks, chunkId++, lines);
      currentChunk = null;
    }

    if (!currentChunk) {
      // Start new chunk for non-comment statements
      const chunkType = determineChunkType(trimmedLine);
      if (chunkType !== 'comment') {
        currentChunk = {
          id: '',
          type: chunkType,
          content: '',
          startLine: i + 1,
          dependencies: [],
          context: ''
        };
      }
    }

    // Add line to current chunk
    if (currentChunk) {
      currentChunk.content += line + '\n';
    }

    // Only end chunk on significant statement boundaries
    // Keep related statements together (LOAD + FROM + WHERE + other clauses)
    if (shouldEndChunk(trimmedLine, braceCount, inString, i, lines)) {
      if (currentChunk && currentChunk.content?.trim()) {
        finalizeChunk(currentChunk, chunks, chunkId++, lines);
        currentChunk = null;
      }
    }
  }

  // Finalize last chunk
  if (currentChunk && currentChunk.content?.trim()) {
    finalizeChunk(currentChunk, chunks, chunkId++, lines);
  }

  // Post-process chunks for dependencies and context
  postProcessChunks(chunks, diagnostics);

  return { chunks, diagnostics };
}

// Helper to check if a line is just a comment
function isCommentLine(line: string): boolean {
  return /^\/\//.test(line) || /^\/\*/.test(line) || /^\*/.test(line);
}

// Helper to determine if we should end the current chunk
function shouldEndChunk(line: string, braceCount: number, inString: boolean, lineIndex: number, allLines: string[]): boolean {
  // Don't end if we're in a string or have unmatched braces
  if (inString || braceCount > 0) return false;
  
  // Don't end on semicolon - keep statements together
  // Only end when we see a major section boundary ahead
  
  // Look ahead to see if next significant line starts a new major section
  for (let i = lineIndex + 1; i < allLines.length; i++) {
    const nextLine = allLines[i].trim();
    if (!nextLine || isCommentLine(nextLine)) continue;
    
    // If next line starts a new major section, end current chunk
    return detectSignificantChunkStart(nextLine, null);
  }
  
  return false;
}

// Detect only significant chunk boundaries (major sections only)
function detectSignificantChunkStart(line: string, currentChunk: Partial<CodeChunk> | null): boolean {
  // Only break on major section boundaries - minimal chunking strategy
  const majorSectionStarters = [
    /^\w+:\s*$/,          // Table labels (e.g., "TableName:") - primary section boundary
    /^\$\(include/i,      // Include files - separate file imports
    /^\$\(must_include/i, // Must include files
    /^SUB\s+/i,           // Subroutine definitions - separate code blocks
    /^ENDSUB/i            // End subroutine
  ];

  // Don't break on continuation keywords (these should stay with LOAD)
  const continuationKeywords = [
    /^FROM\s/i,
    /^WHERE\s/i,
    /^RESIDENT\s/i,
    /^JOIN\s/i,
    /^LEFT\s+JOIN/i,
    /^INNER\s+JOIN/i,
    /^OUTER\s+JOIN/i,
    /^RIGHT\s+JOIN/i,
    /^ORDER\s+BY/i,
    /^GROUP\s+BY/i,
    /^LOAD\s/i,           // LOAD continues previous table section
    /^SET\s+/i,           // SET continues with other statements
    /^LET\s+/i,           // LET continues with other statements
    /^STORE\s+/i,         // STORE continues with other statements
    /^DROP\s+/i,          // DROP continues with other statements
    /^CALL\s+/i           // CALL continues with other statements
  ];

  // Never break on continuation keywords
  if (continuationKeywords.some(pattern => pattern.test(line))) {
    return false;
  }

  // Only break if we're starting a major section
  const isMajorSection = majorSectionStarters.some(pattern => pattern.test(line));
  
  // If we have a current chunk, only break if starting a new major section
  if (currentChunk && currentChunk.content) {
    return isMajorSection;
  }
  
  return isMajorSection;
}

function determineChunkType(line: string): CodeChunk['type'] {
  if (/^SET\s+/i.test(line)) return 'config';
  if (/^LET\s+/i.test(line)) return 'config';
  if (/^LOAD\s/i.test(line)) return 'load';
  if (/^\$\(include/i.test(line)) return 'include';
  if (/^(DROP|STORE|CALL|SUB|ENDSUB)/i.test(line)) return 'transform';
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
