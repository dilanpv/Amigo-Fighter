import React, { useEffect } from 'react';

function BracketView({ matches, round, countdown, onCountdownTick }) {

  useEffect(() => {
    // Start ticking only when countdown has a positive value
    if (!countdown || countdown <= 0) return;

    const timer = setInterval(() => {
      onCountdownTick(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]); // re-run whenever countdown changes (activates on bracket show)

  const isLive = countdown !== null && countdown > 0;

  return (
    <div className="screen min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-neutral-900 to-black overflow-hidden">
      <div className="animate-fade-in-up flex flex-col items-center w-full max-w-5xl">

        {/* Title */}
        <h1 className="text-3xl md:text-7xl font-['Bebas_Neue'] tracking-widest text-center mb-2 drop-shadow-[0_0_20px_rgba(255,60,60,0.9)] text-white">
          LLAVES <span className="text-red-500">RONDA {round}</span>
        </h1>

        {/* Countdown Banner */}
        {isLive && (
          <div className="mb-6 flex flex-col items-center gap-1">
            <div
              key={countdown}
              className="text-7xl md:text-9xl font-['Bebas_Neue'] text-red-500 drop-shadow-[0_0_40px_rgba(255,0,0,0.9)]"
              style={{ animation: 'countPop 0.5s ease-out' }}
            >
              {countdown}
            </div>
            <p className="text-neutral-400 tracking-[0.3em] font-['Bebas_Neue'] text-base md:text-lg animate-pulse">
              COMBATES INICIANDO EN...
            </p>
          </div>
        )}

        {!isLive && countdown === null && (
          <p className="mb-6 text-neutral-400 tracking-[0.3em] font-['Bebas_Neue'] text-lg animate-pulse text-center">
            ESPERANDO RESULTADOS DE LOS COMBATES...
          </p>
        )}

        {/* Match Cards */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5 p-1 md:p-2 max-h-[55vh] overflow-y-auto">
          {matches.map((m, i) => (
            <div
              key={i}
              className={`relative bg-neutral-950/90 backdrop-blur-md border rounded-xl shadow-2xl overflow-hidden transition-all duration-500
                ${m.winner
                  ? 'border-green-700/50 opacity-70 grayscale-[30%]'
                  : isLive
                    ? 'border-red-600 shadow-[0_0_25px_rgba(255,30,30,0.35)] scale-[1.02]'
                    : 'border-neutral-800 hover:border-red-700 hover:shadow-[0_0_20px_rgba(255,0,0,0.2)]'
                }`}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${m.winner ? 'bg-green-500' : 'bg-red-600'}`} />

              {/* Bye badge */}
              {m.bye && (
                <div className="absolute top-2 right-2 text-xs text-green-400 bg-green-900/40 border border-green-600/40 px-2 py-0.5 rounded-full font-['Bebas_Neue'] tracking-widest">
                  LIBRE
                </div>
              )}

              <div className="pl-4 pr-3 py-3 md:pl-5 md:pr-4 md:py-4 flex flex-col gap-1.5 md:gap-2">
                {/* Match ID */}
                <div className="text-[9px] md:text-[10px] text-neutral-600 tracking-[0.2em] font-bold mb-0.5 md:mb-1">
                  COMBATE #{i + 1}
                </div>

                {/* Player 1 */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all
                  ${m.winner?.id === m.p1?.id
                    ? 'bg-green-900/30 border-green-500/60 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
                    : 'bg-black/50 border-neutral-800'}`}
                >
                  <div className="flex items-center gap-3">
                    {m.p1?.face && (
                      <img src={m.p1.face} alt={m.p1.name} className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-neutral-600 object-cover" />
                    )}
                    <span className="text-base md:text-xl font-['Bebas_Neue'] tracking-wider text-white truncate max-w-[100px] md:max-w-[130px]">
                      {m.p1?.name || '??'}
                    </span>
                  </div>
                  {m.winner?.id === m.p1?.id && (
                    <span className="text-green-400 font-bold text-lg drop-shadow-[0_0_8px_#4ade80]">✓ WIN</span>
                  )}
                </div>

                {/* VS */}
                <div className="flex items-center justify-center -my-0.5 relative z-10">
                  <span className={`text-xs font-['Bebas_Neue'] tracking-widest px-3 py-0.5 rounded-full border
                    ${isLive && !m.winner ? 'text-red-400 bg-neutral-900 border-red-600 shadow-[0_0_8px_rgba(255,0,0,0.4)] animate-pulse' : 'text-neutral-500 bg-neutral-900 border-neutral-700'}`}>
                    VS
                  </span>
                </div>

                {/* Player 2 */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all
                  ${m.winner?.id === m.p2?.id
                    ? 'bg-green-900/30 border-green-500/60 shadow-[0_0_10px_rgba(74,222,128,0.2)]'
                    : 'bg-black/50 border-neutral-800'}`}
                >
                  <div className="flex items-center gap-3">
                    {m.p2?.face && (
                      <img src={m.p2.face} alt={m.p2.name} className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-neutral-600 object-cover" />
                    )}
                    <span className="text-base md:text-xl font-['Bebas_Neue'] tracking-wider text-white truncate max-w-[100px] md:max-w-[130px]">
                      {m.p2?.name || (m.bye ? '— BYE —' : '??')}
                    </span>
                  </div>
                  {m.winner?.id === m.p2?.id && (
                    <span className="text-green-400 font-bold text-lg drop-shadow-[0_0_8px_#4ade80]">✓ WIN</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar (shown when not in countdown) */}
        {!isLive && (
          <div className="mt-8 flex flex-col items-center w-full max-w-md">
            <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full bg-red-600 animate-[pulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes countPop {
          0%   { transform: scale(1.6); opacity: 0; }
          50%  { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default BracketView;
