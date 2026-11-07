import fs from "node:fs";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

/** Writes `public/embed.js` from template + .env (same values Vite uses for import.meta.env). */
function shopmindEmbedPlugin() {
  return {
    name: "shopmind-embed",
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), "");
      const templatePath = path.resolve(__dirname, "scripts/shopmind-embed.template.js");
      let code = fs.readFileSync(templatePath, "utf8");
      const urlLit = JSON.stringify(env.VITE_SUPABASE_URL ?? "");
      const keyLit = JSON.stringify(env.VITE_SUPABASE_ANON_KEY ?? "");
      code = code.split("__SM_VITE_SUPABASE_URL__").join(urlLit);
      code = code.split("__SM_VITE_SUPABASE_ANON_KEY__").join(keyLit);
      const outPath = path.resolve(__dirname, "public/embed.js");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, code, "utf8");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    shopmindEmbedPlugin(),
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than app code; separate chunks cache longer.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          // Vite module ids use forward slashes on every OS.
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
