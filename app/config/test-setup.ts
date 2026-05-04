import { Logger } from "@nestjs/common";
import { config } from "dotenv";

jest.setTimeout(10000);
config({ path: ".env.test" });

Logger.overrideLogger(false);
