import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuration Vite minimale : React + build statique dans dist/
export default defineConfig({
  plugins: [react()],
});
