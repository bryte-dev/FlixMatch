// Lecteur ZIP minimal (méthodes stockée / deflate) sans dépendance : utilise DecompressionStream.
const u16 = (v, o) => v.getUint16(o, true);
const u32 = (v, o) => v.getUint32(o, true);

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Renvoie [{ name, read(): Promise<Uint8Array> }] pour chaque fichier de l'archive
export function listZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive ZIP invalide");
  const count = u16(view, eocd + 10);
  let offset = u32(view, eocd + 16);
  const decoder = new TextDecoder();
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (u32(view, offset) !== 0x02014b50) throw new Error("Archive ZIP corrompue");
    const method = u16(view, offset + 10);
    const compressedSize = u32(view, offset + 20);
    const nameLen = u16(view, offset + 28);
    const extraLen = u16(view, offset + 30);
    const commentLen = u16(view, offset + 32);
    const localOffset = u32(view, offset + 42);
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith("/")) continue;
    entries.push({
      name,
      async read() {
        const nl = u16(view, localOffset + 26);
        const el = u16(view, localOffset + 28);
        const start = localOffset + 30 + nl + el;
        const data = bytes.subarray(start, start + compressedSize);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        throw new Error(`Méthode de compression ZIP non supportée (${method})`);
      },
    });
  }
  return entries;
}
