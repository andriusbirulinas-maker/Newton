import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL nenustatytas");

  const schema = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "schema.sql"), "utf-8");
  const pool = new Pool({ connectionString });
  try {
    await pool.query(schema);
    console.log("Migracija sėkminga.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
