import { describe, expect, it } from "vitest";
import { attachmentSnapshot, renderMailHtml, renderMailSubject } from "@/lib/services/mailContent";

describe("mail content snapshots", () => {
  it("escapes variables in HTML and strips header control characters", () => {
    expect(renderMailHtml("<p>{{ user.name }}</p>", { user: { name: "<script>x</script>" } }))
      .toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
    expect(renderMailSubject("Hello {{name}}", { name: "A\r\nBcc: x@example.test" }))
      .toBe("Hello ABcc: x@example.test");
  });

  it("freezes attachment bytes with a checksum for deterministic retries", () => {
    const snapshot = attachmentSnapshot({ filename: "report.pdf", contentType: "application/pdf", bytes: Buffer.from("report") });
    expect(snapshot).toMatchObject({ filename: "report.pdf", contentType: "application/pdf", bytes: 6 });
    expect(snapshot.contentBase64).toBe("cmVwb3J0");
    expect(snapshot.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

