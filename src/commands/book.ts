import { Command } from "commander";
import { compactParams, intOption, outputLimit, scopeValue } from "../options.js";
import { formatBookInfo, formatBookResolve, formatChapters, formatProgress, formatSearch } from "../format.js";
import { withClient, runCall, withOutputOptions } from "../helpers.js";

export function registerBookCommands(program: Command): void {
  program
    .command("search <keyword>")
    .description("Search store content. Scope defaults to book when omitted by this CLI.")
    .option("--scope <scope>", "all|book|fiction|audio|author|fulltext|list|mp|article or numeric scope", "book")
    .option("--count <n>", "page size")
    .option("--max-idx <n>", "pagination offset from previous searchIdx")
    .option("--limit <n>", "maximum human-readable results to print")
    .option("--all", "print all returned results in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, keyword: string, opts: { scope?: string; count?: string; maxIdx?: string }) {
      await runCall(
        this,
        client,
        "/store/search",
        compactParams({
          keyword,
          scope: scopeValue(opts.scope),
          count: intOption(opts.count, "--count"),
          maxIdx: intOption(opts.maxIdx, "--max-idx")
        }),
        formatSearch,
        30
      );
    }));

  const book = program.command("book").description("Book information and reading progress");

  book.command("info <bookId>").description("Get /book/info").action(withClient(async function (client, bookId: string) {
    await runCall(this, client, "/book/info", { bookId }, formatBookInfo);
  }));

  withOutputOptions(book.command("chapters <bookId>").description("Get /book/chapterinfo")).action(withClient(async function (client, bookId: string) {
    await runCall(this, client, "/book/chapterinfo", { bookId }, formatChapters, 80);
  }));

  withOutputOptions(book.command("resolve <title>").description("Resolve a book title to likely bookId matches")).action(withClient(async function (client, title: string) {
    await runCall(this, client, "/store/search", { keyword: title, scope: scopeValue("book"), count: outputLimit(this.opts<{ limit?: string; all?: boolean }>(), 5) }, formatBookResolve, 5);
  }));

  book.command("progress <bookId>").description("Get /book/getprogress").action(withClient(async function (client, bookId: string) {
    await runCall(this, client, "/book/getprogress", { bookId }, formatProgress);
  }));
}
