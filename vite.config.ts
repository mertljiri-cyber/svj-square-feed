import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Local demo must not load the repository's environment or contact production.
  ...(['local-demo', 'local-fixtures'].includes(mode) ? {envDir: path.resolve(__dirname, 'scripts/local-demo-env'), define: {'import.meta.env.VITE_LOCAL_DEMO': '"true"'}} : {}),
  build: { outDir: mode === 'local-demo' ? 'dist-local' : mode === 'local-fixtures' ? 'dist-fixtures' : 'dist' },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      ...(mode === 'local-fixtures' ? [
        {find: /^@\/integrations\/supabase\/client$/, replacement: path.resolve(__dirname, './src/features/local-fixtures/client.ts')},
        {find: /^(?:@\/features\/auth\/AuthProvider|\.\/(?:auth\/)?AuthProvider)$/, replacement: path.resolve(__dirname, './src/features/local-fixtures/auth.tsx')},
        {find: '@/data/technical-register.json', replacement: path.resolve(__dirname, './src/features/local-fixtures/assets.json')},
        {find: './features/LocalDemo', replacement: path.resolve(__dirname, './src/features/LocalFixtureApp.tsx')},
        {find: './App', replacement: path.resolve(__dirname, './src/features/LocalFixtureApp.tsx')},
      ] : []),
      {find: '@', replacement: path.resolve(__dirname, './src')},
      ...(mode === 'local-demo' ? [{find: './App', replacement: path.resolve(__dirname, './src/features/LocalDemo.tsx')}] : []),
    ],
  },
}));
