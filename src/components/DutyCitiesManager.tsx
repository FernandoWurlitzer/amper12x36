
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
import { collection, doc, query, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  MapPin, 
  Plus, 
  X, 
  Activity, 
  CalendarCheck,
  Building2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DutyCity {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface DutyCitiesManagerProps {
  isEditable: boolean;
}

export function DutyCitiesManager({ isEditable }: DutyCitiesManagerProps) {
  const firestore = useFirestore();
  const [newCityName, setNewCityName] = useState("");

  const dutyCitiesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'dutyCities'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: cities, isLoading } = useCollection<DutyCity>(dutyCitiesRef);

  const handleAddCity = () => {
    if (!newCityName.trim() || !dutyCitiesRef) return;
    
    addDocumentNonBlocking(dutyCitiesRef as any, {
      name: newCityName.trim().toUpperCase(),
      isActive: true,
      createdAt: new Date().toISOString()
    });
    
    setNewCityName("");
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

  const activeCities = cities?.filter(c => c.isActive) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <CalendarCheck className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/80">
            Plantão Hoje - Cidades Ativas
          </h2>
        </div>
        {activeCities.length > 0 && (
          <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 bg-primary/5 text-primary tracking-widest px-3">
            {activeCities.length} BASES OPERACIONAIS
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 min-h-[40px]">
        {isLoading ? (
          <div className="h-10 w-32 bg-white/5 animate-pulse rounded-full" />
        ) : cities && cities.length > 0 ? (
          cities.map((city) => (
            <div 
              key={city.id}
              className={cn(
                "group relative flex items-center gap-3 px-4 py-2 rounded-full border transition-all duration-300",
                city.isActive 
                  ? "bg-primary/10 border-primary/30 text-white shadow-lg shadow-primary/10" 
                  : "bg-zinc-900/60 border-white/5 text-muted-foreground opacity-50"
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
            <p className="text-[9px] uppercase tracking-widest">Nenhuma cidade configurada no plantão.</p>
          </div>
        )}
      </div>

      {isEditable && (
        <div className="flex items-center gap-2 bg-zinc-900/40 p-2 rounded-xl border border-white/5">
          <Input 
            placeholder="NOME DA CIDADE (EX: AMPÉRE)"
            value={newCityName}
            onChange={(e) => setNewCityName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCity()}
            className="h-9 bg-transparent border-none text-[10px] uppercase font-black tracking-widest focus-visible:ring-0"
          />
          <Button 
            size="sm" 
            onClick={handleAddCity}
            disabled={!newCityName.trim()}
            className="h-8 gap-2 bg-primary/20 hover:bg-primary text-primary hover:text-white border border-primary/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-[9px] font-black uppercase">Adicionar</span>
          </Button>
        </div>
      )}
    </div>
  );
}
