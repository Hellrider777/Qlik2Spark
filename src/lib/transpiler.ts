// Qlik to PySpark transpiler with LLM-powered chunk processing
// Uses semantic chunking and GPT-4 for accurate conversion

import { llmClient, LLMResponse } from './llm-client';
import { chunkQlikScript, CodeChunk } from './chunker';

interface TranspileResult {
  code: string;
  diagnostics: Array<{
    type: "error" | "warning" | "info" | "success";
    message: string;
    line?: number;
    chunkId?: string;
  }>;
}

interface RepositoryFile {
  path: string;
  content: string;
  dependencies: string[];
  dependents: string[];
}

interface RepositoryResult {
  modules: Map<string, TranspileResult>;
  mainScript: string;
  dependencyGraph: Map<string, RepositoryFile>;
  diagnostics: Array<{
    type: "error" | "warning" | "info" | "success";
    message: string;
    file?: string;
    line?: number;
  }>;
}

// Constants for line limits and splitting
const maxLinesPerOperation = 50;
const maxFieldsPerLoad = 20;

function splitIntoStatements(qlikScript: string): string[] {
  const statements: string[] = [];
  let currentStatement = "";
  let braceCount = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < qlikScript.length; i++) {
    const char = qlikScript[i];
    const nextChar = qlikScript[i + 1] || '';

    if (inString) {
      currentStatement += char;
      if (char === stringChar && nextChar !== stringChar) {
        inString = false;
        stringChar = '';
      }
    } else {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        currentStatement += char;
      } else if (char === '(' || char === '[' || char === '{') {
        braceCount++;
        currentStatement += char;
      } else if (char === ')' || char === ']' || char === '}') {
        braceCount--;
        currentStatement += char;
      } else if (char === ';' && braceCount === 0) {
        currentStatement += char;
        statements.push(currentStatement.trim());
        currentStatement = "";
      } else {
        currentStatement += char;
      }
    }
  }

  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

export async function transpileQlikToPySpark(qlikScript: string, asModule: boolean = false): Promise<TranspileResult> {
  const diagnostics: TranspileResult["diagnostics"] = [];

  // Try LLM-powered conversion first
  if (llmClient.isConfigured()) {
    try {
      diagnostics.push({ type: "info", message: "Using LLM-powered conversion" });

      // Chunk the Qlik script
      const chunkResult = chunkQlikScript(qlikScript);
      diagnostics.push(...chunkResult.diagnostics);

      const pysparkChunks: string[] = [];

      // Add header
      pysparkChunks.push("from pyspark.sql import SparkSession");
      pysparkChunks.push("from pyspark.sql.functions import col, lit, when, concat, upper, lower, trim");
      pysparkChunks.push("");
      pysparkChunks.push("# Initialize Spark Session");
      pysparkChunks.push('spark = SparkSession.builder.appName("Qlik2Spark").getOrCreate()');
      pysparkChunks.push("");

      // Process each chunk with LLM
      for (const chunk of chunkResult.chunks) {
        if (chunk.type === 'comment') {
          // Keep comments as-is
          pysparkChunks.push(chunk.content);
          continue;
        }

        try {
          const llmResponse = await llmClient.convertQlikChunk(chunk.content, chunk.context);

          if (llmResponse.success && llmResponse.code) {
            pysparkChunks.push(`# ${chunk.type.toUpperCase()}: ${chunk.id}`);
            pysparkChunks.push(llmResponse.code.trim());
            pysparkChunks.push("");

            // Add usage info if available
            if (llmResponse.usage) {
              diagnostics.push({
                type: "info",
                message: `Chunk ${chunk.id}: ${llmResponse.usage.promptTokens} prompt + ${llmResponse.usage.completionTokens} completion tokens`,
                chunkId: chunk.id
              });
            }
          } else {
            diagnostics.push({
              type: "error",
              message: `LLM conversion failed for chunk ${chunk.id}: ${llmResponse.error}`,
              chunkId: chunk.id
            });
            // Fallback to rule-based for this chunk
            const fallbackResult = transpileWithRules(chunk.content, false);
            pysparkChunks.push(`# ${chunk.type.toUpperCase()}: ${chunk.id} (fallback)`);
            pysparkChunks.push(fallbackResult.code.trim());
            pysparkChunks.push("");
          }
        } catch (error) {
          diagnostics.push({
            type: "error",
            message: `LLM processing error for chunk ${chunk.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            chunkId: chunk.id
          });
          // Fallback to rule-based for this chunk
          const fallbackResult = transpileWithRules(chunk.content, false);
          pysparkChunks.push(`# ${chunk.type.toUpperCase()}: ${chunk.id} (fallback)`);
          pysparkChunks.push(fallbackResult.code.trim());
          pysparkChunks.push("");
        }
      }

      if (asModule) {
        // Add execute function for module
        pysparkChunks.push("");
        pysparkChunks.push("def execute(spark):");
        pysparkChunks.push("    \"\"\"Execute this module's transformations\"\"\"");
        pysparkChunks.push("    # Module execution logic is embedded above");
        pysparkChunks.push("    pass");
      }

      // Check for errors
      const hasErrors = diagnostics.some(d => d.type === "error");
      if (!hasErrors) {
        diagnostics.unshift({ type: "success", message: "LLM-powered transpilation completed successfully" });
      }

      return {
        code: pysparkChunks.join("\n"),
        diagnostics
      };

    } catch (error) {
      diagnostics.push({
        type: "warning",
        message: `LLM processing failed, falling back to rule-based conversion: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  } else {
    diagnostics.push({ type: "info", message: "LLM not configured, using rule-based conversion" });
  }

  // Fallback to rule-based conversion
  const fallbackResult = transpileWithRules(qlikScript, asModule);
  diagnostics.push(...fallbackResult.diagnostics.filter(d => d.type !== "success")); // Avoid duplicate success messages

  return fallbackResult;
}

function transpileWithRules(qlikScript: string, asModule: boolean = false): TranspileResult {
  const diagnostics: TranspileResult["diagnostics"] = [];
  const statements = splitIntoStatements(qlikScript);
  const pysparkLines: string[] = [];

  // Track tables for lineage
  const tables = new Map<string, string>();

  // Add header
  pysparkLines.push("from pyspark.sql import SparkSession");
  pysparkLines.push("from pyspark.sql.functions import col, lit, when, concat, upper, lower, trim");
  pysparkLines.push("");
  pysparkLines.push("# Initialize Spark Session");
  pysparkLines.push('spark = SparkSession.builder.appName("Qlik2Spark").getOrCreate()');
  pysparkLines.push("");
  pysparkLines.push("# Rule-based conversion from Qlik script");
  pysparkLines.push("");

  let globalLineNum = 0;

  for (let stmt of statements) {
    const lines = stmt.split('\n');
    let inLoadStatement = false;
    let loadFields: string[] = [];
    let fromSource = "";
    let whereClause = "";
    let currentTable = "";
    let stmtStartLine = globalLineNum + 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      globalLineNum++;

      // Skip empty lines and comments
      if (!line || line.startsWith("//") || line.startsWith("REM ")) {
        continue;
      }

      // Handle SET statements
      if (line.toUpperCase().startsWith("SET ")) {
        const match = line.match(/SET\s+(\w+)\s*=\s*(.+);?/i);
        if (match) {
          pysparkLines.push(`# Configuration: ${match[1]} = ${match[2]}`);
          diagnostics.push({ type: "info", message: `SET statement converted to comment`, line: globalLineNum });
        }
        continue;
      }

      // Handle LET statements
      if (line.toUpperCase().startsWith("LET ")) {
        const match = line.match(/LET\s+(\w+)\s*=\s*(.+);?/i);
        if (match) {
          pysparkLines.push(`${match[1]} = ${convertExpression(match[2])}`);
        }
        continue;
      }

      // Handle table name definition (TableName:)
      const tableMatch = line.match(/^(\w+)\s*:/);
      if (tableMatch) {
        currentTable = tableMatch[0].replace(":", "").trim();
        continue;
      }

      // Handle LOAD statements
      if (line.toUpperCase().startsWith("LOAD")) {
        inLoadStatement = true;
        loadFields = [];
        const fieldsMatch = line.replace(/^LOAD\s*/i, "");
        if (fieldsMatch && fieldsMatch !== "*") {
          loadFields = fieldsMatch.split(",").map(f => f.trim()).filter(f => f);
        }
        continue;
      }

      // Continue collecting fields in LOAD
      if (inLoadStatement && !line.toUpperCase().startsWith("FROM") && !line.toUpperCase().startsWith("RESIDENT") && !line.toUpperCase().startsWith("WHERE") && !line.includes(";")) {
        if (!line.toUpperCase().startsWith("FROM") && !line.toUpperCase().startsWith("WHERE")) {
          loadFields.push(...line.replace(/,/g, " ").split(/\s+/).filter(f => f && f !== ","));
        }
      }

      // Handle FROM clause
      if (line.toUpperCase().startsWith("FROM ") || line.toUpperCase().includes(" FROM ")) {
        const fromMatch = line.match(/FROM\s+\[?([^\]\s;]+)\]?/i);
        if (fromMatch) {
          fromSource = fromMatch[1];
        }
      }

      // Handle RESIDENT clause
      if (line.toUpperCase().startsWith("RESIDENT ") || line.toUpperCase().includes(" RESIDENT ")) {
        const residentMatch = line.match(/RESIDENT\s+(\w+)/i);
        if (residentMatch) {
          fromSource = `RESIDENT:${residentMatch[1]}`;
        }
      }

      // Handle WHERE clause
      if (line.toUpperCase().startsWith("WHERE ") || line.toUpperCase().includes(" WHERE ")) {
        const whereMatch = line.match(/WHERE\s+(.+?)(?:;|$)/i);
        if (whereMatch) {
          whereClause = whereMatch[1];
        }
      }

      // End of statement (semicolon)
      if (line.includes(";") && inLoadStatement) {
        inLoadStatement = false;

        // Generate PySpark code
        const tableName = currentTable || `table_${globalLineNum}`;
        pysparkLines.push(`# Load: ${tableName}`);

        if (fromSource.startsWith("RESIDENT:")) {
          const sourceTable = fromSource.replace("RESIDENT:", "");
          if (tables.has(sourceTable)) {
            pysparkLines.push(`${tableName}_df = ${sourceTable}_df`);
          } else {
            pysparkLines.push(`${tableName}_df = ${sourceTable}_df  # Resident table reference`);
            diagnostics.push({ type: "warning", message: `Resident table '${sourceTable}' referenced before definition`, line: globalLineNum });
          }
        } else if (fromSource) {
          const cleanSource = fromSource.replace(/[\[\]]/g, "").replace(/\\/g, "/");
          if (cleanSource.endsWith(".qvd")) {
            pysparkLines.push(`${tableName}_df = spark.read.parquet("${cleanSource.replace(".qvd", ".parquet")}")`);
            diagnostics.push({ type: "info", message: `QVD file converted to Parquet path`, line: globalLineNum });
          } else if (cleanSource.endsWith(".csv")) {
            pysparkLines.push(`${tableName}_df = spark.read.csv("${cleanSource}", header=True, inferSchema=True)`);
          } else if (cleanSource.endsWith(".xlsx") || cleanSource.endsWith(".xls")) {
            pysparkLines.push(`${tableName}_df = spark.read.format("com.crealytics.spark.excel").load("${cleanSource}")`);
          } else {
            pysparkLines.push(`${tableName}_df = spark.read.format("jdbc").option("url", "${cleanSource}").load()`);
          }
        }

        // Add field selection
        if (loadFields.length > 0 && !loadFields.includes("*")) {
          const cleanFields = loadFields
            .filter(f => f && !f.includes("(") && f !== "as" && !f.includes("="))
            .map(f => `"${f.replace(/['"]/g, "")}"`)
            .join(", ");
          if (cleanFields) {
            pysparkLines.push(`${tableName}_df = ${tableName}_df.select(${cleanFields})`);
          }
        }

        // Add WHERE filter
        if (whereClause) {
          pysparkLines.push(`${tableName}_df = ${tableName}_df.filter("${convertWhereClause(whereClause)}")`);
        }

        pysparkLines.push("");
        tables.set(tableName, tableName);

        // Check for too many fields
        if (loadFields.length > maxFieldsPerLoad) {
          diagnostics.push({ type: "warning", message: `LOAD statement has ${loadFields.length} fields, exceeds max ${maxFieldsPerLoad}`, line: globalLineNum });
        }

        // Reset
        currentTable = "";
        loadFields = [];
        fromSource = "";
        whereClause = "";
      }

      // Handle DROP TABLE
      if (line.toUpperCase().startsWith("DROP TABLE ")) {
        const dropMatch = line.match(/DROP\s+TABLE\s+(\w+)/i);
        if (dropMatch) {
          pysparkLines.push(`# ${dropMatch[1]}_df.unpersist()  # DROP TABLE ${dropMatch[1]}`);
          diagnostics.push({ type: "info", message: `DROP TABLE converted to unpersist comment`, line: globalLineNum });
        }
      }

      // Handle JOIN
      if (line.toUpperCase().includes(" JOIN ")) {
        diagnostics.push({ type: "warning", message: `JOIN detected - manual review recommended`, line: globalLineNum });
      }

      // Handle unsupported operations
      if (line.toUpperCase().includes("CONCATENATE")) {
        diagnostics.push({ type: "warning", message: `CONCATENATE requires union() in PySpark`, line: globalLineNum });
      }

      if (line.toUpperCase().includes("APPLYMAP")) {
        diagnostics.push({ type: "warning", message: `APPLYMAP requires join() or mapping UDF in PySpark`, line: globalLineNum });
      }
    }

    // Check for too many lines in statement
    if (lines.length > maxLinesPerOperation) {
      diagnostics.push({ type: "warning", message: `Statement spans ${lines.length} lines, exceeds max ${maxLinesPerOperation}`, line: stmtStartLine });
    }
  }

  if (asModule) {
    // Add execute function for module
    pysparkLines.push("");
    pysparkLines.push("def execute(spark):");
    pysparkLines.push("    \"\"\"Execute this module's transformations\"\"\"");
    pysparkLines.push("    # Module execution logic is embedded above");
    pysparkLines.push("    pass");
  }

  // Add success message
  if (diagnostics.filter(d => d.type === "error").length === 0) {
    diagnostics.unshift({ type: "success", message: "Rule-based transpilation completed successfully" });
  }

  return {
    code: pysparkLines.join("\n"),
    diagnostics
  };
}

function convertExpression(expr: string): string {
  return expr
    .replace(/;$/, "")
    .replace(/&/g, "+")
    .replace(/'/g, '"')
    .trim();
}

function convertWhereClause(where: string): string {
  return where
    .replace(/=/g, "==")
    .replace(/<>/g, "!=")
    .replace(/AND/gi, "AND")
    .replace(/OR/gi, "OR")
    .replace(/'/g, "\\'")
    .trim();
}

// Repository processing with LLM-powered chunking
export async function transpileRepositoryToPySpark(repositoryFiles: Map<string, string>): Promise<RepositoryResult> {
  const modules = new Map<string, TranspileResult>();
  const dependencyGraph: Map<string, RepositoryFile> = new Map();
  const diagnostics: RepositoryResult['diagnostics'] = [];

  // Build dependency graph
  for (const [fileName, content] of repositoryFiles) {
    const dependencies: string[] = [];
    const dependents: string[] = [];

    // Extract includes
    const includeMatches = content.match(/\$\(include\s*=\s*([^)]+)\)/gi);
    if (includeMatches) {
      includeMatches.forEach(match => {
        const file = match.match(/\$\(include\s*=\s*([^)]+)\)/i)?.[1]?.replace(/['"]/g, '');
        if (file) dependencies.push(file);
      });
    }

    dependencyGraph.set(fileName, {
      path: fileName,
      content,
      dependencies,
      dependents
    });
  }

  // Build reverse dependencies
  for (const [fileName, fileInfo] of dependencyGraph) {
    fileInfo.dependencies.forEach(dep => {
      const depFile = dependencyGraph.get(dep);
      if (depFile) {
        depFile.dependents.push(fileName);
      }
    });
  }

  // Topological sort for processing order
  const processingOrder = topologicalSort(dependencyGraph);

  // Process each file
  for (const fileName of processingOrder) {
    const fileInfo = dependencyGraph.get(fileName)!;

    try {
      const result = await transpileQlikToPySpark(fileInfo.content, true);
      modules.set(fileName, result);

      // Add file-level diagnostics
      result.diagnostics.forEach(diag => {
        diagnostics.push({
          ...diag,
          file: fileName
        });
      });

      diagnostics.push({
        type: "success",
        message: `Processed ${fileName} successfully`,
        file: fileName
      });

    } catch (error) {
      diagnostics.push({
        type: "error",
        message: `Failed to process ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        file: fileName
      });
    }
  }

  // Generate main script
  const mainScript = generateMainScript(modules, dependencyGraph);

  return {
    modules,
    mainScript,
    dependencyGraph,
    diagnostics
  };
}

function topologicalSort(dependencyGraph: Map<string, RepositoryFile>): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function visit(fileName: string): void {
    if (visited.has(fileName)) return;
    if (visiting.has(fileName)) {
      throw new Error(`Circular dependency detected involving ${fileName}`);
    }

    visiting.add(fileName);

    const fileInfo = dependencyGraph.get(fileName)!;
    for (const dep of fileInfo.dependencies) {
      if (dependencyGraph.has(dep)) {
        visit(dep);
      }
    }

    visiting.delete(fileName);
    visited.add(fileName);
    order.push(fileName);
  }

  for (const fileName of dependencyGraph.keys()) {
    if (!visited.has(fileName)) {
      visit(fileName);
    }
  }

  return order;
}

function generateMainScript(modules: Map<string, TranspileResult>, dependencyGraph: Map<string, RepositoryFile>): string {
  const lines: string[] = [];

  lines.push("# Main execution script for Qlik2Spark repository");
  lines.push("from pyspark.sql import SparkSession");
  lines.push("");
  lines.push("# Initialize Spark Session");
  lines.push('spark = SparkSession.builder.appName("Qlik2Spark-Repository").getOrCreate()');
  lines.push("");

  // Import all modules
  for (const [fileName] of modules) {
    const moduleName = fileName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.qvs?$/, '');
    lines.push(`# Module: ${fileName}`);
    lines.push(`import ${moduleName}`);
    lines.push("");
  }

  lines.push("# Execute modules in dependency order");
  const processingOrder = topologicalSort(dependencyGraph);

  for (const fileName of processingOrder) {
    if (modules.has(fileName)) {
      const moduleName = fileName.replace(/[^a-zA-Z0-9_]/g, '_').replace(/\.qvs?$/, '');
      lines.push(`${moduleName}.execute(spark)`);
    }
  }

  lines.push("");
  lines.push("# Repository execution completed");
  lines.push('print("Qlik2Spark repository processing completed")');

  return lines.join('\n');
}

// Sample Qlik script for demo
export const sampleQlikScript = `// Sample Qlik Script - Qlik2Spark Demo
SET ThousandSep=',';
SET DecimalSep='.';

LET vToday = Today();

// Load Sales Data
Sales:
LOAD
    SalesID,
    ProductID,
    CustomerID,
    Quantity,
    UnitPrice,
    Quantity * UnitPrice as TotalAmount,
    SalesDate
FROM [lib://DataFiles/sales.qvd] (qvd)
WHERE Year(SalesDate) >= 2023;

// Load Product Master
Products:
LOAD
    ProductID,
    ProductName,
    Category,
    SubCategory
FROM [lib://DataFiles/products.csv]
(txt, codepage is 28591, embedded labels, delimiter is ',', msq);

// Create Summary Table
Summary:
LOAD
    ProductID,
    Sum(TotalAmount) as Revenue
RESIDENT Sales
GROUP BY ProductID;

DROP TABLE Sales;
`;
