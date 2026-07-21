import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { manhubAliases } from "../../vite.shared";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: manhubAliases },
});
