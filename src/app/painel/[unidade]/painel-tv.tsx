"use client";

import { useEffect, useRef, useState } from "react";
import { extrairYoutubeId, fraseChamada } from "@/lib/painel/core";

interface ChamadaResumo {
  id: string;
  nomeChamado: string;
  destino: string;
  criadoEm: string;
}

const POLL_MS = 2000;
const OVERLAY_MS = 8000;

// FIX 3: modulo-level repeat timer rastreado; limpa antes de falar (sem empilhamento)
let repeatTimer: number | undefined;
function falar(texto: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.clearTimeout(repeatTimer);
  window.speechSynthesis.cancel();
  const speak = (t: string) => {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "pt-BR";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };
  speak(texto);
  repeatTimer = window.setTimeout(() => speak(texto), 1800);
}

export function PainelTV({
  unidade,
  videoUrl,
  anuncios,
}: {
  unidade: string;
  videoUrl: string | null;
  anuncios: string[];
}) {
  const [iniciado, setIniciado] = useState(false);
  const [chamada, setChamada] = useState<ChamadaResumo | null>(null);
  const [recentes, setRecentes] = useState<ChamadaResumo[]>([]);
  const [overlay, setOverlay] = useState(false);
  const [erroConexao, setErroConexao] = useState(false);
  const ultimoIdRef = useRef<string | null>(null);
  const playerRef = useRef<YT.Player | null>(null);
  // FIX 1: timer do polling em ref para evitar stray timer apos desmontagem
  const timerRef = useRef<number | undefined>(undefined);
  // FIX 2: timer do overlay em ref para limpar antes de agendar novo
  const overlayTimerRef = useRef<number | undefined>(undefined);
  const videoId = extrairYoutubeId(videoUrl);

  // tema escuro estavel pra TV
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  // FIX 4 + FIX 5: YouTube IFrame Player API com guard de script duplicado e destroy no cleanup
  useEffect(() => {
    if (!iniciado || !videoId) return;
    function criarPlayer() {
      playerRef.current = new window.YT.Player("painel-yt", {
        videoId: videoId!,
        playerVars: {
          autoplay: 1,
          controls: 0,
          loop: 1,
          playlist: videoId!,
          rel: 0,
          modestbranding: 1,
        },
        host: "https://www.youtube-nocookie.com",
      });
    }
    // FIX 5: evita adicionar script duplicado e sobrescrever callback ja registrado
    if (window.YT?.Player) {
      criarPlayer();
    } else if (!document.getElementById("yt-api-script")) {
      const tag = document.createElement("script");
      tag.id = "yt-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = criarPlayer;
    }
    // FIX 4: destrói o player no cleanup para evitar vazamento de recursos
    return () => {
      try {
        playerRef.current?.destroy();
      } catch {
        /* player ja destruido ou nao inicializado */
      }
      playerRef.current = null;
    };
  }, [iniciado, videoId]);

  // FIX 1 + FIX 2: polling com AbortController, timer em ref e overlay timer limpo no cleanup
  useEffect(() => {
    if (!iniciado) return;
    const controller = new AbortController();
    async function tick() {
      try {
        const r = await fetch(`/api/painel/${unidade}/chamadas`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!r.ok) {
          setErroConexao(true);
          return;
        }
        setErroConexao(false);
        const data: { atual: ChamadaResumo | null; recentes: ChamadaResumo[] } = await r.json();
        setRecentes(data.recentes ?? []);
        const atual = data.atual;
        if (atual && atual.id !== ultimoIdRef.current) {
          ultimoIdRef.current = atual.id;
          setChamada(atual);
          setOverlay(true);
          try {
            playerRef.current?.mute?.();
          } catch {
            /* player ainda nao pronto */
          }
          falar(fraseChamada(atual.nomeChamado, atual.destino));
          // FIX 2: cancela overlay anterior antes de agendar novo
          window.clearTimeout(overlayTimerRef.current);
          overlayTimerRef.current = window.setTimeout(() => {
            setOverlay(false);
            try {
              playerRef.current?.unMute?.();
            } catch {
              /* ignore */
            }
          }, OVERLAY_MS);
        }
      } catch (e) {
        // FIX 1: ignora AbortError (desmontagem normal), seta erro apenas em falhas reais
        if ((e as Error).name === "AbortError") return;
        setErroConexao(true);
      } finally {
        // FIX 1: so reagenda se o controller ainda nao foi abortado
        if (!controller.signal.aborted) {
          timerRef.current = window.setTimeout(tick, POLL_MS);
        }
      }
    }
    tick();
    // FIX 1 + FIX 2: cancela fetch em voo, timer de poll e timer de overlay no cleanup
    return () => {
      controller.abort();
      window.clearTimeout(timerRef.current);
      window.clearTimeout(overlayTimerRef.current);
    };
  }, [iniciado, unidade]);

  // FIX 6: keep-alive do speechSynthesis para evitar silencio apos ~15min no Chromium
  useEffect(() => {
    if (!iniciado) return;
    const id = window.setInterval(() => {
      if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
        window.speechSynthesis.resume();
      }
    }, 10000);
    return () => window.clearInterval(id);
  }, [iniciado]);

  // FIX 7: type="button" no botao de inicio para evitar submit acidental em form pai
  if (!iniciado) {
    return (
      <div style={center}>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setIniciado(true)}>
          ▶ Iniciar painel
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--bg)",
      }}
    >
      {/* video ou fallback institucional */}
      {videoId ? (
        <div
          id="painel-yt"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      ) : (
        <div style={{ ...center, color: "var(--text-3)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, color: "var(--accent)" }}>IFP</div>
            <div>Instituto Familia Poncio</div>
          </div>
        </div>
      )}

      {/* overlay de chamada */}
      {overlay && chamada ? (
        <div style={overlayStyle}>
          <div style={{ textAlign: "center", padding: "0 6%" }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: ".2em",
                color: "var(--live)",
                marginBottom: 16,
              }}
            >
              CHAMANDO
            </div>
            <div
              style={{
                fontSize: "clamp(48px, 9vw, 140px)",
                fontWeight: 800,
                color: "var(--text)",
                lineHeight: 1.02,
              }}
            >
              {chamada.nomeChamado.toUpperCase()}
            </div>
            <div
              style={{ marginTop: 20, fontSize: "clamp(20px, 3vw, 44px)", color: "var(--text-2)" }}
            >
              → {chamada.destino}
            </div>
          </div>
        </div>
      ) : null}

      {/* lista de ultimos chamados (canto) */}
      {recentes.length > 0 ? (
        <div style={recentesStyle}>
          <div className="micro" style={{ marginBottom: 6 }}>
            ULTIMOS CHAMADOS
          </div>
          {recentes.map((c) => (
            <div key={c.id} style={{ fontSize: 14, color: "var(--text-2)" }}>
              {c.nomeChamado} · {c.destino}
            </div>
          ))}
        </div>
      ) : null}

      {/* rodape rolante */}
      {anuncios.length > 0 ? (
        <div style={tickerStyle}>
          <div className="painel-marquee">{anuncios.join("      •      ")}</div>
        </div>
      ) : null}

      {erroConexao ? <div style={reconStyle}>reconectando…</div> : null}
    </div>
  );
}

const center: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
};
const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(8,10,11,0.86)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
};
// FIX 7: maxHeight e overflow para evitar crescimento ilimitado da lista de recentes
const recentesStyle: React.CSSProperties = {
  position: "absolute",
  top: 20,
  right: 20,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 14px",
  zIndex: 5,
  maxHeight: "40vh",
  overflow: "hidden",
};
const tickerStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  background: "rgba(8,10,11,0.7)",
  color: "var(--text)",
  padding: "10px 0",
  fontSize: 22,
  zIndex: 6,
  overflow: "hidden",
};
const reconStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 60,
  right: 20,
  fontSize: 12,
  color: "var(--text-3)",
  zIndex: 7,
};
