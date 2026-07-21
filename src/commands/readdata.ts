import { Command } from "commander";
import { compactParams, intOption, optionalString } from "../options.js";
import { formatReadData } from "../format.js";
import { withClient, runCall } from "../helpers.js";

export function registerReaddataCommands(program: Command): void {
  const readdata = program.command("readdata").description("Reading statistics");

  readdata
    .command("detail")
    .description("Get /readdata/detail")
    .option("--mode <mode>", "weekly|monthly|annually|overall")
    .option("--base-time <timestamp>", "Unix timestamp inside the target period")
    .option("--limit <n>", "maximum top reading records to print")
    .option("--all", "print all returned top reading records")
    .action(withClient(async function (client, opts: { mode?: string; baseTime?: string }) {
      await runCall(
        this,
        client,
        "/readdata/detail",
        compactParams({
          mode: optionalString(opts.mode),
          baseTime: intOption(opts.baseTime, "--base-time")
        }),
        formatReadData,
        10
      );
    }));

  readdata
    .command("summary")
    .description("Summarize reading statistics; defaults to monthly")
    .option("--mode <mode>", "weekly|monthly|annually|overall", "monthly")
    .option("--base-time <timestamp>", "Unix timestamp inside the target period")
    .option("--limit <n>", "maximum top reading records to print")
    .option("--all", "print all returned top reading records")
    .action(withClient(async function (client, opts: { mode?: string; baseTime?: string }) {
      await runCall(
        this,
        client,
        "/readdata/detail",
        compactParams({
          mode: optionalString(opts.mode),
          baseTime: intOption(opts.baseTime, "--base-time")
        }),
        formatReadData,
        10
      );
    }));
}
