import { NextResponse } from 'next/server';

export interface ValidationResult {
  valid: boolean;
  error?: NextResponse;
  missingKeys?: string[];
}

export function validateApiKeys(requiredKeys: string[]): ValidationResult {
  const missingKeys: string[] = [];
  
  for (const key of requiredKeys) {
    if (!process.env[key]) {
      missingKeys.push(key);
    }
  }
  
  if (missingKeys.length > 0) {
    return {
      valid: false,
      missingKeys,
      error: NextResponse.json(
        { 
          error: 'Missing required API configuration',
          details: `Missing environment variables: ${missingKeys.join(', ')}`,
          suggestion: 'Please configure the required API keys in your .env file'
        },
        { status: 503 }
      )
    };
  }
  
  return { valid: true };
}

export function validateAIProvider(): ValidationResult {
  const hasAIGateway = !!process.env.AI_GATEWAY_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  
  if (!hasAIGateway && !hasOpenAI && !hasAnthropic && !hasGroq && !hasGemini) {
    return {
      valid: false,
      error: NextResponse.json(
        {
          error: 'No AI provider configured',
          details: 'At least one AI provider API key is required',
          suggestion: 'Please configure AI_GATEWAY_API_KEY or individual provider keys (OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, GEMINI_API_KEY)'
        },
        { status: 503 }
      )
    };
  }
  
  return { valid: true };
}
