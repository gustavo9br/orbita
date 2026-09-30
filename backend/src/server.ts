import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { criarSessao, encerrarSessao, exigirSessao, senhaConfere, sessaoValida } from "./lib/auth.js";
import { aiRouter } from "./routes/ai.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { rotinaRouter } from "./routes/rotina.js";
import { tasksRouter } from "./routes/tasks.js";

const app = express();

// Em produção front e back ficam no mesmo domínio (Traefik), então CORS só importa em dev.
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const tentativas = new Map<string, { n: number; desde: number }>();
app.post("/api/login", (req, res) => {
  // Freio simples contra força bruta: 10 tentativas por IP a cada 15 min.
  const ip = req.ip ?? "?";
  const agora = Date.now();
  const t = tentativas.get(ip);
  const registro = t && agora - t.desde < 15 * 60_000 ? t : { n: 0, desde: agora };
  if (registro.n >= 10) return void res.status(429).json({ erro: "Muitas tentativas. Aguarde alguns minutos." });

  if (!senhaConfere(String(req.body?.senha ?? ""))) {
    tentativas.set(ip, { ...registro, n: registro.n + 1 });
    return void res.status(401).json({ erro: "Senha incorreta." });
  }
  tentativas.delete(ip);
  criarSessao(res);
  res.json({ ok: true });
});
app.post("/api/logout", (_req, res) => {
  encerrarSessao(res);
  res.json({ ok: true });
});
app.get("/api/me", (req, res) => res.json({ autenticado: sessaoValida(req) }));

app.use("/api", exigirSessao);
app.use("/api/tarefas", tasksRouter);
app.use("/api/ia", aiRouter);
app.use("/api/painel", dashboardRouter);
app.use("/api", rotinaRouter);

app.use((erro: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(erro);
  res.status(500).json({ erro: "Erro interno no servidor." });
});

app.set("trust proxy", 1);
app.listen(config.port, () => {
  console.log(`Órbita backend em http://localhost:${config.port} (fuso ${config.timeZone})`);
});
