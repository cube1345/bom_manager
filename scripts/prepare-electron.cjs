const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const root = process.cwd();
  const sourceDir = path.join(root, ".next", "standalone");
  const targetDir = path.join(root, ".next", "standalone-electron");
  const sourceStaticDir = path.join(root, ".next", "static");
  const targetStaticDir = path.join(targetDir, ".next", "static");
  const sourcePublicDir = path.join(root, "public");
  const targetPublicDir = path.join(targetDir, "public");

  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    dereference: true,
    force: true,
  });

  // Next standalone server expects static/public assets colocated with server.js
  await fs.cp(sourceStaticDir, targetStaticDir, {
    recursive: true,
    dereference: true,
    force: true,
  });
  await fs.cp(sourcePublicDir, targetPublicDir, {
    recursive: true,
    dereference: true,
    force: true,
  });

  console.log(`Prepared standalone bundle: ${targetDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
