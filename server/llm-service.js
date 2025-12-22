import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function convertQlikChunk(qlikCode, context) {
  console.log('\n🔄 [LLM Service] Starting conversion...');
  console.log(`📝 Input length: ${qlikCode.length} chars`);
  console.log(`📍 Context: ${context || 'none'}`);

  try {
    console.log('🤖 Initializing Gemini model: gemini-pro');
    const model = genAI.getGenerativeModel({
      model: 'gemini-pro',
    });

    const prompt = `You are an expert ETL developer specializing in converting Qlik Sense scripts to PySpark code.

Your task is to convert Qlik script chunks to equivalent PySpark DataFrame operations.

Guidelines:
- Convert LOAD statements to PySpark DataFrame operations
- Handle data sources (CSV, Excel, QVD, databases)
- Convert Qlik expressions to PySpark SQL expressions
- Maintain table relationships and dependencies
- Use appropriate PySpark functions and methods
- Include proper error handling
- Add comments explaining the conversion
- Return only the PySpark code, no explanations outside code

Context: ${context || 'General Qlik to PySpark conversion'}

Qlik Script to convert:
${qlikCode}`;

    console.log('🚀 Sending request to Gemini API...');
    const startTime = Date.now();

    const result = await model.generateContent(prompt);

    const duration = Date.now() - startTime;
    console.log(`✅ Received response in ${duration}ms`);

    const response = result.response;
    const code = response.text().trim();

    console.log(`📤 Generated code length: ${code.length} chars`);

    return {
      success: true,
      code,
      usage: {
        promptTokens: Math.ceil(prompt.length / 4),
        completionTokens: Math.ceil(code.length / 4),
        totalTokens: Math.ceil((prompt.length + code.length) / 4),
      },
    };
  } catch (error) {
    console.error('❌ [LLM Service] Conversion error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
    });
    return {
      success: false,
      error: error.message || 'Unknown LLM error',
    };
  }
}
