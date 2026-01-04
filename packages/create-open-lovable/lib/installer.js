import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { getEnvPrompts } from './prompts.js';

export async function installer(config) {
  const { name, path: installPath, skipInstall, dryRun, templatesDir } = config;
  const projectPath = path.join(installPath, name);

  if (dryRun) {
    console.log(chalk.blue('\n📋 Dry run - would perform these actions:'));
    console.log(chalk.gray(`  - Create directory: ${projectPath}`));
    console.log(chalk.gray(`  - Copy base template files`));
    console.log(chalk.gray(`  - Copy vercel-specific files`));
    console.log(chalk.gray(`  - Create .env file`));
    if (!skipInstall) {
      console.log(chalk.gray(`  - Run npm install`));
    }
    return;
  }

  // Check if directory exists
  if (await fs.pathExists(projectPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${name} already exists. Overwrite?`,
      default: false
    }]);

    if (!overwrite) {
      throw new Error('Installation cancelled');
    }
    await fs.remove(projectPath);
  }

  // Create project directory
  await fs.ensureDir(projectPath);

  // Copy base template (shared files)
  const baseTemplatePath = path.join(templatesDir, 'base');
  if (await fs.pathExists(baseTemplatePath)) {
    await copyTemplate(baseTemplatePath, projectPath);
  } else {
    // If no base template exists yet, copy from the main project
    await copyMainProject(path.dirname(templatesDir), projectPath, sandbox);
  }

  // Copy vercel-specific template
  const providerTemplatePath = path.join(templatesDir, 'vercel');
  if (await fs.pathExists(providerTemplatePath)) {
    await copyTemplate(providerTemplatePath, projectPath);
  }

  // Configure environment variables
  if (config.configureEnv) {
    const envAnswers = await inquirer.prompt(getEnvPrompts('vercel'));
    await createEnvFile(projectPath, envAnswers);
  } else {
    // Create .env.example copy
    await createEnvExample(projectPath);
  }

  // Update package.json with project name
  await updatePackageJson(projectPath, name);


  // Install dependencies
  if (!skipInstall) {
    console.log(chalk.cyan('\n📦 Installing dependencies...'));
    execSync('npm install', {
      cwd: projectPath,
      stdio: 'inherit'
    });
  }
}

async function copyTemplate(src, dest) {
  const files = await fs.readdir(src);
  
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    const stat = await fs.stat(srcPath);
    
    if (stat.isDirectory()) {
      await fs.ensureDir(destPath);
      await copyTemplate(srcPath, destPath);
    } else {
      await fs.copy(srcPath, destPath, { overwrite: true });
    }
  }
}

async function copyMainProject(mainProjectPath, projectPath) {
  // Copy essential directories and files from the main project
  const itemsToCopy = [
    'app',
    'components',
    'config',
    'lib',
    'types',
    'public',
    'styles',
    '.eslintrc.json',
    '.gitignore',
    'next.config.js',
    'package.json',
    'tailwind.config.ts',
    'tsconfig.json',
    'postcss.config.mjs'
  ];

  for (const item of itemsToCopy) {
    const srcPath = path.join(mainProjectPath, '..', item);
    const destPath = path.join(projectPath, item);
    
    if (await fs.pathExists(srcPath)) {
      await fs.copy(srcPath, destPath, {
        overwrite: true,
        filter: (src) => {
          // Skip node_modules and .next
          if (src.includes('node_modules') || src.includes('.next')) {
            return false;
          }
          return true;
        }
      });
    }
  }
}

async function createEnvFile(projectPath, answers) {
  let envContent = '# Open Lovable Configuration\n\n';
  
  // Required keys
  envContent += `# REQUIRED - Web scraping for cloning websites\n`;
  envContent += `FIRECRAWL_API_KEY=${answers.firecrawlApiKey || 'your_firecrawl_api_key_here'}\n\n`;
  
  envContent += `# REQUIRED - Vercel Sandboxes\n`;
  if (answers.vercelAuthMethod === 'oidc') {
    envContent += `# Using OIDC authentication (automatic in Vercel environment)\n`;
  } else {
    envContent += `VERCEL_TEAM_ID=${answers.vercelTeamId || 'your_team_id'}\n`;
    envContent += `VERCEL_PROJECT_ID=${answers.vercelProjectId || 'your_project_id'}\n`;
    envContent += `VERCEL_TOKEN=${answers.vercelToken || 'your_access_token'}\n`;
  }
  envContent += '\n';
  
  // Optional AI provider keys
  envContent += `# OPTIONAL - AI Providers\n`;
  
  if (answers.anthropicApiKey) {
    envContent += `ANTHROPIC_API_KEY=${answers.anthropicApiKey}\n`;
  } else {
    envContent += `# ANTHROPIC_API_KEY=your_anthropic_api_key_here\n`;
  }
  
  if (answers.openaiApiKey) {
    envContent += `OPENAI_API_KEY=${answers.openaiApiKey}\n`;
  } else {
    envContent += `# OPENAI_API_KEY=your_openai_api_key_here\n`;
  }
  
  if (answers.geminiApiKey) {
    envContent += `GEMINI_API_KEY=${answers.geminiApiKey}\n`;
  } else {
    envContent += `# GEMINI_API_KEY=your_gemini_api_key_here\n`;
  }
  
  if (answers.groqApiKey) {
    envContent += `GROQ_API_KEY=${answers.groqApiKey}\n`;
  } else {
    envContent += `# GROQ_API_KEY=your_groq_api_key_here\n`;
  }
  
  await fs.writeFile(path.join(projectPath, '.env'), envContent);
  await fs.writeFile(path.join(projectPath, '.env.example'), envContent.replace(/=.+/g, '=your_key_here'));
}

async function createEnvExample(projectPath) {
  let envContent = '# Open Lovable Configuration\n\n';
  
  envContent += `# REQUIRED - Web scraping for cloning websites\n`;
  envContent += `# Get yours at https://firecrawl.dev\n`;
  envContent += `FIRECRAWL_API_KEY=your_firecrawl_api_key_here\n\n`;
  
  envContent += `# REQUIRED - Vercel Sandboxes\n`;
  envContent += `# Option 1: OIDC (automatic in Vercel environment)\n`;
  envContent += `# Option 2: Personal Access Token\n`;
  envContent += `VERCEL_TEAM_ID=your_team_id\n`;
  envContent += `VERCEL_PROJECT_ID=your_project_id\n`;
  envContent += `VERCEL_TOKEN=your_access_token\n\n`;
  
  envContent += `# OPTIONAL - AI Providers (need at least one)\n`;
  envContent += `# Get yours at https://console.anthropic.com\n`;
  envContent += `ANTHROPIC_API_KEY=your_anthropic_api_key_here\n\n`;
  envContent += `# Get yours at https://platform.openai.com\n`;
  envContent += `OPENAI_API_KEY=your_openai_api_key_here\n\n`;
  envContent += `# Get yours at https://aistudio.google.com/app/apikey\n`;
  envContent += `GEMINI_API_KEY=your_gemini_api_key_here\n\n`;
  envContent += `# Get yours at https://console.groq.com\n`;
  envContent += `GROQ_API_KEY=your_groq_api_key_here\n`;
  
  await fs.writeFile(path.join(projectPath, '.env.example'), envContent);
}

async function updatePackageJson(projectPath, name) {
  const packageJsonPath = path.join(projectPath, 'package.json');
  
  if (await fs.pathExists(packageJsonPath)) {
    const packageJson = await fs.readJson(packageJsonPath);
    packageJson.name = name;
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
  }
}

