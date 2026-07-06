import { useState } from "react";
import { useGame } from "../../context/GameContextV2";
import { useAuth } from "../../context/AuthContextV2";
import { useSettings, NOTIFICATION_KEYS } from "../../context/SettingsContext";
import { ConfirmButton } from "./hud";
import { haptics } from "../../lib/haptics";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { Switch } from "../ui/switch";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../ui/collapsible";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "../ui/accordion";
import {
  Settings, UserCog, KeyRound, LogOut, Trash2, Monitor, Gamepad2, Cog, Bell, Info,
  ChevronDown, Wrench, Fuel, BedDouble, Gift, ShieldCheck, Volume2,
} from "lucide-react";
import { audio } from "../../lib/audio";
import { toast } from "sonner";

const GAME_VERSION = "1.1.0";

const CHANGELOG = [
  { v: "1.1.0", text: "Banda sonora original e efeitos sonoros temáticos — sirenes de perseguição, dinheiro, subida de nível e mais." },
  { v: "1.0.0", text: "Módulo de Definições: conta, interface, jogabilidade, automatizações e notificações." },
  { v: "0.9.0", text: "Interligação total do jogo: novos veículos exigidos por operações, novas especialidades com talentos e bónus próprios." },
  { v: "0.8.0", text: "50 novas operações, novos operacionais, veículos, imóveis e capítulos de história." },
  { v: "0.7.0", text: "Extrato financeiro, autonomia de tesouraria, limite de armazenamento de dinheiro sujo, abastecimento com tempo de espera." },
  { v: "0.6.0", text: "Favoritos, ordenação, ações em lote e confirmações de segurança em toda a interface." },
  { v: "0.5.0", text: "Distância ao QG a afetar risco e recompensa das operações; requisito mínimo de equipa por risco." },
];

// Adapta a Switch genérica do shadcn à cor "ligado = verde" já usada no resto
// do jogo (em vez do vermelho de marca do variant "default").
const ToggleSwitch = ({ checked, onChange, testId, disabled }) => (
  <Switch
    data-testid={testId}
    checked={checked}
    onCheckedChange={onChange}
    disabled={disabled}
    className="data-[state=checked]:bg-success data-[state=unchecked]:bg-white/10"
  />
);

const Section = ({ icon: Icon, title, children, testId }) => (
  <div className="mt-6 first:mt-0" data-testid={testId}>
    <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400">
      <Icon size={12} /> {title}
    </h3>
    <Card className="space-y-2 border-white/10 bg-white/[0.03] p-3 shadow-none">{children}</Card>
  </div>
);

const Row = ({ label, hint, children, testId }) => (
  <div className="flex items-center justify-between gap-3 py-1" data-testid={testId}>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-zinc-300">{label}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-snug text-zinc-500">{hint}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

// Slider de volume compacto (0–100%), coerente com o resto do painel.
const VolumeSlider = ({ value, onChange, disabled, testId }) => (
  <div className="flex items-center gap-1.5">
    <input
      data-testid={testId}
      type="range"
      min="0"
      max="100"
      value={Math.round(value * 100)}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) / 100)}
      className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/10 accent-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
    />
    <span className="w-8 text-right font-mono text-[10px] text-zinc-500">{Math.round(value * 100)}%</span>
  </div>
);

const ThresholdInput = ({ value, onChange, disabled, testId }) => (
  <div className="flex items-center gap-1">
    <Input
      data-testid={testId}
      type="number"
      min="1"
      max="99"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
      className="h-auto w-14 border-white/10 bg-black/60 px-1.5 py-1 text-right font-mono text-[11px] text-white"
    />
    <span className="font-mono text-[10px] text-zinc-500">%</span>
  </div>
);

const ChangePasswordForm = () => {
  const { changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (next.length < 6) return setError("A nova palavra-passe precisa de pelo menos 6 caracteres.");
    if (next !== confirm) return setError("As palavras-passe novas não coincidem.");
    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setCurrent(""); setNext(""); setConfirm("");
      setTimeout(() => { setDone(false); setOpen(false); }, 2000);
    } else {
      setError(res.error || "Não foi possível alterar a palavra-passe.");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        data-testid="settings-change-password-toggle"
        className="flex w-full items-center justify-between rounded border border-white/10 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition-colors hover:bg-white/5"
      >
        <span className="flex items-center gap-1.5"><KeyRound size={12} /> Alterar palavra-passe</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        <Input
          data-testid="settings-current-password-input"
          type="password" placeholder="Palavra-passe atual" value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="border-white/10 bg-white/5 font-mono text-xs text-white placeholder:text-zinc-600"
        />
        <Input
          data-testid="settings-new-password-input"
          type="password" placeholder="Nova palavra-passe" value={next}
          onChange={(e) => setNext(e.target.value)}
          className="border-white/10 bg-white/5 font-mono text-xs text-white placeholder:text-zinc-600"
        />
        <Input
          data-testid="settings-confirm-password-input"
          type="password" placeholder="Confirmar nova palavra-passe" value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="border-white/10 bg-white/5 font-mono text-xs text-white placeholder:text-zinc-600"
        />
        {error && <p className="text-[10px] text-red-400">{error}</p>}
        {done && <p className="text-[10px] text-emerald-400">Palavra-passe alterada com sucesso.</p>}
        <Button
          data-testid="settings-change-password-submit"
          onClick={submit}
          disabled={busy || !current || !next || !confirm}
          className="w-full text-xs font-bold uppercase"
        >
          Guardar nova palavra-passe
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Só visível para a conta única autorizada a auto-promover-se — o backend
// (/auth/claim-admin) reforça a mesma restrição, isto é só para não mostrar
// um botão irrelevante a todos os outros jogadores.
const CLAIM_ADMIN_EMAIL = "geral@lusorae.pt";

const ClaimAdminForm = () => {
  const { user, claimAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.email !== CLAIM_ADMIN_EMAIL || user.role === "admin") return null;

  const run = async () => {
    setBusy(true);
    setError("");
    const res = await claimAdmin();
    setBusy(false);
    if (res.ok) {
      toast.success(res.message || "Acesso de administrador concedido!");
    } else {
      setError(res.error || "Não foi possível conceder acesso de administrador.");
    }
  };

  return (
    <Card className="border-amber-500/20 bg-amber-500/5 p-2 shadow-none">
      <p className="text-[10px] leading-snug text-amber-300">
        Esta conta pode aceder ao Painel Administrativo (/painel).
      </p>
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
      <Button
        data-testid="settings-claim-admin-button"
        onClick={run}
        disabled={busy}
        className="mt-2 w-full bg-amber-600 text-xs font-bold uppercase tracking-wider text-white hover:bg-amber-700"
      >
        <ShieldCheck size={14} className="mr-1.5" /> Tornar-me Administrador
      </Button>
    </Card>
  );
};

const DeleteAccountForm = () => {
  const { deleteAccount } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setError("");
    if (!password) return setError("Introduz a tua palavra-passe para confirmar.");
    setBusy(true);
    const res = await deleteAccount(password);
    setBusy(false);
    if (!res.ok) setError(res.error || "Não foi possível eliminar a conta.");
  };

  return (
    <Card className="border-red-500/20 bg-red-500/5 p-2 shadow-none">
      <p className="text-[10px] leading-snug text-red-300">
        Esta ação é irreversível: apaga a organização, o plantel, a frota, os imóveis e todo o progresso. Não há forma de recuperar depois.
      </p>
      <Input
        data-testid="settings-delete-password-input"
        type="password" placeholder="Palavra-passe para confirmar" value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-2 border-red-500/20 bg-black/40 font-mono text-xs text-white placeholder:text-zinc-600"
      />
      {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
      <ConfirmButton
        testId="settings-delete-account-button"
        icon={Trash2}
        label="Eliminar conta"
        confirmLabel="Tens a certeza? Clica outra vez."
        onConfirm={run}
        disabled={busy || !password}
        className="mt-2"
        tip="Elimina permanentemente a conta e toda a organização."
      />
    </Card>
  );
};

const ABOUT_ITEMS = [
  {
    key: "changelog", label: "Changelog",
    content: (
      <div className="space-y-1.5">
        {CHANGELOG.map((c) => (
          <p key={c.v} className="text-[10px] leading-snug text-zinc-400">
            <span className="font-mono font-bold text-zinc-300">v{c.v}</span> — {c.text}
          </p>
        ))}
      </div>
    ),
  },
  {
    key: "terms", label: "Termos e Condições",
    content: (
      <p className="text-[10px] leading-snug text-zinc-500">
        Lusorae é um jogo de simulação fictício, sem qualquer ligação a atividades reais. Ao usares a conta
        aceitas jogar de boa-fé, não abusar de falhas técnicas para vantagem indevida e que o progresso pode
        ser perdido em caso de manutenção ou reinício do servidor. A organização pode encerrar contas usadas
        de forma abusiva ou fraudulenta.
      </p>
    ),
  },
  {
    key: "privacy", label: "Política de Privacidade",
    content: (
      <p className="text-[10px] leading-snug text-zinc-500">
        Guardamos apenas o necessário para a conta funcionar: email, palavra-passe encriptada e o progresso do
        jogo. As preferências de interface ficam só no teu dispositivo. Nada é vendido nem partilhado com
        terceiros. Podes eliminar a conta e todos os dados associados a qualquer momento em Conta → Eliminar conta.
      </p>
    ),
  },
  {
    key: "credits", label: "Créditos",
    content: (
      <p className="text-[10px] leading-snug text-zinc-500">
        Lusorae — criado e mantido por PulseBreakPT. Desenvolvido com FastAPI, MongoDB e React.
      </p>
    ),
  },
];

export const SettingsPanel = ({ open, onOpenChange }) => {
  const { state, updateAutomationSettings } = useGame();
  const { logout } = useAuth();
  const {
    showSeconds, setShowSeconds, compactNumbers, setCompactNumbers,
    showTooltips, setShowTooltips, hapticFeedback, setHapticFeedback,
    rememberFilters, setRememberFilters, rememberSort, setRememberSort,
    confirmIrreversible, setConfirmIrreversible,
    autoSelectBestTeam, setAutoSelectBestTeam, autoSelectBestVehicle, setAutoSelectBestVehicle,
    hideImpossibleMissions, setHideImpossibleMissions, repeatLastConfig, setRepeatLastConfig,
    autoOpenReport, setAutoOpenReport, lowSuccessThreshold, setLowSuccessThreshold,
    notifications, setNotification,
    soundEnabled, setSoundEnabled, musicEnabled, setMusicEnabled,
    sfxEnabled, setSfxEnabled, musicVolume, setMusicVolume, sfxVolume, setSfxVolume,
  } = useSettings();

  if (!state) return null;
  const settings = state.player.settings || {};
  const patchAutomation = (patch) => updateAutomationSettings(patch);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-sm overflow-y-auto border-border bg-background/95 backdrop-blur-xl sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-white">
            <Settings size={18} className="text-zinc-400" /> Definições
          </SheetTitle>
          <SheetDescription className="text-zinc-500">Conta, interface, jogabilidade, automatizações, áudio e notificações.</SheetDescription>
        </SheetHeader>

        <Section icon={UserCog} title="Conta" testId="settings-section-account">
          <ChangePasswordForm />
          <ClaimAdminForm />
          <Button
            data-testid="logout-button"
            onClick={logout}
            variant="outline"
            className="w-full border-white/10 bg-transparent text-xs font-bold uppercase tracking-wider text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={14} className="mr-1.5" /> Terminar sessão
          </Button>
          <DeleteAccountForm />
        </Section>

        <Section icon={Monitor} title="Interface" testId="settings-section-interface">
          <Row label="Mostrar segundos nos temporizadores" testId="settings-row-show-seconds">
            <ToggleSwitch testId="settings-toggle-show-seconds" checked={showSeconds} onChange={setShowSeconds} />
          </Row>
          <Row label="Números compactos" hint="1,2 M em vez de 1 200 000" testId="settings-row-compact-numbers">
            <ToggleSwitch testId="settings-toggle-compact-numbers" checked={compactNumbers} onChange={setCompactNumbers} />
          </Row>
          <Row label="Tooltips de ajuda" testId="settings-row-show-tooltips">
            <ToggleSwitch testId="settings-toggle-show-tooltips" checked={showTooltips} onChange={setShowTooltips} />
          </Row>
          <Row label="Feedback háptico" hint="Vibração ao executar ações" testId="settings-row-haptic-feedback">
            <ToggleSwitch
              testId="settings-toggle-haptic-feedback"
              checked={hapticFeedback}
              onChange={(v) => {
                setHapticFeedback(v);
                if (v) haptics.success();
              }}
            />
          </Row>
          <Row label="Memorizar filtros" testId="settings-row-remember-filters">
            <ToggleSwitch testId="settings-toggle-remember-filters" checked={rememberFilters} onChange={setRememberFilters} />
          </Row>
          <Row label="Memorizar ordenação" testId="settings-row-remember-sort">
            <ToggleSwitch testId="settings-toggle-remember-sort" checked={rememberSort} onChange={setRememberSort} />
          </Row>
          <Row label="Confirmar apenas ações irreversíveis" hint="Desliga para executar de imediato, sem confirmação" testId="settings-row-confirm-irreversible">
            <ToggleSwitch testId="settings-toggle-confirm-irreversible" checked={confirmIrreversible} onChange={setConfirmIrreversible} />
          </Row>
        </Section>

        <Section icon={Gamepad2} title="Jogabilidade" testId="settings-section-gameplay">
          <Row label="Selecionar automaticamente a melhor equipa" testId="settings-row-auto-team">
            <ToggleSwitch testId="settings-toggle-auto-team" checked={autoSelectBestTeam} onChange={setAutoSelectBestTeam} />
          </Row>
          <Row label="Selecionar automaticamente o melhor veículo" testId="settings-row-auto-vehicle">
            <ToggleSwitch testId="settings-toggle-auto-vehicle" checked={autoSelectBestVehicle} onChange={setAutoSelectBestVehicle} />
          </Row>
          <Row label="Ocultar operações impossíveis" hint="Esconde do mapa as que nenhuma equipa consegue cumprir agora" testId="settings-row-hide-impossible">
            <ToggleSwitch testId="settings-toggle-hide-impossible" checked={hideImpossibleMissions} onChange={setHideImpossibleMissions} />
          </Row>
          <Row label="Repetir automaticamente a última configuração" testId="settings-row-repeat-config">
            <ToggleSwitch testId="settings-toggle-repeat-config" checked={repeatLastConfig} onChange={setRepeatLastConfig} />
          </Row>
          <Row label="Abrir automaticamente o relatório da operação" hint="Abre o Intel quando uma equipa regressa" testId="settings-row-auto-report">
            <ToggleSwitch testId="settings-toggle-auto-report" checked={autoOpenReport} onChange={setAutoOpenReport} />
          </Row>
          <Row label="Avisar quando a probabilidade de sucesso é baixa" hint={`Abaixo de ${Math.round(lowSuccessThreshold * 100)}%`} testId="settings-row-low-success">
            <Input
              data-testid="settings-low-success-input"
              type="number" min="10" max="95" step="5"
              value={Math.round(lowSuccessThreshold * 100)}
              onChange={(e) => setLowSuccessThreshold(Math.max(0.10, Math.min(0.95, (parseInt(e.target.value, 10) || 70) / 100)))}
              className="h-auto w-14 border-white/10 bg-black/60 px-1.5 py-1 text-right font-mono text-[11px] text-white"
            />
          </Row>
        </Section>

        <Section icon={Cog} title="Automatizações" testId="settings-section-automations">
          <Row label="Reparar veículos automaticamente" hint="Abaixo da durabilidade indicada" testId="settings-row-auto-repair">
            <div className="flex items-center gap-2">
              <ThresholdInput
                testId="settings-auto-repair-threshold"
                value={settings.auto_repair_threshold ?? 30}
                disabled={!settings.auto_repair_enabled}
                onChange={(v) => patchAutomation({ auto_repair_threshold: v })}
              />
              <ToggleSwitch
                testId="settings-toggle-auto-repair"
                checked={!!settings.auto_repair_enabled}
                onChange={(v) => patchAutomation({ auto_repair_enabled: v })}
              />
            </div>
          </Row>
          <Row label="Abastecer veículos automaticamente" hint="Abaixo do combustível indicado" testId="settings-row-auto-refuel">
            <div className="flex items-center gap-2">
              <ThresholdInput
                testId="settings-auto-refuel-threshold"
                value={settings.auto_refuel_threshold ?? 20}
                disabled={!settings.auto_refuel_enabled}
                onChange={(v) => patchAutomation({ auto_refuel_threshold: v })}
              />
              <ToggleSwitch
                testId="settings-toggle-auto-refuel"
                checked={!!settings.auto_refuel_enabled}
                onChange={(v) => patchAutomation({ auto_refuel_enabled: v })}
              />
            </div>
          </Row>
          <Row label="Pôr operacionais a descansar automaticamente" hint="Abaixo da energia indicada" testId="settings-row-auto-rest">
            <div className="flex items-center gap-2">
              <ThresholdInput
                testId="settings-auto-rest-threshold"
                value={settings.auto_rest_threshold ?? 20}
                disabled={!settings.auto_rest_enabled}
                onChange={(v) => patchAutomation({ auto_rest_threshold: v })}
              />
              <ToggleSwitch
                testId="settings-toggle-auto-rest"
                checked={!!settings.auto_rest_enabled}
                onChange={(v) => patchAutomation({ auto_rest_enabled: v })}
              />
            </div>
          </Row>
          <Row label="Recolher automaticamente recompensas de missões concluídas" testId="settings-row-auto-claim">
            <ToggleSwitch
              testId="settings-toggle-auto-claim"
              checked={!!settings.auto_claim_quests}
              onChange={(v) => patchAutomation({ auto_claim_quests: v })}
            />
          </Row>
          <p className="flex items-center gap-1.5 pt-1 text-[9px] text-zinc-600">
            <Wrench size={9} /> <Fuel size={9} /> <BedDouble size={9} /> <Gift size={9} />
            Corre mesmo com a app fechada — os custos são os mesmos das ações manuais.
          </p>
        </Section>

        <Section icon={Volume2} title="Áudio" testId="settings-section-audio">
          <Row label="Som" hint="Interruptor geral — silencia tudo" testId="settings-row-sound">
            <ToggleSwitch
              testId="settings-toggle-sound"
              checked={soundEnabled}
              onChange={(v) => { setSoundEnabled(v); if (v) audio.sfx.notify(); }}
            />
          </Row>
          <Row label="Música ambiente" hint="Banda sonora noir gerada em tempo real" testId="settings-row-music">
            <div className="flex items-center gap-2">
              <VolumeSlider
                testId="settings-music-volume"
                value={musicVolume}
                disabled={!soundEnabled || !musicEnabled}
                onChange={setMusicVolume}
              />
              <ToggleSwitch
                testId="settings-toggle-music"
                checked={musicEnabled}
                onChange={setMusicEnabled}
                disabled={!soundEnabled}
              />
            </div>
          </Row>
          <Row label="Efeitos sonoros" hint="Despachos, dinheiro, sirenes, notificações" testId="settings-row-sfx">
            <div className="flex items-center gap-2">
              <VolumeSlider
                testId="settings-sfx-volume"
                value={sfxVolume}
                disabled={!soundEnabled || !sfxEnabled}
                onChange={setSfxVolume}
              />
              <ToggleSwitch
                testId="settings-toggle-sfx"
                checked={sfxEnabled}
                onChange={(v) => { setSfxEnabled(v); if (v && soundEnabled) setTimeout(() => audio.sfx.cash(), 50); }}
                disabled={!soundEnabled}
              />
            </div>
          </Row>
        </Section>

        <Section icon={Bell} title="Notificações" testId="settings-section-notifications">
          {NOTIFICATION_KEYS.map((n) => (
            <Row key={n.key} label={n.label} testId={`settings-row-notify-${n.key}`}>
              <ToggleSwitch
                testId={`settings-toggle-notify-${n.key}`}
                checked={notifications[n.key] !== false}
                onChange={(v) => setNotification(n.key, v)}
              />
            </Row>
          ))}
        </Section>

        <Section icon={Info} title="Sobre" testId="settings-section-about">
          <Row label="Versão do jogo" testId="settings-row-version">
            <span className="font-mono text-[11px] text-zinc-400">v{GAME_VERSION}</span>
          </Row>
          <Accordion type="single" collapsible className="space-y-1.5">
            {ABOUT_ITEMS.map((item) => (
              <AccordionItem key={item.key} value={item.key} className="rounded border border-white/10 border-b-white/10 px-2">
                <AccordionTrigger
                  data-testid={`settings-toggle-${item.key}`}
                  className="py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300 hover:no-underline"
                >
                  {item.label}
                </AccordionTrigger>
                <AccordionContent className="pb-2">{item.content}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Section>
      </SheetContent>
    </Sheet>
  );
};
