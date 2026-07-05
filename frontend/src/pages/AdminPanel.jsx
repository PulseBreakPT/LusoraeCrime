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
import { Users, TrendingUp, Activity, Settings, AlertTriangle, Lock, Unlock, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";

export default function AdminPanel() {
  const { user } = useAuth();
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

  // Verificar se é admin
  useEffect(() => {
    if (user && user.role !== "admin") {
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

  const handleGrantAdmin = async () => {
    try {
      await api.post(`/admin/user/${selectedUser}/grant-admin`, {});
      toast.success("Utilizador promovido a administrador!");
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao promover utilizador");
    }
  };

  const handleRevokeAdmin = async () => {
    if (!window.confirm("Tem certeza? Este utilizador perderá acesso ao painel administrativo.")) return;
    try {
      await api.post(`/admin/user/${selectedUser}/revoke-admin`, {});
      toast.success("Acesso de administrador removido!");
      handleSelectUser(selectedUser);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao remover acesso de administrador");
    }
  };

  if (user?.role !== "admin") {
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
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Cabeçalho */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3">
            <Settings className="h-8 w-8 text-amber-500" />
            Painel Administrativo
          </h1>
          <p className="text-zinc-500 mt-1">Gestão de utilizadores, recursos e servidor</p>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-zinc-900/50 border border-white/10">
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
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold">{u.email}</p>
                        <p className="text-zinc-500 text-sm">{u.name}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={u.role === "admin" ? "default" : "secondary"} className="mb-1">
                          {u.role}
                        </Badge>
                        {u.player_id && (
                          <p className="text-amber-400 font-mono text-xs">Nível {u.player_level}</p>
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
                      <Badge>{userDetails.user.role}</Badge>
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
                    <Button onClick={handleGrantResources} className="w-full bg-green-600 hover:bg-green-700">
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
                      Isto vai limpar todas as equipas, funcionários, veículos, propriedades e missões.
                    </p>
                    <Button onClick={handleResetProgress} className="w-full bg-orange-600 hover:bg-orange-700">
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
                        <Button onClick={handleRevokeAdmin} className="w-full bg-amber-600 hover:bg-amber-700">
                          <Lock size={16} className="mr-2" />
                          Remover Admin
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-zinc-400 text-sm">Utilizador é jogador normal</p>
                        <Button onClick={handleGrantAdmin} className="w-full bg-green-600 hover:bg-green-700">
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
                      <Button onClick={handleBanUser} className="w-full bg-red-600 hover:bg-red-700">
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
