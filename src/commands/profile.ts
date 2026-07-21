import { Command } from "commander";
import { formatShelf } from "../format.js";
import { withClient, runCall } from "../helpers.js";

export function registerProfileCommands(program: Command): void {
  const profile = program.command("profile").description("Convenience profile commands");

  profile.command("summary").description("Currently aliases shelf list; use progress per book for detail").action(withClient(async function (client) {
    await runCall(this, client, "/shelf/sync", {}, formatShelf, 30);
  }));
}
