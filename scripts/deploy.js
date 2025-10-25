#!/usr/bin/env node

const { exec } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// =========================
// Cinematic Silent Progress Bar
// =========================
class SilentProgressBar {
  constructor(totalSteps, options = {}) {
    this.totalSteps = totalSteps;
    this.currentStep = 0;
    this.barLength = options.length || 50; // width of the bar
    this.completeChar = options.completeChar || "█";
    this.incompleteChar = options.incompleteChar || "─";
    this.intervalTime = options.interval || 100;
    this.i = 0;
    this.animationInterval = null;
  }

  start() {
    // Start automatic progress animation
    this.animationInterval = setInterval(() => {
      const progress = this.currentStep / this.totalSteps;
      const completeLength = Math.round(this.barLength * progress);
      const incompleteLength = this.barLength - completeLength;
      const bar =
        this.completeChar.repeat(completeLength) +
        this.incompleteChar.repeat(incompleteLength);

      const percent = Math.round(progress * 100);
      process.stdout.write(`\r[${bar}] ${percent}%`);
    }, this.intervalTime);
  }

  increment() {
    if (this.currentStep < this.totalSteps) this.currentStep++;
  }

  complete() {
    this.currentStep = this.totalSteps;
    const bar = this.completeChar.repeat(this.barLength);
    process.stdout.write(`\r[${bar}] 100%\n`);
    clearInterval(this.animationInterval);
  }
}

// =========================
// Run Command Async (Suppress Output)
// =========================
function runCommandSilent(command) {
  return new Promise((resolve, reject) => {
    const child = exec(command, { stdio: "ignore" }, (error) => {
      if (error) return reject(error);
      resolve();
    });
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

    if (!commitMessage) process.exit(1);

    const stages = [
      "git add .",
      `git commit -m "${commitMessage}"`,
      "git push origin main"
    ];

    const progressBar = new SilentProgressBar(stages.length, { length: 50, interval: 80 });
    progressBar.start();

    for (const stage of stages) {
      await runCommandSilent(stage);
      progressBar.increment();
    }

    progressBar.complete();

  } catch {
    process.exit(1);
  } finally {
    rl.close();
  }
}

deploy();
