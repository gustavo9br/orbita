import ical, { type VEvent } from "node-ical";
import { config } from "../config.js";
import { db, gravarValor } from "../db.js";
import { hoje, somarDias } from "./dates.js";

// Google Agenda via "endereço secreto no formato iCal": leitura sem OAuth, suficiente pra
// trazer os compromissos pro planejamento. Eventos recorrentes são expandidos numa janela
// de -7 a +42 dias e gravados como linhas comuns (source = 'google').

function texto(valor: unknown): string {
  if (valor == null) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "object" && "val" in valor) return String((valor as { val: unknown }).val);
  return String(valor);
}

export interface ResultadoSync {
  importados: number;
  removidos: number;
  sincronizadoEm: string;
}

export async function sincronizarGoogleAgenda(): Promise<ResultadoSync> {
  if (!config.googleIcsUrl) throw new Error("GOOGLE_CALENDAR_ICS_URL não configurada.");

  const de = new Date(`${somarDias(hoje(), -7)}T00:00:00`);
  const ate = new Date(`${somarDias(hoje(), 42)}T23:59:59`);

  const calendario = await ical.async.fromURL(config.googleIcsUrl);
  const vistos = new Set<string>();
  const upsert = db.prepare(`
    INSERT INTO events (title, start_at, end_at, all_day, location, source, external_id)
    VALUES (?, ?, ?, ?, ?, 'google', ?)
    ON CONFLICT(external_id) DO UPDATE SET
      title = excluded.title, start_at = excluded.start_at, end_at = excluded.end_at,
      all_day = excluded.all_day, location = excluded.location
  `);

  db.exec("BEGIN");
  try {
    for (const componente of Object.values(calendario)) {
      if (!componente || (componente as { type?: string }).type !== "VEVENT") continue;
      const evento = componente as VEvent;
      if ((evento as { status?: string }).status === "CANCELLED") continue;
      const instancias = ical.expandRecurringEvent(evento, { from: de, to: ate, expandOngoing: true });
      for (const inst of instancias) {
        const inicio = new Date(inst.start);
        const fim = inst.end ? new Date(inst.end) : inicio;
        const id = `${evento.uid ?? texto(inst.summary)}@${inicio.toISOString()}`;
        vistos.add(id);
        upsert.run(
          texto(inst.summary) || "(sem título)",
          inicio.toISOString(),
          fim.toISOString(),
          inst.isFullDay ? 1 : 0,
          texto(inst.event.location),
          id,
        );
      }
    }

    // Remove da janela o que sumiu da agenda (evento apagado ou remarcado).
    const existentes = db
      .prepare("SELECT id, external_id FROM events WHERE source = 'google' AND start_at >= ? AND start_at <= ?")
      .all(de.toISOString(), ate.toISOString()) as { id: number; external_id: string }[];
    const apagar = db.prepare("DELETE FROM events WHERE id = ?");
    let removidos = 0;
    for (const e of existentes) {
      if (!vistos.has(e.external_id)) {
        apagar.run(e.id);
        removidos++;
      }
    }
    db.exec("COMMIT");

    const sincronizadoEm = new Date().toISOString();
    gravarValor("google_sync_at", sincronizadoEm);
    return { importados: vistos.size, removidos, sincronizadoEm };
  } catch (erro) {
    db.exec("ROLLBACK");
    throw erro;
  }
}
