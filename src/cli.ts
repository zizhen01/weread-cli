#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { WereadClient, WereadError, SKILL_VERSION } from "./client.js";
import { jsonMode } from "./options.js";
import { printJson } from "./format.js";
import { printFailure } from "./helpers.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerApiCommands } from "./commands/api.js";
import { registerBookCommands } from "./commands/book.js";
import { registerShelfCommands } from "./commands/shelf.js";
import { registerReaddataCommands } from "./commands/readdata.js";
import { registerNotesCommands } from "./commands/notes.js";
import { registerReviewsCommands } from "./commands/reviews.js";
import { registerDiscoverCommands } from "./commands/discover.js";
import { registerProfileCommands } from "./commands/profile.js";

const program = new Command();
const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

program
  .name("weread")
  .description("基于微信读书官方支持 API 的命令行工具")
  .version(packageJson.version)
  .option("--json", "emit JSON to stdout only")
  .option("--compact", "with --json, emit compact agent-friendly items where supported");

program
  .command("doctor")
  .description("Check local CLI configuration without making an authenticated API call")
  .action(async function () {
    const client = new WereadClient();
    const authConfigured = client.authConfigured();
    const payload = {
      ok: authConfigured,
      ...client.config(),
      hint: authConfigured ? "Ready." : "Set WEREAD_API_KEY=wrk-...",
      ...(!authConfigured
        ? {
            error: {
              type: "missing_auth",
              message: "WeRead API key is not configured. Run: weread config set-key <wrk-...>"
            }
          }
        : {})
    };
    if (jsonMode(this)) printJson(payload);
    else {
      process.stdout.write(
        [
          `Auth: ${payload.auth_configured ? "configured" : "missing"}`,
          `Base URL: ${payload.base_url}`,
          `Skill version: ${payload.skill_version}`,
          payload.hint
        ].join("\n") + "\n"
      );
    }
    if (!payload.ok) process.exitCode = 2;
  });

registerConfigCommands(program);
registerApiCommands(program);
registerBookCommands(program);
registerShelfCommands(program);
registerReaddataCommands(program);
registerNotesCommands(program);
registerReviewsCommands(program);
registerDiscoverCommands(program);
registerProfileCommands(program);

if (process.argv.length <= 2) {
  program.outputHelp();
} else {
  program.exitOverride();
  program.parseAsync(process.argv).catch((error: unknown) => {
    const commanderError = error as { code?: string; message?: string };
    if (
      commanderError.code === "commander.helpDisplayed" ||
      commanderError.code === "commander.version" ||
      commanderError.code === "commander.outputHelp" ||
      commanderError.message === "(outputHelp)"
    ) {
      return;
    }
    if (error instanceof WereadError) {
      printFailure(error.failure);
      process.exitCode = error.exitCode;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    printFailure({
      ok: false,
      skill_version: SKILL_VERSION,
      error: {
        type: "invalid_input",
        message
      }
    });
    process.exitCode = 1;
  });
}
