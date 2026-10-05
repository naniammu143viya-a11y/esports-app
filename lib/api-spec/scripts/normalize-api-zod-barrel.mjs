import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const apiZodSource = path.resolve(scriptDirectory, "../../api-zod/src");
const typesDirectory = path.join(apiZodSource, "generated/types");
const typeIndex = await readFile(path.join(typesDirectory, "index.ts"), "utf8");
const typeModules = [
  ...typeIndex.matchAll(/export \* from ['"]\.\/([^'"]+)['"];?/g),
].map((match) => match[1]);

const typeNames = new Set();
for (const moduleName of typeModules) {
  const moduleSource = await readFile(
    path.join(typesDirectory, `${moduleName}.ts`),
    "utf8",
  );
  for (const match of moduleSource.matchAll(
    /export\s+(?:type|interface)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    typeNames.add(match[1]);
  }
}

const zodApiSource = await readFile(
  path.join(apiZodSource, "generated/api.ts"),
  "utf8",
);
const runtimeNames = new Set(
  [...zodApiSource.matchAll(/export\s+(?:const|type|interface)\s+([A-Za-z_$][\w$]*)/g)]
    .map((match) => match[1]),
);
const nonConflictingTypes = [...typeNames]
  .filter((name) => !runtimeNames.has(name))
  .sort();

const barrel = [
  'export * from "./generated/api";',
  "export type {",
  ...nonConflictingTypes.map((name) => `  ${name},`),
  '} from "./generated/types";',
  "",
].join("\n");

await writeFile(path.join(apiZodSource, "index.ts"), barrel);
