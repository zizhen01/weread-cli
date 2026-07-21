import { Command } from "commander";
import { compactParams, intOption, optionalString } from "../options.js";
import { formatRecommendations } from "../format.js";
import { withClient, runCall } from "../helpers.js";

export function registerDiscoverCommands(program: Command): void {
  const discover = program.command("discover").description("Book recommendations");

  discover
    .command("recommend")
    .description("Get /book/recommend")
    .option("--count <n>", "page size")
    .option("--max-idx <n>", "pagination offset")
    .option("--limit <n>", "maximum human-readable recommendations to print")
    .option("--all", "print all returned recommendations in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, opts: { count?: string; maxIdx?: string }) {
      await runCall(
        this,
        client,
        "/book/recommend",
        compactParams({
          count: intOption(opts.count, "--count"),
          maxIdx: intOption(opts.maxIdx, "--max-idx")
        }),
        formatRecommendations,
        30
      );
    }));

  discover
    .command("similar <bookId>")
    .description("Get /book/similar")
    .option("--count <n>", "page size")
    .option("--max-idx <n>", "pagination offset")
    .option("--session-id <id>", "pagination sessionId")
    .option("--limit <n>", "maximum human-readable recommendations to print")
    .option("--all", "print all returned recommendations in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, bookId: string, opts: { count?: string; maxIdx?: string; sessionId?: string }) {
      await runCall(
        this,
        client,
        "/book/similar",
        compactParams({
          bookId,
          count: intOption(opts.count, "--count"),
          maxIdx: intOption(opts.maxIdx, "--max-idx"),
          sessionId: optionalString(opts.sessionId)
        }),
        formatRecommendations,
        30
      );
    }));
}
