import { classifyFirstAction } from './action-intent.ts'

Deno.test('negated attack does not override observation',()=>{
  if(classifyFirstAction('我不主動攻擊，先觀察四周')!=='observe')throw Error('negation')
})
Deno.test('sequential instructions classify first step only',()=>{
  if(classifyFirstAction('我先調查宅邸，然後詢問守衛')!=='observe')throw Error('sequence')
})
Deno.test('explicit movement remains movement',()=>{
  if(classifyFirstAction('我離開這裡前往海灘')!=='move')throw Error('move')
})
Deno.test('dialogue remains dialogue',()=>{
  if(classifyFirstAction('我詢問凱恩目前的撤離路線')!=='talk')throw Error('talk')
})
Deno.test('unrecognized intent remains free, never forced into an option',()=>{
  if(classifyFirstAction('我想在這裡建立一座城鎮')!=='free')throw Error('free')
})
