import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/** 로컬 `npm run dev`에서만 — OpenAI 호출을 프록시 (키는 서버 쪽 env에만) */
function openaiChatProxy(openaiKey: string | undefined): Plugin {
  return {
    name: "openai-chat-proxy",
    configureServer(server) {
      server.middlewares.use("/api/chat", (req, res, next) => {
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (c) => {
          body += c;
        });
        req.on("end", async () => {
          try {
            if (!openaiKey) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error: {
                    message:
                      "OPENAI_API_KEY가 없습니다. 프로젝트 루트에 .env 파일을 만들고 OPENAI_API_KEY=sk-... 를 넣어 주세요.",
                  },
                })
              );
              return;
            }
            const json = JSON.parse(body || "{}");
            const r = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: json.model ?? "gpt-4o-mini",
                messages: json.messages,
                max_tokens: json.max_tokens ?? 900,
              }),
            });
            const text = await r.text();
            res.statusCode = r.status;
            res.setHeader("Content-Type", "application/json");
            res.end(text);
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: { message: String(e) } }));
          }
        });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const openaiKey = env.OPENAI_API_KEY;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger(), openaiChatProxy(openaiKey)].filter(
      Boolean
    ) as Plugin[],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
