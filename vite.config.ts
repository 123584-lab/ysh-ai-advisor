import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function healthPlugin() {
  return {
    name: "ysh-health-endpoint",
    configureServer(server) {
      server.middlewares.use("/api/health", (_request, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(
          JSON.stringify({
            status: "ok",
            service: "ysh-ai-advisor",
            time: new Date().toISOString(),
          }),
        );
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/health", (_request, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(
          JSON.stringify({
            status: "ok",
            service: "ysh-ai-advisor",
            time: new Date().toISOString(),
          }),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [healthPlugin(), react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
