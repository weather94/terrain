import { Command, flags } from "@oclif/command";
import * as path from "path";
import * as childProcess from "child_process";
import { cli } from "cli-ux";
import { Env, getEnv } from "../../lib/env";
import * as fs from "fs-extra";

export const task = async (fn: (env: Env) => Promise<void>) => {
  try {
    await fn(
      getEnv(
        process.env.configPath || "",
        process.env.keysPath || "",
        process.env.refsPath || "",
        process.env.network || ""
      )
    );
  } catch (err) {
    if (err instanceof Error) {
      cli.error(err);
    }
    if (typeof err === "string") {
      cli.error(err);
    }

    cli.error(`${err}`);
  }
};

export default class Run extends Command {
  static description = "run predefined task";

  static flags = {
    network: flags.string({ default: "localterra" }),
    "config-path": flags.string({ default: "config.terrain.json" }),
    "refs-path": flags.string({ default: "refs.terrain.json" }),
    "keys-path": flags.string({ default: "keys.terrain.js" }),
  };

  static args = [{ name: "task" }];

  fromCwd = (p: string) => path.join(process.cwd(), p);

  async run() {
    const { args, flags } = this.parse(Run);

    let scriptPaths;
    console.log(args.task);
    if (args.task === "all") {
      scriptPaths = fs
        .readdirSync("tasks")
        .filter((name) => parseInt(name.split("_")[0]));
    } else {
      const taskNums = args.task.split(",").map((num: string) => parseInt(num));
      scriptPaths = scriptPaths = fs
        .readdirSync("tasks")
        .filter((name) => taskNums.includes(parseInt(name.split("_")[0])));
    }
    console.log(`scriptPaths`, scriptPaths);

    for (let i = 0; i < scriptPaths.length; i++) {
      console.log(scriptPaths[i]);
      let scriptPath = this.fromCwd(`tasks/${scriptPaths[i]}`);
      await runScript(scriptPath, {
        configPath: this.fromCwd(flags["config-path"]),
        keysPath: this.fromCwd(flags["keys-path"]),
        refsPath: this.fromCwd(flags["refs-path"]),
        network: flags.network,
      });
    }
  }
}

async function runScript(
  scriptPath: string,
  env: {
    configPath: string;
    keysPath: string;
    refsPath: string;
    network: string;
  }
) {
  return new Promise((resolve, reject) => {
    let invoked = false;

    const cProcess = childProcess.fork(scriptPath, {
      env: {
        ...process.env,
        ...env,
      },
      execArgv: ["-r", "ts-node/register"],
    });

    // listen for errors as they may prevent the exit event from firing
    cProcess.on("error", (err) => {
      if (invoked) return;
      invoked = true;
      reject(err);
    });

    // execute the callback once the process has finished running
    cProcess.on("exit", (code) => {
      if (invoked) return;
      invoked = true;
      const err = code === 0 ? undefined : new Error(`exit code ${code}`);
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`exit code ${code}`));
      }
    });
  });
}
