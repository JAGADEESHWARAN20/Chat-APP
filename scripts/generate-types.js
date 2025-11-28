// scripts/generate-types.js
const { exec } = require("child_process");
const path = require("path");
require("dotenv").config();

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;

if (!PROJECT_ID) {
  console.error("❌ ERROR: SUPABASE_PROJECT_ID missing in .env file");
  process.exit(1);
}

console.log(`🔄 Generating Supabase types for project: ${PROJECT_ID}`);

const command = `npx supabase gen types typescript --project-id ${PROJECT_ID} --schema public > lib/types/supabase.ts`;

exec(command, { cwd: path.join(__dirname, "..") }, (err, stdout, stderr) => {
  if (err) {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  }

  if (stderr) console.error(stderr);

  console.log("✅ Types successfully updated → lib/types/supabase.ts");
});
