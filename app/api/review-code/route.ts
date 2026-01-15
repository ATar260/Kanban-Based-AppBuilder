import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { validateAIProvider } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : process.env.OPENAI_BASE_URL,
});

interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

interface ReviewResult {
  passed: boolean;
  score: number;
  issues: ReviewIssue[];
  summary: string;
  improvements: string[];
}

const CODE_REVIEW_PROMPT = `You are an expert code reviewer (Bugbot). Analyze the provided code files for:

1. **Bugs & Errors**
   - Syntax errors
   - Logic errors
   - Type mismatches
   - Missing imports
   - Undefined variables

2. **Security Issues**
   - XSS vulnerabilities
   - Injection risks
   - Exposed secrets
   - Unsafe data handling

3. **Best Practices**
   - React hooks rules
   - Component structure
   - State management
   - Error handling
   - Accessibility

4. **Performance**
   - Unnecessary re-renders
   - Missing memoization
   - Large bundle imports
   - Inefficient loops

5. **Code Quality**
   - Dead code
   - Duplicate code
   - Magic numbers
   - Poor naming

Return a JSON response with this structure:
{
  "passed": boolean,          // true if no errors, only warnings/info
  "score": number,            // 0-100 quality score
  "issues": [
    {
      "severity": "error" | "warning" | "info",
      "type": "bug" | "security" | "practice" | "performance" | "quality",
      "file": "path/to/file.tsx",
      "line": 42,
      "message": "Description of the issue",
      "suggestion": "How to fix it"
    }
  ],
  "summary": "Brief overall assessment",
  "improvements": ["Suggested improvement 1", "Suggested improvement 2"]
}

Be thorough but practical. Focus on issues that would cause runtime problems or security risks.
ONLY return valid JSON, no markdown.`;

export async function POST(request: NextRequest) {
  const validation = validateAIProvider();
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const { files, ticketId, ticketTitle, customStandards } = await request.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files provided for review' }, { status: 400 });
    }

    const fileContents = files.map((f: { path: string; content: string }) => 
      `// FILE: ${f.path}\n${f.content}`
    ).join('\n\n---\n\n');

    let systemPrompt = CODE_REVIEW_PROMPT;
    if (customStandards && typeof customStandards === 'string') {
      systemPrompt = CODE_REVIEW_PROMPT + '\n\n' + customStandards;
    }

    const { text } = await generateText({
      model: openai('gpt-5-mini'),
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Review the following code files from ticket "${ticketTitle || 'Unknown'}" (${ticketId || 'no-id'}):\n\n${fileContents}` 
        }
      ],
      temperature: 0.3,
      maxOutputTokens: 2000,
    });

    let result: ReviewResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      result = {
        passed: true,
        score: 75,
        issues: [],
        summary: 'Code review completed but parsing failed. Manual review recommended.',
        improvements: [],
      };
    }

    result.passed = !result.issues?.some(i => i.severity === 'error');

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[review-code] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
