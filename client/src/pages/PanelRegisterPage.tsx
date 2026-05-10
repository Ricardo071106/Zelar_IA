import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const shellClass =
  "min-h-screen relative overflow-hidden bg-gradient-to-b from-white via-emerald-50/70 to-green-50 text-slate-800";

const orbClass =
  "pointer-events-none absolute rounded-full blur-3xl opacity-35 mix-blend-multiply";

const cardClass =
  "rounded-2xl border border-emerald-200/70 bg-white/85 backdrop-blur-md shadow-[0_0_48px_rgba(16,185,129,0.07)]";

const inputClass =
  "border-emerald-200 bg-white text-slate-800 placeholder:text-slate-400 focus-visible:ring-emerald-500/35 focus-visible:border-emerald-400";

export default function PanelRegisterPage() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/panel/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Cadastro",
          description: j.error || "Não foi possível concluir.",
          variant: "destructive",
        });
        return;
      }
      const token = j.token as string | undefined;
      if (!token) {
        toast({ title: "Resposta inválida", variant: "destructive" });
        return;
      }
      window.location.assign(`/painel?t=${encodeURIComponent(token)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={shellClass}>
      <div className={`${orbClass} -left-20 top-0 h-72 w-72 bg-emerald-400`} />
      <div className={`${orbClass} right-0 top-1/3 h-96 w-96 bg-green-400`} />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <Card className={`${cardClass} w-full max-w-md`}>
          <CardHeader className="space-y-1">
            <CardTitle className="font-mago text-2xl text-emerald-950">Criar senha do painel</CardTitle>
            <CardDescription className="text-slate-600">
              Disponível para quem já conversou com o Zelar no WhatsApp. Use o mesmo número (com DDI) e defina uma senha com pelo menos 8
              caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">WhatsApp (DDI + número)</Label>
                <Input
                  id="phone"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="5511999999999"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2">Confirmar senha</Label>
                <Input
                  id="password2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={inputClass}
                  required
                  minLength={8}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
              >
                {loading ? "Salvando…" : "Registrar e entrar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Já tem senha?{" "}
              <Link href="/painel/entrar" className="font-medium text-emerald-800 underline underline-offset-4 hover:text-emerald-950">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
