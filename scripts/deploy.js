#!/usr/bin/env node

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function deploy() {
  try {
    // Get commit message from user
    const commitMessage = await new Promise((resolve) => {
      rl.question('Enter commit message: ', (answer) => {
        resolve(answer.trim());
      });
    });

    if (!commitMessage) {
      console.error('❌ Commit message cannot be empty!');
      process.exit(1);
    }

    console.log('🚀 Starting deployment process...\n');

    // Step 1: Add all changes
    console.log('📦 Adding changes to git...');
    execSync('git add .', { stdio: 'inherit' });
    console.log('✅ Changes added\n');

    // Step 2: Commit with the provided message
    console.log('💾 Committing changes...');
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    console.log('✅ Changes committed\n');

    // Step 3: Push to deploy on Vercel
    console.log('🚀 Pushing to deploy on Vercel...');
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('✅ Changes pushed and deployment triggered!\n');

    console.log('🎉 Deployment process completed! Vercel will now deploy your changes.');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

deploy();