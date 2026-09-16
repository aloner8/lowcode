import { createServer, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { deliverSmtpMail } from "@/lib/services/smtpTransport";

const sockets = new Set<Socket>();
let closeServer: (() => Promise<void>) | undefined;

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  sockets.clear();
  await closeServer?.();
  closeServer = undefined;
});

describe("SMTP transport integration", () => {
  it("sends CC and multiple attachments through a real SMTP socket", async () => {
    let wire = "";
    let dataMode = false;
    let data = "";
    const server = createServer((socket) => {
      sockets.add(socket);
      socket.setEncoding("utf8");
      socket.write("220 smtp.test ESMTP\r\n");
      socket.on("data", (chunk: string) => {
        wire += chunk;
        if (dataMode) {
          data += chunk;
          if (data.includes("\r\n.\r\n")) {
            dataMode = false;
            socket.write("250 2.0.0 queued as TEST-ID\r\n");
          }
          return;
        }
        for (const line of chunk.split("\r\n").filter(Boolean)) {
          if (/^(EHLO|HELO) /i.test(line)) socket.write("250-smtp.test\r\n250 SIZE 52428800\r\n");
          else if (/^(MAIL FROM|RCPT TO):/i.test(line)) socket.write("250 2.1.0 OK\r\n");
          else if (line === "DATA") { dataMode = true; socket.write("354 End data with <CR><LF>.<CR><LF>\r\n"); }
          else if (line === "QUIT") socket.end("221 2.0.0 Bye\r\n");
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    closeServer = () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("SMTP test server did not bind");

    const result = await deliverSmtpMail({
      config: { host: "127.0.0.1", port: address.port, tlsMode: "none", rejectUnauthorized: true, connectionTimeoutMs: 2000, socketTimeoutMs: 5000 },
      message: {
        fromName: "Platform",
        fromAddress: "noreply@example.test",
        to: ["one@example.test"],
        cc: ["two@example.test"],
        subject: "Request received",
        html: "<p>Done</p>",
        attachments: [
          { filename: "a.txt", contentType: "text/plain", contentBase64: "QQ==", bytes: 1, sha256: "a".repeat(64) },
          { filename: "b.txt", contentType: "text/plain", contentBase64: "Qg==", bytes: 1, sha256: "b".repeat(64) },
        ],
      },
    });

    expect(result.rejected).toEqual([]);
    expect(wire).toContain("RCPT TO:<one@example.test>");
    expect(wire).toContain("RCPT TO:<two@example.test>");
    expect(data).toContain("Subject: Request received");
    expect(data).toContain('filename=a.txt');
    expect(data).toContain('filename=b.txt');
  });
});

