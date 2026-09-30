import { useCallback, useEffect, useRef, useState } from "react";
import { api, type Settings } from "./api";

export type Fase = "ocioso" | "foco" | "pausa";

interface Estado {
  fase: Fase;
  inicioEm: number;
  fimEm: number;
  taskId: number | null;
  ciclos: number; // focos completos desde a última pausa longa
}

const CHAVE = "orbita:pomodoro";
const OCIOSO: Estado = { fase: "ocioso", inicioEm: 0, fimEm: 0, taskId: null, ciclos: 0 };

function carregar(): Estado {
  try {
    const salvo = localStorage.getItem(CHAVE);
    return salvo ? { ...OCIOSO, ...JSON.parse(salvo) } : OCIOSO;
  } catch {
    return OCIOSO;
  }
}

function bipe(vezes = 2) {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < vezes; i++) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = 880;
      ganho.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.35);
      ganho.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.3);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.35);
      osc.stop(ctx.currentTime + i * 0.35 + 0.3);
    }
  } catch {
    /* sem áudio disponível */
  }
}

function avisar(titulo: string, corpo: string) {
  if ("Notification" in window && Notification.permission === "granted") new Notification(titulo, { body: corpo });
}

export function usePomodoro(settings: Settings | null, aoRegistrar: () => void) {
  const [estado, setEstado] = useState<Estado>(carregar);
  const [agora, setAgora] = useState(Date.now());
  const registrando = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      /* armazenamento indisponível: o timer só não sobrevive a um reload */
    }
  }, [estado]);

  useEffect(() => {
    if (estado.fase === "ocioso") return;
    const id = setInterval(() => setAgora(Date.now()), 500);
    return () => clearInterval(id);
  }, [estado.fase]);

  const registrar = useCallback(
    async (e: Estado, fim: number, interrompido: boolean) => {
      const minutos = Math.max(1, Math.round((fim - e.inicioEm) / 60000));
      await api
        .registrarPomodoro({
          task_id: e.taskId,
          started_at: new Date(e.inicioEm).toISOString(),
          ended_at: new Date(fim).toISOString(),
          minutes: minutos,
          interrupted: interrompido,
        })
        .catch(() => {});
      aoRegistrar();
    },
    [aoRegistrar],
  );

  // Transição automática quando o tempo acaba.
  useEffect(() => {
    if (estado.fase === "ocioso" || agora < estado.fimEm || !settings || registrando.current) return;
    if (estado.fase === "foco") {
      registrando.current = true;
      const ciclos = estado.ciclos + 1;
      const longa = ciclos % 4 === 0;
      const minutosPausa = longa ? settings.longBreakMinutes : settings.shortBreakMinutes;
      registrar(estado, estado.fimEm, false).finally(() => (registrando.current = false));
      bipe(3);
      avisar("Pomodoro concluído 🍅", `Hora de uma pausa ${longa ? "longa" : "curta"} de ${minutosPausa} min. Levante, beba água.`);
      setEstado({ ...estado, fase: "pausa", inicioEm: Date.now(), fimEm: Date.now() + minutosPausa * 60000, ciclos: longa ? 0 : ciclos });
    } else {
      bipe(2);
      avisar("Pausa encerrada", "Pronto para o próximo bloco de foco?");
      setEstado((s) => ({ ...s, fase: "ocioso" }));
    }
  }, [agora, estado, settings, registrar]);

  const iniciar = useCallback(
    (taskId: number | null) => {
      if (!settings) return;
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
      const inicio = Date.now();
      setAgora(inicio);
      setEstado((s) => ({ ...s, fase: "foco", inicioEm: inicio, fimEm: inicio + settings.pomodoroMinutes * 60000, taskId }));
    },
    [settings],
  );

  /** Interrompe o foco: registra o tempo já feito como pomodoro interrompido (é dado útil pro painel). */
  const interromper = useCallback(() => {
    if (estado.fase === "foco") registrar(estado, Date.now(), true);
    setEstado((s) => ({ ...s, fase: "ocioso" }));
  }, [estado, registrar]);

  const trocarTarefa = useCallback((taskId: number | null) => setEstado((s) => ({ ...s, taskId })), []);

  const restanteMs = estado.fase === "ocioso" ? (settings?.pomodoroMinutes ?? 25) * 60000 : Math.max(0, estado.fimEm - agora);
  const totalMs = estado.fase === "ocioso" ? restanteMs : estado.fimEm - estado.inicioEm;

  return {
    fase: estado.fase,
    taskId: estado.taskId,
    ciclos: estado.ciclos,
    restanteMs,
    progresso: totalMs ? 1 - restanteMs / totalMs : 0,
    iniciar,
    interromper,
    trocarTarefa,
  };
}

export type ControlePomodoro = ReturnType<typeof usePomodoro>;

export function mmss(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
