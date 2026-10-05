const locks=new Map();

export async function withRunLock(runId,task){
  const previous=locks.get(runId)||Promise.resolve();
  let release;
  const gate=new Promise(resolve=>{release=resolve});
  const current=previous.then(()=>gate);
  locks.set(runId,current);

  await previous;
  try{
    return await task();
  }finally{
    release();
    if(locks.get(runId)===current)locks.delete(runId);
  }
}

export function isRunLocked(runId){
  return locks.has(runId);
}
