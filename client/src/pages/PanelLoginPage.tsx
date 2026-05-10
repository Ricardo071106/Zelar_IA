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

export default function PanelLoginPage() {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await fetch("/api/panel/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          title: "Não foi possível entrar",
          description: j.error || "Verifique telefone e senha.",
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
            <CardTitle className="font-mago text-2xl text-emerald-950">Painel Zelar</CardTitle>
            <CardDescription className="text-slate-600">
              Entre com o mesmo número do WhatsApp (apenas números, com DDI) e sua senha do painel.
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
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
              >
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Primeira vez no painel?{" "}
              <Link href="/painel/registro" className="font-medium text-emerald-800 underline underline-offset-4 hover:text-emerald-950">
                Registre-se
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
