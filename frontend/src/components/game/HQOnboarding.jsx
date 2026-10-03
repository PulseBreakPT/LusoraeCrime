import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { renderToStaticMarkup } from "react-dom/server";
import { Home, Loader2, CheckCircle2, OctagonAlert, MapPin } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import { useGame } from "../../context/GameContextV2";
import { formatApiErrorDetail, fmtMoney } from "../../lib/game";
import { Button } from "../ui/button";
import { DisclaimerModal } from "./DisclaimerModal";
import MapBaseLayer from "./MapBaseLayer";

// -----------------------------------------------------------------------------
// Onboarding de conta nova: o backend cria a organização com hq=null e o
// GET /game/state devolve { hq_pending: true } até o jogador escolher no mapa
// onde montar o PRIMEIRO Quartel-General (POST /game/hq/place). Este ecrã é a
// única porta de entrada no jogo para contas novas — sem ele, o GamePage
// rebentava ao renderizar o LiveMap sem player.hq ("reading 'lat'").
// Regras (validadas pelo servidor em /game/hq/validate — autoritativo):
// só em terra firme portuguesa (continente, Madeira ou Açores); mar proibido.
// -----------------------------------------------------------------------------

const candidateIcon = (status) => {
  // Válido/verificação: pin branco premium do QG; inválido: vermelho.
  const invalid = status === "invalid";
  const ring = invalid ? "#EF4444" : status === "valid" ? "#34D399" : "#71717A";
  const html = `
    <div class="hq-pin" style="${invalid ? "background:linear-gradient(160deg,#3f1d1d 0%,#27090b 100%);color:#FCA5A5;border-color:#EF4444;" : ""}box-shadow:0 0 0 2px ${ring}, 0 0 22px rgba(0,0,0,0.5), 0 8px 18px rgba(0,0,0,0.6);">
      ${renderToStaticMarkup(<Home size={16} strokeWidth={2.5} />)}
    </div>`;
  return L.divIcon({ html, className: "lus-marker", iconSize: [36, 36], iconAnchor: [18, 18] });
};

// Cada clique/toque no mapa reposiciona o pin candidato (arrastar também).
const ClickPicker = ({ onPick }) => {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
};

export default function HQOnboarding() {
  const { state, refresh } = useGame();
  const player = state?.player || {};

  const [point, setPoint] = useState(null);
  // verdict.status: idle | checking | valid | invalid
  const [verdict, setVerdict] = useState({ status: "idle" });
  const [placing, setPlacing] = useState(false);
  const seqRef = useRef(0);

  const pick = (lat, lng) => {
    if (placing) return;
    setPoint({ lat, lng });
  };

  // Validação em direto no servidor (debounce curto + guarda de sequência:
  // só o resultado do último ponto escolhido conta).
  useEffect(() => {
    if (!point) return;
    const seq = ++seqRef.current;
    setVerdict({ status: "checking" });
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post("/game/hq/validate", { lat: point.lat, lng: point.lng }, { timeout: 12000 });
        if (seqRef.current !== seq) return;
        if (data.valid) {
          setVerdict({ status: "valid", label: data.label, locality: data.locality });
        } else {
          setVerdict({ status: "invalid", reason: data.reason || "Localização inválida para o Quartel-General." });
        }
      } catch (e) {
        if (seqRef.current !== seq) return;
        setVerdict({
          status: "invalid",
          reason: formatApiErrorDetail(e.response?.data?.detail) || "Não foi possível verificar o local — tenta novamente.",
        });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [point]);

  const confirm = async () => {
    if (!point || verdict.status !== "valid" || placing) return;
    setPlacing(true);
    try {
      const { data } = await api.post("/game/hq/place", { lat: point.lat, lng: point.lng }, { timeout: 20000 });
      const where = data?.hq?.name || "novo território";
      toast.success(`${where} estabelecido — a rede está a mapear as zonas de operação.`);
      await refresh();
    } catch (e) {
      const status = e.response?.status;
      if (status === 409) {
        // Já colocado (duplo clique/estado antigo) — só falta refrescar.
        await refresh();
      } else {
        toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
        setPlacing(false);
        // Reverifica o ponto — o veredicto do servidor é autoritativo.
        setPoint((p) => (p ? { ...p } : p));
      }
    }
  };

  const icon = useMemo(() => candidateIcon(verdict.status), [verdict.status]);

  return (
    <div data-testid="hq-onboarding" className="fixed inset-0 overflow-hidden bg-background">
      <MapContainer
        center={[39.55, -8.0]}
        zoom={7}
        minZoom={5}
        zoomControl={false}
        attributionControl={true}
        className="lus-dark-map absolute inset-0 z-0 h-full w-full"
      >
        <MapBaseLayer />
        <ClickPicker onPick={pick} />
        {point && (
          <Marker
            position={[point.lat, point.lng]}
            icon={icon}
            draggable={!placing}
            eventHandlers={{
              dragend: (e) => {
                const p = e.target.getLatLng();
                pick(p.lat, p.lng);
              },
            }}
            zIndexOffset={600}
          />
        )}
      </MapContainer>
      <div className="lus-vignette" aria-hidden="true" />

      {/* Cabeçalho */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center px-3 pt-4">
        <div className="pointer-events-auto w-full max-w-md rounded-xl border border-zinc-800 bg-black/80 p-4 backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-red-500">Fundação da organização</p>
          <h1 className="mt-1 text-lg font-bold text-white">Estabelece o teu Quartel-General</h1>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-200">{player.org_name || "A tua organização"}</span> precisa de uma base.
            Toca em qualquer ponto de <span className="text-zinc-200">terra firme portuguesa</span> (continente, Madeira ou Açores) —
            o mar é estritamente proibido. As zonas de operação nascem em redor do QG.
          </p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-md border border-emerald-900/60 bg-emerald-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
              {fmtMoney(player.clean_money || 0)} limpos
            </span>
            <span className="rounded-md border border-amber-900/60 bg-amber-950/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
              {fmtMoney(player.dirty_money || 0)} sujos
            </span>
          </div>
        </div>
      </div>

      {/* Estado do local escolhido + confirmação */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-5">
        <div
          data-testid="hq-onboarding-status"
          className="pointer-events-auto w-full max-w-md rounded-xl border border-zinc-800 bg-black/80 p-4 backdrop-blur-md"
        >
          {!point && (
            <div className="flex items-center gap-2.5 text-zinc-400">
              <MapPin className="h-4 w-4 shrink-0 text-zinc-500" />
              <p className="text-xs">Toca no mapa para escolheres o local do Quartel-General. Podes arrastar o pin para afinar.</p>
            </div>
          )}
          {point && verdict.status === "checking" && (
            <div className="flex items-center gap-2.5 text-zinc-300">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
              <p className="text-xs">A verificar o local...</p>
            </div>
          )}
          {point && verdict.status === "invalid" && (
            <div className="flex items-start gap-2.5">
              <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-xs leading-relaxed text-red-400">{verdict.reason}</p>
            </div>
          )}
          {point && verdict.status === "valid" && (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{verdict.label || "Local válido"}</p>
                {verdict.locality && verdict.label !== verdict.locality && (
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{verdict.locality}</p>
                )}
              </div>
            </div>
          )}
          <Button
            data-testid="hq-place-confirm"
            className="mt-3 w-full"
            disabled={verdict.status !== "valid" || placing}
            onClick={confirm}
          >
            {placing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> A estabelecer o QG...
              </>
            ) : (
              <>
                <Home className="h-4 w-4" /> Estabelecer o Quartel-General aqui
              </>
            )}
          </Button>
          <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-wider text-zinc-600">
            Decisão permanente — o QG não pode ser mudado depois
          </p>
        </div>
      </div>

      {/* Disclaimer de ficção — para contas novas aparece AQUI, antes de o
          jogador estabelecer o QG (primeiro ecrã real do jogo). Aceite UMA
          única vez por conta (user.disclaimer_accepted, registado no servidor
          via POST /legal/disclaimer-ack) — depois nunca mais reaparece. */}
      <DisclaimerModal />
    </div>
  );
}
