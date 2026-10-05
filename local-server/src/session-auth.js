import crypto from "node:crypto";

export function randomToken(){
  return crypto.randomBytes(32).toString("base64url");
}
export function hashToken(token){
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
export function readCookie(req,name){
  const raw=String(req.headers.cookie||"");
  for(const part of raw.split(";")){
    const i=part.indexOf("=");
    if(i<0)continue;
    const k=part.slice(0,i).trim();
    if(k===name)return decodeURIComponent(part.slice(i+1).trim());
  }
  return null;
}
export function sessionCookie(token){
  const maxAge=60*60*24*30;
  return `rpg_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
