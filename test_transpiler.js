// Simple test script for transpiler
import { transpileQlikToPySpark, sampleQlikScript } from './src/lib/transpiler.ts';

console.log('Testing transpiler with sample script...');

const result = transpileQlikToPySpark(sampleQlikScript);

console.log('Diagnostics:');
result.diagnostics.forEach(d => {
  console.log(`[${d.type.toUpperCase()}] Line ${d.line}: ${d.message}`);
});

console.log('\nGenerated PySpark code:');
console.log(result.code);
