import React, { useEffect, useState } from 'react';

function TournamentResults({ winner, onFinish }) {
  const [showPodium, setShowPodium] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowPodium(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="screen min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-black overflow-hidden relative">
      {/* Background FX */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 via-black to-black"></div>
      
      {/* Confetti or simple stars could go here via CSS animations, for now we use simple pulse/glow */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-yellow-500/20 blur-[100px] rounded-full transition-opacity duration-1000 ${showPodium ? 'opacity-100' : 'opacity-0'}`}></div>

      <div className="z-10 w-full max-w-4xl flex flex-col items-center animate-fade-in-up">
        <h1 className="text-3xl md:text-6xl text-white mb-2 font-['Bebas_Neue'] tracking-[0.2em] drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
          CAMPEÓN DEL TORNEO
        </h1>

        <div className={`mt-8 mb-12 flex flex-col items-center transition-all duration-1000 transform ${showPodium ? 'scale-100 translate-y-0 opacity-100' : 'scale-50 translate-y-20 opacity-0'}`}>
          <div className="relative mb-6 group">
            {/* Crown icon/indicator */}
            <div className="absolute -top-10 md:-top-12 left-1/2 -translate-x-1/2 text-4xl md:text-5xl drop-shadow-[0_0_15px_rgba(234,179,8,0.8)] animate-bounce">
              👑
            </div>
            
            <div className="w-28 h-28 md:w-44 md:h-44 bg-black rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.6)] relative z-10 group-hover:scale-105 transition-transform duration-500">
              {winner?.face ? (
                <img src={winner.face} alt={winner.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-neutral-600 font-['Bebas_Neue'] bg-neutral-900">
                  {winner?.name?.[0] || '?'}
                </div>
              )}
            </div>
          </div>

          <h2 className="text-4xl md:text-7xl text-yellow-400 font-['Bebas_Neue'] tracking-widest drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">
            {winner?.name || 'DESCONOCIDO'}
          </h2>
          <p className="mt-3 text-neutral-400 font-['Bebas_Neue'] text-base md:text-2xl tracking-[0.3em] animate-pulse">
            ¡LA LEYENDA SE HA FORJADO!
          </p>
        </div>

        <div className={`w-full flex justify-center mt-8 transition-opacity duration-1000 delay-1000 ${showPodium ? 'opacity-100' : 'opacity-0'}`}>
          <button 
            onClick={onFinish}
            className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 border border-red-500 text-white font-['Bebas_Neue'] text-2xl md:text-3xl tracking-widest rounded shadow-[0_0_20px_rgba(255,0,0,0.5)] hover:scale-105 hover:shadow-[0_0_30px_rgba(255,0,0,0.8)] transition-all duration-300 active:scale-95"
          >
            VOLVER AL LOBBY
          </button>
        </div>
      </div>
    </div>
  );
}

export default TournamentResults;
