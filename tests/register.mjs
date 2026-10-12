// Lets `node --test` run the project's TypeScript modules as they are:
// resolves the "@/…" alias to src/ and extensionless imports to .ts files.
import { register } from "node:module";
register("./resolve-hooks.mjs", import.meta.url);
