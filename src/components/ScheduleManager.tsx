
"use client";

import { TechnicianRow } from "./TechnicianRow";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Lock, Copy, CheckCircle2, Share2, Loader2 } from "lucide-react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Technician = {
  id: string;
  name: string;
};

interface ScheduleManagerProps {
  isFullscreen?: boolean;
}

// Cidades fixas conforme solicitado
const CITIES: Technician[] = [
  { id: "francisco-beltrao", name: "Francisco Beltrão" },
  { id: "ponta-grossa", name: "Ponta Grossa" },
  { id: "pato-branco", name: "Pato Branco" },
];

export function ScheduleManager({ isFullscreen = false }: ScheduleManagerProps) {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Verificar se o usuário atual é um Membro TAC
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  const copyUid = () => {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      toast({
        title: "UID Copiado!",
        description: "Agora cole este ID na coleção 'roles_tac_members' no Console do Firebase.",
      });
    }
  };

  const copyPublicLink = () => {
    const url = window.location.href;
    if (url.includes('workstations.cloud.google.com')) {
      toast({
        variant: "destructive",
        title: "Atenção!",
        description: "Você está no modo editor. Use o link do App Hosting (Console Firebase) para compartilhar.",
      });
      return;
    }
    
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copiado!",
      description: "O link público da agenda foi copiado para sua área de transferência.",
    });
  };

  if (isAuthLoading || isTacLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Sincronizando Agenda...</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", isFullscreen && "space-y-2")}>
      {!isFullscreen && user && !isTacMember && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 space-y-3 text-destructive">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <p className="font-semibold text-sm">Acesso de Edição Negado</p>
          </div>
          <div className="text-[11px] space-y-2 text-foreground/80">
            <p>Siga estes passos no Firebase Console para liberar seu acesso:</p>
            <div className="grid gap-2 pl-2">
              <div className="flex gap-2 items-start">
                <span className="bg-destructive/20 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">1</span>
                <p>Crie a coleção: <code className="bg-destructive/20 px-1 rounded font-bold text-destructive text-[10px]">roles_tac_members</code></p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="bg-destructive/20 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">2</span>
                <div className="space-y-1.5 w-full">
                  <p>No <b>ID do Documento</b>, use seu UID (clique abaixo para copiar):</p>
                  <div 
                    onClick={copyUid}
                    className="flex items-center justify-between bg-background border border-destructive/30 p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors group"
                  >
                    <code className="text-[10px] font-mono break-all">{user.uid}</code>
                    <Copy className="h-3 w-3 shrink-0 opacity-50 group-hover:opacity-100" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isFullscreen && isTacMember && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2 flex items-center gap-2 text-green-500">
          <CheckCircle2 className="h-4 w-4" />
          <p className="text-[11px] font-medium uppercase tracking-wider">Permissão TAC Ativa</p>
        </div>
      )}

      {!isFullscreen && !user && (
        <div className="bg-muted border rounded-lg p-2 flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <p className="text-[11px] font-medium uppercase tracking-wider">
            Modo de visualização.
          </p>
        </div>
      )}

      <div className={cn(
        "grid grid-cols-1 gap-3",
        isFullscreen && "gap-2"
      )}>
        {CITIES.map((city) => (
          <TechnicianRow
            key={city.id}
            technician={city}
            isEditable={isTacMember}
            compact={true}
          />
        ))}
      </div>

      {!isFullscreen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <Card className="bg-muted/50 border-none shadow-none">
            <CardContent className="p-3 flex items-start gap-2 text-[11px] text-muted-foreground">
              <div className="bg-primary/10 p-1.5 rounded-full shrink-0">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-foreground uppercase tracking-tight">Dicas</p>
                <p>Clique e arraste para marcar blocos. As cidades são regionais.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border border-primary/10 shadow-none overflow-hidden">
            <CardContent className="p-3 flex items-center justify-between h-full gap-3">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <div className="bg-primary p-1.5 rounded-full shrink-0">
                  <Share2 className="h-3 w-3 text-primary-foreground" />
                </div>
                <p className="font-bold text-foreground uppercase tracking-tight">Compartilhar</p>
              </div>
              <Button 
                onClick={copyPublicLink}
                variant="outline" 
                className="h-8 gap-1.5 border-primary/20 hover:bg-primary/10 transition-all text-[10px] font-bold uppercase"
              >
                <Copy className="h-3 w-3" />
                Copiar Link
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
