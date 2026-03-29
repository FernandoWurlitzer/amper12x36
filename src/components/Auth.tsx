"use client";

import { useState } from "react";
import { useAuth, useUser, initiateEmailSignIn, initiateEmailSignUp } from "@/firebase";
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
import { LogIn, LogOut, User as UserIcon } from "lucide-react";

export function Auth() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = () => {
    if (isSignUp) {
      initiateEmailSignUp(auth, email, password);
    } else {
      initiateEmailSignIn(auth, email, password);
    }
  };

  if (isUserLoading) return <div className="h-10 w-24 bg-muted animate-pulse rounded-md" />;

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-xs font-medium text-foreground">{user.email}</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Conectado</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut(auth)} title="Sair">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <LogIn className="h-4 w-4" />
          Acesso TAC
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isSignUp ? "Criar Conta TAC" : "Acesso Restrito TAC"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">E-mail</label>
            <Input 
              type="email" 
              placeholder="seu@email.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Senha</label>
            <Input 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button onClick={handleAuth} className="w-full">
            {isSignUp ? "Cadastrar" : "Entrar"}
          </Button>
          <Button 
            variant="link" 
            className="text-xs" 
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Já tenho conta? Entrar" : "Novo membro TAC? Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
