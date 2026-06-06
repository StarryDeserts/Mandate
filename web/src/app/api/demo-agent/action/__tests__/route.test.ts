import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../route";

const ORIGINAL_SESSION_KEY = process.env.MANDATE_SESSION_KEY_PRIVATE_KEY;

afterEach(() => {
  if (ORIGINAL_SESSION_KEY === undefined) delete process.env.MANDATE_SESSION_KEY_PRIVATE_KEY;
  else process.env.MANDATE_SESSION_KEY_PRIVATE_KEY = ORIGINAL_SESSION_KEY;
});

describe("POST /api/demo-agent/action", () => {
  it("returns missing_session_key without sending a transaction when the session key env is absent", async () => {
    delete process.env.MANDATE_SESSION_KEY_PRIVATE_KEY;

    const response = await POST(actionRequest("safe"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("missing_session_key");
  });

  it("returns invalid_session_key and never echoes the key when the session key is malformed", async () => {
    const malformedKey = "0xthis-is-not-a-valid-private-key";
    process.env.MANDATE_SESSION_KEY_PRIVATE_KEY = malformedKey;

    const response = await POST(actionRequest("dangerous"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("invalid_session_key");
    expect(JSON.stringify(body)).not.toContain(malformedKey);
    expect(JSON.stringify(body)).not.toContain("not-a-valid-private-key");
  });

  it("rejects malformed request bodies before reading the session key", async () => {
    delete process.env.MANDATE_SESSION_KEY_PRIVATE_KEY;

    const response = await POST(actionRequest("malicious"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.reason).toBe("invalid_request");
  });
});

function actionRequest(kind: unknown): Request {
  return new Request("http://localhost/api/demo-agent/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind })
  });
}
