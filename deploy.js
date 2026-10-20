import { existsSync, statSync } from "node:fs";
import path from "node:path";
import FtpDeploy from "ftp-deploy";

const REQUIRED_ENV = ["FTP_HOST", "FTP_USER", "FTP_PASSWORD"];

// ftp-deploy uses plain FTP (node-ftp), which has no TLS support.
// If your host enforces FTPS, port this script to `basic-ftp` with secure: true.
const localRoot = path.resolve(
  import.meta.dirname,
  process.env.LOCAL_DIR?.trim() || "public",
);
const remoteRoot = normalizeRemoteRoot(
  process.env.REMOTE_ROOT?.trim() || "/www",
);
const port = Number(process.env.FTP_PORT || 21);

function normalizeRemoteRoot(value) {
  let root = value.replace(/\\/g, "/");
  if (!root.startsWith("/")) root = `/${root}`;
  if (!root.endsWith("/")) root += "/";
  return root;
}

function validateEnvironment() {
  const problems = [];
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    problems.push(`Missing required env var(s): ${missing.join(", ")}`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`FTP_PORT must be a valid port number, got "${process.env.FTP_PORT}"`);
  }
  if (!existsSync(localRoot) || !statSync(localRoot).isDirectory()) {
    problems.push(`LOCAL_DIR is not an existing directory: ${localRoot}`);
  }
  // An empty password makes ftp-deploy open an interactive prompt, which
  // hangs in CI, so FTP_PASSWORD is validated above instead.
  if (problems.length > 0) {
    console.error("Cannot deploy:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("\nCopy example.env to .env and fill in your FTP details.");
    process.exit(1);
  }
}

function buildConfig() {
  const extraExcludes = (process.env.EXCLUDE || "")
    .split(",")
    .map((pattern) => pattern.trim())
    .filter(Boolean);

  return {
    user: process.env.FTP_USER.trim(),
    // Never trim the password; leading/trailing spaces can be significant.
    password: process.env.FTP_PASSWORD,
    host: process.env.FTP_HOST.trim(),
    port,
    localRoot,
    remoteRoot,
    // Dotfiles must be listed explicitly so .htaccess and friends are sent.
    // minimatch's matchBase lets ".*" match dotfiles in nested folders too.
    include: [".*", "*", "**/*"],
    // matchBase also makes a slash-less exclude match nested basenames,
    // so these two patterns cover .env files at any depth.
    exclude: [".env", ".env.*", ...extraExcludes],
    // Overwrite-only: never remove files that exist remotely.
    deleteRemote: false,
    forcePasv: true,
    sftp: false,
  };
}

async function main() {
  validateEnvironment();

  if (remoteRoot === "/") {
    console.warn(
      "Warning: REMOTE_ROOT is / (the account root). Files will be written there.",
    );
  }

  const ftpDeploy = new FtpDeploy();
  const failures = [];
  let uploaded = 0;

  ftpDeploy.on("uploading", (data) => {
    console.log(
      `[${data.transferredFileCount + 1}/${data.totalFilesCount}] ${data.filename}`,
    );
  });

  ftpDeploy.on("uploaded", () => {
    uploaded++;
  });

  ftpDeploy.on("upload-error", (data) => {
    failures.push({ file: data.filename, error: data.error ?? data.err });
  });

  try {
    await ftpDeploy.deploy(buildConfig());
  } catch (err) {
    // ftp-deploy rejects with a plain { code, message } object, not an Error.
    const message = err?.message ?? String(err);
    console.error(`\nDeploy failed: ${message}`);
    for (const failure of failures) {
      console.error(`  ${failure.file}: ${failure.error?.message ?? failure.error}`);
    }
    process.exit(1);
  }

  console.log(
    `\nDeployed ${uploaded} file(s) to ${process.env.FTP_HOST.trim()} ${remoteRoot}`,
  );
}

await main();
