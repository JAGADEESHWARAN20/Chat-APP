#!/usr/bin/env node

const { exec } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// =========================
// Premium Progress Bar Class
// =========================
class ProgressBar {
  constructor(totalSteps, options = {}) {
    this.totalSteps = totalSteps;
    this.currentStep = 0;
    this.barLength = options.length || 40; // width of the progress bar
    this.completeChar = options.completeChar || "█";
    this.incompleteChar = options.incompleteChar || "─";
  }

  increment(stepText = "") {
    this.currentStep++;
    const progress = this.currentStep / this.totalSteps;
    const completeLength = Math.round(this.barLength * progress);
    const incompleteLength = this.barLength - completeLength;

    const bar =
      this.completeChar.repeat(completeLength) +
      this.incompleteChar.repeat(incompleteLength);

    const percent = Math.round(progress * 100);

    process.stdout.write(`\r[${bar}] ${percent}% ${stepText}`);
  }

  complete(finalText = "") {
    this.currentStep = this.totalSteps;
    const bar = this.completeChar.repeat(this.barLength);
    process.stdout.write(`\r[${bar}] 100% ${finalText}\n`);
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

    console.log("\n🚀 Starting deployment process...\n");

    const stages = [
      { command: "git add .", label: "Adding changes to git..." },
      { command: `git commit -m "${commitMessage}"`, label: "Committing changes..." },
      { command: "git push origin main", label: "Pushing to Vercel..." }
    ];

    const progressBar = new ProgressBar(stages.length, { length: 50, completeChar: "█", incompleteChar: "─" });

    for (const stage of stages) {
      progressBar.increment(stage.label);
      await runCommand(stage.command);
    }

    progressBar.complete("Deployment finished successfully! 🎉\n");

    console.log("\n🎉 Deployment completed! Vercel is now building your app.\n");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

deploy();
