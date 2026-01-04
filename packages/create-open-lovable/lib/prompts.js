export function getPrompts(config) {
  const prompts = [];

  if (!config.name) {
    prompts.push({
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'my-open-lovable',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      }
    });
  }

  prompts.push({
    type: 'confirm',
    name: 'configureEnv',
    message: 'Would you like to configure API keys now?',
    default: true
  });

  return prompts;
}

export function getEnvPrompts(provider) {
  const prompts = [];

  // Always include Firecrawl API key
  prompts.push({
    type: 'input',
    name: 'firecrawlApiKey',
    message: 'Firecrawl API key (for web scraping):',
    validate: (input) => {
      if (!input || input.trim() === '') {
        return 'Firecrawl API key is required for web scraping functionality';
      }
      return true;
    }
  });

  if (provider === 'vercel') {
    prompts.push({
      type: 'list',
      name: 'vercelAuthMethod',
      message: 'Vercel authentication method:',
      choices: [
        {
          name: 'OIDC Token (automatic in Vercel environment)',
          value: 'oidc',
          short: 'OIDC'
        },
        {
          name: 'Personal Access Token',
          value: 'pat',
          short: 'PAT'
        }
      ]
    });

    prompts.push({
      type: 'input',
      name: 'vercelTeamId',
      message: 'Vercel Team ID:',
      when: (answers) => answers.vercelAuthMethod === 'pat',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Team ID is required for PAT authentication';
        }
        return true;
      }
    });

    prompts.push({
      type: 'input',
      name: 'vercelProjectId',
      message: 'Vercel Project ID:',
      when: (answers) => answers.vercelAuthMethod === 'pat',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Project ID is required for PAT authentication';
        }
        return true;
      }
    });

    prompts.push({
      type: 'input',
      name: 'vercelToken',
      message: 'Vercel Access Token:',
      when: (answers) => answers.vercelAuthMethod === 'pat',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Access token is required for PAT authentication';
        }
        return true;
      }
    });
  }

  // Optional AI provider keys
  prompts.push({
    type: 'confirm',
    name: 'addAiKeys',
    message: 'Would you like to add AI provider API keys?',
    default: true
  });

  prompts.push({
    type: 'checkbox',
    name: 'aiProviders',
    message: 'Select AI providers to configure:',
    when: (answers) => answers.addAiKeys,
    choices: [
      { name: 'Anthropic (Claude)', value: 'anthropic' },
      { name: 'OpenAI (GPT)', value: 'openai' },
      { name: 'Google (Gemini)', value: 'gemini' },
      { name: 'Groq', value: 'groq' }
    ]
  });

  prompts.push({
    type: 'input',
    name: 'anthropicApiKey',
    message: 'Anthropic API key:',
    when: (answers) => answers.aiProviders && answers.aiProviders.includes('anthropic')
  });

  prompts.push({
    type: 'input',
    name: 'openaiApiKey',
    message: 'OpenAI API key:',
    when: (answers) => answers.aiProviders && answers.aiProviders.includes('openai')
  });

  prompts.push({
    type: 'input',
    name: 'geminiApiKey',
    message: 'Gemini API key:',
    when: (answers) => answers.aiProviders && answers.aiProviders.includes('gemini')
  });

  prompts.push({
    type: 'input',
    name: 'groqApiKey',
    message: 'Groq API key:',
    when: (answers) => answers.aiProviders && answers.aiProviders.includes('groq')
  });

  return prompts;
}