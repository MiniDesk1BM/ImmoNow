import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173 },
  build: {
    rolldownOptions: {
      output: {
        // Les jeux de données (communes, zonage, DVF) pèsent plus que le code : chunk séparé,
        // donc mis en cache indépendamment et rechargé seulement quand `npm run data:fetch` les change.
        codeSplitting: { groups: [{ name: "donnees", test: /[\\/]src[\\/]data[\\/]/ }] },
      },
    },
  },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
