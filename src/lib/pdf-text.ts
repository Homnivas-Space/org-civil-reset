// Extracts the text layer from a PDF, in-memory only — nothing here ever
// touches disk or a bucket. Uses unpdf (a serverless build of PDF.js with
// zero native deps), which is what makes this work on Workers at all —
// most PDF libraries assume Node's filesystem/canvas and break here.
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
