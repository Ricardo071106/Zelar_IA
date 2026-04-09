import { useCallback, useEffect, useMemo, useState } from "react";
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

function getToken(): string | null {
  const q = new URLSearchParams(window.location.search).get("t");
  return q && q.trim() ? q.trim() : null;
}

export default function UserPanelPage() {
  const { toast } = useToast();
  const token = useMemo(() => getToken(), []);

  const [me, setMe] = useState<PanelMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [tab, setTab] = useState("config");

  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const authHeader = useMemo(() => (token ? { "X-Panel-Token": token } : {}), [token]);

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
      setLoadError("Link inválido ou incompleto (falta o token de acesso). Abra o link enviado pelo Zelar no WhatsApp.");
      return;
    }
    loadMe().catch((e) => setLoadError(String(e.message || e)));
  }, [token, loadMe]);

  useEffect(() => {
    if (!token) return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("google") === "1") {
      toast({ title: "Google Calendar conectado" });
      window.history.replaceState({}, "", `/painel?t=${encodeURIComponent(token)}`);
    }
    if (p.get("microsoft") === "1") {
      toast({ title: "Microsoft Calendar conectado" });
      window.history.replaceState({}, "", `/painel?t=${encodeURIComponent(token)}`);
    }
  }, [token, toast]);

  useEffect(() => {
    if (tab !== "guests" || !token) return;
    loadGuests();
    const id = window.setInterval(loadGuests, 2500);
    return () => window.clearInterval(id);
  }, [tab, token, loadGuests]);

  const saveProfile = async () => {
    if (!token) return;
    const r = await fetch("/api/panel/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader },
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
      headers: { "Content-Type": "application/json", ...authHeader },
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
      headers: { "Content-Type": "application/json", ...authHeader },
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
    if (!gEmail.trim()) {
      toast({ title: "E-mail obrigatório", variant: "destructive" });
      return;
    }
    const r = await fetch("/api/panel/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
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
      headers: { ...authHeader },
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
    setGName(g.name);
    setGEmail(g.email);
    setGPhone(g.phone);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const notifyGuests = async () => {
    if (!token) return;
    const r = await fetch("/api/panel/guests/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      body: JSON.stringify({ t: token }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Erro", description: j.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Concluído",
      description: `E-mails: ${j.emailed ?? 0} · WhatsApp: ${j.whatsapped ?? 0}`,
    });
    loadGuests();
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle>Painel Zelar</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Carregando…</p>
      </div>
    );
  }

  const cal = me.settings.calendarConnected;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Painel Zelar</h1>
          <p className="text-sm text-slate-600 mt-1">
            Telefone: <span className="font-mono">{me.user.phone}</span>
            {me.user.subscriptionStatus === "active" ? (
              <span className="ml-2 text-emerald-600">· Assinatura ativa</span>
            ) : (
              <span className="ml-2 text-amber-600">· Assinatura inativa</span>
            )}
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="guests">Convidados</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conta</CardTitle>
                <CardDescription>E-mail obrigatório para usar o bot no WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fuso horário</Label>
                  <Select value={timeZone} onValueChange={setTimeZone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Fuso" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {me.timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={saveProfile}>
                  Salvar e-mail e fuso
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Calendário</CardTitle>
                <CardDescription>
                  {cal
                    ? `Conectado: ${cal === "google" ? "Google" : "Microsoft"}.`
                    : "Conecte Google ou Microsoft para sincronizar eventos."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {!cal ? (
                  <>
                    <Button type="button" variant="secondary" asChild>
                      <a href={me.links.googleConnect}>Conectar Google</a>
                    </Button>
                    <Button type="button" variant="secondary" asChild>
                      <a href={me.links.microsoftConnect}>Conectar Microsoft</a>
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" onClick={disconnectCalendar}>
                    Desconectar calendário
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assinatura</CardTitle>
                <CardDescription>Pagamento via Stripe.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button type="button" onClick={openStripe}>
                  {me.user.subscriptionStatus === "active" ? "Gerenciar / renovar (Stripe)" : "Assinar com Stripe"}
                </Button>
                {me.user.subscriptionStatus === "active" && (
                  <Button type="button" variant="destructive" onClick={cancelSubscription}>
                    Cancelar assinatura
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guests" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-lg">Planilha de convidados</CardTitle>
                  <CardDescription>
                    Nome, e-mail e telefone (atualiza em tempo quase real). Use Concluído para avisar convidados
                    ainda não notificados.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={resetGuestForm}>
                    Novo convidado
                  </Button>
                  <Button type="button" onClick={notifyGuests}>
                    Concluído
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 border rounded-lg p-4 bg-white">
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Nome</Label>
                    <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label>E-mail</Label>
                    <Input
                      value={gEmail}
                      onChange={(e) => setGEmail(e.target.value)}
                      placeholder="Obrigatório"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label>Telefone (WhatsApp)</Label>
                    <Input value={gPhone} onChange={(e) => setGPhone(e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="sm:col-span-3 flex gap-2">
                    <Button type="button" onClick={saveGuest}>
                      {editingId ? "Salvar alterações" : "Adicionar à tabela"}
                    </Button>
                    {editingId != null && (
                      <Button type="button" variant="ghost" onClick={resetGuestForm}>
                        Cancelar edição
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-md border bg-white overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="w-[140px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                            Nenhum convidado. Clique em &quot;Novo convidado&quot;, preencha e adicione.
                          </TableCell>
                        </TableRow>
                      ) : (
                        guests.map((g) => (
                          <TableRow key={g.id}>
                            <TableCell>{g.name || "—"}</TableCell>
                            <TableCell className="font-mono text-sm">{g.email}</TableCell>
                            <TableCell className="font-mono text-sm">{g.phone || "—"}</TableCell>
                            <TableCell className="space-x-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => editGuest(g)}>
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
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
