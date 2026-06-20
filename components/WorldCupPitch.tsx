import React, { useMemo } from 'react';
import { Profile } from '../types';

interface PlayerInfo {
  employee: Profile;
  weeklySchedule: { day: string; shift: string }[];
}

interface WorldCupPitchProps {
  players: PlayerInfo[];
  weekLabel: string;
  sectorName: string;
}

export const WorldCupPitch: React.FC<WorldCupPitchProps> = ({ players, weekLabel, sectorName }) => {
  // El primer jugador será el arquero (Dibu), los demás serán jugadores de campo.
  const goalkeeper = players.length > 0 ? players[0] : null;
  const fieldPlayers = players.length > 1 ? players.slice(1) : [];

  // Distribución en la cancha:
  // Queremos distribuir a los jugadores en líneas (Defensores, Mediocampistas, Delanteros).
  // No importa cuántos sean, los dividiremos en 3 bloques aproximadamente.
  const lines = useMemo(() => {
    const total = fieldPlayers.length;
    if (total === 0) return [];
    
    // Si son pocos, hacemos menos líneas
    if (total <= 3) return [fieldPlayers];
    if (total <= 6) {
      const half = Math.ceil(total / 2);
      return [fieldPlayers.slice(0, half), fieldPlayers.slice(half)];
    }
    
    // Por defecto 3 líneas (Defensa, Medio, Ataque)
    const third = Math.ceil(total / 3);
    const defCount = third;
    const midCount = Math.ceil((total - defCount) / 2);
    
    return [
      fieldPlayers.slice(0, defCount), // Defensa
      fieldPlayers.slice(defCount, defCount + midCount), // Medio
      fieldPlayers.slice(defCount + midCount) // Ataque
    ];
  }, [fieldPlayers]);

  const renderPlayer = (player: PlayerInfo, isGoalkeeper: boolean) => {
    // Nombre corto: Solo primer nombre y primer apellido
    const nameParts = player.employee.full_name.split(' ');
    const shortName = nameParts.length > 1 
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
      : nameParts[0];

    return (
      <div key={player.employee.id} className="flex flex-col items-center w-36 sm:w-40 mb-4">
        {/* Camiseta SVG */}
        <div className="relative w-16 h-16 drop-shadow-xl hover:scale-110 transition-transform mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
            {/* Cuerpo de la camiseta */}
            <path 
              d="M 25 20 C 25 10, 35 10, 40 15 C 45 20, 55 20, 60 15 C 65 10, 75 10, 75 20 L 95 40 L 85 50 L 75 40 L 75 90 L 25 90 L 25 40 L 15 50 L 5 40 Z" 
              fill={isGoalkeeper ? "#10b981" : "#fff"} 
            />
            {/* Si NO es arquero, agregamos franjas celestes (Argentina) */}
            {!isGoalkeeper && (
              <>
                <rect x="35" y="20" width="10" height="70" fill="#38bdf8" />
                <rect x="55" y="20" width="10" height="70" fill="#38bdf8" />
                {/* Mangas franjas */}
                <path d="M 15 40 L 25 30 L 25 40 Z" fill="#38bdf8" />
                <path d="M 85 40 L 75 30 L 75 40 Z" fill="#38bdf8" />
              </>
            )}
            {/* Cuello */}
            <path d="M 40 15 C 45 25, 55 25, 60 15" fill="none" stroke="#1e293b" strokeWidth="2" />
          </svg>
          {/* Numero (opcional, ponemos un 10 a los de campo y 1 al arquero, o vacio) */}
          <div className="absolute inset-0 flex items-center justify-center font-black text-xl text-slate-800 opacity-80 pt-2">
            {isGoalkeeper ? '1' : '10'}
          </div>
        </div>

        {/* Info */}
        <div className="mt-1 w-full bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1.5 border border-white/10 shadow-lg flex flex-col items-center gap-1">
          <p className="text-white font-black text-[11px] leading-none uppercase tracking-wide truncate w-full text-center border-b border-white/20 pb-1">{shortName}</p>
          <div className="flex flex-col w-full gap-[3px]">
            {player.weeklySchedule.map((s, idx) => (
              <div key={idx} className="flex justify-between items-center w-full px-1">
                <span className="text-white/80 font-bold text-[9px] uppercase leading-none">{s.day}</span>
                <span className="text-yellow-300 font-bold text-[9px] leading-none">{s.shift}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full relative bg-green-700 rounded-3xl overflow-hidden shadow-2xl border-8 border-white print-container">
      
      {/* Encabezado de impresión */}
      <div className="absolute top-4 left-4 z-20 hidden print:block text-white">
        <h1 className="text-2xl font-black uppercase tracking-widest drop-shadow-md">Convocatoria: {sectorName}</h1>
        <p className="text-sm font-bold opacity-90">{weekLabel}</p>
      </div>

      <div className="absolute top-4 right-4 z-20 hidden print:block">
        <span className="text-4xl">🇦🇷</span>
      </div>

      {/* Textura de pasto (líneas horizontales claras/oscuras) */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, #000 50px, #000 100px)'
      }}></div>

      {/* Lineas de la cancha */}
      <div className="absolute inset-4 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)' }}></div>
      {/* Línea central */}
      <div className="absolute top-1/2 left-4 right-4 pointer-events-none -mt-[2px]" style={{ borderTop: '4px solid rgba(255,255,255,0.85)' }}></div>
      {/* Círculo central */}
      <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full -mt-16 -ml-16 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)' }}></div>
      {/* Punto central */}
      <div className="absolute top-1/2 left-1/2 w-3 h-3 rounded-full -mt-1.5 -ml-1.5 pointer-events-none" style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}></div>

      {/* Áreas (Arriba y Abajo) */}
      <div className="absolute top-4 left-1/2 w-64 h-32 -ml-32 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)' }}></div>
      <div className="absolute top-4 left-1/2 w-32 h-12 -ml-16 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)' }}></div>
      <div className="absolute top-36 left-1/2 w-16 h-16 rounded-full -ml-8 -mt-8 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)', clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)' }}></div>

      <div className="absolute bottom-4 left-1/2 w-64 h-32 -ml-32 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)' }}></div>
      <div className="absolute bottom-4 left-1/2 w-32 h-12 -ml-16 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)' }}></div>
      <div className="absolute bottom-36 left-1/2 w-16 h-16 rounded-full -ml-8 -mt-8 pointer-events-none" style={{ border: '4px solid rgba(255,255,255,0.85)', clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }}></div>


      {/* Contenido / Jugadores */}
      <div className="relative z-10 min-h-[800px] flex flex-col justify-between py-12 px-4">
        
        {/* Equipo rival imaginario (vacío, solo para ocupar espacio arriba) */}
        <div className="flex-1"></div>

        {/* Medio campo hacia abajo (nuestro equipo) */}
        <div className="flex flex-col justify-end gap-8 pb-8 pt-20">
          
          {/* Delanteros */}
          {lines.length > 2 && (
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-6">
              {lines[2].map(p => renderPlayer(p, false))}
            </div>
          )}

          {/* Mediocampistas */}
          {lines.length > 1 && (
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-6">
              {lines[1].map(p => renderPlayer(p, false))}
            </div>
          )}

          {/* Defensores */}
          {lines.length > 0 && (
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-6">
              {lines[0].map(p => renderPlayer(p, false))}
            </div>
          )}

          {/* Arquero */}
          {goalkeeper && (
            <div className="flex justify-center mt-4">
              {renderPlayer(goalkeeper, true)}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
