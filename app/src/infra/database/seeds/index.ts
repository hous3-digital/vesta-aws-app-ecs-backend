import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@src/infra/database/@prisma/generated/client";
import * as fs from "fs";
import { join } from "path";

// SSL é exigido pelo RDS staging/prod (rds.force_ssl=1). O @prisma/adapter-pg
// ignora `?sslmode=require` da connection string, então passamos `ssl:` aqui.
// Em local (Postgres sem SSL), mantemos undefined.
const isLocal = process.env.NODE_ENV === "local" || process.env.NODE_ENV === "development";
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter: adapter });

const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

async function executeFunctions() {
  const content = fs
    .readFileSync(join(__dirname, "functions.sql"))
    .toString()
    .split("\n")
    .filter((line) => line.indexOf("--") !== 0)
    .join("\n");

  const functions = content.match(/create[\s\S]+?\$\$[\s\S]+?\$\$;/gi) || [];

  for (const func of functions) {
    const nameMatch = func.match(/create\s+or\s+replace\s+function\s+([\w.]+)/i);
    const functionName = nameMatch ? nameMatch[1] : "unknown";
    console.log(`${GREEN}creating function: ${RESET}${functionName}`);
    await prisma.$queryRawUnsafe(func);
  }
}

async function executeSqlFile(fileName: string): Promise<void> {
  const filePath = join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`${GREEN}seed skipped (file missing): ${RESET}${fileName}`);
    return;
  }

  const inserts = fs
    .readFileSync(filePath)
    .toString()
    .split("\n")
    .filter((line) => line.indexOf("--") !== 0)
    .join("\n")
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\s+/g, " ")
    .split(";");

  for (const insert of inserts) {
    if (!insert.trim()) continue;
    console.log(`${GREEN}inserting query: ${RESET}${insert}`);
    await prisma.$queryRawUnsafe(insert);
  }
}

async function executeBaseSeed() {
  await executeSqlFile("base.seed.sql");
}

async function executeLocalFixtures() {
  const env = process.env.NODE_ENV;
  const canExecute = env === "local" || env === "development" || env === "test";
  if (!canExecute) return;

  await executeSqlFile("local-fixtures.sql");
  console.log(`${GREEN}local fixtures:${RESET}`);
  console.log("  issuer     local_bank");
  console.log("  api key    vesta_live_local_dev_do_not_use_in_production");
  console.log("  backoffice dev@localhost / vesta_local");
  console.log("  verifier   verifier_local");
}

async function main() {
  await executeFunctions();
  await executeBaseSeed();
  await executeLocalFixtures();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
