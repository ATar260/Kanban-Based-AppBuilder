#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { fileURLToPath } from 'url';
import { installer } from './lib/installer.js';
import { getPrompts } from './lib/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('create-open-lovable')
  .description('Create a new Open Lovable project')
  .version('1.0.0')
  .option('-n, --name <name>', 'Project name')
  .option('-p, --path <path>', 'Installation path (defaults to current directory)')
  .option('--skip-install', 'Skip npm install')
  .option('--dry-run', 'Run without making changes')
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log(chalk.cyan('\n🚀 Welcome to Open Lovable Setup!\n'));

  let config = {
    name: options.name || 'my-open-lovable',
    path: options.path || process.cwd(),
    skipInstall: options.skipInstall || false,
    dryRun: options.dryRun || false
  };

  const prompts = getPrompts(config);
  const answers = await inquirer.prompt(prompts);
  config = { ...config, ...answers };

  console.log(chalk.gray('\nConfiguration:'));
  console.log(chalk.gray(`  Project: ${config.name}`));
  console.log(chalk.gray(`  Path: ${path.resolve(config.path, config.name)}\n`));

  if (config.dryRun) {
    console.log(chalk.yellow('🔍 Dry run mode - no files will be created\n'));
  }

  const spinner = ora('Creating project...').start();

  try {
    await installer({
      ...config,
      templatesDir: path.join(__dirname, 'templates')
    });

    spinner.succeed('Project created successfully!');

    console.log(chalk.green('\n✅ Setup complete!\n'));
    console.log(chalk.white('Next steps:'));
    console.log(chalk.gray(`  1. cd ${config.name}`));
    console.log(chalk.gray(`  2. Copy .env.example to .env and add your API keys`));
    console.log(chalk.gray(`  3. npm run dev`));
    console.log(chalk.gray('\nHappy coding! 🎉\n'));

  } catch (error) {
    spinner.fail('Setup failed');
    console.error(chalk.red('\n❌ Error:'), error.message);
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('Unexpected error:'), error);
  process.exit(1);
});