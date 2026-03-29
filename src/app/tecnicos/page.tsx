
"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase,
  addDocumentNonBlocking,
  deleteDocumentNonBlocking
} from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  Trash2, 
  Users, 
  ShieldAlert, 
  Loader2,
  UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function TecnicosPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newTechName, setNewTechName] = useState("");

  // Verificar permissão TAC
  const tacMemberRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_tac_members', user.uid);
  }, [firestore, user]);

  const { data: tacMemberDoc, isLoading: isTacLoading } = useDoc(tacMemberRef);
  const isTacMember = !!tacMemberDoc;

  // Buscar técnicos do Firestore
  const techniciansRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'technicians');
  }, [firestore]);

  const { data: technicians, isLoading: isTechLoading } = useCollection(techniciansRef);

  const handleAddTechnician = () => {
    if (!newTechName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome inválido",
        description: "O nome do técnico não pode estar vazio.",
      });
      return;
    }

    if (!techniciansRef) return;

    addDocumentNonBlocking(techniciansRef, {
      name: newTechName.trim(),
      createdAt: new Date().toISOString()
    });

    setNewTechName("");
    toast({
      title: "Técnico Adicionado",
      description: `${newTechName} foi incluído na equipe.`,
    });
  };

  const handleDeleteTechnician = (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover ${name}? Isso não apagará os blocos de horários vinculados a este ID, mas ele não aparecerá mais na agenda.`)) return;
    
    if (!firestore) return;
    const techDocRef = doc(firestore, 'technicians', id);
    deleteDocumentNonBlocking(techDocRef);

    toast({
      title: "Técnico Removido",
      description: `${name} foi removido do sistema.`,
    });
  };

  if (isAuthLoading || isTacLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Header />
      
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight text-foreground uppercase flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                Gestão de Técnicos
              </h2>
              <p className="text-muted-foreground text-sm uppercase tracking-widest opacity-70">
                Administre os profissionais da equipe 12x36
              </p>
            </div>
          </div>

          {!isTacMember ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="p-8 flex flex-col items-center text-center space-y-4">
                <ShieldAlert className="h-12 w-12 text-destructive opacity-50" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-destructive">Acesso Negado</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Apenas membros do TAC com permissão administrativa podem gerenciar técnicos.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-8">
              {/* Formulário de Adição */}
              <Card className="bg-card/50 border-primary/10 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Novo Profissional
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input 
                      placeholder="Nome completo do técnico" 
                      value={newTechName}
                      onChange={(e) => setNewTechName(e.target.value)}
                      className="bg-background/50 border-border/50 focus:border-primary/50 text-lg h-12"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTechnician()}
                    />
                    <Button onClick={handleAddTechnician} className="h-12 px-8 gap-2 font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
                      <Plus className="h-5 w-5" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Lista de Técnicos */}
              <Card className="border-border/50 bg-card/30">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                    Equipe Atual ({technicians?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isTechLoading ? (
                    <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando técnicos...</div>
                  ) : technicians && technicians.length > 0 ? (
                    <div className="divide-y divide-border/30">
                      {technicians.map((tech) => (
                        <div key={tech.id} className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors group">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/20">
                              {tech.name[0].toUpperCase()}
                            </div>
                            <span className="font-semibold text-foreground text-lg">{tech.name}</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteTechnician(tech.id, tech.name)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="h-5 w-5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-muted-foreground space-y-4">
                      <Users className="h-12 w-12 mx-auto opacity-20" />
                      <p className="uppercase tracking-widest text-xs font-bold">Nenhum técnico cadastrado</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <footer className="p-8 text-center text-sm text-muted-foreground uppercase tracking-widest opacity-50">
        &copy; {new Date().getFullYear()} AMPERNET 12x36. Todos os direitos reservados.
      </footer>
    </div>
  );
}
