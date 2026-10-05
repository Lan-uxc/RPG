import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const scenarioDir=path.resolve(__dirname,"../scenarios");

export function loadScenario(id="town_origin"){
  const safe=String(id).replace(/[^a-zA-Z0-9_-]/g,"");
  const file=path.join(scenarioDir,safe+".json");
  if(!fs.existsSync(file)) throw new Error("scenario_not_found");
  const data=JSON.parse(fs.readFileSync(file,"utf8"));
  if(!data.id || !data.start || !data.places) throw new Error("scenario_invalid");
  return data;
}
