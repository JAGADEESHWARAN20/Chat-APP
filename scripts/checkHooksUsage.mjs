// scripts/checkHooksUsage.mjs
import fs from "fs";
import path from "path";

const projectRoot = process.cwd();

// List your hooks: file name and main export name
const hooks = [
  { file: "use-media-query.ts",       exportName: "useMediaQuery" },
  { file: "use-mobile.tsx",           exportName: "useIsMobile" },
  { file: "useActiveUsers.ts",        exportName: "useActiveUsers" },
  { file: "useAuthSync.tsx",          exportName: "useAuthSync" },
  { file: "useConnectionManager.ts",  exportName: "useConnectionManager" },
  { file: "useMembershipRealtime.ts", exportName: "useMembershipRealtime" },
  { file: "useNotificationHandler.ts",exportName: "useNotificationHandler" },
  { file: "usePerformanceOptimizations.ts", exportName: "useThrottledCallback" }, // also has useDebouncedCallback
  { file: "usePresence.ts",           exportName: "usePresence" },
  { file: "useRoomActions.tsx",       exportName: "useRoomActions" },
  { file: "useRoomMessages.tsx",      exportName: "useRoomMessages" },
  { file: "useRoomPresence.ts",       exportName: "useRoomPresenceSync" },
  { file: "useTypingStatus.ts",       exportName: "useTypingStatus" },
];

// Walk all source files recursively, skipping heavy build dirs
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "dist", "build"].includes(entry.name)) continue;
      walk(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function fileContains(filePath, patterns) {
  const content = fs.readFileSync(filePath, "utf8");
  return patterns.some((p) => content.includes(p));
}

function main() {
  const allFiles = walk(projectRoot);

  for (const hook of hooks) {
    const importPath = `@/hooks/${hook.file.replace(/\.tsx?$/, "")}`;
    const patterns = [
      `from "${importPath}"`,
      `from '${importPath}'`,
      hook.exportName,
    ];

    let usedIn = [];

    for (const f of allFiles) {
      if (f.endsWith(path.join("hooks", hook.file))) continue; // skip its own file
      if (fileContains(f, patterns)) {
        usedIn.push(path.relative(projectRoot, f));
      }
    }

    if (usedIn.length > 0) {
      console.log(`USED   - ${hook.file} (${hook.exportName})`);
      console.log(`         in: ${[...new Set(usedIn)].join(", ")}`);
    } else {
      console.log(`UNUSED - ${hook.file} (${hook.exportName})`);
    }
  }
}

main();
