import { Command } from "commander";
import { outputLimit } from "../options.js";
import { formatShelf, formatShelfRecent } from "../format.js";
import { withClient, runCall, printSynthetic, withOutputOptions, arrayField, numberField, objectField, isRecord } from "../helpers.js";

function sortShelfRecentData(data: unknown, limit: number | undefined): unknown {
  const books = arrayField(data, "books").slice().sort((a, b) => recentTimestamp(b) - recentTimestamp(a));
  return {
    ...(isRecord(data) ? data : {}),
    books: limit === undefined ? books : books.slice(0, limit),
    totalBookCount: Math.max(numberField(data, "totalBookCount") ?? 0, books.length)
  };
}

function recentTimestamp(book: unknown): number {
  for (const key of ["lastReadTime", "readUpdateTime", "updateTime", "finishReadingTime", "sort"]) {
    const value = objectField(book, key);
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function registerShelfCommands(program: Command): void {
  const shelf = program.command("shelf").description("Shelf management");

  withOutputOptions(shelf.command("list").description("Get /shelf/sync")).action(withClient(async function (client) {
    await runCall(this, client, "/shelf/sync", {}, formatShelf, 30);
  }));

  withOutputOptions(shelf.command("recent").description("Show recently read or updated shelf books")).action(withClient(async function (client) {
    const result = await client.call("/shelf/sync", {});
    const limit = outputLimit(this.optsWithGlobals<{ limit?: string; all?: boolean }>(), 10);
    const data = sortShelfRecentData(result.data, limit);
    await printSynthetic(this, "/shelf/recent", data, formatShelfRecent);
  }));
}
