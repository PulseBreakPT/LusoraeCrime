import { useState } from "react";
import { AlertTriangle, Download, RotateCcw, Trash2 } from "lucide-react";
import { useGame } from "../../context/GameContextV2";
import { Button } from "../ui/button";
import {
  exportLocalGuestSave,
  isLocalGuestMode,
  restoreLocalGuestBackup,
  startFreshLocalGuestGame,
} from "../../game/localGuestEngine";

const downloadText = (text,name) => {
  if (!text) return;
  const blob=new Blob([text],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url; link.download=name; document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
};

export function GuestSaveRecovery() {
  const { state }=useGame();
  const [confirmFresh,setConfirmFresh]=useState(false);
  const recovery=state?.local_recovery;
  if (!recovery?.detected || !isLocalGuestMode()) return null;

  const reload=()=>window.location.reload();
  const restore=()=>{
    try {
      if (restoreLocalGuestBackup()) reload();
    } catch (_e) {
      // O save danificado continua preservado e pode ser exportado.
    }
  };
  const fresh=()=>{
    if (!confirmFresh) { setConfirmFresh(true); return; }
    startFreshLocalGuestGame();
    reload();
  };

  return (
    <div data-testid="guest-save-recovery" className="pointer-events-auto fixed left-1/2 top-3 z-[150] w-[min(94vw,34rem)] -translate-x-1/2 rounded-xl border border-amber-500/30 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          <p className="text-xs font-bold text-white">Problema detetado no progresso local</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
            {recovery.restored_from_backup
              ? "Recuperei automaticamente a cópia anterior. O ficheiro que falhou foi preservado para não perderes dados."
              : "O save principal não pôde ser lido. O original foi preservado e não foi apagado silenciosamente."}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {recovery.has_backup && (
          <Button type="button" variant="outline" size="compact" onClick={restore} className="gap-1.5 text-xs">
            <RotateCcw size={12}/> Restaurar cópia
          </Button>
        )}
        <Button
          type="button" variant="outline" size="compact"
          onClick={()=>downloadText(exportLocalGuestSave("corrupt"),`submundo-save-com-erro-${new Date().toISOString().slice(0,10)}.json`)}
          className="gap-1.5 text-xs"
        >
          <Download size={12}/> Exportar original
        </Button>
        <Button type="button" variant={confirmFresh?"destructive":"outline"} size="compact" onClick={fresh} className="gap-1.5 text-xs">
          <Trash2 size={12}/> {confirmFresh?"Confirmar novo jogo":"Começar de novo"}
        </Button>
      </div>
    </div>
  );
}
