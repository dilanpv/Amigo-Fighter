import React, { useState } from 'react';

function TournamentLobby({ players, onStart, onRegister, isAdmin, onBack, tournamentName }) {
  const [registered, setRegistered] = useState(false);

  return (
    <div className="screen min-h-screen flex flex-col items-center p-4 bg-gradient-to-br from-neutral-900 to-black overflow-y-auto">
      <div className="w-full max-w-5xl flex flex-col md:flex-row md:items-center gap-4 mb-8 mt-4 animate-fade-in-up">
          <button onClick={onBack} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 text-xl md:text-2xl font-['Bebas_Neue'] tracking-wider rounded border border-neutral-600 transition-colors w-fit shadow-md">
            ← VOLVER
          </button>
          <h1 className="text-5xl md:text-7xl text-red-500 m-0 font-['Bebas_Neue'] tracking-widest drop-shadow-[0_0_15px_rgba(255,60,60,0.8)] md:ml-auto">
            {tournamentName || "TORNEO AMIGO"}
          </h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl flex-1 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        
        {/* PLAYERS LIST */}
        <div className="flex-1 bg-neutral-950/80 backdrop-blur-md border border-neutral-800 p-6 rounded-lg shadow-2xl flex flex-col min-h-[400px]">
          <h2 className="text-2xl md:text-3xl text-red-500 mb-4 pb-2 border-b-2 border-red-600 font-['Bebas_Neue'] tracking-widest">
            LUCHADORES REGISTRADOS ({players.length})
          </h2>
          <div className="flex-1 overflow-y-auto flex flex-col gap-3">
            {players.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-neutral-500 text-xl md:text-2xl font-['Bebas_Neue'] tracking-widest animate-pulse">ESPERANDO RETADORES...</p>
                </div>
            ) : (
                players.map((p, index) => (
                    <div key={`${p.id}-${index}`} className="flex items-center gap-4 bg-neutral-900/50 p-3 rounded border-l-4 border-red-600 hover:bg-neutral-800/80 transition-colors">
                        <div className="w-12 h-12 bg-black border border-neutral-700 rounded-full overflow-hidden shadow-inner flex-shrink-0">
                            {p.face ? <img src={p.face} className="w-full h-full object-cover" alt={p.name} /> : <div className="w-full h-full bg-neutral-800"></div>}
                        </div>
                        <span className="text-xl md:text-2xl font-['Bebas_Neue'] tracking-widest text-white">{p.name}</span>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex-1 flex flex-col justify-center bg-neutral-950/80 backdrop-blur-md border border-neutral-800 p-6 rounded-lg shadow-2xl">
          {!registered ? (
            <button 
              className="w-full relative group overflow-hidden bg-gradient-to-br from-red-700 to-red-900 border border-red-500 text-white p-6 text-3xl md:text-5xl font-['Bebas_Neue'] tracking-[0.1em] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_4px_15px_rgba(255,0,0,0.4)] hover:shadow-[0_0_30px_rgba(255,0,0,0.8)] rounded-md"
              onClick={() => { onRegister(); setRegistered(true); }}
            >
              <span className="relative z-10">¡REGISTRARME!</span>
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <span className="absolute z-10 inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">¡REGISTRARME!</span>
            </button>
          ) : (
            <div className="text-center p-8 border-2 border-dashed border-green-500/50 rounded-lg bg-green-900/10 shadow-[0_0_30px_rgba(74,222,128,0.1)]">
                <h3 className="text-3xl md:text-4xl text-green-400 font-['Bebas_Neue'] tracking-widest animate-pulse">¡ESTÁS REGISTRADO!</h3>
                <p className="mt-4 text-neutral-400 text-lg md:text-xl font-['Bebas_Neue'] tracking-wider">PREPÁRATE PARA LAS LLAVES</p>
            </div>
          )}

          {isAdmin && (
            <div className="mt-10 pt-8 border-t border-neutral-800 flex flex-col gap-4">
                <p className="text-sm md:text-base text-neutral-500 tracking-widest font-bold">PANEL DE ADMINISTRADOR</p>
                <button 
                    className={`w-full py-4 text-2xl md:text-3xl font-['Bebas_Neue'] tracking-widest rounded transition-all duration-300 relative overflow-hidden group
                      ${players.length < 2 ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-green-800 text-white border border-green-400 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(74,222,128,0.3)] hover:shadow-[0_0_40px_rgba(74,222,128,0.6)]'}`}
                    onClick={onStart}
                    disabled={players.length < 2}
                >
                    <span className="relative z-10">INICIAR TORNEO</span>
                    {players.length >= 2 && (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <span className="absolute z-10 inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">INICIAR TORNEO</span>
                      </>
                    )}
                </button>
            </div>
          )}
        </div>

      </div>

      <div className="mt-12 mb-4 text-neutral-500 tracking-[0.4em] text-sm md:text-base animate-pulse font-['Bebas_Neue'] text-center">
        EL EVENTO DE BOXEO UNIVERSITARIO DEL AÑO
      </div>
    </div>
  );
}

export default TournamentLobby;
