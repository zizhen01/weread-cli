import { Command } from "commander";
import { configPath, maskSecret, readConfig, updateConfig } from "../config.js";
import { intOption, jsonMode } from "../options.js";
import { printJson } from "../format.js";


export function registerConfigCommands(program: Command): void {
  const config = program.command("config").description("Manage local credentials and defaults in ~/.weread-cli");

  config
    .command("path")
    .description("Show the local config file path")
    .action(function () {
      const payload = { ok: true, path: configPath() };
      if (jsonMode(this)) printJson(payload);
      else process.stdout.write(`${payload.path}\n`);
    });

  config
    .command("list")
    .description("Show local config with secrets redacted")
    .action(function () {
      const stored = readConfig();
      const payload = {
        ok: true,
        path: configPath(),
        api_key_configured: Boolean(stored.apiKey),
        api_key_preview: maskSecret(stored.apiKey),
        base_url: stored.baseUrl ?? null,
        timeout_ms: stored.timeoutMs ?? null
      };
      if (jsonMode(this)) printJson(payload);
      else {
        process.stdout.write(
          [
            `Path: ${payload.path}`,
            `API key: ${payload.api_key_configured ? payload.api_key_preview : "not configured"}`,
            `Base URL: ${payload.base_url ?? "default"}`,
            `Timeout: ${payload.timeout_ms ?? "default"}`
          ].join("\n") + "\n"
        );
      }
    });

  config
    .command("set-key <apiKey>")
    .description("Store the WeRead API key in ~/.weread-cli/config.json")
    .action(function (apiKey: string) {
      if (!apiKey.startsWith("wrk-")) {
        throw new Error("API key should look like wrk-...");
      }
      const stored = updateConfig({ apiKey });
      const payload = {
        ok: true,
        path: configPath(),
        api_key_preview: maskSecret(stored.apiKey)
      };
      if (jsonMode(this)) printJson(payload);
      else process.stdout.write(`Saved API key to ${payload.path}\n`);
    });

  config
    .command("set-base-url <url>")
    .description("Store a custom API base URL")
    .action(function (url: string) {
      const stored = updateConfig({ baseUrl: url });
      const payload = { ok: true, path: configPath(), base_url: stored.baseUrl };
      if (jsonMode(this)) printJson(payload);
      else process.stdout.write(`Saved base URL to ${payload.path}\n`);
    });

  config
    .command("set-timeout <ms>")
    .description("Store request timeout in milliseconds")
    .action(function (ms: string) {
      const timeoutMs = intOption(ms, "ms");
      if (timeoutMs === undefined || timeoutMs <= 0) throw new Error("ms must be a positive integer");
      const stored = updateConfig({ timeoutMs });
      const payload = { ok: true, path: configPath(), timeout_ms: stored.timeoutMs };
      if (jsonMode(this)) printJson(payload);
      else process.stdout.write(`Saved timeout to ${payload.path}\n`);
    });
}
