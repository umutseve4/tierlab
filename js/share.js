// Share links: the whole tier list lives in the URL hash — no server, no database.
// JSON -> deflate (CompressionStream) -> base64url. Prefix "z" = compressed, "j" = plain.

function toB64Url(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodePayload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === "function") {
    try {
      return "z" + toB64Url(await pipe(bytes, new CompressionStream("deflate-raw")));
    } catch { /* fall through */ }
  }
  return "j" + toB64Url(bytes);
}

export async function decodePayload(str) {
  const kind = str[0];
  let bytes = fromB64Url(str.slice(1));
  if (kind === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
  else if (kind !== "j") throw new Error("Unknown share format");
  return JSON.parse(new TextDecoder().decode(bytes));
}
