import { Command } from "commander";
import { writeFileSync } from "node:fs";
import type { WereadClient } from "../client.js";
import { compactMode, compactParams, intOption, jsonMode, parseJsonValue, positiveIntOption } from "../options.js";
import { buildNotesExport, formatBookmarks, formatNotebooks, formatNotesTop, formatPopularBookmarks, formatReviews, markdownExport, printJson } from "../format.js";
import { withClient, runCall, printSynthetic, withOutputOptions, MAX_FETCH_PAGES, arrayField, numberField, objectField, isRecord } from "../helpers.js";

async function fetchAllNotebooks(client: WereadClient): Promise<unknown> {
  const books: unknown[] = [];
  let lastSort: number | undefined;
  let lastPage: unknown = {};
  for (let page = 0; page < MAX_FETCH_PAGES; page += 1) {
    const result = await client.call("/user/notebooks", compactParams({ count: 100, lastSort }));
    lastPage = result.data;
    const pageBooks = arrayField(result.data, "books");
    books.push(...pageBooks);
    const hasMore = objectField(result.data, "hasMore") === 1;
    const nextSort = numberField(pageBooks.at(-1), "sort");
    if (!hasMore || nextSort === undefined || nextSort === lastSort) break;
    lastSort = nextSort;
  }
  return { ...(isRecord(lastPage) ? lastPage : {}), books, totalBookCount: Math.max(numberField(lastPage, "totalBookCount") ?? 0, books.length) };
}

async function fetchAllMineReviews(client: WereadClient, bookId: string): Promise<unknown> {
  const reviews: unknown[] = [];
  let synckey: number | undefined;
  let lastPage: unknown = {};
  for (let page = 0; page < MAX_FETCH_PAGES; page += 1) {
    const result = await client.call("/review/list/mine", compactParams({ bookid: bookId, count: 100, synckey }));
    lastPage = result.data;
    const pageReviews = arrayField(result.data, "reviews");
    reviews.push(...pageReviews);
    const nextSynckey = numberField(result.data, "synckey");
    const hasMore = objectField(result.data, "hasMore") === 1 || (pageReviews.length > 0 && nextSynckey !== undefined && nextSynckey !== synckey);
    if (!hasMore) break;
    synckey = nextSynckey;
  }
  return { ...(isRecord(lastPage) ? lastPage : {}), reviews };
}

function sortNotebookData(data: unknown): unknown {
  const books = arrayField(data, "books").slice().sort((a, b) => noteTotal(b) - noteTotal(a));
  return { ...(isRecord(data) ? data : {}), books };
}

function limitNotebookData(data: unknown, limit: number): unknown {
  const books = arrayField(data, "books");
  return {
    ...(isRecord(data) ? data : {}),
    books: books.slice(0, limit),
    totalBookCount: Math.max(numberField(data, "totalBookCount") ?? 0, books.length)
  };
}

function noteTotal(item: unknown): number {
  return Number(objectField(item, "reviewCount") ?? 0) + Number(objectField(item, "noteCount") ?? 0) + Number(objectField(item, "bookmarkCount") ?? 0);
}

export function registerNotesCommands(program: Command): void {
  const notes = program.command("notes").description("Personal notes, highlights, and public highlight context");

  notes
    .command("notebooks")
    .description("Get /user/notebooks")
    .option("--count <n>", "page size")
    .option("--last-sort <n>", "pagination cursor from previous books[].sort")
    .option("--limit <n>", "maximum human-readable notebook books to print")
    .option("--all", "print all returned notebook books in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, opts: { count?: string; lastSort?: string }) {
      await runCall(
        this,
        client,
        "/user/notebooks",
        compactParams({
          count: intOption(opts.count, "--count"),
          lastSort: intOption(opts.lastSort, "--last-sort")
        }),
        formatNotebooks,
        50
      );
    }));

  withOutputOptions(notes.command("bookmarks <bookId>").description("Get /book/bookmarklist")).action(withClient(async function (client, bookId: string) {
    await runCall(this, client, "/book/bookmarklist", { bookId }, formatBookmarks, 80);
  }));

  notes
    .command("top")
    .description("Rank notebook books by personal highlight/note count")
    .option("--limit <n>", "maximum books to print", "20")
    .option("--all", "fetch and rank all notebook pages")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, opts: { limit?: string; all?: boolean }) {
      const limit = positiveIntOption(opts.limit, "--limit") ?? 20;
      const data = opts.all ? await fetchAllNotebooks(client) : (await client.call("/user/notebooks", { count: Math.max(limit, 100) })).data;
      const sorted = sortNotebookData(data);
      await printSynthetic(this, "/user/notebooks", limitNotebookData(sorted, limit), formatNotesTop);
    }));

  notes
    .command("export <bookId>")
    .description("Export one book's personal highlights and ideas")
    .option("--format <format>", "markdown|json", "markdown")
    .option("--output <path>", "write export to a file")
    .option("--all", "fetch all personal idea pages when pagination is available")
    .option("--compact", "omit lower-value fields from the export")
    .action(withClient(async function (client, bookId: string, opts: { format?: string; output?: string; all?: boolean; compact?: boolean }) {
      const format = opts.format ?? "markdown";
      if (format !== "markdown" && format !== "json") throw new Error("--format must be markdown or json");
      const [bookInfo, chapters, bookmarks, mine] = await Promise.all([
        client.call("/book/info", { bookId }),
        client.call("/book/chapterinfo", { bookId }),
        client.call("/book/bookmarklist", { bookId }),
        opts.all ? fetchAllMineReviews(client, bookId) : client.call("/review/list/mine", { bookid: bookId, count: 100 }).then((result) => result.data)
      ]);
      const exported = buildNotesExport(bookId, bookInfo.data, chapters.data, bookmarks.data, mine, Boolean(opts.compact || compactMode(this)));
      const content = format === "json" || jsonMode(this) ? `${JSON.stringify({ ok: true, data: exported }, null, 2)}\n` : markdownExport(exported);
      if (opts.output) {
        writeFileSync(opts.output, content, "utf8");
        const payload = { ok: true, path: opts.output, format, highlights: exported.highlights.length, ideas: exported.ideas.length };
        if (jsonMode(this)) printJson(payload);
        else process.stdout.write(`Wrote ${format} export to ${opts.output}\n`);
        return;
      }
      process.stdout.write(content);
    }));

  notes
    .command("mine <bookId>")
    .description("Get /review/list/mine")
    .option("--count <n>", "page size")
    .option("--synckey <n>", "pagination cursor")
    .option("--limit <n>", "maximum human-readable reviews to print")
    .option("--all", "print all returned reviews in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, bookId: string, opts: { count?: string; synckey?: string }) {
      await runCall(
        this,
        client,
        "/review/list/mine",
        compactParams({
          bookid: bookId,
          count: intOption(opts.count, "--count"),
          synckey: intOption(opts.synckey, "--synckey")
        }),
        formatReviews,
        30
      );
    }));

  notes
    .command("underlines <bookId> <chapterUid>")
    .description("Get /book/underlines")
    .option("--synckey <n>", "sync key")
    .action(withClient(async function (client, bookId: string, chapterUid: string, opts: { synckey?: string }) {
      await runCall(this, client, "/book/underlines", {
        bookId,
        chapterUid: intOption(chapterUid, "chapterUid"),
        synckey: intOption(opts.synckey, "--synckey")
      });
    }));

  notes
    .command("best <bookId>")
    .description("Get /book/bestbookmarks")
    .option("--chapter-uid <n>", "chapter UID; default all chapters")
    .option("--synckey <n>", "sync key")
    .option("--limit <n>", "maximum human-readable highlights to print")
    .option("--all", "print all returned highlights in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items")
    .action(withClient(async function (client, bookId: string, opts: { chapterUid?: string; synckey?: string }) {
      await runCall(
        this,
        client,
        "/book/bestbookmarks",
        compactParams({
          bookId,
          chapterUid: intOption(opts.chapterUid, "--chapter-uid"),
          synckey: intOption(opts.synckey, "--synckey")
        }),
        formatPopularBookmarks,
        80
      );
    }));

  notes
    .command("readreviews <bookId> <chapterUid>")
    .description("Get /book/readreviews for one or more highlight ranges")
    .requiredOption("--reviews-json <json>", "array of {range,maxIdx,count,synckey}")
    .action(withClient(async function (client, bookId: string, chapterUid: string, opts: { reviewsJson: string }) {
      const reviews = parseJsonValue(opts.reviewsJson, "--reviews-json");
      if (!Array.isArray(reviews)) throw new Error("--reviews-json must be a JSON array");
      await runCall(this, client, "/book/readreviews", {
        bookId,
        chapterUid: intOption(chapterUid, "chapterUid"),
        reviews
      });
    }));
}
