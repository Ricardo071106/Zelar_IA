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
import { Textarea } from "@/components/ui/textarea";
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

type GuestRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  studentType: string;
  monthlyAmountCents: number | null;
  packageLessonsTotal: number | null;
  remainingLessons: number | null;
  financialStatus: string;
  notes: string;
};

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
  const [tab, setTab] = useState("config");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gStudentType, setGStudentType] = useState("");
  const [gMonthly, setGMonthly] = useState("");
  const [gPackage, setGPackage] = useState("");
  const [gRemaining, setGRemaining] = useState("");
  const [gFinancial, setGFinancial] = useState("pendente");
  const [gNotes, setGNotes] = useState("");
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
    const id = window.setInterval(() => {
      void loadGuests();
    }, 2500);
    return () => window.clearInterval(id);
  }, [tab, token, loadGuests]);

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
    setGStudentType("");
    setGMonthly("");
    setGPackage("");
    setGRemaining("");
    setGFinancial("pendente");
    setGNotes("");
  };

  const saveGuest = async () => {
    if (!token) return;
    const nameTrim = gName.trim();
    const words = nameTrim.split(/\s+/).filter(Boolean);
    if (words.length < 2 || words.some((w) => w.length < 2)) {
      toast({
        title: "Nome completo",
        description: "Informe nome e sobrenome (cada parte com pelo menos 2 caracteres).",
        variant: "destructive",
      });
      return;
    }
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
    if (gMonthly.trim()) {
      const normalized = gMonthly.trim().replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      if (!Number.isFinite(n) || n < 0) {
        toast({ title: "Valor mensal", description: "Use um valor válido em reais.", variant: "destructive" });
        return;
      }
    }
    let packageLessonsTotal: number | null | undefined = undefined;
    let remainingLessons: number | null | undefined = undefined;
    if (gPackage.trim()) {
      const n = parseInt(gPackage.trim(), 10);
      if (Number.isNaN(n)) {
        toast({ title: "Pacote", description: "Número inválido.", variant: "destructive" });
        return;
      }
      packageLessonsTotal = n;
    }
    if (gRemaining.trim()) {
      const n = parseInt(gRemaining.trim(), 10);
      if (Number.isNaN(n)) {
        toast({ title: "Aulas restantes", description: "Número inválido.", variant: "destructive" });
        return;
      }
      remainingLessons = n;
    }

    const payload: Record<string, unknown> = {
      t: token,
      id: editingId ?? undefined,
      email: gEmail.trim(),
      name: nameTrim,
      phone: gPhone.trim(),
      studentType: gStudentType.trim(),
      notes: gNotes.trim(),
      financialStatus: gFinancial,
      packageLessonsTotal,
      remainingLessons,
    };
    if (gMonthly.trim()) {
      payload.monthlyAmountReais = gMonthly.trim();
    }

    const r = await fetch("/api/panel/guests", {
      method: "POST",
      headers: jsonPostHeaders,
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Erro", description: j.error || "Não salvou", variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Aluno atualizado" : "Aluno adicionado" });
    resetGuestForm();
    loadGuests();
  };

  const deleteGuest = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Remover este aluno da lista?")) return;
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
    setGName(g.name.startsWith("WhatsApp ") ? "" : g.name);
    setGEmail(g.email);
    setGPhone(g.phone);
    setGStudentType(g.studentType || "");
    setGMonthly(
      g.monthlyAmountCents != null
        ? (g.monthlyAmountCents / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "",
    );
    setGPackage(g.packageLessonsTotal != null ? String(g.packageLessonsTotal) : "");
    setGRemaining(g.remainingLessons != null ? String(g.remainingLessons) : "");
    setGFinancial(g.financialStatus || "pendente");
    setGNotes(g.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
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

      <div className="relative z-10 max-w-5xl mx-auto py-10 px-4 space-y-8">
        <header className="text-center sm:text-left space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-emerald-700/80 font-medium">Zelar · espaço do organizador</p>
          <h1 className="font-mago text-4xl sm:text-5xl text-emerald-950 drop-shadow-[0_0_28px_rgba(16,185,129,0.2)]">
            Painel Zelar
          </h1>
          <p className="text-slate-600 text-sm max-w-xl">
            Ajuste sua conta, alunos/clientes, calendário e lembretes no WhatsApp.
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
              Alunos
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
                <CardTitle className="font-mago text-2xl text-emerald-900">Alunos e clientes</CardTitle>
                <CardDescription className="text-slate-600">
                  <strong className="text-emerald-800">Nome completo obrigatório</strong> (nome e sobrenome). Preencha também{" "}
                  <strong className="text-emerald-800">pelo menos e-mail ou telefone</strong>. A tabela atualiza sozinha.
                  No WhatsApp você pode perguntar pendências financeiras, aulas de hoje ou quantas aulas faltam — sempre{" "}
                  <strong>digitando em texto</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
                      disabled={importing}
                      className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 font-semibold shadow-md border-0"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {importing ? "Importando…" : "Enviar planilha (.xlsx, .xls ou .csv)"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5">
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <Label className="text-slate-700">Nome completo *</Label>
                    <Input
                      className={inputClass}
                      value={gName}
                      onChange={(e) => setGName(e.target.value)}
                      placeholder="Ex.: Maria Silva"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">E-mail</Label>
                    <Input
                      className={inputClass}
                      value={gEmail}
                      onChange={(e) => setGEmail(e.target.value)}
                      placeholder="opcional se tiver telefone"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Telefone (WhatsApp)</Label>
                    <Input
                      className={inputClass}
                      value={gPhone}
                      onChange={(e) => setGPhone(e.target.value)}
                      placeholder="opcional se tiver e-mail"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Tipo de aluno</Label>
                    <Input
                      className={inputClass}
                      value={gStudentType}
                      onChange={(e) => setGStudentType(e.target.value)}
                      placeholder="ex.: particular, grupo…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Valor mensal (R$)</Label>
                    <Input
                      className={inputClass}
                      value={gMonthly}
                      onChange={(e) => setGMonthly(e.target.value)}
                      placeholder="ex.: 350 ou 1.200,50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Status financeiro</Label>
                    <Select value={gFinancial} onValueChange={setGFinancial}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-emerald-200">
                        <SelectItem value="pendente">pendente</SelectItem>
                        <SelectItem value="pago">pago</SelectItem>
                        <SelectItem value="cancelado">cancelado</SelectItem>
                        <SelectItem value="reagendado">reagendado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Aulas no pacote</Label>
                    <Input
                      className={inputClass}
                      value={gPackage}
                      onChange={(e) => setGPackage(e.target.value)}
                      placeholder="opcional"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700">Aulas restantes</Label>
                    <Input
                      className={inputClass}
                      value={gRemaining}
                      onChange={(e) => setGRemaining(e.target.value)}
                      placeholder="opcional"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-3">
                    <Label className="text-slate-700">Observações</Label>
                    <Textarea
                      className={inputClass}
                      value={gNotes}
                      onChange={(e) => setGNotes(e.target.value)}
                      placeholder="Notas internas…"
                      rows={2}
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 font-semibold shadow-md"
                      onClick={saveGuest}
                    >
                      {editingId ? "Salvar alterações" : "Adicionar aluno"}
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
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Nome</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Telefone</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">E-mail</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Tipo</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">R$ mês</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Status</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Aulas (rest.)</TableHead>
                        <TableHead className="min-w-[140px] font-mago text-emerald-900" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.length === 0 ? (
                        <TableRow className="border-emerald-100 hover:bg-transparent">
                          <TableCell colSpan={8} className="text-center text-slate-500 py-10">
                            Nenhum aluno ainda. Preencha o formulário acima e toque em &quot;Adicionar aluno&quot;.
                          </TableCell>
                        </TableRow>
                      ) : (
                        guests.map((g) => (
                          <TableRow key={g.id} className="border-emerald-100 hover:bg-emerald-50/60">
                            <TableCell className="text-slate-800 whitespace-nowrap">{g.name || "—"}</TableCell>
                            <TableCell className="font-mono text-sm text-slate-700 whitespace-nowrap">
                              {g.phone || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-slate-700 whitespace-nowrap max-w-[180px] truncate">
                              {g.email || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700">{g.studentType || "—"}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {g.monthlyAmountCents != null
                                ? (g.monthlyAmountCents / 100).toLocaleString("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  })
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm capitalize">{g.financialStatus || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {g.remainingLessons != null ? g.remainingLessons : "—"}
                            </TableCell>
                            <TableCell className="space-x-2 whitespace-nowrap">
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
      </div>
    </div>
  );
}
