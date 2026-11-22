import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

function mdTextPlugin() {
  return {
    name: "md-text",
    transform(_code: string, id: string) {
      if (id.endsWith(".md")) {
        const content = readFileSync(id, "utf-8");
        return { code: `export default ${JSON.stringify(content)};`, map: null };
      }
    },
  };
}

export default defineConfig({
  plugins: [mdTextPlugin()],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
