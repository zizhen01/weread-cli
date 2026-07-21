import { Command } from "commander";
import { collectParam, parseBodyJson, parseParams } from "../options.js";
import { withClient, runCall } from "../helpers.js";

export function registerApiCommands(program: Command): void {
  const api = program.command("api").description("Low-level official API commands");

  api
    .command("list")
    .description("List supported APIs via /_list")
    .action(withClient(async function (client) {
      await runCall(this, client, "/_list", {});
    }));

  api
    .command("call <apiName>")
    .description("Call any supported API with flattened parameters")
    .option("--body-json <json>", "JSON object merged into the request body")
    .option("--param <key=value>", "flattened parameter; may be repeated", collectParam, [])
    .action(withClient(async function (client, apiName: string, opts: { bodyJson?: string; param?: string[] }) {
      const params = { ...parseBodyJson(opts.bodyJson), ...parseParams(opts.param) };
      await runCall(this, client, apiName, params);
    }));
}
