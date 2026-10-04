import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContextV2";
import { api } from "../lib/api";
import { fmtMoney } from "../lib/game";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Users, TrendingUp, Activity, Settings, AlertTriangle, Lock, RotateCcw, Zap, ArrowLeft, Eye, Shield, Crown, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

const ROLE_META = {
  player: { label: "Jogador", icon: UserIcon, badge: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
  moderator: { label: "Moderador", icon: Shield, badge: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  admin: { label: "Admin", icon: Crown, badge: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
};

const RoleBadge = ({ role }) => {
  const meta = ROLE_META[role] || ROLE_META.player;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 font-mono text-[10px] uppercase ${meta.badge}`}>
      <Icon size={11} /> {meta.label}
    </Badge>
  );
};

export default function AdminPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isStaff = user?.role === "admin" || user?.role === "moderator";
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [logs, setLogs] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [grantForm, setGrantForm] = useState({ clean_money: 0, dirty_money: 0, respect: 0 });
  const [resetForm, setResetForm] = useState({ keep_level: false });
  const [banForm, setBanForm] = useState({ reason: "" });

  // Só a equipa de gestão (admin/moderador) pode estar aqui
  useEffect(() => {
    if (user && user.role !== "admin" && user.role !== "moderator") {
      window.location.href = "/";
    }
  }, [user]);

  // Carregar dashboard
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const { data } = await api.get("/admin/dashboard");
        setDashboard(data);
      } catch (e) {
        toast.error("Erro ao carregar dashboard");
      }
    };
    fetchDashboard();
  }, []);

  // Carregar utilizadores
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get(`/admin/users?page=${page}&per_page=50`);
        setUsers(data.users);
      } catch (e) {
        toast.error("Erro ao carregar utilizadores");
      }
    };
    fetchUsers();
  }, [page]);

  // Carregar detalhes de utilizador
  const handleSelectUser = async (userId) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/user/${userId}`);
      setUserDetails(data);
      setSelectedUser(userId);
    } catch (e) {
      toast.error("Erro ao carregar detalhes do utilizador");
    } finally {
      setLoading(false);
    }
  };

  // Carregar logs
  const fetchLogs = async () => {
    try {
      const { data } = await api.get("/admin/logs");
      setLogs(data.logs);
    } catch (e) {
      toast.error("Erro ao carregar logs");
    }
  };

  // Carregar estatísticas do servidor
  const fetchServerStats = async () => {
    try {
      const { data } = await api.get("/admin/server-stats");
      setServerStats(data);
    } catch (e) {
      toast.error("Erro ao carregar estatísticas");
    }
  };

  // Ações
  const handleGrantResources = async () => {
    try {
      await api.post(`/admin/user/${selectedUser}/grant-resources`, grantForm);
      toast.success("Recursos concedidos!");
      setGrantForm({ clean_money: 0, dirty_money: 0, respect: 0 });
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao conceder recursos");
    }
  };

  const handleResetProgress = async () => {
    if (!window.confirm("Tem certeza? Isto vai limpar todo o progresso do jogador.")) return;
    try {
      await api.post(`/admin/user/${selectedUser}/reset-progress`, resetForm);
      toast.success("Progresso resetado!");
      setResetForm({ keep_level: false });
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao resetar progresso");
    }
  };

  const handleBanUser = async () => {
    if (!banForm.reason) {
      toast.error("Especifique um motivo para banir");
      return;
    }
    try {
      await api.post(`/admin/user/${selectedUser}/ban`, banForm);
      toast.success("Utilizador banido!");
      setBanForm({ reason: "" });
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao banir utilizador");
    }
  };

  const handleUnbanUser = async () => {
    try {
      await api.post(`/admin/user/${selectedUser}/unban`, {});
      toast.success("Utilizador desbanido!");
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao desbanir utilizador");
    }
  };

  const handleSetRole = async (role) => {
    const label = ROLE_META[role]?.label || role;
    if (!window.confirm(`Definir a função deste utilizador como "${label}"?`)) return;
    try {
      const { data } = await api.post(`/admin/user/${selectedUser}/role`, { role });
      toast.success(data.message || `Função atualizada para ${label}`);
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao alterar função");
    }
  };

  if (!isStaff) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Alert className="w-96 border-red-500/50 bg-red-500/10">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription>Acesso negado — apenas administradores</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:mb-8">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white sm:gap-3 sm:text-4xl">
              <Settings className="h-6 w-6 shrink-0 text-amber-500 sm:h-8 sm:w-8" />
              <span className="truncate">Painel Administrativo</span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-zinc-500 sm:text-base">Gestão de utilizadores, recursos e servidor</p>
              {!isAdmin && (
                <Badge variant="outline" className="gap-1 border-blue-500/40 bg-blue-500/10 font-mono text-[10px] uppercase text-blue-300" data-testid="readonly-badge">
                  <Eye size={11} /> Modo leitura
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { window.location.href = "/"; }}
            className="shrink-0 gap-1.5 border-white/10 bg-black/40 text-zinc-300 hover:text-white"
            data-testid="back-to-game-button"
          >
            <ArrowLeft size={14} /> Voltar ao jogo
          </Button>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3 gap-1 border border-white/10 bg-zinc-900/50 sm:grid-cols-5">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <TrendingUp size={16} />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users size={16} />
              <span className="hidden sm:inline">Utilizadores</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <Zap size={16} />
              <span className="hidden sm:inline">Ações</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity size={16} />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp size={16} />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6 mt-6">
            {dashboard && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-white/10 bg-zinc-900/50 p-4">
                  <p className="text-zinc-400 text-sm font-mono uppercase">Utilizadores</p>
                  <p className="text-3xl font-bold text-white mt-2">{dashboard.stats.total_users}</p>
                </Card>
                <Card className="border-white/10 bg-zinc-900/50 p-4">
                  <p className="text-zinc-400 text-sm font-mono uppercase">Jogadores</p>
                  <p className="text-3xl font-bold text-white mt-2">{dashboard.stats.total_players}</p>
                </Card>
                <Card className="border-white/10 bg-zinc-900/50 p-4">
                  <p className="text-zinc-400 text-sm font-mono uppercase">Missões Ativas</p>
                  <p className="text-3xl font-bold text-white mt-2">{dashboard.stats.active_missions}</p>
                </Card>
                <Card className="border-white/10 bg-zinc-900/50 p-4">
                  <p className="text-zinc-400 text-sm font-mono uppercase">Missões Total</p>
                  <p className="text-3xl font-bold text-white mt-2">{dashboard.stats.total_missions}</p>
                </Card>
                <Card className="border-white/10 bg-zinc-900/50 p-4 md:col-span-2">
                  <p className="text-zinc-400 text-sm font-mono uppercase">Dinheiro Limpo</p>
                  <p className="text-3xl font-bold text-emerald-400 mt-2">{fmtMoney(dashboard.stats.total_clean_money)}</p>
                </Card>
                <Card className="border-white/10 bg-zinc-900/50 p-4 md:col-span-2">
                  <p className="text-zinc-400 text-sm font-mono uppercase">Dinheiro Sujo</p>
                  <p className="text-3xl font-bold text-amber-500 mt-2">{fmtMoney(dashboard.stats.total_dirty_money)}</p>
                </Card>
              </div>
            )}

            {/* Top Players */}
            <Card className="border-white/10 bg-zinc-900/50 p-6">
              <h3 className="text-lg font-bold text-white mb-4">Top 5 Jogadores</h3>
              <div className="space-y-3">
                {dashboard?.top_players.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded bg-black/30 border border-white/5">
                    <div>
                      <p className="text-white font-semibold">{p.name}</p>
                      <p className="text-zinc-500 text-sm">{p.email}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1 mr-2">Nível {p.level}</Badge>
                      <p className="text-amber-400 font-mono text-sm">+{p.respect} respeito</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Utilizadores */}
          <TabsContent value="users" className="space-y-6 mt-6">
            <Card className="border-white/10 bg-zinc-900/50 p-6">
              <div className="flex gap-4 mb-6">
                <Input
                  placeholder="Buscar por email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="border-white/10 bg-black/50"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.filter(u => u.email.includes(searchEmail)).map((u) => (
                  <div
                    key={u.id}
                    onClick={() => handleSelectUser(u.id)}
                    className={`p-4 rounded cursor-pointer transition ${
                      selectedUser === u.id
                        ? "bg-blue-500/20 border border-blue-500/50"
                        : "bg-black/30 border border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-white font-semibold">{u.email}</p>
                        <p className="truncate text-zinc-500 text-sm">{u.name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <RoleBadge role={u.role} />
                        {u.player_id && (
                          <p className="mt-1 text-amber-400 font-mono text-xs">Nível {u.player_level}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              <div className="flex gap-2 mt-6 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <span className="text-white text-sm flex items-center">Página {page}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Detalhes e Ações */}
          <TabsContent value="details" className="space-y-6 mt-6">
            {selectedUser && userDetails && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informações do Utilizador */}
                <Card className="border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Informações do Utilizador</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-zinc-500">Email</p>
                      <p className="text-white font-mono">{userDetails.user.email}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Nome</p>
                      <p className="text-white">{userDetails.user.name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Função</p>
                      <RoleBadge role={userDetails.user.role} />
                    </div>
                    <div>
                      <p className="text-zinc-500">Criado em</p>
                      <p className="text-white">{new Date(userDetails.user.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </Card>

                {/* Informações do Jogador */}
                <Card className="border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Dados do Jogador</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-zinc-500 text-xs">Nível</p>
                      <p className="text-white font-bold text-xl">{userDetails.player.level}</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-zinc-500 text-xs">Respeito</p>
                      <p className="text-amber-400 font-bold text-xl">{userDetails.player.respect}</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-zinc-500 text-xs">Calor</p>
                      <p className="text-red-400 font-bold text-xl">{userDetails.player.heat.toFixed(1)}</p>
                    </div>
                    <div className="bg-black/30 p-3 rounded">
                      <p className="text-zinc-500 text-xs">Equipa(s)</p>
                      <p className="text-white font-bold text-xl">{userDetails.resources.teams_count}</p>
                    </div>
                    <div className="col-span-2 bg-black/30 p-3 rounded">
                      <p className="text-zinc-500 text-xs">Dinheiro Limpo</p>
                      <p className="text-emerald-400 font-bold">{fmtMoney(userDetails.player.clean_money)}</p>
                    </div>
                    <div className="col-span-2 bg-black/30 p-3 rounded">
                      <p className="text-zinc-500 text-xs">Dinheiro Sujo</p>
                      <p className="text-amber-500 font-bold">{fmtMoney(userDetails.player.dirty_money)}</p>
                    </div>
                  </div>
                </Card>

                {/* Conceder Recursos */}
                <Card className="border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">💰 Conceder Recursos</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-zinc-400 text-sm">Dinheiro Limpo</label>
                      <Input
                        type="number"
                        value={grantForm.clean_money}
                        onChange={(e) => setGrantForm({ ...grantForm, clean_money: parseInt(e.target.value) || 0 })}
                        className="border-white/10 bg-black/50 mt-1"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-sm">Dinheiro Sujo</label>
                      <Input
                        type="number"
                        value={grantForm.dirty_money}
                        onChange={(e) => setGrantForm({ ...grantForm, dirty_money: parseInt(e.target.value) || 0 })}
                        className="border-white/10 bg-black/50 mt-1"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-zinc-400 text-sm">Respeito</label>
                      <Input
                        type="number"
                        value={grantForm.respect}
                        onChange={(e) => setGrantForm({ ...grantForm, respect: parseInt(e.target.value) || 0 })}
                        className="border-white/10 bg-black/50 mt-1"
                        placeholder="0"
                      />
                    </div>
                    <Button onClick={handleGrantResources} variant="success" className="w-full">
                      Conceder
                    </Button>
                  </div>
                </Card>

                {/* Resetar Progresso */}
                <Card className="border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">🔄 Resetar Progresso</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="keepLevel"
                        checked={resetForm.keep_level}
                        onChange={(e) => setResetForm({ ...resetForm, keep_level: e.target.checked })}
                        className="rounded border-white/20"
                      />
                      <label htmlFor="keepLevel" className="text-zinc-400 text-sm">
                        Manter nível actual
                      </label>
                    </div>
                    <p className="text-zinc-500 text-xs">
                      Isto vai limpar todas as equipas, operacionais, veículos, propriedades e operações.
                    </p>
                    <Button onClick={handleResetProgress} variant="outline" className="w-full border-orange-500/50 bg-gradient-to-b from-orange-500 to-orange-700 text-white hover:border-orange-400/70 hover:from-orange-400 hover:to-orange-600 hover:text-white">
                      <RotateCcw size={16} className="mr-2" />
                      Resetar Tudo
                    </Button>
                  </div>
                </Card>

                {/* Admin/Acesso */}
                <Card className="border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">👑 Admin/Acesso</h3>
                  <div className="space-y-3">
                    {userDetails.user.role === "admin" ? (
                      <>
                        <p className="text-green-400 text-sm font-semibold">✓ Utilizador é administrador</p>
                        <Button onClick={handleRevokeAdmin} variant="outline" className="w-full border-amber-500/50 bg-gradient-to-b from-amber-500 to-amber-700 text-white hover:border-amber-400/70 hover:from-amber-400 hover:to-amber-600 hover:text-white">
                          <Lock size={16} className="mr-2" />
                          Remover Admin
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-zinc-400 text-sm">Utilizador é jogador normal</p>
                        <Button onClick={handleGrantAdmin} variant="success" className="w-full">
                          <Unlock size={16} className="mr-2" />
                          Tornar Admin
                        </Button>
                      </>
                    )}
                  </div>
                </Card>

                {/* Ban/Unban */}
                <Card className="border-white/10 bg-zinc-900/50 p-6">
                  <h3 className="text-lg font-bold text-white mb-4">⛔ Ban/Unban</h3>
                  {userDetails.user.role !== "admin" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-zinc-400 text-sm">Motivo do Ban</label>
                        <Input
                          value={banForm.reason}
                          onChange={(e) => setBanForm({ ...banForm, reason: e.target.value })}
                          className="border-white/10 bg-black/50 mt-1"
                          placeholder="Ex: Comportamento abusivo, spam, etc..."
                        />
                      </div>
                      <Button onClick={handleBanUser} variant="destructive" className="w-full">
                        <Lock size={16} className="mr-2" />
                        Banir Utilizador
                      </Button>
                    </div>
                  ) : (
                    <p className="text-zinc-500">Não pode banir outro administrador</p>
                  )}
                </Card>
              </div>
            )}
            {!selectedUser && (
              <Alert className="border-white/10 bg-zinc-900/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Selecione um utilizador da lista para ver ações disponíveis</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Logs */}
          <TabsContent value="logs" className="space-y-6 mt-6">
            <Card className="border-white/10 bg-zinc-900/50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Histórico de Ações Administrativas</h3>
                <Button onClick={fetchLogs} variant="outline" size="sm">
                  Atualizar
                </Button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.length > 0 ? (
                  logs.map((log, i) => (
                    <div key={i} className="p-3 rounded bg-black/30 border border-white/5 text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-semibold capitalize">{log.action.replace(/_/g, " ")}</p>
                          <p className="text-zinc-500">{log.admin_email}</p>
                        </div>
                        <p className="text-zinc-400 text-xs">{new Date(log.ts).toLocaleString()}</p>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-zinc-400 text-xs mt-2 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-500 text-center py-8">Nenhum log disponível</p>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Estatísticas do Servidor */}
          <TabsContent value="stats" className="space-y-6 mt-6">
            <Card className="border-white/10 bg-zinc-900/50 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Estatísticas Avançadas</h3>
                <Button onClick={fetchServerStats} variant="outline" size="sm">
                  Carregar
                </Button>
              </div>

              {serverStats ? (
                <div className="space-y-6">
                  {/* Utilizadores Ativos */}
                  <div>
                    <p className="text-zinc-400 text-sm font-mono uppercase mb-2">Utilizadores Ativos (7 dias)</p>
                    <p className="text-3xl font-bold text-blue-400">{serverStats.active_users_7d}</p>
                  </div>

                  {/* Missões por Categoria */}
                  <div>
                    <p className="text-white font-semibold mb-3">Missões por Categoria</p>
                    <div className="space-y-2">
                      {serverStats.missions_by_category.map((cat, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded bg-black/30 border border-white/5">
                          <span className="text-white capitalize">{cat._id || "N/A"}</span>
                          <div className="text-right">
                            <p className="text-blue-400 font-bold">{cat.count}</p>
                            <p className="text-zinc-500 text-xs">{fmtMoney(cat.total_reward)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Distribuição de Níveis */}
                  <div>
                    <p className="text-white font-semibold mb-3">Distribuição de Níveis</p>
                    <div className="space-y-2">
                      {serverStats.player_level_distribution.map((level, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded bg-black/30 border border-white/5">
                          <span className="text-white">Nível {level._id}</span>
                          <p className="text-amber-400 font-bold">{level.count} jogadores</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-zinc-500 text-center py-8">Clique em "Carregar" para ver estatísticas</p>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
