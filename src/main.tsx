import { createRoot } from "react-dom/client";
import "./index.css";

// Demo uses a separate module graph: never initialize the real auth/backend client.
const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
const demo = import.meta.env.VITE_LOCAL_DEMO === 'true';
if (demo && !loopback) {
  document.getElementById('root')!.textContent = 'Syntetické demo je dostupné pouze na loopback adrese.';
} else {
  const appModule = demo ? import('./features/LocalDemo') : import('./App');
  void appModule.then(({default: App}) => createRoot(document.getElementById('root')!).render(<App />)).catch(() => {
    document.getElementById('root')!.textContent = 'Aplikaci se nepodařilo načíst. Obnovte stránku.';
  });
}
