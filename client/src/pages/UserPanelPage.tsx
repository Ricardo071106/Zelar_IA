import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PanelMe = {
  user: {
    id: number;
    phone: string;
    name: string | null;
    email: string | null;
    subscriptionStatus: string | null;
    subscriptionEndsAt: string | null;
  };
  settings: {
    timeZone: string;
    calendarConnected: "google" | "microsoft" | null;
  };
  timezones: string[];
  links: {
    googleConnect: string;
    microsoftConnect: string;
    stripePaymentLink: string | null;
    stripeCheckoutUrl: string | null;
  };
};

type GuestRow = { id: number; name: string; email: string; phone: string };
type GroupRow = { id: number; name: string; contactIds: number[] };

function getToken(): string | null {
  const q = new URLSearchParams(window.location.search).get("t");
  return q && q.trim() ? q.trim() : null;
}

const shellClass =
  "min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/70 to-green-50 text-slate-800";

const orbClass =
  "pointer-events-none absolute rounded-full blur-3xl opacity-35 mix-blend-multiply";

const cardClass =
  "rounded-2xl border border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]";

const inputClass =
  "border-emerald-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:ring-emerald-500/35 focus-visible:border-emerald-400";

export default function UserPanelPage() {
  const { toast } = useToast();
  const token = useMemo(() => getToken(), []);

  const [me, setMe] = useState<PanelMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [tab, setTab] = useState("config");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [grName, setGrName] = useState("");
  const [grSelected, setGrSelected] = useState<Record<number, boolean>>({});
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const panelTokenHeaders = useMemo((): Record<string, string> => {
    if (!token) return {};
    return { "X-Panel-Token": token };
  }, [token]);
  const jsonPostHeaders: Record<string, string> = useMemo(
    () => ({ "Content-Type": "application/json", ...panelTokenHeaders }),
    [panelTokenHeaders],
  );

  const loadMe = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/panel/me?t=${encodeURIComponent(token)}`);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || "Falha ao carregar painel");
    }
    const data: PanelMe = await r.json();
    setMe(data);
    setEmail(data.user.email || "");
    setTimeZone(data.settings.timeZone || "America/Sao_Paulo");
  }, [token]);

  const loadGuests = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/panel/guests?t=${encodeURIComponent(token)}`);
    if (!r.ok) return;
    const j = await r.json();
    setGuests(j.guests || []);
  }, [token]);

  const loadGroups = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/panel/groups?t=${encodeURIComponent(token)}`);
    if (!r.ok) return;
    const j = await r.json();
    setGroups(j.groups || []);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoadError(
        "Este endereço precisa incluir o token na URL (ex.: …/painel?t=…). " +
          "Abra o link completo enviado pelo bot no WhatsApp. " +
          "Se o servidor não tiver PANEL_TOKEN_SECRET configurado no Render, o bot não consegue gerar o link — peça ao administrador para adicionar essa variável e fazer redeploy.",
      );
      return;
    }
    loadMe().catch((e) => setLoadError(String(e.message || e)));
  }, [token, loadMe]);

  useEffect(() => {
    if (!token) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("google") === "1") {
      toast({ title: "Google Calendar conectado ✨" });
      window.history.replaceState({}, "", `/painel?t=${encodeURIComponent(token)}`);
    }
    if (p.get("microsoft") === "1") {
      toast({ title: "Microsoft Calendar conectado ✨" });
      window.history.replaceState({}, "", `/painel?t=${encodeURIComponent(token)}`);
    }
  }, [token, toast]);

  useEffect(() => {
    if (tab !== "guests" || !token) return;
    loadGuests();
    loadGroups();
    const id = window.setInterval(() => {
      void loadGuests();
      void loadGroups();
    }, 2500);
    return () => window.clearInterval(id);
  }, [tab, token, loadGuests, loadGroups]);

  const saveProfile = async () => {
    if (!token) return;
    const r = await fetch("/api/panel/me", {
      method: "PATCH",
      headers: jsonPostHeaders,
      body: JSON.stringify({ t: token, email, timeZone }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Erro", description: j.error || "Não foi possível salvar", variant: "destructive" });
      return;
    }
    toast({ title: "Perfil salvo" });
    loadMe().catch(() => {});
  };

  const disconnectCalendar = async () => {
    if (!token) return;
    const r = await fetch("/api/panel/calendar/disconnect", {
      method: "POST",
      headers: jsonPostHeaders,
      body: JSON.stringify({ t: token }),
    });
    if (!r.ok) {
      toast({ title: "Erro ao desconectar", variant: "destructive" });
      return;
    }
    toast({ title: "Calendário desconectado" });
    loadMe().catch(() => {});
  };

  const cancelSubscription = async () => {
    if (!token) return;
    if (
      !window.confirm(
        "Tem certeza que deseja cancelar a assinatura? O acesso continua até o fim do período pago.",
      )
    ) {
      return;
    }
    const r = await fetch("/api/panel/subscription/cancel", {
      method: "POST",
      headers: jsonPostHeaders,
      body: JSON.stringify({ t: token, confirm: true }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Erro", description: j.error || "Cancelamento falhou", variant: "destructive" });
      return;
    }
    toast({
      title: "Assinatura cancelada",
      description: j.endsAt ? `Ativa até ${new Date(j.endsAt).toLocaleDateString("pt-BR")}` : undefined,
    });
    loadMe().catch(() => {});
  };

  const openStripe = () => {
    const url = me?.links.stripeCheckoutUrl || me?.links.stripePaymentLink;
    if (url) {
      window.location.href = url;
    } else {
      toast({
        title: "Pagamento indisponível",
        description: "Configure STRIPE no servidor.",
        variant: "destructive",
      });
    }
  };

  const resetGuestForm = () => {
    setEditingId(null);
    setGName("");
    setGEmail("");
    setGPhone("");
  };

  const saveGuest = async () => {
    if (!token) return;
    const hasE = gEmail.trim().length > 0;
    const hasP = gPhone.trim().length > 0;
    if (!hasE && !hasP) {
      toast({
        title: "E-mail ou telefone",
        description: "Preencha pelo menos um dos dois.",
        variant: "destructive",
      });
      return;
    }
    const r = await fetch("/api/panel/guests", {
      method: "POST",
      headers: jsonPostHeaders,
      body: JSON.stringify({
        t: token,
        id: editingId ?? undefined,
        email: gEmail.trim(),
        name: gName.trim(),
        phone: gPhone.trim(),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Erro", description: j.error || "Não salvou", variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Convidado atualizado" : "Convidado adicionado" });
    resetGuestForm();
    loadGuests();
  };

  const deleteGuest = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Remover este convidado da planilha?")) return;
    const r = await fetch(`/api/panel/guests/${id}?t=${encodeURIComponent(token)}`, {
      method: "DELETE",
      headers: panelTokenHeaders,
    });
    if (!r.ok) {
      toast({ title: "Erro ao remover", variant: "destructive" });
      return;
    }
    toast({ title: "Removido" });
    if (editingId === id) resetGuestForm();
    loadGuests();
  };

  const editGuest = (g: GuestRow) => {
    setEditingId(g.id);
    setGName(g.name.startsWith("WhatsApp ") || g.name === "Convidado" ? "" : g.name);
    setGEmail(g.email);
    setGPhone(g.phone);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const initGroupSelection = (idsInGroup: number[]) => {
    const s: Record<number, boolean> = {};
    for (const g of guests) s[g.id] = idsInGroup.includes(g.id);
    setGrSelected(s);
  };

  const openNewGroup = () => {
    setEditingGroupId(null);
    setGrName("");
    initGroupSelection([]);
    setGroupDialogOpen(true);
  };

  const openEditGroup = (gr: GroupRow) => {
    setEditingGroupId(gr.id);
    setGrName(gr.name);
    initGroupSelection(gr.contactIds);
    setGroupDialogOpen(true);
  };

  const saveGroup = async () => {
    if (!token) return;
    const name = grName.trim();
    if (name.length < 2) {
      toast({ title: "Nome do grupo", description: "Use pelo menos 2 caracteres.", variant: "destructive" });
      return;
    }
    const contactIds = Object.entries(grSelected)
      .filter(([, on]) => on)
      .map(([id]) => parseInt(id, 10));
    const path = editingGroupId != null ? `/api/panel/groups/${editingGroupId}` : "/api/panel/groups";
    const r = await fetch(`${path}?t=${encodeURIComponent(token)}`, {
      method: editingGroupId != null ? "PATCH" : "POST",
      headers: jsonPostHeaders,
      body: JSON.stringify(
        editingGroupId != null ? { t: token, name, contactIds } : { t: token, name, contactIds },
      ),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Grupo", description: j.error || "Não foi possível salvar", variant: "destructive" });
      return;
    }
    toast({ title: editingGroupId != null ? "Grupo atualizado" : "Grupo criado" });
    setGroupDialogOpen(false);
    loadGroups();
    loadGuests();
  };

  const deleteGroup = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Excluir este grupo? Os contatos da planilha permanecem.")) return;
    const r = await fetch(`/api/panel/groups/${id}?t=${encodeURIComponent(token)}`, {
      method: "DELETE",
      headers: panelTokenHeaders,
    });
    if (!r.ok) {
      toast({ title: "Erro ao excluir grupo", variant: "destructive" });
      return;
    }
    toast({ title: "Grupo removido" });
    loadGroups();
  };

  const onSpreadsheetPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch(`/api/panel/guests/import?t=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: panelTokenHeaders,
        body: fd,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Importação", description: j.error || "Falha", variant: "destructive" });
        return;
      }
      const n = j.imported ?? 0;
      const errC = (j.errors?.length as number) || 0;
      toast({
        title: "Planilha processada",
        description: `Importados ${n} contato(s).` + (errC > 0 ? ` ${errC} linha(s) com aviso no servidor.` : ""),
      });
      loadGuests();
    } finally {
      setImporting(false);
    }
  };

  if (loadError) {
    return (
      <div className={`${shellClass} flex items-center justify-center p-6`}>
        <div className={`${orbClass} left-1/4 top-20 h-64 w-64 bg-emerald-400`} />
        <div className={`${orbClass} right-1/4 bottom-32 h-48 w-48 bg-green-300`} />
        <Card className={`${cardClass} relative z-10 max-w-lg w-full border-emerald-300`}>
          <CardHeader>
            <CardTitle className="font-mago text-2xl text-emerald-900">Portal Zelar</CardTitle>
            <CardDescription className="text-slate-600">{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={`${shellClass} flex items-center justify-center`}>
        <div className={`${orbClass} left-1/3 top-1/3 h-56 w-56 bg-emerald-400`} />
        <p className="relative z-10 font-mago text-xl text-emerald-800 animate-pulse">Carregando seu painel…</p>
      </div>
    );
  }

  const cal = me.settings.calendarConnected;

  return (
    <div className={shellClass}>
      <div className={`${orbClass} -left-20 top-0 h-72 w-72 bg-emerald-400`} />
      <div className={`${orbClass} right-0 top-1/3 h-96 w-96 bg-green-400`} />
      <div className={`${orbClass} left-1/3 bottom-0 h-64 w-64 bg-teal-300`} />

      <div className="relative z-10 max-w-3xl mx-auto py-10 px-4 space-y-8">
        <header className="text-center sm:text-left space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700/80 font-medium">Zelar · espaço do organizador</p>
          <h1 className="font-mago text-4xl sm:text-5xl text-emerald-950 drop-shadow-[0_0_28px_rgba(16,185,129,0.2)]">
            Painel do tempo
          </h1>
          <p className="text-slate-600 text-sm max-w-xl">
            Ajuste sua conta e sua constelação de convidados com calma — aqui a agenda obedece a você.
          </p>
          <p className="text-sm text-slate-600">
            Telefone: <span className="font-mono text-emerald-900 font-medium">{me.user.phone}</span>
            {me.user.subscriptionStatus === "active" ? (
              <span className="ml-2 text-emerald-700 font-medium">· Assinatura ativa</span>
            ) : (
              <span className="ml-2 text-slate-500 font-medium">· Assinatura inativa</span>
            )}
          </p>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2 h-12 rounded-xl border border-emerald-200 bg-white/70 p-1 shadow-sm">
            <TabsTrigger
              value="config"
              className="rounded-lg text-slate-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              Conta
            </TabsTrigger>
            <TabsTrigger
              value="guests"
              className="rounded-lg text-slate-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              Convidados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-5 mt-6">
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="font-mago text-2xl text-emerald-900">Sua identidade</CardTitle>
                <CardDescription className="text-slate-600">
                  E-mail obrigatório para o bot no WhatsApp reconhecer você nos envios.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">Fuso horário</Label>
                  <Select value={timeZone} onValueChange={setTimeZone}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Fuso" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 bg-white border-emerald-200 text-slate-800">
                      {me.timezones.map((tz) => (
                        <SelectItem key={tz} value={tz} className="focus:bg-emerald-50">
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 font-semibold shadow-lg shadow-emerald-900/15"
                  onClick={saveProfile}
                >
                  Gravar e-mail e fuso
                </Button>
              </CardContent>
            </Card>

            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="font-mago text-2xl text-emerald-900">Calendário</CardTitle>
                <CardDescription className="text-slate-600">
                  {cal
                    ? `Vínculo ativo: ${cal === "google" ? "Google" : "Microsoft"}.`
                    : "Escolha uma torre: Google ou Microsoft para sincronizar eventos."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                {!cal ? (
                  <>
                    <a
                      href={me.links.googleConnect}
                      className="inline-flex items-center justify-center rounded-xl bg-[#4285F4] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#3367d6] hover:shadow-lg"
                    >
                      Conectar Google
                    </a>
                    <a
                      href={me.links.microsoftConnect}
                      className="inline-flex items-center justify-center rounded-xl bg-[#0078d4] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#106ebe] hover:shadow-lg"
                    >
                      Conectar Microsoft
                    </a>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-500 text-emerald-800 bg-white hover:bg-emerald-50"
                    onClick={disconnectCalendar}
                  >
                    Encerrar vínculo do calendário
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="font-mago text-2xl text-emerald-900">Oferta &amp; renovação</CardTitle>
                <CardDescription className="text-slate-600">Caminho pelo Stripe.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 font-semibold shadow-md"
                  onClick={openStripe}
                >
                  {me.user.subscriptionStatus === "active" ? "Abrir Stripe" : "Assinar com Stripe"}
                </Button>
                {me.user.subscriptionStatus === "active" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-2 border-red-600 bg-white text-red-700 font-semibold hover:bg-red-600 hover:text-white hover:border-red-600"
                    onClick={cancelSubscription}
                  >
                    Cancelar assinatura
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guests" className="space-y-5 mt-6">
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="font-mago text-2xl text-emerald-900">Círculo de convidados</CardTitle>
                <CardDescription className="text-slate-600">
                  Preencha nome (opcional) e{" "}
                  <strong className="text-emerald-800">pelo menos e-mail ou telefone</strong>. A tabela atualiza sozinha
                  a cada instantes. Você pode <strong>importar uma planilha</strong> (Excel/Sheets em .xlsx ou .csv) e
                  formar <strong>grupos</strong> para convidar todo mundo de uma vez pelo WhatsApp.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-slate-600 rounded-xl border border-emerald-200/60 bg-white/50 p-4 leading-relaxed">
                  No agendamento por mensagem, inclua algo como:{" "}
                  <span className="font-mono text-emerald-900">adicione o grupo Nome do grupo</span> — o texto
                  normalizado (sem acento) precisa bater com o nome que você deu no painel, para o Zelar trazer
                  e-mails e telefones de todos do grupo.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={onSpreadsheetPick}
                  />
                  <div className="space-y-1">
                    <Label>Planilha de contatos (Excel / CSV)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-emerald-300 text-emerald-900"
                      disabled={importing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {importing ? "Importando…" : "Enviar planilha (.xlsx, .xls ou .csv)"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/30 p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-mago text-lg text-amber-950">Grupos</h3>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-500 text-white"
                      onClick={openNewGroup}
                    >
                      Criar grupo
                    </Button>
                  </div>
                  {groups.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Nenhum grupo. Crie um, escolha o nome e marque os contatos que já estão na planilha.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {groups.map((gr) => (
                        <li
                          key={gr.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-800 border border-amber-100/80 rounded-lg bg-white/60 px-3 py-2"
                        >
                          <span>
                            <strong>{gr.name}</strong>
                            <span className="text-slate-500"> · {gr.contactIds.length} pessoa(s)</span>
                          </span>
                          <span className="space-x-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-amber-300"
                              onClick={() => openEditGroup(gr)}
                            >
                              Editar
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-red-700"
                              onClick={() => void deleteGroup(gr.id)}
                            >
                              Excluir
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5">
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-slate-700">Nome</Label>
                    <Input
                      className={inputClass}
                      value={gName}
                      onChange={(e) => setGName(e.target.value)}
                      placeholder="Como você chama no áudio…"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-slate-700">E-mail</Label>
                    <Input
                      className={inputClass}
                      value={gEmail}
                      onChange={(e) => setGEmail(e.target.value)}
                      placeholder="Se não tiver telefone, use e-mail"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-slate-700">Telefone (WhatsApp)</Label>
                    <Input
                      className={inputClass}
                      value={gPhone}
                      onChange={(e) => setGPhone(e.target.value)}
                      placeholder="Se não tiver e-mail, use o número"
                    />
                  </div>
                  <div className="sm:col-span-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 font-semibold shadow-md"
                      onClick={saveGuest}
                    >
                      {editingId ? "Salvar alterações" : "Adicionar à mesa"}
                    </Button>
                    {editingId != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-slate-600 hover:text-emerald-900 hover:bg-emerald-100/80"
                        onClick={resetGuestForm}
                      >
                        Cancelar edição
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-white/60 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-emerald-100 hover:bg-transparent">
                        <TableHead className="font-mago text-emerald-900">Nome</TableHead>
                        <TableHead className="font-mago text-emerald-900">E-mail</TableHead>
                        <TableHead className="font-mago text-emerald-900">Telefone</TableHead>
                        <TableHead className="w-[150px] font-mago text-emerald-900" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.length === 0 ? (
                        <TableRow className="border-emerald-100 hover:bg-transparent">
                          <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                            Nenhum convidado ainda. Preencha o formulário acima e toque em &quot;Adicionar à mesa&quot;.
                          </TableCell>
                        </TableRow>
                      ) : (
                        guests.map((g) => (
                          <TableRow key={g.id} className="border-emerald-100 hover:bg-emerald-50/60">
                            <TableCell className="text-slate-800">{g.name || "—"}</TableCell>
                            <TableCell className="font-mono text-sm text-slate-700">{g.email || "—"}</TableCell>
                            <TableCell className="font-mono text-sm text-slate-700">{g.phone || "—"}</TableCell>
                            <TableCell className="space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50"
                                onClick={() => editGuest(g)}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-700 font-medium hover:text-white hover:bg-red-600"
                                onClick={() => deleteGuest(g.id)}
                              >
                                Apagar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent className="bg-white border-emerald-200 max-h-[85vh] flex flex-col sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-mago text-emerald-950">
                {editingGroupId != null ? "Editar grupo" : "Novo grupo"}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                Marque os contatos. No WhatsApp, use o nome parecido com o do painel — por exemplo: adicione o
                grupo {grName.trim() || "…"}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
              <div className="space-y-2">
                <Label className="text-slate-700">Nome do grupo</Label>
                <Input
                  className={inputClass}
                  value={grName}
                  onChange={(e) => setGrName(e.target.value)}
                  placeholder="ex.: Time comercial"
                />
              </div>
              <Label className="text-slate-700">Contatos na planilha</Label>
              {guests.length === 0 ? (
                <p className="text-sm text-slate-500">Salve contatos no painel ou importe uma planilha antes.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-emerald-200/60 p-2 space-y-2">
                  {guests.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-emerald-300"
                        checked={!!grSelected[g.id]}
                        onChange={(e) => setGrSelected((s) => ({ ...s, [g.id]: e.target.checked }))}
                      />
                      <span>
                        {g.name || g.email || g.phone}
                        {g.name && (g.email || g.phone) ? ` · ${g.email || g.phone}` : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setGroupDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-gradient-to-r from-emerald-600 to-green-600 text-white"
                onClick={() => void saveGroup()}
              >
                Salvar grupo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
