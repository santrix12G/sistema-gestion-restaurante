import { UtensilsCrossed } from 'lucide-react';

/** Nombre del restaurante. Se cambia con NEXT_PUBLIC_NOMBRE_RESTAURANTE, sin tocar el código. */
export const NOMBRE_RESTAURANTE = process.env.NEXT_PUBLIC_NOMBRE_RESTAURANTE || 'Restaurante';

/** Logo (ícono sobre el color de la marca) y nombre del restaurante */
export function Marca({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${claro ? 'bg-white/15 text-white' : 'bg-marca-600 text-white'}`}>
        <UtensilsCrossed className="size-5" aria-hidden />
      </span>
      <span className={`truncate text-lg font-bold tracking-tight ${claro ? 'text-white' : 'text-stone-900'}`}>{NOMBRE_RESTAURANTE}</span>
    </span>
  );
}
