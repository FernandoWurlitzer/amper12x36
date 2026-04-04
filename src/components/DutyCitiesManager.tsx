
"use client";

import { useState } from "react";
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from "@/firebase";
import { collection, doc, query, orderBy, CollectionReference } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Plus, 
  X, 
  CalendarCheck,
  Building2,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface DutyCity {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface DutyCitiesManagerProps {
  isEditable: boolean;
}

const PREDEFINED_BASES = [
  "AMPÉRE",
  "SÃO LOURENÇO D'OESTE",
  "ARAUCÁRIA",
  "GUAÍRA",
  "MUNDO NOVO"
];

export function DutyCitiesManager({ isEditable }: DutyCitiesManagerProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBases, setSelectedBases] = useState<string[]>([]);
  const [customCity, setCustomCity] = useState("");

  // Referência base da coleção para operações de escrita
  const dutyCitiesCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'dutyCities');
  }, [firestore]);

  // Consulta para exibição dos dados (com ordenação)
  const dutyCitiesQuery = useMemoFirebase(() => {
    if (!dutyCitiesCollectionRef) return null;
    return query(dutyCitiesCollectionRef, orderBy('createdAt', 'desc'));
  }, [dutyCitiesCollectionRef]);

  const { data: cities, isLoading } = useCollection<DutyCity>(dutyCitiesQuery);

  const handleAddCities = () => {
    if (!dutyCitiesCollectionRef || !firestore) return;

    const citiesToAdd = [...selectedBases];
    if (customCity.trim()) {
      citiesToAdd.push(customCity.trim().toUpperCase());
    }

    if (citiesToAdd.length === 0) return;

    citiesToAdd.forEach(cityName => {
      const alreadyExists = cities?.some(c => c.name === cityName);
      if (!alreadyExists) {
        addDocumentNonBlocking(dutyCitiesCollectionRef as CollectionReference, {
          name: cityName,
          isActive: true,
          createdAt: new Date().toISOString()
        });
      } else {
        const existingCity = cities?.find(c => c.name === cityName);
        if (existingCity && !existingCity.isActive) {
          const cityRef = doc(firestore, 'dutyCities', existingCity.id);
          updateDocumentNonBlocking(cityRef, { isActive: true });
        }
      }
    });

    toast({
      title: "Bases Atualizadas",
      description: `${citiesToAdd.length} cidade(s) configurada(s) para o plantão.`,
    });

    setSelectedBases([]);
    setCustomCity("");
    setIsDialogOpen(false);
  };

  const toggleCityStatus = (cityId: string, currentStatus: boolean) => {
    if (!firestore || !isEditable) return;
    const cityRef = doc(firestore, 'dutyCities', cityId);
    updateDocumentNonBlocking(cityRef, { isActive: !currentStatus });
  };

  const handleDeleteCity = (cityId: string) => {
    if (!firestore || !isEditable) return;
    const cityRef = doc(firestore, 'dutyCities', cityId);
    deleteDocumentNonBlocking(cityRef);
  };

  const toggleBaseSelection = (base: string) => {
    setSelectedBases(prev => 
      prev.includes(base) ? prev.filter(b => b !== base) : [...prev, base]
    );
  };

  const activeCities = cities?.filter(c => c.isActive) || [];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <CalendarCheck className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/80">
            Plantão Hoje - Cidades Ativas
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {activeCities.length > 0 && (
            <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary tracking-widest px-3">
              {activeCities.length} BASES OPERACIONAIS
            </Badge>
          )}
          
          {isEditable && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 gap-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 transition-all">
                  <Plus className="h-3 w-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Adicionar Base</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] border-primary/20 bg-card/95 backdrop-blur-xl">
                <DialogHeader>
                  <DialogTitle className="text-sm font-black uppercase tracking-[0.2em] text-center">Configurar Plantão</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
                      Selecione as Bases Padrões:
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {PREDEFINED_BASES.map((base) => (
                        <div 
                          key={base}
                          onClick={() => toggleBaseSelection(base)}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                            selectedBases.includes(base) 
                              ? "bg-primary/10 border-primary/40 text-primary shadow-lg shadow-primary/5" 
                              : "bg-white/5 border-white/5 hover:border-white/10"
                          )}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest">{base}</span>
                          <div className={cn(
                            "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                            selectedBases.includes(base) ? "bg-primary border-primary" : "border-white/20"
                          )}>
                            {selectedBases.includes(base) && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-70">
                      Outra Cidade:
                    </label>
                    <Input 
                      placeholder="EX: FRANCISCO BELTRÃO"
                      value={customCity}
                      onChange={(e) => setCustomCity(e.target.value)}
                      className="bg-white/5 border-white/10 focus:border-primary/50 text-[10px] font-bold uppercase tracking-widest"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    onClick={handleAddCities}
                    className="w-full font-black uppercase tracking-widest text-[10px]"
                    disabled={selectedBases.length === 0 && !customCity.trim()}
                  >
                    Confirmar Seleção
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {isLoading ? (
          <div className="h-10 w-32 bg-white/5 animate-pulse rounded-full" />
        ) : cities && cities.length > 0 ? (
          cities.map((city) => (
            <div 
              key={city.id}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300",
                city.isActive 
                  ? "bg-primary/20 border-primary text-white shadow-lg shadow-primary/20" 
                  : "bg-zinc-900/60 border-white/10 text-muted-foreground opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  city.isActive ? "bg-primary" : "bg-zinc-700"
                )} />
                <span className="text-[9px] font-black uppercase tracking-wider">{city.name}</span>
              </div>

              {isEditable && (
                <div className="flex items-center gap-2 ml-2 border-l border-white/10 pl-2">
                  <Switch 
                    checked={city.isActive} 
                    onCheckedChange={() => toggleCityStatus(city.id, city.isActive)}
                    className="scale-75 data-[state=checked]:bg-primary"
                  />
                  <button 
                    onClick={() => handleDeleteCity(city.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground p-2">
            <Building2 className="h-4 w-4 opacity-20" />
            <p className="text-[9px] uppercase tracking-widest">Nenhuma base configurada no sistema.</p>
          </div>
        )}
      </div>
    </div>
  );
}
