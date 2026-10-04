import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writePublicGlossary } from "./dictionaryPublic.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pack = JSON.parse(readFileSync(join(root, "src/data/techDictionary.json"), "utf8"));
writePublicGlossary(pack.entries);
