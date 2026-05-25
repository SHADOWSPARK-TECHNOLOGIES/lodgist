// This file configures Prisma to use the shared schema from packages/db.
// The lodgist app uses the SAME Prisma client as the backend, ensuring
// type consistency across the entire codebase.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "../packages/db/prisma/schema.prisma",
  ...(process.env["DATABASE_URL"] && {
    datasource: { url: process.env["DATABASE_URL"] },
  }),
});
