#!/usr/bin/env node

const { exec } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Rotating Bold Spinner Animation
function createSpinner(text) {
  const frames = ["◴", "◷", "◶", "◵"].map(f => `\x1b[1m${f}\x1b[0m`);
  let i = 0;

  process.stdout.write("\n");

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i = ++i % frames.length]} ${text}`);
  }, 120);

  return {
    stop(finalText) {
      clearInterval(interval);
      process.stdout.write(`\r✅ ${finalText}\n`);
    }
  };
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const process = exec(command, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || stderr);
    });
  });
}

async function deploy() {
  try {
    const commitMessage = await new Promise(resolve => {
      rl.question("📝 Enter commit message: ", answer => resolve(answer.trim()));
    });

    if (!commitMessage) {
      console.error("❌ Commit message cannot be empty!");
      process.exit(1);
    }

    console.log("\n🚀 Starting deployment process...");

    // Step 1: Git Add
    const spinner1 = createSpinner("Adding changes to git...");
    await runCommand("git add .");
    spinner1.stop("Changes added!");

    // Step 2: Git Commit
    const spinner2 = createSpinner("Committing changes...");
    await runCommand(`git commit -m "${commitMessage}"`);
    spinner2.stop("Changes committed!");

    // Step 3: Git Push
    const spinner3 = createSpinner("Pushing to Vercel...");
    await runCommand("git push origin main");
    spinner3.stop("Changes pushed & deployment triggered!");

    console.log("\n🎉 Deployment completed! Vercel is now building your app.\n");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

deploy();
