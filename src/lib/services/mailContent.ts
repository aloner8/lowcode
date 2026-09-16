import { createHash } from "node:crypto";

export interface QueuedMailAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
  bytes: number;
  sha256: string;
}

const valueAt = (variables: Record<string, unknown>, key: string) =>
  key.split(".").reduce<unknown>((current, part) =>
    current && typeof current === "object"
      ? (current as Record<string, unknown>)[part]
      : undefined, variables);

const safeText = (value: unknown) => {
  const text = value === undefined || value === null
    ? ""
    : String(value).replace(/[\u0000-\u001f\u007f]/g, "");
  if (/^\s*(?:javascript|data|vbscript):/i.test(text)) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

export const renderMailHtml = (template: string, variables: Record<string, unknown>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) =>
    safeText(valueAt(variables, key)));

export const renderMailSubject = (template: string, variables: Record<string, unknown>) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) =>
    String(valueAt(variables, key) ?? "")
      .replace(/[\r\n\u0000-\u001f\u007f]/g, "")
      .slice(0, 500));

export const attachmentSnapshot = (input: {
  filename: string;
  contentType: string;
  bytes: Buffer;
}): QueuedMailAttachment => ({
  filename: input.filename.replace(/[\r\n\u0000-\u001f\u007f]/g, "").slice(0, 255),
  contentType: input.contentType.replace(/[\r\n\u0000-\u001f\u007f]/g, "").slice(0, 160),
  contentBase64: input.bytes.toString("base64"),
  bytes: input.bytes.length,
  sha256: createHash("sha256").update(input.bytes).digest("hex"),
});

