import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export const manhubEnvDir = root;
export const manhubEnvPrefix = ["VITE_", "NEXT_PUBLIC_"];

export const manhubAliases = {
  "@manhub/auth": resolve(root, "packages/auth/src/index.tsx"),
  "@manhub/backend": resolve(root, "packages/backend/src/index.ts"),
  "@manhub/platform-config": resolve(root, "packages/platform-config/src/index.ts"),
  "@manhub/ui": resolve(root, "packages/ui/src/index.tsx"),
};
