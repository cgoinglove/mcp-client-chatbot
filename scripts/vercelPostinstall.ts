import { exec } from "child_process";
import { IS_VERCEL } from "lib/const";
import { promisify } from "util";

const execPromise = promisify(exec);

// Only run migrations on Vercel
if (!IS_VERCEL) {
  console.log("Not running on Vercel, skipping database migration.");
  process.exit(0);
}

async function runMigrate() {
  try {
    const { stdout, stderr } = await execPromise(
      "pnpm db:migrate && pnpm initial:flag-generate",
      {
        cwd: process.cwd(),
        env: process.env,
      },
    );

    console.log("Database migration output:");
    console.log(stdout);

    if (stderr) {
      console.error("Database migration stderr:");
      console.error(stderr);
    }
  } catch (error: any) {
    console.error("Database migration error:", error);
    process.exit(1);
  }
}

runMigrate();
