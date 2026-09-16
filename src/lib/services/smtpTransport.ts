import nodemailer from "nodemailer";
import type { QueuedMailAttachment } from "./mailContent";

export interface SmtpTransportConfig {
  host: string;
  port: number;
  tlsMode: "none" | "starttls" | "tls";
  rejectUnauthorized: boolean;
  connectionTimeoutMs: number;
  socketTimeoutMs: number;
}

export interface SmtpMailMessage {
  fromName?: string;
  fromAddress: string;
  replyTo?: string;
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  attachments: QueuedMailAttachment[];
}

export async function deliverSmtpMail(input: {
  config: SmtpTransportConfig;
  message: SmtpMailMessage;
  username?: string;
  password?: string;
}): Promise<{ messageId: string | null; accepted: string[]; rejected: string[] }> {
  const transport = nodemailer.createTransport({
    host: input.config.host,
    port: input.config.port,
    secure: input.config.tlsMode === "tls",
    requireTLS: input.config.tlsMode === "starttls",
    ignoreTLS: input.config.tlsMode === "none",
    connectionTimeout: input.config.connectionTimeoutMs,
    greetingTimeout: input.config.connectionTimeoutMs,
    socketTimeout: input.config.socketTimeoutMs,
    tls: { rejectUnauthorized: input.config.rejectUnauthorized },
    auth: input.username ? { user: input.username, pass: input.password ?? "" } : undefined,
  });
  try {
    const result = await transport.sendMail({
      from: { name: input.message.fromName ?? "", address: input.message.fromAddress },
      replyTo: input.message.replyTo || undefined,
      to: input.message.to,
      cc: input.message.cc.length ? input.message.cc : undefined,
      subject: input.message.subject,
      html: input.message.html,
      attachments: input.message.attachments.map((attachment) => ({
        filename: attachment.filename,
        contentType: attachment.contentType,
        content: Buffer.from(attachment.contentBase64, "base64"),
      })),
    });
    return {
      messageId: result.messageId || null,
      accepted: result.accepted.map(String),
      rejected: result.rejected.map(String),
    };
  } finally {
    transport.close();
  }
}

