export type Recording = {file:string;scenario:string;label:string;mode:'mock'|'qwen';events:number;sha256:string;original_sha256:string;source_commit:string};
export async function recordings(): Promise<Recording[]> {
 const r=await fetch('/data/recordings.json');if(!r.ok)throw new Error('The bundled recordings could not be loaded.');return r.json();
}
