#!/usr/bin/env node

const { exec: execCallback } = require("child_process");
const util = require("util");
const readline = require("readline");

// Promisify exec for a cleaner async/await syntax
const exec = util.promisify(execCallback);

// =========================
// ANSI Escape Codes
// =========================
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
  },
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
  },
  // Cursor/Line manipulation
  clearLine: "\x1b[2K", // Clears the current line
  cursorToStart: "\x1b[G", // Moves cursor to column 0
};

// =========================
// Cinematic Deployment Class
// =========================
class CinematicDeploy {
  constructor(commitMessage) {
    this.commitMessage = commitMessage;
    // Define the stages of deployment
    this.stages = [
      {
        name: "add",
        command: "git add .",
        title: "Scanning workspace...",
        color: c.fg.green,
      },
      {
        name: "commit",
        command: `git commit -m "${commitMessage}"`,
        title: "Writing commit...",
        color: c.fg.magenta,
      },
      {
        name: "push",
        command: "git push origin main",
        title: "Transmitting objects...",
        color: c.fg.blue,
      },
    ];

    this.animationInterval = null;
    this.frameIndex = 0;
    this.currentStageName = "";

    // Animation frames
    this.spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    this.waveFrames = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", " "];
    this.glitchChars = ["█", "▓", "▒", "█", "█", "█", "█", "▒", "▓", "█"];
  }

  /**
   * Starts the animation loop for a specific stage.
   * @param {string} stageName - The name of the stage (e.g., 'add')
   * @param {string} title - The text to display
   * @param {string} color - The ANSI color code
   */
  startAnimation(stageName, title, color) {
    this.currentStageName = stageName;
    this.frameIndex = 0;
    this.animationInterval = setInterval(() => {
      this.frameIndex++;
      const spinner =
        color +
        this.spinnerFrames[this.frameIndex % this.spinnerFrames.length] +
        c.reset;
      let animation = "";

      // Render a different "stunning effect" for each stage
      switch (stageName) {
        case "add":
          // Effect 1: File analysis count
          const files = Math.floor(Math.random() * 20) + this.frameIndex * 3;
          animation = `(${c.dim}${files} files analyzed${c.reset})`;
          break;

        case "commit":
          // Effect 2: Glitchy progress bar
          let bar = "";
          const length = 25;
          const percent = (this.frameIndex % (length + 1)) / length;
          const complete = Math.floor(length * percent);
          for (let i = 0; i < length; i++) {
            if (i < complete) {
              bar += this.glitchChars[
                Math.floor(Math.random() * this.glitchChars.length)
              ];
            } else {
              bar += c.fg.gray + "░" + c.reset;
            }
          }
          animation = `[${color}${bar}${c.reset}]`;
          break;

        case "push":
          // Effect 3: Data transmission wave
          const kbs = (
            Math.random() * 150 +
            800 +
            Math.sin(this.frameIndex * 0.1) * 100
          ).toFixed(1);
          const wave = this.waveFrames
            .map(
              (_, i) =>
                this.waveFrames[
                  (this.frameIndex + i) % this.waveFrames.length
                ]
            )
            .join("");
          animation = `${c.fg.gray}${wave.substring(0, 15)}${
            c.reset
          } (${c.dim}${kbs} KB/s${c.reset})`;
          break;
      }

      // Write the animation frame to the console
      process.stdout.write(
        c.clearLine +
          c.cursorToStart +
          `${spinner} ${c.bold}Processing:${c.reset} ${color}${title}${c.reset} ${animation}`
      );
    }, 80); // 80ms is a sweet spot for smooth animation
  }

  /**
   * Stops the animation and prints a success or failure message.
   * @param {string} stageName - The name of the stage
   * @param {string} title - The stage title
   * @param {string} color - The stage color
   * @param {boolean} [success=true] - Whether the stage was successful
   */
  stopAnimation(stageName, title, color, success = true) {
    clearInterval(this.animationInterval);
    process.stdout.write(c.clearLine + c.cursorToStart);

    if (success) {
      const check = c.fg.green + "✔" + c.reset;
      let detail = "";
      if (stageName === "commit") {
        detail = `: ${c.dim}${this.commitMessage}${c.reset}`;
      }
      console.log(`${check} ${c.bold}Complete:${c.reset} ${color}${title}${c.reset} ${detail}`);
    } else {
      const cross = c.fg.red + "✖" + c.reset;
      console.log(
        `${cross} ${c.bold}Failed:${c.reset} ${c.fg.red}Error during '${stageName}' stage.${c.reset}`
      );
    }
  }

  /**
   * Runs the entire deployment process.
   */
  async run() {
    console.log(c.bold + "🚀 Initiating cinematic deployment protocol..." + c.reset);
    try {
      for (const [index, stage] of this.stages.entries()) {
        const stageNum = `(Stage ${index + 1}/${this.stages.length})`;
        const title = `${stage.title} ${c.dim}${stageNum}${c.reset}`;
        
        this.startAnimation(stage.name, title, stage.color);

        // Run the command silently.
        // { stdio: 'ignore' } is the key to suppressing output.
        await exec(stage.command, { stdio: "ignore" });

        this.stopAnimation(stage.name, title, stage.color, true);
      }
      console.log(
        `\n${c.bold + c.fg.green}✅ Deployment Complete!${c.reset} ${
          c.italic
        }Your changes are live.${c.reset}`
      );
    } catch (error) {
      // Find the failed stage to report it
      const failedStage = this.stages.find(s => s.name === this.currentStageName);
      const title = `${failedStage.title} ${c.dim}(Stage ${
        this.stages.indexOf(failedStage) + 1
      }/${this.stages.length})${c.reset}`;

      this.stopAnimation(failedStage.name, title, failedStage.color, false);
      
      // Log the actual error from git
      console.error(
        `\n${c.bold + c.fg.red}Critical Error:${c.reset}\n${c.dim}(${
          error.cmd
        })${c.reset}\n${error.stderr || error.stdout}`
      );
      process.exit(1);
    }
  }
}

// =========================
// Main Execution
// =========================
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const commitMessage = await new Promise((resolve) => {
      rl.question(
        `📝 ${c.bold}Enter commit message:${c.reset} ${c.dim}(or leave blank to cancel)${c.reset} `,
        (answer) => resolve(answer.trim())
      );
    });

    if (!commitMessage) {
      console.log(c.fg.yellow + "\nDeployment cancelled by user." + c.reset);
      process.exit(0);
    }

    rl.close();

    // Start the show!
    const deployer = new CinematicDeploy(commitMessage);
    await deployer.run();
  } catch {
    rl.close();
    console.error(c.fg.red + "An unexpected error occurred." + c.reset);
    process.exit(1);
  }
}

main();
