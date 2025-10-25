#!/usr/bin/env node

const { exec } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// =========================
// Spinner Class (High-quality XL Circle)
// =========================
class CircleSpinner {
  constructor(text, options = {}) {
    this.text = text;
    this.frames = options.frames || [
      "          ● ● ●          ",
      "      ●           ●      ",
      "    ●               ●    ",
      "   ●                 ●   ",
      "   ●                 ●   ",
      "    ●               ●    ",
      "      ●           ●      ",
      "          ● ● ●          "
    ];
    this.frames = this.frames.map(f => `\x1b[1m${f}\x1b[0m`); // bold
    this.intervalTime = options.interval || 100;
    this.i = 0;
  }

  start() {
    process.stdout.write("\n");
    this.interval = setInterval(() => {
      process.stdout.write(`\r${this.frames[this.i = ++this.i % this.frames.length]} ${this.text}`);
    }, this.intervalTime);
  }

  stop(finalText) {
    clearInterval(this.interval);
    process.stdout.write(`\r✅ ${finalText}\n`);
  }
}

// =========================
// Run Command Async
// =========================
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = exec(command, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve(stdout || stderr);
    });
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
    const spinner1 = new CircleSpinner("Adding changes to git...");
    spinner1.start();
    await runCommand("git add .");
    spinner1.stop("Changes added!");

    // Step 2: Git Commit
    const spinner2 = new CircleSpinner("Committing changes...");
    spinner2.start();
    await runCommand(`git commit -m "${commitMessage}"`);
    spinner2.stop("Changes committed!");

    // Step 3: Git Push
    const spinner3 = new CircleSpinner("Pushing to Vercel...");
    spinner3.start();
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
