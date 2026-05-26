import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PluggyConnect } from "react-pluggy-connect";
import { Switch } from "@/components/ui/switch";

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
    pluggyItemId: string | null;
    defaultLessonPriceCents: number | null;
    lessonPackagesJson: unknown | null;
    pluggyAutoBuscarEnabled: boolean;
    pluggyAutoBuscarTime: string;
    pluggyAutoBuscarLastRunAt: string | null;
    pluggyAutoBuscarLastSummary: string | null;
  };
  pluggy: { itemId: string; label: string } | null;
  pluggyMaintenance: boolean;
  pluggyMaintenanceMessage?: string;
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
  payerTaxIdMasked: string;
  studentType: string;
  monthlyAmountCents: number | null;
  packageLessonsTotal: number | null;
  remainingLessons: number | null;
  /** Centavos BRL — crédito retido (cancelamento / ajuste); débitos PIX no /buscar podem abater. */
  lessonBalanceCents: number;
  /** Soma das aulas *pendentes* no calendário, cada uma pelo preço vigente no agendamento. */
  lessonPendingDebtCents: number;
  /** Crédito retido menos aulas pendentes: positivo = sobra, zero = quitado, negativo = pendente. */
  lessonNetBalanceCents: number;
  financialStatus: string;
  notes: string;
};

type LessonPackageUi = { id: string; label: string; lessons: string; priceReais: string };

type PendingLessonRow = {
  id: number;
  title: string;
  startDate: string;
  studentContactId: number | null;
  studentName: string;
  status: string;
  unitCents: number | null;
  /** Saldo líquido negativo sem linhas “pendente” no banco: últimas aulas pagas que explicam a dívida. */
  estimateFromGap?: boolean;
  dbPaymentStatus?: string;
};

function slugifyPackageId(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return base || "pacote";
}

function parseReaisInputToCents(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const normalized = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function formatBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function sanitizePanelTokenFromUrl(raw: string): string {
  let s = raw.trim();
  try {
    s = decodeURIComponent(s);
  } catch {
    /* manter */
  }
  let cut = s.split(/[?&]itemId=/i)[0]?.trim() ?? s;
  cut = cut.split(/%3[Ff]item[Ii]d%3[Dd]/i)[0]?.trim() ?? cut;
  return cut;
}

function pluggyMaintLabel(text: string, maintenance: boolean): string {
  return maintenance ? `${text} (manutenção)` : text;
}

function readPanelToken(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("t");
  if (!q || !q.trim()) return null;
  return sanitizePanelTokenFromUrl(q);
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
  const [token, setToken] = useState<string | null>(() => readPanelToken());

  useEffect(() => {
    const sync = () => setToken(readPanelToken());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  /** Corrige URL após redirect Pluggy: `t` não pode levar `?itemId=` colado (quebrava sessão do painel). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const rawT = params.get("t");
    if (!rawT?.trim()) return;
    const clean = sanitizePanelTokenFromUrl(rawT);
    if (clean === rawT.trim()) return;
    params.set("t", clean);
    params.delete("itemId");
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
    setToken(clean);
  }, []);
  const [me, setMe] = useState<PanelMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [timeZone, setTimeZone] = useState("America/Sao_Paulo");
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [tab, setTab] = useState("config");
  const [lessonPriceReais, setLessonPriceReais] = useState("");
  const [packageRows, setPackageRows] = useState<LessonPackageUi[]>([]);
  const [financeSaving, setFinanceSaving] = useState(false);
  const [pluggyTokenLoading, setPluggyTokenLoading] = useState(false);
  const [pluggyDialogOpen, setPluggyDialogOpen] = useState(false);
  const [pluggyConnectToken, setPluggyConnectToken] = useState<string | null>(null);
  const [pluggyAutoBuscarEnabled, setPluggyAutoBuscarEnabled] = useState(false);
  const [pluggyAutoBuscarTime, setPluggyAutoBuscarTime] = useState("21:00");
  const [pluggyScheduleSaving, setPluggyScheduleSaving] = useState(false);
  const [pluggyBuscarNowLoading, setPluggyBuscarNowLoading] = useState(false);

  const pluggyMaintenance = me?.pluggyMaintenance ?? true;

  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gCpf, setGCpf] = useState("");
  const [gCpfMasked, setGCpfMasked] = useState("");
  const [gBalanceReais, setGBalanceReais] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [pendingLessons, setPendingLessons] = useState<PendingLessonRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const data = (await r.json()) as PanelMe;
    if (data.pluggy === undefined) {
      data.pluggy = data.settings.pluggyItemId
        ? { itemId: data.settings.pluggyItemId, label: "Conta conectada" }
        : null;
    }
    setMe(data);
    setEmail(data.user.email || "");
    const tzOpts = Array.isArray(data.timezones) ? data.timezones : [];
    const tzRaw = data.settings.timeZone || "America/Sao_Paulo";
    const tzSafe = tzOpts.includes(tzRaw) ? tzRaw : tzOpts[0] ?? "America/Sao_Paulo";
    setTimeZone(tzSafe);
    const cents = data.settings.defaultLessonPriceCents;
    setLessonPriceReais(
      cents != null && Number.isFinite(cents)
        ? (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "",
    );
    if (data.settings.lessonPackagesJson != null) {
      const jp = data.settings.lessonPackagesJson;
      if (Array.isArray(jp) && jp.length > 0) {
        setPackageRows(
          jp.map((p: unknown) => {
            const o = p as Record<string, unknown>;
            const cents = o?.priceCents;
            const priceCentsNum = typeof cents === "number" && Number.isFinite(cents) ? cents : null;
            return {
              id: typeof o?.id === "string" ? o.id : "",
              label: typeof o?.label === "string" ? o.label : "",
              lessons: typeof o?.lessons === "number" ? String(o.lessons) : "",
              priceReais:
                priceCentsNum != null
                  ? (priceCentsNum / 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "",
            };
          }),
        );
      } else {
        setPackageRows([]);
      }
    } else {
      setPackageRows([]);
    }
    setPluggyAutoBuscarEnabled(Boolean(data.settings.pluggyAutoBuscarEnabled));
    const buscarTime = data.settings.pluggyAutoBuscarTime?.trim() || "21:00";
    setPluggyAutoBuscarTime(/^\d{1,2}:\d{2}$/.test(buscarTime) ? buscarTime : "21:00");
  }, [token]);

  const loadGuests = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/panel/guests?t=${encodeURIComponent(token)}`);
    if (!r.ok) return;
    const j = await r.json();
    setGuests(j.guests || []);
  }, [token]);

  const loadPendingLessons = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/panel/lessons/pending?t=${encodeURIComponent(token)}`);
    if (!r.ok) return;
    const j = await r.json();
    setPendingLessons(j.lessons || []);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoadError(
        "Para ver o painel, faça login com seu e-mail e senha em «Entrar». " +
          "Na primeira vez, use o link «Criar senha» enviado pelo Zelar no WhatsApp — ele identifica sua conta e salva o e-mail.",
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
    void loadGuests();
  }, [tab, token, loadGuests]);

  useEffect(() => {
    if (tab !== "lessons" || !token) return;
    void loadPendingLessons();
  }, [tab, token, loadPendingLessons]);

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

  const savePluggyBuscarSchedule = async () => {
    if (!token || pluggyMaintenance) return;
    setPluggyScheduleSaving(true);
    try {
      const r = await fetch("/api/panel/settings/pluggy-buscar-schedule", {
        method: "PATCH",
        headers: jsonPostHeaders,
        body: JSON.stringify({
          t: token,
          pluggyAutoBuscarEnabled,
          pluggyAutoBuscarTime,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Erro", description: j.error || "Não salvou", variant: "destructive" });
        return;
      }
      toast({ title: "Horário da busca salvo" });
      loadMe().catch(() => {});
    } finally {
      setPluggyScheduleSaving(false);
    }
  };

  const runPluggyBuscarNow = async () => {
    if (!token || pluggyMaintenance) return;
    setPluggyBuscarNowLoading(true);
    try {
      const r = await fetch("/api/panel/pluggy/buscar-now", {
        method: "POST",
        headers: jsonPostHeaders,
        body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Busca no extrato",
          description: j.error || j.lastSummary || "Falha na busca",
          variant: "destructive",
        });
        loadMe().catch(() => {});
        return;
      }
      const lessons = j.result?.lessonsMarked ?? 0;
      toast({
        title: "Extrato atualizado",
        description:
          lessons > 0
            ? `${lessons} aula(s) marcada(s) como paga(s).`
            : "Busca concluída. Veja o resumo abaixo ou use /buscar no WhatsApp.",
      });
      loadMe().catch(() => {});
    } finally {
      setPluggyBuscarNowLoading(false);
    }
  };

  const saveFinance = async () => {
    if (!token) return;
    const rows = packageRows.filter((r) => r.label.trim());
    for (const r of rows) {
      const lessons = parseInt(r.lessons.trim(), 10);
      const cents = parseReaisInputToCents(r.priceReais);
      if (!Number.isFinite(lessons) || lessons <= 0) {
        toast({
          title: "Pacotes",
          description: `Informe um número de aulas válido em «${r.label.trim() || "pacote"}».`,
          variant: "destructive",
        });
        return;
      }
      if (cents == null || cents <= 0) {
        toast({
          title: "Pacotes",
          description: `Informe um preço válido em «${r.label.trim()}».`,
          variant: "destructive",
        });
        return;
      }
    }
    const parsed =
      rows.length === 0
        ? null
        : rows.map((r) => {
            const lessons = parseInt(r.lessons.trim(), 10);
            const cents = parseReaisInputToCents(r.priceReais)!;
            const label = r.label.trim();
            const id = (r.id.trim() || slugifyPackageId(label)).slice(0, 64);
            return { id, label, lessons, priceCents: cents };
          });
    setFinanceSaving(true);
    try {
      const r = await fetch("/api/panel/settings/finance", {
        method: "PATCH",
        headers: jsonPostHeaders,
        body: JSON.stringify({
          t: token,
          defaultLessonPriceReais: lessonPriceReais.trim() || null,
          lessonPackagesJson: parsed,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Erro", description: j.error || "Não salvou", variant: "destructive" });
        return;
      }
      toast({ title: "Financeiro salvo" });
      loadMe().catch(() => {});
    } finally {
      setFinanceSaving(false);
    }
  };

  const openPluggyConnect = async () => {
    if (!token) return;
    if (pluggyMaintenance) {
      toast({
        title: "Manutenção",
        description: me?.pluggyMaintenanceMessage || "Pluggy temporariamente indisponível.",
        variant: "destructive",
      });
      return;
    }
    setPluggyTokenLoading(true);
    try {
      const r = await fetch("/api/panel/pluggy/connect-token", {
        method: "POST",
        headers: jsonPostHeaders,
        body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Pluggy", description: j.error || "Indisponível", variant: "destructive" });
        return;
      }
      const ct = j.connectToken as string | undefined;
      if (ct) {
        setPluggyConnectToken(ct);
        setPluggyDialogOpen(true);
      } else {
        toast({ title: "Pluggy", description: "Token vazio na resposta.", variant: "destructive" });
      }
    } finally {
      setPluggyTokenLoading(false);
    }
  };

  const copyPluggyTokenOnly = async () => {
    if (!token || pluggyMaintenance) return;
    setPluggyTokenLoading(true);
    try {
      const r = await fetch("/api/panel/pluggy/connect-token", {
        method: "POST",
        headers: jsonPostHeaders,
        body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({ title: "Pluggy", description: j.error || "Indisponível", variant: "destructive" });
        return;
      }
      const ct = j.connectToken as string | undefined;
      if (ct) {
        await navigator.clipboard.writeText(ct).catch(() => {});
        toast({
          title: "Token copiado",
          description: "Use manualmente no playground Pluggy se preferir (~30 min).",
        });
      }
    } finally {
      setPluggyTokenLoading(false);
    }
  };

  const disconnectPluggy = async () => {
    if (!token || pluggyMaintenance) return;
    if (
      !window.confirm(
        "Desconectar o banco no Pluggy? O Zelar deixa de ler o extrato para marcar aulas como pagas até você conectar de novo.",
      )
    ) {
      return;
    }
    const r = await fetch("/api/panel/settings/finance", {
      method: "PATCH",
      headers: jsonPostHeaders,
      body: JSON.stringify({ pluggyItemId: null }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ title: "Pluggy", description: j.error || "Não desconectou", variant: "destructive" });
      return;
    }
    toast({ title: "Banco desconectado" });
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
    setGCpf("");
    setGCpfMasked("");
    setGBalanceReais("");
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

    const payload: Record<string, unknown> = {
      t: token,
      id: editingId ?? undefined,
      email: gEmail.trim(),
      name: nameTrim,
      phone: gPhone.trim(),
    };
    if (gCpf.trim()) payload.payerTaxId = gCpf.trim();
    const bal = parseReaisInputToCents(gBalanceReais);
    if (bal != null) payload.lessonBalanceCents = bal;
    else if (editingId != null && !gBalanceReais.trim()) payload.lessonBalanceCents = 0;

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
    setGCpf("");
    setGCpfMasked(g.payerTaxIdMasked || "");
    setGBalanceReais(
      g.lessonBalanceCents > 0
        ? (g.lessonBalanceCents / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "",
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updatePackageRow = (idx: number, patch: Partial<LessonPackageUi>) => {
    setPackageRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const addPackageRow = () => {
    setPackageRows((prev) => [...prev, { id: "", label: "", lessons: "", priceReais: "" }]);
  };

  const removePackageRow = (idx: number) => {
    setPackageRows((prev) => prev.filter((_, i) => i !== idx));
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
      const errs = Array.isArray(j.errors) ? j.errors : [];
      const nomeIncompleto = errs.filter((e: { code?: string }) => e.code === "nome_incompleto");
      const linesNome = nomeIncompleto.map((e: { line: number }) => e.line).join(", ");

      if (nomeIncompleto.length) {
        toast({
          title: "Nome sem sobrenome na planilha",
          description:
            (n > 0 ? `Importados ${n} contato(s). ` : "") +
            `Linha(s) ${linesNome}: inclua nome e sobrenome em cada célula de nome (mínimo duas palavras, cada uma com pelo menos 2 letras). Corrija no Excel, salve e importe de novo.` +
            (errs.length > nomeIncompleto.length
              ? ` Outras ${errs.length - nomeIncompleto.length} linha(s) também precisam de ajuste.`
              : ""),
          variant: "destructive",
          duration: 12_000,
        });
      } else if (errs.length) {
        const preview = errs
          .slice(0, 5)
          .map((e: { line: number; error: string }) => `Linha ${e.line}: ${e.error}`)
          .join(" ");
        toast({
          title: "Planilha processada com avisos",
          description: `${errs.length} linha(s) não importadas. ${preview}${errs.length > 5 ? "…" : ""}`,
          variant: "destructive",
          duration: 10_000,
        });
      } else {
        toast({
          title: "Planilha processada",
          description: `Importados ${n} contato(s).`,
        });
      }
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
            <Button asChild className="mt-4 bg-emerald-700 hover:bg-emerald-800 text-white">
              <Link href="/painel/entrar">Ir para login</Link>
            </Button>
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
          <TabsList className="grid w-full max-w-2xl grid-cols-3 h-12 rounded-xl border border-emerald-200 bg-white/70 p-1 shadow-sm">
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
            <TabsTrigger
              value="lessons"
              className="rounded-lg text-slate-600 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md"
            >
              Aulas
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
                      {(Array.isArray(me.timezones) && me.timezones.length ? me.timezones : ["America/Sao_Paulo"]).map(
                        (tz) => (
                          <SelectItem key={tz} value={tz} className="focus:bg-emerald-50">
                            {tz}
                          </SelectItem>
                        ),
                      )}
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
                <CardTitle className="font-mago text-2xl text-emerald-900">Pluggy &amp; preços de aula</CardTitle>
                <CardDescription className="text-slate-600">
                  Conecte o Open Finance (Pluggy) para o sistema reconhecer PIX e créditos com base no <strong>nome do
                  pagador</strong> e no <strong>valor</strong>, e atualizar o título da aula de «pendente» para «pago».
                  Aqui você define o preço de referência e os pacotes — status de pagamento no dia a dia vem do banco, não
                  de campos manuais na aba de alunos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pluggyMaintenance && (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {me.pluggyMaintenanceMessage ||
                      "Open Finance (Pluggy) em manutenção. Use comprovante PIX (foto ou PDF) no WhatsApp."}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Só usamos créditos no extrato com <strong>data ≥ primeira aula</strong> criada no calendário (qualquer
                  aluno). Faturas de cartão, corretoras e boletos são ignorados. No WhatsApp,{" "}
                  <strong className="font-mono text-emerald-900">/buscar</strong>
                  {pluggyMaintenance ? " (manutenção)" : ""} lê o extrato (Pluggy) ou envie{" "}
                  <strong>foto ou PDF</strong> do comprovante do PIX recebido — o mesmo pagamento não entra duas vezes.
                </p>
                {me.pluggy ? (
                  <div className="rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 to-white p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Banco conectado</p>
                      <p className="text-lg font-semibold text-emerald-950 mt-0.5">{me.pluggy.label}</p>
                      <p className="text-xs font-mono text-slate-500 break-all">Item {me.pluggy.itemId}</p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-300 text-red-800 hover:bg-red-50"
                      disabled={pluggyMaintenance}
                      onClick={() => void disconnectPluggy()}
                    >
                      {pluggyMaintLabel("Desconectar banco", pluggyMaintenance)}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    Nenhum banco vinculado ainda. Use <strong>Conectar banco</strong> abaixo.
                  </p>
                )}

                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Busca automática do extrato</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Todo dia no horário escolhido (fuso{" "}
                      <span className="font-mono text-emerald-800">{me.settings.timeZone}</span>), o Zelar roda a
                      mesma conciliação do <span className="font-mono">/buscar</span> no WhatsApp. Você ainda pode
                      buscar manualmente quando quiser.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="pluggy-auto-buscar"
                        checked={pluggyAutoBuscarEnabled}
                        onCheckedChange={setPluggyAutoBuscarEnabled}
                        disabled={!me.pluggy || pluggyMaintenance}
                      />
                      <Label htmlFor="pluggy-auto-buscar" className="text-slate-700 cursor-pointer">
                        {pluggyMaintLabel("Ativar busca diária", pluggyMaintenance)}
                      </Label>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pluggy-buscar-time" className="text-xs text-slate-600">
                        Horário
                      </Label>
                      <Input
                        id="pluggy-buscar-time"
                        type="time"
                        className={`${inputClass} w-[8.5rem]`}
                        value={pluggyAutoBuscarTime}
                        onChange={(e) => setPluggyAutoBuscarTime(e.target.value)}
                        disabled={!me.pluggy || !pluggyAutoBuscarEnabled || pluggyMaintenance}
                      />
                    </div>
                  </div>
                  {!me.pluggy && !pluggyMaintenance && (
                    <p className="text-xs text-amber-800">Conecte o banco para ativar a busca automática.</p>
                  )}
                  {me.settings.pluggyAutoBuscarLastRunAt && (
                    <p className="text-xs text-slate-600">
                      Última busca:{" "}
                      {new Date(me.settings.pluggyAutoBuscarLastRunAt).toLocaleString("pt-BR", {
                        timeZone: me.settings.timeZone,
                      })}
                      {me.settings.pluggyAutoBuscarLastSummary ?
                        ` — ${me.settings.pluggyAutoBuscarLastSummary}`
                      : ""}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-emerald-600 text-emerald-800 hover:bg-emerald-50"
                      disabled={pluggyScheduleSaving || !me.pluggy || pluggyMaintenance}
                      onClick={() => void savePluggyBuscarSchedule()}
                    >
                      {pluggyScheduleSaving ?
                        "Salvando…"
                      : pluggyMaintLabel("Salvar horário", pluggyMaintenance)}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-50"
                      disabled={pluggyBuscarNowLoading || !me.pluggy || pluggyMaintenance}
                      onClick={() => void runPluggyBuscarNow()}
                    >
                      {pluggyBuscarNowLoading ?
                        "Buscando…"
                      : pluggyMaintLabel("Buscar agora", pluggyMaintenance)}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700">Preço por aula (referência, R$)</Label>
                  <Input
                    className={inputClass}
                    value={lessonPriceReais}
                    onChange={(e) => setLessonPriceReais(e.target.value)}
                    placeholder="ex.: 80,00"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-slate-700">Pacotes nomeados</Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Crie nomes e preços (ex.: &quot;Pacote básico&quot;, 10 aulas, R$ 800). Use esses nomes no WhatsApp
                      nas marcações.
                    </p>
                  </div>
                  {packageRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-emerald-300/80 bg-emerald-50/50 px-4 py-8 text-center text-sm text-slate-600">
                      Nenhum pacote ainda. Toque em &quot;Adicionar pacote&quot; para montar sua tabela.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {packageRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_100px_140px_auto] items-end rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/50 p-4 shadow-sm"
                        >
                          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                            <Label className="text-xs text-slate-600">Nome do pacote</Label>
                            <Input
                              className={inputClass}
                              value={row.label}
                              onChange={(e) => updatePackageRow(idx, { label: e.target.value })}
                              placeholder="Ex.: Pacote básico"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600">Aulas</Label>
                            <Input
                              className={inputClass}
                              value={row.lessons}
                              onChange={(e) => updatePackageRow(idx, { lessons: e.target.value })}
                              placeholder="10"
                              inputMode="numeric"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-slate-600">Preço total (R$)</Label>
                            <Input
                              className={inputClass}
                              value={row.priceReais}
                              onChange={(e) => updatePackageRow(idx, { priceReais: e.target.value })}
                              placeholder="800,00"
                              inputMode="decimal"
                            />
                          </div>
                          <div className="flex justify-end sm:col-span-2 lg:col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-700 hover:bg-red-50 hover:text-red-800"
                              onClick={() => removePackageRow(idx)}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto border-emerald-400 text-emerald-900 hover:bg-emerald-50"
                    onClick={addPackageRow}
                  >
                    + Adicionar pacote
                  </Button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={financeSaving}
                    className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 font-semibold shadow-md"
                    onClick={() => void saveFinance()}
                  >
                    {financeSaving ? "Salvando…" : "Salvar preços"}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    disabled={pluggyTokenLoading || pluggyMaintenance}
                    className="bg-slate-800 text-white hover:bg-slate-900"
                    onClick={() => void openPluggyConnect()}
                  >
                    {pluggyTokenLoading ?
                      "Abrindo…"
                    : pluggyMaintLabel("Conectar banco (Pluggy)", pluggyMaintenance)}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pluggyTokenLoading || pluggyMaintenance}
                    className="border-emerald-600 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => void copyPluggyTokenOnly()}
                  >
                    {pluggyMaintLabel("Copiar token", pluggyMaintenance)}
                  </Button>
                </div>
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
                  Cadastre apenas <strong className="text-emerald-800">nome completo</strong> e{" "}
                  <strong className="text-emerald-800">e-mail e/ou telefone</strong>.{" "}
                  <strong>Pendente (aulas)</strong> soma o valor das aulas ainda não pagas (cada uma com o preço
                  congelado no dia em que foi marcada; mudar o preço no painel não altera aulas antigas).{" "}
                  <strong>Saldo retido</strong> é crédito (ex.: cancelamento); o Pluggy pode abatê-lo no{" "}
                  <span className="font-mono text-emerald-900">/buscar</span>
                  {pluggyMaintenance ? " (manutenção)" : ""}. No WhatsApp use{" "}
                  <span className="font-mono text-emerald-900">/aula</span> para ver a agenda do dia.
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

                <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-5">
                  <div className="space-y-2 sm:col-span-2">
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
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-slate-700">CPF do pagador (opcional)</Label>
                    <Input
                      className={inputClass}
                      value={gCpf}
                      onChange={(e) => setGCpf(e.target.value)}
                      placeholder={gCpfMasked ? `Atual: ${gCpfMasked} — digite para trocar` : "Somente para conciliar pagamentos"}
                      inputMode="numeric"
                    />
                    <p className="text-xs text-slate-500">
                      O Zelar não salva o CPF puro: guarda apenas hash seguro e mostra os últimos 4 dígitos.
                    </p>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-slate-700">Saldo retido (R$)</Label>
                    <Input
                      className={inputClass}
                      value={gBalanceReais}
                      onChange={(e) => setGBalanceReais(e.target.value)}
                      placeholder="0,00 — crédito após cancelar aula ou ajuste manual"
                    />
                    <p className="text-xs text-slate-500">
                      Este é o crédito manual/retido. Na tabela, o Zelar mostra o saldo líquido: positivo sobra, zero
                      quitado, negativo pendente.
                    </p>
                  </div>
                  <div className="sm:col-span-2 flex flex-wrap gap-2">
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
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">CPF</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Saldo</TableHead>
                        <TableHead className="min-w-[140px] font-mago text-emerald-900" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.length === 0 ? (
                        <TableRow className="border-emerald-100 hover:bg-transparent">
                          <TableCell colSpan={6} className="text-center text-slate-500 py-10">
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
                            <TableCell className="font-mono text-sm text-slate-700 whitespace-nowrap max-w-[220px] truncate">
                              {g.email || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-sm text-slate-700 whitespace-nowrap">
                              {g.payerTaxIdMasked || "—"}
                            </TableCell>
                            <TableCell
                              className={
                                (g.lessonNetBalanceCents ?? 0) > 0
                                  ? "text-emerald-700 font-semibold whitespace-nowrap"
                                  : (g.lessonNetBalanceCents ?? 0) < 0
                                    ? "text-red-700 font-semibold whitespace-nowrap"
                                    : "text-slate-700 font-semibold whitespace-nowrap"
                              }
                              title={`Crédito: ${formatBrl(g.lessonBalanceCents ?? 0)} · Aulas pendentes: ${formatBrl(
                                g.lessonPendingDebtCents ?? 0,
                              )}`}
                            >
                              {formatBrl(g.lessonNetBalanceCents ?? (g.lessonBalanceCents ?? 0) - (g.lessonPendingDebtCents ?? 0))}
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

          <TabsContent value="lessons" className="space-y-5 mt-6">
            <Card className={cardClass}>
              <CardHeader>
                <CardTitle className="font-mago text-2xl text-emerald-900">Aulas Pendentes</CardTitle>
                <CardDescription className="text-slate-600">
                  Só entram aulas <strong>pendentes</strong> com <strong>aluno vinculado</strong> no cadastro (qualquer
                  data). O valor usa o preço da aula ou o <strong>preço padrão</strong> do painel para calcular dívida e
                  saldo líquido. Se o saldo líquido ficar negativo sem pendência no banco, podemos mostrar linhas
                  estimadas (últimas aulas pagas).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-emerald-200/80 bg-white/60 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-emerald-100 hover:bg-transparent">
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Data</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Aluno</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Status</TableHead>
                        <TableHead className="font-mago text-emerald-900 whitespace-nowrap">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingLessons.length === 0 ? (
                        <TableRow className="border-emerald-100 hover:bg-transparent">
                          <TableCell colSpan={4} className="text-center text-slate-500 py-10">
                            Nenhuma aula pendente nem estimativa de dívida (saldo líquido negativo sem pendências no
                            banco).
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendingLessons.map((lesson) => (
                          <TableRow key={lesson.id} className="border-emerald-100 hover:bg-emerald-50/60">
                            <TableCell className="font-mono text-sm text-slate-700 whitespace-nowrap">
                              {new Date(lesson.startDate).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </TableCell>
                            <TableCell className="text-slate-800 whitespace-nowrap">{lesson.studentName}</TableCell>
                            <TableCell
                              className={`font-semibold whitespace-nowrap ${
                                lesson.estimateFromGap ? "text-amber-800" : "text-red-700"
                              }`}
                              title={
                                lesson.estimateFromGap
                                  ? `No banco está ${lesson.dbPaymentStatus ?? "pago"}; exibido como referência pela dívida líquida.`
                                  : undefined
                              }
                            >
                              {lesson.status}
                            </TableCell>
                            <TableCell className="text-slate-700 whitespace-nowrap">
                              {lesson.unitCents != null ? formatBrl(lesson.unitCents) : "—"}
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

      <Dialog
        open={pluggyDialogOpen}
        onOpenChange={(open) => {
          setPluggyDialogOpen(open);
          if (!open) setPluggyConnectToken(null);
        }}
      >
        <DialogContent className="max-w-[560px] max-h-[92vh] overflow-y-auto bg-white border-emerald-200">
          <DialogHeader>
            <DialogTitle className="font-mago text-emerald-950">Pluggy Connect</DialogTitle>
            <DialogDescription className="text-slate-600">
              Contas <strong>PF</strong> e <strong>PJ</strong> (Open Finance — banco). Autorize só leitura do extrato; o
              Zelar usa apenas <strong>nome do pagador</strong> e <strong>valor</strong> para casar com seus alunos e
              marcar aulas pagas desde a <strong>primeira aula criada</strong> de cada aluno. Em sandbox, escolha o
              conector <strong>Sandbox</strong> (ex.: <span className="font-mono">user-ok</span> /{" "}
              <span className="font-mono">password-ok</span>, MFA <span className="font-mono">123456</span>). Em
              produção use HTTPS e <span className="font-mono text-emerald-900">BASE_URL</span> público (webhook Pluggy).
            </DialogDescription>
          </DialogHeader>
          {pluggyConnectToken ? (
            <div className="min-h-[420px] w-full">
              <PluggyConnect
                connectToken={pluggyConnectToken}
                connectorTypes={["PERSONAL_BANK", "BUSINESS_BANK"]}
                includeSandbox={
                  import.meta.env.DEV || import.meta.env.VITE_PLUGGY_INCLUDE_SANDBOX === "true"
                }
                language="pt"
                theme="light"
                onSuccess={async (data: { item?: { id?: string } }) => {
                  const itemId = data?.item?.id?.trim();
                  if (itemId && token) {
                    try {
                      const r = await fetch("/api/panel/settings/finance", {
                        method: "PATCH",
                        headers: jsonPostHeaders,
                        body: JSON.stringify({ pluggyItemId: itemId }),
                      });
                      const j = await r.json().catch(() => ({}));
                      if (!r.ok) {
                        toast({
                          title: "Pluggy",
                          description:
                            (j as { error?: string }).error ||
                            "Conta conectada, mas não salvamos o item — tente de novo ou aguarde o webhook.",
                          variant: "destructive",
                        });
                      } else {
                        toast({
                          title: "Conta conectada",
                          description: "Item Pluggy vinculado ao seu usuário.",
                        });
                      }
                    } catch {
                      toast({
                        title: "Pluggy",
                        description: "Falha de rede ao salvar o item; o webhook pode vincular em seguida.",
                        variant: "destructive",
                      });
                    }
                  } else {
                    toast({
                      title: "Conta conectada",
                      description: "O item Pluggy será associado ao seu usuário em instantes (webhook).",
                    });
                  }
                  setPluggyDialogOpen(false);
                  setPluggyConnectToken(null);
                  void loadMe();
                }}
                onError={(err: { message?: string }) => {
                  toast({
                    title: "Pluggy",
                    description: err?.message || "Erro no widget",
                    variant: "destructive",
                  });
                }}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
