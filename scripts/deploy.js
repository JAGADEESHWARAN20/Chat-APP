#!/usr/bin/env node

const { exec } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// =========================
// XL Smooth Premium Dotted Circle Spinner (Minimal & Elegant)
// =========================
function createCircleSpinner(text) {
  const frames = [
    "          ● ● ●          ",
    "      ●           ●      ",
    "    ●               ●    ",
    "   ●                 ●   ",
    "   ●                 ●   ",
    "    ●               ●    ",
    "      ●           ●      ",
    "          ● ● ●          "
  ].map(f => `\x1b[1m${f}\x1b[0m`); // bold dots

  let i = 0;

  process.stdout.write("\n");

  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[i = ++i % frames.length]} ${text}`);
  }, 150); // 150ms per frame

  return {
    stop(finalText) {
      clearInterval(interval);
      process.stdout.write(`\r✅ ${finalText}\n`);
    }
  };
}

// =========================
// Helper function to run commands async
// =========================
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = exec(command, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || stderr);
    });

    // Pipe stdout/stderr to terminal
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

// =========================
// Deployment Script
// =========================
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
    const spinner1 = createCircleSpinner("Adding changes to git...");
    await runCommand("git add .");
    spinner1.stop("Changes added!");

    // Step 2: Git Commit
    const spinner2 = createCircleSpinner("Committing changes...");
    await runCommand(`git commit -m "${commitMessage}"`);
    spinner2.stop("Changes committed!");

    // Step 3: Git Push
    const spinner3 = createCircleSpinner("Pushing to Vercel...");
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
