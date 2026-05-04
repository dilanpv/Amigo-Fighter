import React, { useState } from 'react';

function Lobby({ onJoin }) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedRoom = room.trim().toUpperCase();
    const trimmedName = name.trim();
    // M-3: Prevent reserved internal codes from being used as room codes
    if (trimmedRoom === 'TOURNAMENT') {
      alert('Ese código de sala está reservado. Por favor usa otro código.');
      return;
    }
    if (trimmedName && trimmedRoom) {
      onJoin(trimmedRoom, trimmedName);
    }
  };

  return (
    <div className="screen min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center animate-fade-in-up">
        {/* LOGO */}
        <h1 className="text-6xl md:text-8xl font-bold tracking-widest text-center mb-8 drop-shadow-[0_0_15px_rgba(255,60,60,0.8)] transition-transform hover:scale-105 duration-300 cursor-default leading-none">
          <span className="text-white">AMIGO</span><br/>
          <span className="text-red-500">FIGHTER</span>
        </h1>

        {/* CONTENEDOR PRINCIPAL - GLASSMORPHISM */}
        <div className="w-full bg-neutral-950/80 backdrop-blur-xl border-t-4 border-b-4 border-red-600 p-6 md:p-8 shadow-[0_0_40px_rgba(255,0,0,0.2)] hover:shadow-[0_0_60px_rgba(255,0,0,0.3)] transition-shadow duration-500 relative overflow-hidden">
          
          {/* EFECTO DE LUZ DE FONDO EN LA TARJETA */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
            {/* CAMPO: APODO */}
            <div className="flex flex-col group">
              <label className="text-red-500 tracking-[0.2em] mb-2 text-sm md:text-base font-semibold group-focus-within:text-red-400 transition-colors">
                NOMBRE DE LUCHADOR
              </label>
              <input 
                type="text" 
                className="w-full bg-black/60 border border-neutral-700 text-white p-3 md:p-4 text-xl md:text-2xl font-['Bebas_Neue'] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/50 transition-all duration-300 placeholder-neutral-600 shadow-inner"
                placeholder="JUGADOR 1"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                required
              />
            </div>
            
            {/* CAMPO: CÓDIGO DE SALA */}
            <div className="flex flex-col group">
              <label className="text-red-500 tracking-[0.2em] mb-2 text-sm md:text-base font-semibold group-focus-within:text-red-400 transition-colors">
                CÓDIGO DE SALA
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 w-full bg-black/60 border border-neutral-700 text-white p-3 md:p-4 text-xl md:text-2xl font-['Bebas_Neue'] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/50 transition-all duration-300 placeholder-neutral-600 shadow-inner"
                  placeholder="0000"
                  value={room}
                  onChange={(e) => setRoom(e.target.value.toUpperCase())}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setRoom(Math.random().toString(36).substring(2, 6).toUpperCase())}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 text-lg md:text-xl font-['Bebas_Neue'] tracking-wider hover:shadow-[0_0_15px_rgba(255,0,0,0.6)] transition-all duration-300 active:scale-95 border border-red-500 flex items-center justify-center"
                >
                  GEN
                </button>
              </div>
            </div>

            {/* BOTÓN: ENTRAR AL RING */}
            <button 
              type="submit" 
              className="mt-2 w-full relative group overflow-hidden bg-gradient-to-br from-red-700 to-red-900 border border-red-500 text-white p-4 text-2xl md:text-3xl font-['Bebas_Neue'] tracking-[0.1em] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_4px_15px_rgba(255,0,0,0.4)] hover:shadow-[0_0_30px_rgba(255,0,0,0.8)]"
            >
              <span className="relative z-10">ENTRAR AL RING</span>
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="absolute z-10 inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">ENTRAR AL RING</span>
            </button>
          </form>

          {/* SEPARADOR */}
          <div className="my-8 flex items-center justify-center relative">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-neutral-500 to-transparent"></div>
            <span className="absolute px-4 bg-neutral-950 text-neutral-400 text-sm tracking-widest font-bold">O</span>
          </div>

          {/* BOTÓN: UNIRSE A TORNEO */}
          <button 
            onClick={() => {
              if (!name.trim()) {
                alert("Debes ingresar un NOMBRE DE LUCHADOR para acceder a los torneos.");
                return;
              }
              onJoin('TOURNAMENT', name.trim());
            }} 
            className="w-full relative group overflow-hidden bg-gradient-to-br from-green-600 to-green-800 border border-green-400 text-white p-4 text-xl md:text-2xl font-['Bebas_Neue'] tracking-[0.1em] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_4px_15px_rgba(74,222,128,0.3)] hover:shadow-[0_0_30px_rgba(74,222,128,0.6)]"
          >
            <span className="relative z-10 text-shadow-sm">ZONA DE TORNEOS</span>
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            <span className="absolute z-10 inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-shadow-sm">ZONA DE TORNEOS</span>
          </button>
        </div>

        {/* INSERTA MONEDA */}
        <div className="mt-8 text-neutral-500 tracking-[0.3em] text-xs md:text-sm animate-pulse flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
          INSERTA UNA MONEDA PARA EMPEZAR
        </div>
      </div>
    </div>
  );
}

export default Lobby;

