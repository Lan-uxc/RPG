import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const scenarioDir=path.resolve(__dirname,"../scenarios");

function validateScenario(data){
  if(!data || typeof data!=="object") throw new Error("scenario_invalid");
  if(!data.id || !data.name || !data.start || !data.places) throw new Error("scenario_invalid");
  if(!data.start.location || !data.places[data.start.location]) throw new Error("scenario_invalid_start");
  return data;
}

export function loadScenario(id="town_origin"){
  const safe=String(id).replace(/[^a-zA-Z0-9_-]/g,"");
  const file=path.join(scenarioDir,safe+".json");
  if(!fs.existsSync(file)) throw new Error("scenario_not_found");
  return validateScenario(JSON.parse(fs.readFileSync(file,"utf8")));
}

export function listScenarios(){
  return fs.readdirSync(scenarioDir)
    .filter(x=>x.endsWith(".json"))
    .map(file=>{
      const data=validateScenario(JSON.parse(fs.readFileSync(path.join(scenarioDir,file),"utf8")));
      return {id:data.id,name:data.name,startLocation:data.start.location};
    });
}
