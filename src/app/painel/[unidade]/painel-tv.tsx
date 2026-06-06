"use client";

import { useEffect, useRef, useState } from "react";
import { fraseChamada } from "@/lib/painel/core";

interface ChamadaResumo {
  id: string;
  nomeChamado: string;
  destino: string;
  criadoEm: string;
}

const POLL_MS = 2000;
const OVERLAY_MS = 8000;

// extrai o videoId de varias formas de URL do YouTube
function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1]! : null;
}

function falar(texto: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = "pt-BR";
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  // repete uma vez apos uma pausa curta
  const u2 = new SpeechSynthesisUtterance(texto);
  u2.lang = "pt-BR";
  u2.rate = 0.95;
  window.setTimeout(() => window.speechSynthesis.speak(u2), 1800);
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
  const videoId = youtubeId(videoUrl);

  // tema escuro estavel pra TV
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  // YouTube IFrame Player API (so apos o gesto, com som liberado)
  useEffect(() => {
    if (!iniciado || !videoId) return;
    function criarPlayer() {
      playerRef.current = new window.YT.Player("painel-yt", {
        videoId: videoId!,
        playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: videoId!, rel: 0, modestbranding: 1 },
        host: "https://www.youtube-nocookie.com",
      });
    }
    if (window.YT && window.YT.Player) {
      criarPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = criarPlayer;
    }
  }, [iniciado, videoId]);

  // polling das chamadas
  useEffect(() => {
    if (!iniciado) return;
    let timer: number;
    async function tick() {
      try {
        const r = await fetch(`/api/painel/${unidade}/chamadas`, { cache: "no-store" });
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
          window.setTimeout(() => {
            setOverlay(false);
            try {
              playerRef.current?.unMute?.();
            } catch {
              /* ignore */
            }
          }, OVERLAY_MS);
        }
      } catch {
        setErroConexao(true);
      } finally {
        timer = window.setTimeout(tick, POLL_MS);
      }
    }
    tick();
    return () => window.clearTimeout(timer);
  }, [iniciado, unidade]);

  // gesto inicial: libera audio/autoplay
  if (!iniciado) {
    return (
      <div style={center}>
        <button className="btn btn-primary btn-lg" onClick={() => setIniciado(true)}>
          ▶ Iniciar painel
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      {/* video ou fallback institucional */}
      {videoId ? (
        <div id="painel-yt" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
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
            <div style={{ fontSize: 18, letterSpacing: ".2em", color: "var(--live)", marginBottom: 16 }}>
              CHAMANDO
            </div>
            <div style={{ fontSize: "clamp(48px, 9vw, 140px)", fontWeight: 800, color: "var(--text)", lineHeight: 1.02 }}>
              {chamada.nomeChamado.toUpperCase()}
            </div>
            <div style={{ marginTop: 20, fontSize: "clamp(20px, 3vw, 44px)", color: "var(--text-2)" }}>
              → {chamada.destino}
            </div>
          </div>
        </div>
      ) : null}

      {/* lista de ultimos chamados (canto) */}
      {recentes.length > 0 ? (
        <div style={recentesStyle}>
          <div className="micro" style={{ marginBottom: 6 }}>ULTIMOS CHAMADOS</div>
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

      {erroConexao ? (
        <div style={reconStyle}>reconectando…</div>
      ) : null}
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
const recentesStyle: React.CSSProperties = {
  position: "absolute",
  top: 20,
  right: 20,
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 14px",
  zIndex: 5,
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
