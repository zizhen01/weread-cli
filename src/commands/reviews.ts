import { Command } from "commander";
import { compactParams, intOption } from "../options.js";
import { formatReviews } from "../format.js";
import { withClient, runCall } from "../helpers.js";

export function registerReviewsCommands(program: Command): void {
  const reviews = program.command("reviews").description("Public and single review APIs");

  reviews
    .command("list <bookId>")
    .description("Get /review/list")
    .option("--type <n>", "0 all, 1 recommended, 2 negative, 3 recent, 4 normal")
    .option("--count <n>", "page size")
    .option("--max-idx <n>", "pagination idx")
    .option("--synckey <n>", "pagination cursor")
    .option("--limit <n>", "maximum human-readable reviews to print")
    .option("--all", "print all returned reviews in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, bookId: string, opts: { type?: string; count?: string; maxIdx?: string; synckey?: string }) {
      await runCall(
        this,
        client,
        "/review/list",
        compactParams({
          bookId,
          reviewListType: intOption(opts.type, "--type"),
          count: intOption(opts.count, "--count"),
          maxIdx: intOption(opts.maxIdx, "--max-idx"),
          synckey: intOption(opts.synckey, "--synckey")
        }),
        formatReviews,
        30
      );
    }));

  reviews
    .command("single <reviewId>")
    .description("Get /review/single")
    .option("--comments-count <n>", "comment count")
    .option("--comments-direction <n>", "0 desc, 1 asc")
    .option("--likes-count <n>", "like count")
    .option("--likes-direction <n>", "like direction")
    .option("--synckey <n>", "sync key")
    .action(withClient(async function (client, reviewId: string, opts: Record<string, string | undefined>) {
      await runCall(
        this,
        client,
        "/review/single",
        compactParams({
          reviewId,
          commentsCount: intOption(opts.commentsCount, "--comments-count"),
          commentsDirection: intOption(opts.commentsDirection, "--comments-direction"),
          likesCount: intOption(opts.likesCount, "--likes-count"),
          likesDirection: intOption(opts.likesDirection, "--likes-direction"),
          synckey: intOption(opts.synckey, "--synckey")
        })
      );
    }));
}
