/** Verify the original Python-canonical JSONL bytes without reserializing floats in JavaScript. */
export async function sha256(text: string): Promise<string> {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
export async function verifyOriginal(text:string,expectedSha:string) {
 if(await sha256(text)!==expectedSha)return {ok:false,bad_seq:null,note:'Bundled original file checksum mismatch.'};
 let previous='0'.repeat(64);let seq=1;
 for(const line of text.split('\n').filter(Boolean)){
  try{
   const row=JSON.parse(line);
   // Original lines use sorted keys, no spaces, UTF-8; the top-level hash precedes payload.
   const unsigned=line.replace(/,"hash":"[0-9a-f]{64}"/,'');
   if(unsigned===line||row.seq!==seq||row.prev_hash!==previous||await sha256(unsigned)!==row.hash)
    return {ok:false,bad_seq:seq,note:`Original chain invalid at entry ${seq}.`};
   previous=row.hash;seq++;
  }catch{return {ok:false,bad_seq:seq,note:`Original chain malformed at entry ${seq}.`};}
 }
 if(seq===1)return {ok:false,bad_seq:null,note:'Original chain is empty.'};
 return {ok:true,bad_seq:null,note:'Browser verified the bundled original chain; this is tamper evidence, not independent authentication.'};
}
