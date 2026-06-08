import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

const port = Number(process.env.PORT ?? "3000");

// Verify the webhook signature with a constant-time comparison of the HMAC over the raw body.
const verifyWebhookSignature = (rawBody, signature, secret) => {
    const expectedSignature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signature);

    return expected.length === received.length && timingSafeEqual(expected, received);
};

//helper method to reject unauthorized requests
const rejectUnauthorized = (response) => {
  response.writeHead(401, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: false, error: "unauthorized" }));
};

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/webhooks/github") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: false, error: "not_found" }));
    return;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const signature = request.headers["x-hub-signature-256"];
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  // Validate the webhook signature
  if (!webhookSecret || typeof signature !== "string") {
    rejectUnauthorized(response);
    return;
  }
  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    rejectUnauthorized(response);
    return;
  }

  console.log("Webhook received");
  console.log("event:", request.headers["x-github-event"] ?? "unknown");
  console.log("delivery:", request.headers["x-github-delivery"] ?? "unknown");
  console.log("signature:", request.headers["x-hub-signature-256"] ?? "missing");
  console.log("body:", rawBody || "<empty>");

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true }));
});

server.listen(port, () => {
  console.log(`Webhook dev server listening on http://localhost:${port}`);
  console.log("Route: POST /webhooks/github");
});
