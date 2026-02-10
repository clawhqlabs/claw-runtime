import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ShellResult {
  stdout: string;
  stderr: string;
}

export async function runShellCommand(
  command: string,
  args: string[] = [],
  cwd?: string
): Promise<ShellResult> {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd });
  return { stdout, stderr };
}
