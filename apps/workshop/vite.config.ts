import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { manhubAliases, manhubEnvDir, manhubEnvPrefix } from "../../vite.shared";

export default defineConfig({
  envDir: manhubEnvDir,
  envPrefix: manhubEnvPrefix,
  plugins: [react()],
  resolve: { alias: manhubAliases },
});
