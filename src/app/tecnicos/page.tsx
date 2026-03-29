
"use client";

import { Header } from "@/components/Header";

export default function TecnicosPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Header />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <div className="bg-card rounded-2xl p-6 md:p-10 border shadow-sm h-full min-h-[400px] flex flex-col items-center justify-center text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">Técnicos</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Esta página está atualmente vazia e pronta para receber o gerenciamento de técnicos.
            </p>
          </div>
        </div>
      </main>

      <footer className="p-8 text-center text-sm text-muted-foreground uppercase tracking-widest opacity-50">
        &copy; {new Date().getFullYear()} AMPERNET 12x36. Todos os direitos reservados.
      </footer>
    </div>
  );
}
