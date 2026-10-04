import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, Crosshair, Target, Building2, Users, IdCard, Car, Warehouse,
  Swords, ShoppingBag, Landmark, BrainCircuit, Settings, RefreshCw,
  ClipboardCopy, Download, BedDouble, Fuel, Wrench, Sparkles, Focus,
  Clock3, CornerDownLeft, Vault,
} from "lucide-react";
import { useGame } from "../../context/GameContextV2";
import { useSettings } from "../../context/SettingsContext";
import { fmtMoney, orgAlerts, teamsReadiness } from "../../lib/game";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";

const RECENT_KEY = "submundo.command-recent";

const fold = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .trim();

const fuzzyScore = (query, text) => {
  const q = fold(query);
  const source = fold(text);
  if (!q) return 1;
  if (source === q) return 100;
  if (source.startsWith(q)) return 80;
  if (source.includes(q)) return 60;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => source.includes(token))) return 45;
  let qi = 0;
  let gap = 0;
  for (let i = 0; i < source.length && qi < q.length; i += 1) {
    if (source[i] === q[qi]) qi += 1;
    else if (qi > 0) gap += 1;
  }
  return qi === q.length ? Math.max(5, 30 - gap) : 0;
};

const PANEL_COMMANDS = [
  ["operations", "Operações", "Lista e despacho de oportunidades", Crosshair, "1"],
  ["quests", "Missões", "História, diárias, semanais e recompensas", Target, "2"],
  ["empire", "Império", "Tesouraria, lavagem e polícia", Building2, "3"],
  ["teams", "Equipas", "Composição, veículos e despacho", Users, "4"],
  ["employees", "Operacionais", "Efetivo, formação, saúde e salários", IdCard, "5"],
  ["fleet", "Frota", "Veículos, combustível e manutenção", Car, "6"],
  ["properties", "Imóveis", "Propriedades, rendimento e capacidade", Warehouse, "7"],
  ["weapons", "Armamento", "Inventário, atribuição e manutenção", Swords, "8"],
  ["shop", "Loja", "Acelerações, cosméticos, VIP e slots", ShoppingBag, "9"],
  ["mastermind", "Mastermind", "Grandes golpes, mercado negro, caçadores e sinais", Vault, null],
  ["hq", "Quartel-General", "Estratégia, melhorias e desempenho", Landmark, null],
  ["intel", "Relatórios", "Alertas e histórico", BrainCircuit, null],
  ["settings", "Definições", "Interface, jogabilidade e notificações", Settings, null],
];

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const downloadTransactions = async (fetchTransactions) => {
  const result = await fetchTransactions();
  if (!result.ok) {
    toast.error("Não foi possível obter o extrato financeiro.");
    return;
  }
  const rows = result.data || [];
  const header = ["Data", "Tipo", "Montante", "Moeda", "Saldo após", "Descrição"];
  const body = rows.map((tx) => [
    tx.ts, tx.kind, tx.amount, tx.currency, tx.balance_after, tx.note,
  ].map(csvCell).join(";"));
  const blob = new Blob(["\uFEFF", [header.map(csvCell).join(";"), ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `submundo-extrato-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast.success(`${rows.length} movimentos exportados.`);
};

const copyBriefing = async (state) => {
  const alerts = orgAlerts(state);
  const ready = teamsReadiness(state);
  const active = (state.missions || []).filter((mission) => mission.phase !== "done").length;
  const briefing = [
    `SUBMUNDO · ${state.player.org_name}`,
    `Nível ${state.player.level} · Respeito ${state.player.respect}`,
    `Dinheiro limpo: ${fmtMoney(state.player.clean_money)}`,
    `Dinheiro sujo: ${fmtMoney(state.player.dirty_money)}`,
    `Calor: ${Math.round(state.player.heat)}%`,
    `Equipas prontas: ${ready.ready} · Em operação: ${active}`,
    `Alertas ativos: ${alerts.total}`,
  ].join("\n");
  if (!navigator.clipboard?.writeText) {
    toast.error("O browser não permite copiar automaticamente.");
    return;
  }
  await navigator.clipboard.writeText(briefing);
  toast.success("Resumo copiado.");
};

const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
  catch { return []; }
};

export const CommandCenter = ({ open, onOpenChange, onNavigate, onSelectOpp }) => {
  const {
    state, refresh, fetchTransactions, claimAllQuests,
    restAllEligible, refuelAllEligible, repairFleetAll,
    repairWeaponsAll, optimizeOrganization,
  } = useGame();
  const { focusMode, setFocusMode } = useSettings();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState(readRecent);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const commands = useMemo(() => {
    if (!state) return [];
    const panelCommands = PANEL_COMMANDS.map(([panel, label, hint, Icon, shortcut]) => ({
      id: `panel:${panel}`,
      label,
      hint,
      Icon,
      shortcut,
      group: "Navegação",
      keywords: `${panel} painel menu`,
      run: () => onNavigate(panel),
    }));

    const priorities = (state.retention?.next_moves || []).map((move) => ({
      id: `priority:${move.id}`,
      label: move.title,
      hint: move.description,
      Icon: Crosshair,
      group: "Prioridades",
      keywords: `${move.horizon || ""} prioridade próximo passo agora sessão plano`,
      run: () => onNavigate(
        move.panel,
        move.focus_test_id ? { focusTestId: move.focus_test_id } : undefined
      ),
    }));

    const quick = [
      {
        id: "action:refresh", label: "Atualizar", hint: "Obtém os dados mais recentes",
        Icon: RefreshCw, shortcut: "R", group: "Ações rápidas", keywords: "refresh atualizar recarregar",
        run: refresh,
      },
      {
        id: "action:briefing", label: "Copiar resumo", hint: "Copia dinheiro, calor, equipas e alertas",
        Icon: ClipboardCopy, group: "Ações rápidas", keywords: "copiar relatório briefing resumo",
        run: () => copyBriefing(state),
      },
      {
        id: "action:csv", label: "Exportar extrato em CSV", hint: "Descarrega o histórico financeiro",
        Icon: Download, group: "Ações rápidas", keywords: "download exportar finanças transações excel",
        run: () => downloadTransactions(fetchTransactions),
      },
      {
        id: "action:rest-all", label: "Descansar todos os cansados", hint: "Ação em lote com um único relatório",
        Icon: BedDouble, group: "Ações rápidas", keywords: "rh fadiga operacionais lote",
        run: restAllEligible,
      },
      {
        id: "action:refuel-all", label: "Abastecer toda a frota elegível", hint: "Processa veículos disponíveis em sequência",
        Icon: Fuel, group: "Ações rápidas", keywords: "carros combustível gasolina gasóleo lote",
        run: refuelAllEligible,
      },
      {
        id: "action:repair-fleet", label: "Reparar toda a frota elegível", hint: "Evita pedidos simultâneos e resume o resultado",
        Icon: Wrench, group: "Ações rápidas", keywords: "carros manutenção oficina lote",
        run: repairFleetAll,
      },
      {
        id: "action:repair-weapons", label: "Reparar todo o armamento elegível", hint: "Manutenção sequencial do arsenal",
        Icon: Swords, group: "Ações rápidas", keywords: "armas manutenção arsenal lote",
        run: repairWeaponsAll,
      },
      {
        id: "action:claim-all", label: "Reclamar todas as recompensas", hint: "Recolhe contratos concluídos",
        Icon: Target, group: "Ações rápidas", keywords: "missões prémios contratos dinheiro",
        run: claimAllQuests,
      },
      {
        id: "action:optimize", label: "Otimizar toda a organização", hint: "Efetivo, frota, imóveis e armamento",
        Icon: Sparkles, group: "Ações rápidas", keywords: "automático melhorar tudo organização",
        run: optimizeOrganization,
      },
      {
        id: "action:focus", label: focusMode ? "Sair do modo focado" : "Ativar modo focado",
        hint: "Mostra apenas mapa e controlos essenciais",
        Icon: Focus, group: "Ações rápidas", keywords: "mapa esconder interface concentração",
        run: () => setFocusMode(!focusMode),
      },
    ];

    const entities = [
      ...(state.teams || []).map((item) => ({
        id: `team:${item.id}`, label: item.name, hint: "Equipa", Icon: Users,
        group: "Resultados", keywords: `${item.spec || ""} equipa`, run: () => onNavigate("teams"),
      })),
      ...(state.employees || []).map((item) => ({
        id: `employee:${item.id}`, label: item.name, hint: "Operacional", Icon: IdCard,
        group: "Resultados", keywords: `${item.role_key || ""} ${item.spec || ""} funcionário`,
        run: () => onNavigate("employees"),
      })),
      ...(state.vehicles || []).map((item) => ({
        id: `vehicle:${item.id}`, label: item.name, hint: "Veículo", Icon: Car,
        group: "Resultados", keywords: `${item.model_key || ""} frota carro`, run: () => onNavigate("fleet"),
      })),
      ...(state.properties || []).map((item) => ({
        id: `property:${item.id}`, label: item.name, hint: "Imóvel", Icon: Warehouse,
        group: "Resultados", keywords: `${item.type_key || ""} ${item.district || ""} propriedade`,
        run: () => onNavigate("properties"),
      })),
      ...(state.weapons || []).map((item) => ({
        id: `weapon:${item.id}`, label: item.name, hint: "Arma", Icon: Swords,
        group: "Resultados", keywords: `${item.model_key || ""} arsenal`, run: () => onNavigate("weapons"),
      })),
      ...(state.opportunities || []).map((item) => ({
        id: `opp:${item.id}`, label: item.name, hint: `Operação · ${fmtMoney(item.reward ?? 0)}`,
        Icon: Crosshair, group: "Resultados",
        keywords: `${item.type_key || ""} ${item.category || ""} ${item.district || ""} missão oportunidade`,
        run: () => onSelectOpp(item),
      })),
    ];
    return [...priorities, ...quick, ...panelCommands, ...entities];
  }, [
    state, refresh, fetchTransactions, claimAllQuests, restAllEligible,
    refuelAllEligible, repairFleetAll, repairWeaponsAll, optimizeOrganization,
    focusMode, setFocusMode, onNavigate, onSelectOpp,
  ]);

  const visible = useMemo(() => {
    const q = fold(query);
    if (!q) {
      const byId = new Map(commands.map((command) => [command.id, command]));
      const priorities = commands.filter((command) => command.group === "Prioridades");
      const recent = recentIds.map((id) => byId.get(id)).filter(Boolean);
      const defaults = commands.filter((command) => command.group === "Ações rápidas");
      return [
        ...priorities,
        ...recent.filter((command) => command.group !== "Prioridades"),
        ...defaults.filter((command) => !recentIds.includes(command.id)),
      ].slice(0, 14);
    }
    return commands
      .map((command) => ({
        command,
        score: fuzzyScore(q, `${command.label} ${command.hint} ${command.keywords || ""}`),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.command.label.localeCompare(b.command.label, "pt"))
      .slice(0, 50)
      .map((item) => item.command);
  }, [commands, query, recentIds]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const execute = async (command) => {
    if (!command) return;
    const next = [command.id, ...recentIds.filter((id) => id !== command.id)].slice(0, 6);
    setRecentIds(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* noop */ }
    onOpenChange(false);
    await command.run();
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => Math.min(visible.length - 1, value + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => Math.max(0, value - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(visible[activeIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="command-center"
        className="sub-menu-modal max-w-none overflow-hidden p-0 text-white"
        onKeyDown={onKeyDown}
      >
        <DialogHeader className="sub-menu-modal-header border-b border-white/[0.065] px-4 pb-3.5 pt-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Search size={17} className="text-red-400" /> Pesquisa
          </DialogTitle>
        </DialogHeader>

        <div className="relative border-b border-white/10">
          <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            autoFocus
            data-testid="command-search"
            aria-label="Pesquisar no SUBMUNDO"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar área, veículo ou operação…"
            className="h-12 rounded-none border-0 bg-transparent pl-11 pr-4 font-mono text-sm text-white shadow-none focus-visible:ring-0"
          />
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2" role="listbox" aria-label="Resultados de pesquisa">
            {!query && recentIds.length > 0 && (
              <p className="px-2 pb-1 pt-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                Recentes e ações rápidas
              </p>
            )}
            {visible.map((command, index) => {
              const Icon = command.Icon || Search;
              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  data-testid={`command-item-${command.id.replace(/:/g, "-")}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => execute(command)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    index === activeIndex ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/40">
                    <Icon size={15} className="text-red-300" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{command.label}</span>
                    <span className="block truncate font-mono text-[10px] text-zinc-500">{command.hint}</span>
                  </span>
                  {command.shortcut && (
                    <kbd className="rounded border border-white/10 bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      {command.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })}
            {visible.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Search size={20} className="mx-auto text-zinc-700" />
                <p className="mt-2 text-xs text-zinc-500">Nenhum resultado encontrado.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-2 font-mono text-[10px] text-zinc-600">
          <span className="flex items-center gap-1"><Clock3 size={10} /> ↑↓ navegar</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={10} /> executar</span>
          <span className="ml-auto">Ctrl K · /</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
