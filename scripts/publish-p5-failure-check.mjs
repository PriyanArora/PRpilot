/* global fetch */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const githubApiUrl = "https://api.github.com";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createGitHubAppJwt(appId, privateKeyPath) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const payload = {
    iat: nowSeconds - 60,
    exp: nowSeconds + 9 * 60,
    iss: appId
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const key = createPrivateKey(readFileSync(privateKeyPath, "utf8"));
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), key);

  return `${signingInput}.${base64Url(signature)}`;
}

async function githubRequest(path, options = {}) {
  const response = await fetch(`${githubApiUrl}${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "prpilot-local-p5-proof",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`GitHub API ${options.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }

  return body;
}

async function main() {
  const appId = requireEnv("GITHUB_APP_ID");
  const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH ?? ".env.private-key.pem";
  const repoFullName = requireEnv("REPO_FULL_NAME");
  const prNumber = Number(requireEnv("PR_NUMBER"));
  const [owner, repo] = repoFullName.split("/");

  if (!owner || !repo || !Number.isInteger(prNumber)) {
    throw new Error("Expected REPO_FULL_NAME=owner/repo and PR_NUMBER=<number>");
  }

  const appJwt = createGitHubAppJwt(appId, privateKeyPath);
  const installation = await githubRequest(`/repos/${owner}/${repo}/installation`, {
    headers: {
      authorization: `Bearer ${appJwt}`
    }
  });
  const tokenResponse = await githubRequest(`/app/installations/${installation.id}/access_tokens`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${appJwt}`
    }
  });
  const pullRequest = await githubRequest(`/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      authorization: `Bearer ${tokenResponse.token}`
    }
  });
  const headSha = pullRequest.head.sha;
  const annotationPath = process.env.P5_ANNOTATION_PATH ?? "README.md";

  const checkRun = await githubRequest(`/repos/${owner}/${repo}/check-runs`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenResponse.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      name: "PRPilot Fast",
      head_sha: headSha,
      status: "completed",
      conclusion: "failure",
      external_id: `prpilot:${pullRequest.base.repo.id}:${prNumber}:fast:${headSha}`,
      output: {
        title: "PRPilot Fast",
        summary: [
          "Verdict: failure",
          "Blocking findings: 1",
          "Advisory findings: 0",
          "Coverage gaps: 0",
          "Inline annotations: 1",
          "Overflow findings in summary: 0",
          "Applied limits: none",
          "Deep scan available: yes"
        ].join("\n"),
        annotations: [
          {
            path: annotationPath,
            start_line: 1,
            end_line: 1,
            annotation_level: "failure",
            message: "P5 proof blocking finding: PRPilot Fast correctly publishes a failing check."
          }
        ]
      },
      actions: [
        {
          label: "Run deep scan",
          description: "Request optional PRPilot Deep review",
          identifier: "run_deep_scan"
        }
      ]
    })
  });

  console.log("Published P5 failure check");
  console.log(`repo: ${repoFullName}`);
  console.log(`pr: #${prNumber}`);
  console.log(`head_sha: ${headSha}`);
  console.log(`check_run_url: ${checkRun.html_url}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
