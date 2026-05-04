import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@src/infra/database/@prisma/generated/client";
import * as fs from "fs";
import { join } from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
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

async function executeBaseSeed() {
  const inserts = fs
    .readFileSync(join(__dirname, "base.seed.sql"))
    .toString()
    .split("\n")
    .filter((line) => line.indexOf("--") !== 0)
    .join("\n")
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\s+/g, " ")
    .split(";");

  for (const insert of inserts) {
    const isLastLine = insert.trim() === "";
    if (!isLastLine) {
      console.log(`${GREEN}inserting query: ${RESET}${insert}`);
      await prisma.$queryRawUnsafe(insert);
    }
  }
}

async function executeDevSeed() {
  const isLocal = process.env.NODE_ENV === "local";
  const isDevelopment = process.env.NODE_ENV === "development";
  const canExecute = isLocal || isDevelopment;

  if (!canExecute) {
    return;
  }

  const inserts = fs
    .readFileSync(join(__dirname, "dev.seed.sql"))
    .toString()
    .split("\n")
    .filter((line) => line.indexOf("--") !== 0)
    .join("\n")
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\s+/g, " ")
    .split(";");

  for (const insert of inserts) {
    const isLastLine = insert.trim() === "";
    if (!isLastLine) {
      console.log(`${GREEN}inserting query: ${RESET}${insert}`);
      await prisma.$queryRawUnsafe(insert);
    }
  }
}

async function executeE2eSeed() {
  const canExecute = process.env.NODE_ENV === "test";

  if (!canExecute) {
    return;
  }

  const inserts = fs
    .readFileSync(join(__dirname, "e2e.seed.sql"))
    .toString()
    .split("\n")
    .filter((line) => line.indexOf("--") !== 0)
    .join("\n")
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\s+/g, " ")
    .split(";");

  for (const insert of inserts) {
    const isLastLine = insert.trim() === "";
    if (!isLastLine) {
      console.log(`${GREEN}inserting query: ${RESET}${insert}`);
      await prisma.$queryRawUnsafe(insert);
    }
  }
}

async function main() {
  await executeFunctions();
  await executeBaseSeed();
  await executeDevSeed();
  await executeE2eSeed();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
