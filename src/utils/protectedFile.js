import { safeApiResourceUrl, safeExternalUrl } from "./safeUrl";

export async function downloadProtectedFile(client, path, filename = "arquivo") {
  const safeUrl = safeApiResourceUrl(path) || safeExternalUrl(path);
  if (!safeUrl) throw new Error("Endereço de arquivo inválido.");

  const { data } = await client.get(safeUrl, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
