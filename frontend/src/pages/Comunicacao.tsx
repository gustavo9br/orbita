import { useEffect, useState } from "react";
import { api, type Mensagem, type RespostaIA } from "../lib/api";
import { relativo } from "../lib/format";
import { Carregando, OrigemIA } from "../components/ui";

const TIPOS: { id: string; titulo: string; exemplo: string }[] = [
  {
    id: "status",
    titulo: "Status para cliente/gestor",
    exemplo: "terminei a tela de comissão, falta testar com dados reais. deploy deve ficar pra quinta pq o backup do banco ainda n foi configurado",
  },
  {
    id: "assincrona",
    titulo: "Resposta assíncrona",
    exemplo: "o joão perguntou no grupo se dá pra mudar o filtro de data do relatório. dá sim mas precisa saber se é por emissão ou vencimento",
  },
  {
    id: "prazo",
    titulo: "Negociar prazo/escopo",
    exemplo: "cliente quer o app de agendamento em 2 semanas com pagamento online. sem pagamento dá, com pagamento precisa de mais 1 semana",
  },
  {
    id: "nao",
    titulo: "Dizer não com cuidado",
    exemplo: "me chamaram pra uma call de 2h amanhã às 15h pra 'alinhar ideias'. to com entrega do ERP, posso responder por escrito",
  },
  {
    id: "ata",
    titulo: "Ata de reunião",
    exemplo: "reunião erp: decidiram migrar estoque em outubro. eu faço API, maria valida com fiscal. dúvida sobre NF de devolução ficou em aberto. próxima reunião dia 10",
  },
];

export function Comunicacao() {
  const [tipo, setTipo] = useState("status");
  const [destinatario, setDestinatario] = useState("");
  const [tom, setTom] = useState("profissional e cordial");
  const [rascunho, setRascunho] = useState("");
  const [resp, setResp] = useState<RespostaIA<Mensagem> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [historico, setHistorico] = useState<{ id: number; kind: string; output: string; created_at: string }[]>([]);

  const carregarHistorico = () => api.mensagens().then(({ mensagens }) => setHistorico(mensagens));

  useEffect(() => {
    carregarHistorico();
  }, []);

  async function gerar() {
    setCarregando(true);
    setErro("");
    setCopiado(false);
    try {
      setResp(await api.redigir({ tipo, rascunho, destinatario, tom }));
      carregarHistorico();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregando(false);
    }
  }

  const tipoAtual = TIPOS.find((t) => t.id === tipo)!;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Comunicação</h1>
          <p>Escreva do jeito que vier na cabeça; a IA transforma numa mensagem clara, assíncrona e sem ruído.</p>
        </div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}

      <div className="grid cols-2">
        <section className="card">
          <div className="pilha">
            <div className="linha">
              {TIPOS.map((t) => (
                <button key={t.id} className={`btn pequeno ${tipo === t.id ? "primario" : ""}`} onClick={() => setTipo(t.id)}>
                  {t.titulo}
                </button>
              ))}
            </div>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <label className="campo">
                Para quem
                <input className="input" placeholder="Ex.: Carla (cliente do ERP)" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} />
              </label>
              <label className="campo">
                Tom
                <select className="select" value={tom} onChange={(e) => setTom(e.target.value)}>
                  <option>profissional e cordial</option>
                  <option>direto e objetivo</option>
                  <option>informal, pra colega de equipe</option>
                  <option>formal</option>
                </select>
              </label>
            </div>
            <label className="campo">
              Rascunho / anotações
              <textarea className="textarea" style={{ minHeight: 150 }} placeholder={tipoAtual.exemplo} value={rascunho} onChange={(e) => setRascunho(e.target.value)} />
            </label>
            <div className="linha">
              <button className="btn ia" onClick={gerar} disabled={carregando || !rascunho.trim()}>
                {carregando ? <Carregando texto="Redigindo…" /> : "✦ Redigir mensagem"}
              </button>
              {!rascunho && (
                <button className="btn fantasma pequeno" onClick={() => setRascunho(tipoAtual.exemplo)}>
                  usar exemplo
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="card">
          {!resp ? (
            <div className="pilha">
              <h2>Boas práticas que a IA aplica</h2>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
                <li>A informação principal vem na primeira frase (o leitor decide em 5 segundos se precisa agir).</li>
                <li>Pedidos explícitos, com responsável e data.</li>
                <li>Uma mensagem completa em vez de "oi, tudo bem?" + espera.</li>
                <li>Nada é inventado: o que faltar vira [ASSIM] e aparece como ponto de atenção.</li>
                <li>Resolver por escrito o que não precisa de reunião protege blocos de foco dos dois lados.</li>
              </ul>
            </div>
          ) : (
            <div className="pilha">
              <OrigemIA resposta={resp} />
              <div className="small muted">Assunto</div>
              <strong>{resp.resultado.assunto}</strong>
              <div className="saida">{resp.resultado.mensagem}</div>
              {resp.resultado.pontos_de_atencao.length > 0 && (
                <div className="aviso">
                  <strong>Revise antes de enviar:</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {resp.resultado.pontos_de_atencao.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <button className="btn" onClick={() => navigator.clipboard.writeText(resp.resultado.mensagem).then(() => setCopiado(true))}>
                {copiado ? "✓ Copiado" : "Copiar mensagem"}
              </button>
            </div>
          )}
        </section>
      </div>

      {historico.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h2>Últimas mensagens</h2>
          </div>
          <div className="pilha">
            {historico.slice(0, 5).map((m) => (
              <details key={m.id}>
                <summary className="small">
                  {TIPOS.find((t) => t.id === m.kind)?.titulo ?? m.kind} · <span className="muted">{relativo(m.created_at)}</span>
                </summary>
                <div className="saida" style={{ marginTop: 6 }}>
                  {m.output}
                </div>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
