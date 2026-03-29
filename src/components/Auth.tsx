"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser, initiateEmailSignIn, errorEmitter } from "@/firebase";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LogIn, LogOut, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Auth() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("amper.tac@ampernet.com.br");
  const [password, setPassword] = useState("tac2026F");

  useEffect(() => {
    const handleAuthError = (err: Error) => {
      toast({
        variant: "destructive",
        title: "Falha na Autenticação",
        description: "Usuário ou senha inválidos. Por favor, verifique suas credenciais.",
      });
    };

    errorEmitter.on('auth-error', handleAuthError);
    return () => errorEmitter.off('auth-error', handleAuthError);
  }, [toast]);

  const handleAuth = () => {
    initiateEmailSignIn(auth, email, password);
  };

  if (isUserLoading) return <div className="h-10 w-24 bg-muted animate-pulse rounded-md" />;

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-end">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3 w-3" />
            TAC ADMIN
          </div>
          <span className="text-[10px] text-muted-foreground">{user.email}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut(auth)} title="Sair" className="hover:text-primary">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 border-primary/50 hover:bg-primary/10 hover:text-primary transition-all">
          <LogIn className="h-4 w-4" />
          Acesso TAC
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px] border-primary/20 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Acesso Restrito TAC</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Usuário / E-mail</label>
            <Input 
              type="email" 
              placeholder="ex: amper.tac@ampernet.com.br" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary/50"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Senha</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 border-border/50 focus:border-primary/50"
            />
          </div>
          <Button onClick={handleAuth} className="w-full h-11 text-base font-semibold shadow-lg shadow-primary/20">
            Entrar no Painel
          </Button>
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest">
            Uso exclusivo para membros autorizados
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
