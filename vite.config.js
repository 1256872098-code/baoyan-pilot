import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

export default defineConfig({
  plugins: [
    react(),
    {
      name: "baoyanpilot-dev-api",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          if (!request.url?.startsWith("/api/recommend")) {
            next();
            return;
          }

          response.status = (statusCode) => {
            response.statusCode = statusCode;
            return response;
          };
          response.json = (payload) => {
            if (!response.headersSent) {
              response.setHeader("Content-Type", "application/json; charset=utf-8");
            }
            response.end(JSON.stringify(payload));
          };

          try {
            const { default: handler } = await import("./api/recommend.js");
            await handler(request, response);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Local /api/recommend failed:", error);
            if (!response.headersSent) {
              response.statusCode = 500;
              response.setHeader("Content-Type", "application/json; charset=utf-8");
            }
            response.end(JSON.stringify({ error: "本地 AI 接口调用失败，请检查 .env.local 和后端日志。" }));
          }
        });
      },
    },
  ],
  server: {
    watch: {
      ignored: ["**/tmp-*", "**/*.log"],
    },
  },
});
