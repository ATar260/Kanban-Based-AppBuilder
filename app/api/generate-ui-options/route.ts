import { NextRequest, NextResponse } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { validateAIProvider } from '@/lib/api-validation';
import { appConfig } from '@/config/app.config';

export const dynamic = 'force-dynamic';

const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : process.env.OPENAI_BASE_URL,
});

interface UIOption {
  id: string;
  name: string;
  description: string;
  style: string;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  layout: string;
  features: string[];
  previewPrompt: string;
}

const UI_OPTIONS_PROMPT = `You are a UI/UX designer generating 3 distinct visual design options for a web application.

Given the user's description, create 3 VERY DIFFERENT design approaches. Each should be visually distinct and appeal to different tastes.

For each option provide:
- id: "option-1", "option-2", "option-3"
- name: A catchy name for the style (e.g., "Modern Minimal", "Bold & Vibrant", "Elegant Classic")
- description: 2-3 sentences describing the visual approach
- style: One of [modern, playful, professional, artistic, minimalist, bold, elegant, futuristic]
- colorScheme: Object with primary, secondary, accent, background, text (hex colors)
- layout: Brief description of layout approach (e.g., "Centered hero with asymmetric sections")
- features: Array of 3-4 visual features (e.g., "Glassmorphism cards", "Gradient backgrounds")
- previewPrompt: A detailed prompt to generate a preview image of this design

Make the 3 options VERY DIFFERENT from each other:
- Option 1: Should be clean, professional, safe choice
- Option 2: Should be bold, creative, attention-grabbing
- Option 3: Should be unique, artistic, memorable

Return ONLY valid JSON:
{
  "options": [...]
}`;

export async function POST(request: NextRequest) {
  const validation = validateAIProvider();
  if (!validation.valid) {
    return validation.error;
  }

  try {
    const { prompt, context } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const modelId = appConfig.ai.defaultModel.replace('openai/', '');
    const { text } = await generateText({
      model: openai(modelId),
      messages: [
        { role: 'system', content: UI_OPTIONS_PROMPT },
        { 
          role: 'user', 
          content: `Generate 3 UI design options for: ${prompt}${context ? `\n\nAdditional context: ${context}` : ''}` 
        }
      ],
      temperature: 0.8,
      maxOutputTokens: 2000,
    });

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Failed to parse UI options' }, { status: 500 });
    }

    const options: UIOption[] = (parsed.options || []).map((opt: any, index: number) => ({
      id: opt.id || `option-${index + 1}`,
      name: opt.name || `Option ${index + 1}`,
      description: opt.description || '',
      style: opt.style || 'modern',
      colorScheme: opt.colorScheme || {
        primary: '#3B82F6',
        secondary: '#6366F1',
        accent: '#F59E0B',
        background: '#FFFFFF',
        text: '#1F2937',
      },
      layout: opt.layout || 'Standard layout',
      features: opt.features || [],
      previewPrompt: opt.previewPrompt || '',
    }));

    return NextResponse.json({ options });
  } catch (error: any) {
    console.error('[generate-ui-options] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
