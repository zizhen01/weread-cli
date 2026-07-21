import { Command } from "commander";
import { WereadClient, WereadError, SKILL_VERSION, type GatewayParams } from "./client.js";
import { compactMode, jsonMode, outputLimit } from "./options.js";
import { jsonView, printJson, printResult, type FormatOptions } from "./format.js";

export const MAX_FETCH_PAGES = 50;

export function withClient<T extends unknown[]>(
  handler: (this: Command, client: WereadClient, ...args: T) => Promise<void>
): (this: Command, ...args: T) => Promise<void> {
  return async function (...args: T) {
    const client = new WereadClient();
    await handler.apply(this, [client, ...args]);
  };
}

export async function runCall(
  command: Command,
  client: WereadClient,
  apiName: string,
  params: GatewayParams,
  formatter?: (data: unknown, options: FormatOptions) => string,
  defaultLimit?: number
): Promise<void> {
  try {
    const result = await client.call(apiName, params);
    if (jsonMode(command)) {
      const view = jsonView(apiName, result.data, compactMode(command));
      printJson({
        ...result,
        data: view.data,
        ...(view.items !== undefined ? { items: view.items, totalCount: view.totalCount } : {}),
        ...(view.empty_reason ? { empty_reason: view.empty_reason } : {})
      });
    } else printResult(result, formatter, displayOptions(command, defaultLimit));
  } catch (error) {
    if (error instanceof WereadError) {
      printFailure(error.failure, jsonMode(command));
      process.exitCode = error.exitCode;
      return;
    }
    throw error;
  }
}

export async function printSynthetic(
  command: Command,
  apiName: string,
  data: unknown,
  formatter: (data: unknown, options: FormatOptions) => string,
  defaultLimit?: number
): Promise<void> {
  if (jsonMode(command)) {
    const view = jsonView(apiName, data, compactMode(command));
    printJson({
      ok: true,
      api_name: apiName,
      skill_version: SKILL_VERSION,
      data: view.data,
      ...(view.items !== undefined ? { items: view.items, totalCount: view.totalCount } : {}),
      ...(view.empty_reason ? { empty_reason: view.empty_reason } : {})
    });
    return;
  }
  printResult({ ok: true, api_name: apiName, skill_version: SKILL_VERSION, data }, formatter, displayOptions(command, defaultLimit));
}

export function displayOptions(command: Command, defaultLimit?: number): FormatOptions {
  return { limit: defaultLimit === undefined ? undefined : outputLimit(command.optsWithGlobals<{ limit?: string; all?: boolean }>(), defaultLimit) };
}

export function printFailure(failure: unknown, asJson = true): void {
  if (asJson) {
    printJson(failure);
    return;
  }
  const message =
    failure && typeof failure === "object" && "error" in failure
      ? ((failure as { error?: { message?: string } }).error?.message ?? "Command failed")
      : "Command failed";
  process.stderr.write(`${message}\n`);
}

export function arrayField(value: unknown, key: string): unknown[] {
  const raw = objectField(value, key);
  return Array.isArray(raw) ? raw : [];
}

export function numberField(value: unknown, key: string): number | undefined {
  const raw = objectField(value, key);
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

export function objectField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function withOutputOptions(command: Command): Command {
  return command
    .option("--limit <n>", "maximum human-readable items to print")
    .option("--all", "print all returned items in human-readable output")
    .option("--compact", "with --json, emit compact agent-friendly items where supported");
}
