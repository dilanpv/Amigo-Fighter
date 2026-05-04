import React, { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import FighterGame from '../game/FighterGame';
import { socket } from '../socket';

function GameView({ roomId, playerData, gameState, onEnd }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const [hp, setHp] = useState({ p1: 100, p2: 100 });
  const [delayedHp, setDelayedHp] = useState({ p1: 100, p2: 100 });
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const timer = setTimeout(() => {
        setDelayedHp(hp);
    }, 500);
    return () => clearTimeout(timer);
  }, [hp]);
  const [wins, setWins] = useState({ p1: 0, p2: 0 });
  const [round, setRound] = useState(1);
  const [matchWinnerId, setMatchWinnerId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showRoundAnnounce, setShowRoundAnnounce] = useState(false); // M-1
  const [showTutorial, setShowTutorial] = useState(false); // M-6
  const roundEndingRef = useRef(false);
  const roundAnnounceRef = useRef(null);

  useEffect(() => {
    // M-6: Check if tutorial was already seen
    const tutorialSeen = localStorage.getItem('af_tutorial_seen');
    if (!tutorialSeen) {
      setShowTutorial(true);
      const timer = setTimeout(() => {
        setShowTutorial(false);
        localStorage.setItem('af_tutorial_seen', 'true');
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, []);

  const triggerRoundAnnounce = () => {
    setShowRoundAnnounce(true);
    if (roundAnnounceRef.current) clearTimeout(roundAnnounceRef.current);
    roundAnnounceRef.current = setTimeout(() => setShowRoundAnnounce(false), 2200);
  };

  const triggerKey = (keyCode, isDown) => {
      window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { keyCode: keyCode }));
  };

  const handleFullscreen = async () => {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(() => {});
            }
        } else {
            await document.exitFullscreen();
        }
    } catch (err) {
        console.error(err);
    }
  };

  useEffect(() => {
    let timer;
    if (hp.p1 > 0 && hp.p2 > 0 && timeLeft > 0 && !isPaused) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [hp.p1 > 0, hp.p2 > 0, timeLeft <= 0, isPaused]);

  useEffect(() => {
      const handleOpponentLeft = () => {
          if (hp.p1 > 0) {
              // Si el oponente se fue, forzamos la victoria del jugador local
              setMatchWinnerId(playerData.id);
          }
      };
      socket.on('opponent_left_match', handleOpponentLeft);
      return () => socket.off('opponent_left_match', handleOpponentLeft);
  }, [hp.p1, playerData.id]);

  useEffect(() => {
    if (timeLeft !== 0 || hp.p1 <= 0 || hp.p2 <= 0) return;
    if (!gameRef.current) return;
    if (hp.p1 > hp.p2) {
      const scene = gameRef.current.scene.getScene('FighterGame');
      if (scene) {
        const oppPlayer = scene.gameState.players.find(p => p.id !== scene.playerData.id);
        gameRef.current.events.emit('updateHP', { id: oppPlayer?.id || 'CPU', damage: 9999 });
      }
    } else if (hp.p2 > hp.p1) {
      gameRef.current.events.emit('updateHP', { id: gameRef.current.scene.getScene('FighterGame')?.playerData?.id, damage: 9999 });
    }
  }, [timeLeft]);

  useEffect(() => {
    if (!gameRef.current) {
      const config = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: 800,
          height: 450,
        },
        physics: {
          default: 'arcade',
          arcade: { gravity: { y: 1000 }, debug: false }
        },
        scene: FighterGame
      };

      const game = new Phaser.Game(config);
      game.scene.start('FighterGame', { socket, roomId, playerData, gameState });
      // M-1: Show round announce when game starts
      triggerRoundAnnounce();
      
      game.events.on('updateHP', (data) => {
        setHp(prev => {
          const isP1 = data.id === playerData.id;
          const newHP = {
            ...prev,
            [isP1 ? 'p1' : 'p2']: Math.max(0, prev[isP1 ? 'p1' : 'p2'] - data.damage)
          };

          if ((newHP.p1 <= 0 || newHP.p2 <= 0) && !roundEndingRef.current) {
            roundEndingRef.current = true;
            
            const loserId = newHP.p1 <= 0 ? playerData.id : (opponent?.id || 'CPU');
            if (gameRef.current) gameRef.current.events.emit('gameOver', { loserId });
            setWins(w => {
                const winnerKey = newHP.p1 <= 0 ? 'p2' : 'p1';
                const nextWins = { ...w, [winnerKey]: w[winnerKey] + 1 };

                if (nextWins.p1 >= 2 || nextWins.p2 >= 2) {
                    const wId = nextWins.p1 >= 2 ? playerData.id : 'CPU';
                    setMatchWinnerId(wId);
                } else {
                    setTimeout(() => {
                        roundEndingRef.current = false;
                        setRound(r => { 
                            return r + 1;
                        });
                        setHp({ p1: 100, p2: 100 });
                        setDelayedHp({ p1: 100, p2: 100 });
                        setTimeLeft(60);
                        triggerRoundAnnounce(); // M-1: show announce for new round
                        if (gameRef.current) {
                            gameRef.current.events.emit('resetRound');
                        }
                    }, 2500);
                }
                return nextWins;
            });
          }
          return newHP;
        });
      });

      gameRef.current = game;
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [roomId, playerData, gameState]);

  const opponent = gameState.players.find(p => p.id !== playerData.id);

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-950 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black opacity-80 z-0"></div>

      {/* HUD OVERLAY */}
      <div className="w-full px-2 md:px-6 py-2 flex justify-between items-start md:items-center z-20 flex-shrink-0 bg-gradient-to-b from-black/80 to-transparent">

        {/* P1 STATUS */}
        <div className="w-[38%] md:w-[40%] max-w-[420px]">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
            <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-white bg-black overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.3)] flex-shrink-0 rounded-full mx-auto md:mx-0">
              {playerData.face ? <img src={playerData.face} className="w-full h-full object-cover" alt="Player 1" /> : <div className="w-full h-full bg-blue-900" />}
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="font-['Bebas_Neue'] text-sm md:text-xl mb-1 truncate text-white text-center md:text-left tracking-wider">{playerData.name}</div>
              <div className="relative overflow-hidden border-2 border-neutral-700 h-4 md:h-6 bg-black w-full rounded shadow-inner">
                <div className="absolute top-0 bottom-0 left-0 bg-red-700 transition-all duration-500" style={{ width: `${delayedHp.p1}%` }}></div>
                <div className="absolute top-0 bottom-0 left-0 bg-green-500 shadow-[0_0_15px_#22c55e] transition-all duration-150" style={{ width: `${hp.p1}%` }}></div>
              </div>
              <div className="flex gap-1 mt-2 justify-center md:justify-start">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className={`w-3 h-3 md:w-4 md:h-4 rounded-full border border-neutral-600 ${i < wins.p1 ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-black'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TIMER CENTER */}
        <div className="flex flex-col items-center gap-1 md:gap-2 px-1 flex-shrink-0 z-30 mt-2 md:mt-0">
            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => onEnd(null)}
                className="px-2 py-1 md:px-4 md:py-2 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-xs md:text-lg tracking-widest border border-neutral-600 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-neutral-800 transition-all hover:scale-105 hover:border-red-500"
              >SALIR</button>

              <button
                onClick={handleFullscreen}
                className="md:hidden px-2 py-1 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-xs tracking-widest border border-neutral-600 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-neutral-800"
              >🖵</button>

              <div className="flex flex-col items-center mx-1 bg-black/50 p-2 border border-neutral-800 rounded">
                  <div className="font-['Bebas_Neue'] text-[10px] md:text-sm text-red-500 tracking-widest">RONDA {round}</div>
                  <div className={`font-['Bebas_Neue'] text-3xl md:text-5xl leading-none transition-all duration-300
                    ${timeLeft <= 10 && timeLeft > 0 && hp.p1 > 0 && hp.p2 > 0
                      ? 'text-orange-400 animate-pulse drop-shadow-[0_0_15px_rgba(251,146,60,0.9)] scale-110'
                      : 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]'}`}>
                    {hp.p1 <= 0 || hp.p2 <= 0 ? 'KO' : timeLeft}
                  </div>
              </div>


              <button
                onClick={() => {
                    const scene = gameRef.current?.scene.getScene('FighterGame');
                    if (scene) {
                        if (scene.scene.isPaused()) {
                          scene.scene.resume();
                          setIsPaused(false);
                        } else {
                          scene.scene.pause();
                          setIsPaused(true);
                        }
                    }
                }}
                className="px-2 py-1 md:px-4 md:py-2 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-xs md:text-lg tracking-widest border border-neutral-600 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:bg-neutral-800 transition-all hover:scale-105 hover:border-yellow-500"
              >PAUSA</button>
            </div>
        </div>

        {/* P2 STATUS */}
        <div className="w-[38%] md:w-[40%] max-w-[420px]">
          <div className="flex flex-col md:flex-row-reverse items-end md:items-center gap-2 text-right">
            <div className="w-12 h-12 md:w-16 md:h-16 border-2 border-red-500 bg-black overflow-hidden shadow-[0_0_15px_#ff3c3c] flex-shrink-0 rounded-full mx-auto md:mx-0">
              {opponent?.face ? <img src={opponent.face} className="w-full h-full object-cover" alt="Player 2" /> : <div className="w-full h-full bg-red-900" />}
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="font-['Bebas_Neue'] text-sm md:text-xl mb-1 truncate text-white text-center md:text-right tracking-wider">{opponent?.name || 'RETADOR'}</div>
              <div className="relative overflow-hidden border-2 border-neutral-700 h-4 md:h-6 bg-black w-full rounded shadow-inner">
                <div className="absolute top-0 bottom-0 right-0 bg-neutral-600 transition-all duration-500" style={{ width: `${delayedHp.p2}%` }}></div>
                <div className="absolute top-0 bottom-0 right-0 bg-red-500 shadow-[0_0_15px_#ef4444] transition-all duration-150" style={{ width: `${hp.p2}%` }}></div>
              </div>
              <div className="flex flex-row-reverse gap-1 mt-2 justify-center md:justify-start">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className={`w-3 h-3 md:w-4 md:h-4 rounded-full border border-neutral-600 ${i < wins.p2 ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-black'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* PHASER CONTAINER */}
      <div className="relative flex-1 w-full overflow-hidden flex items-center justify-center z-10 p-2 md:p-0">
        <div id="phaser-parent" ref={containerRef} className="w-full h-full max-w-[1200px] max-h-[800px] rounded-lg overflow-hidden border border-neutral-800 shadow-2xl" />

        {/* M-1: ROUND ANNOUNCE OVERLAY */}
        {showRoundAnnounce && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none"
               style={{ animation: 'roundFadeInOut 2.2s ease-in-out forwards' }}>
            <div className="font-['Bebas_Neue'] text-neutral-400 text-2xl md:text-4xl tracking-[0.5em] mb-2"
                 style={{ animation: 'roundSlideDown 0.4s ease-out' }}>
              RONDA {round}
            </div>
            <div className="font-['Bebas_Neue'] text-7xl md:text-[10rem] text-red-500 leading-none drop-shadow-[0_0_40px_rgba(255,0,0,0.9)]"
                 style={{ animation: 'roundPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
              ¡FIGHT!
            </div>
          </div>
        )}

        {/* KO OVERLAY */}
        {(hp.p1 <= 0 || hp.p2 <= 0) && !matchWinnerId && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
            <h2 className="font-['Bebas_Neue'] text-[20vw] md:text-[15vw] text-red-600 italic animate-pulse drop-shadow-[0_0_30px_#dc2626]">K.O.</h2>
          </div>
        )}


        {/* MATCH OVER OVERLAY */}
        {matchWinnerId && (
          <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-md">
            <div className="text-center p-8 bg-neutral-900/50 border border-neutral-700 rounded-xl shadow-2xl">
              <h2 className="font-['Bebas_Neue'] text-5xl md:text-8xl italic mb-2 tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.5)] text-white">
                {matchWinnerId === playerData.id ? '¡GANASTE!' : 'PERDISTE'}
              </h2>
              <p className="font-['Bebas_Neue'] text-2xl md:text-4xl text-neutral-500 mb-8 tracking-[0.3em]">FIN DEL COMBATE</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button 
                  onClick={() => {
                      if (gameState.players.length === 1) {
                          // CPU mode: reset locally
                          setRound(1);
                          setWins({p1: 0, p2: 0});
                          setMatchWinnerId(null);
                          setHp({p1: 100, p2: 100});
                          setDelayedHp({p1: 100, p2: 100});
                          setTimeLeft(60);
                          roundEndingRef.current = false;
                          if (gameRef.current) {
                              gameRef.current.events.emit('resetRound');
                          }
                      } else {
                          // Multiplayer: exit cleanly so App.jsx handles the flow
                          onEnd(null);
                      }
                  }} 
                  className="px-8 py-4 bg-red-600 text-white font-['Bebas_Neue'] text-2xl md:text-3xl tracking-widest rounded-lg shadow-[0_0_20px_#dc2626] hover:bg-red-500 transition-all hover:scale-105 active:scale-95"
                >
                  REVANCHA
                </button>
                <button 
                  onClick={() => onEnd(matchWinnerId)} 
                  className="px-8 py-4 bg-neutral-800 text-white font-['Bebas_Neue'] text-2xl md:text-3xl tracking-widest border border-neutral-600 rounded-lg hover:bg-neutral-700 transition-all hover:scale-105 active:scale-95"
                >
                  SALIR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* MOBILE CONTROLS */}
        <div className="md:hidden absolute bottom-2 left-2 right-2 flex justify-between items-end z-40 pointer-events-none mb-4">
            {/* D-PAD */}
            <div className="flex flex-col items-center gap-1 pointer-events-auto opacity-60">
                <button 
                    onPointerDown={(e) => { e.preventDefault(); triggerKey(38, true); }}
                    onPointerUp={(e) => { e.preventDefault(); triggerKey(38, false); }}
                    onPointerOut={(e) => { e.preventDefault(); triggerKey(38, false); }}
                    className="w-12 h-12 bg-neutral-800/80 border-2 border-neutral-600 rounded-t-xl text-white font-bold active:bg-red-600 active:scale-95 transition-all shadow-lg text-xl"
                >▲</button>
                <div className="flex gap-1">
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(37, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(37, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(37, false); }}
                        className="w-12 h-12 bg-neutral-800/80 border-2 border-neutral-600 rounded-l-xl text-white font-bold active:bg-red-600 active:scale-95 transition-all shadow-lg text-xl"
                    >◄</button>
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(40, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(40, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(40, false); }}
                        className="w-12 h-12 bg-neutral-800/80 border-2 border-neutral-600 rounded-b-xl text-white font-bold active:bg-red-600 active:scale-95 transition-all shadow-lg text-xl"
                    >▼</button>
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(39, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(39, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(39, false); }}
                        className="w-12 h-12 bg-neutral-800/80 border-2 border-neutral-600 rounded-r-xl text-white font-bold active:bg-red-600 active:scale-95 transition-all shadow-lg text-xl"
                    >►</button>
                </div>
            </div>

            {/* EMOTE BUTTONS (L-4) */}
            <div className="flex gap-2 justify-end mb-2 mr-2 opacity-40 hover:opacity-100 transition-opacity pointer-events-auto">
                {['👊', '🔥', '😂', '💀', '👑'].map(emoji => (
                    <button 
                        key={emoji}
                        onPointerDown={(e) => {
                            e.preventDefault();
                            if (gameRef.current) {
                                gameRef.current.events.emit('triggerEmote', emoji);
                            }
                        }}
                        className="w-10 h-10 md:w-12 md:h-12 bg-neutral-900/90 border border-neutral-700 rounded-lg flex items-center justify-center text-xl md:text-2xl hover:bg-neutral-800 active:scale-90 transition-all shadow-lg"
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col gap-2 pointer-events-auto opacity-60 mr-2">
                <div className="flex gap-2 justify-end">
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(87, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(87, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(87, false); }}
                        className="w-14 h-14 bg-purple-600/90 border-2 border-purple-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:bg-purple-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(147,51,234,0.5)]"
                    >ESP</button>
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(68, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(68, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(68, false); }}
                        className="w-14 h-14 bg-blue-600/90 border-2 border-blue-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:bg-blue-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                    >PAT</button>
                </div>
                <div className="flex gap-2 justify-end mr-6">
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(65, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(65, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(65, false); }}
                        className="w-14 h-14 bg-green-600/90 border-2 border-green-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:bg-green-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                    >JAB</button>
                    <button 
                        onPointerDown={(e) => { e.preventDefault(); triggerKey(83, true); }}
                        onPointerUp={(e) => { e.preventDefault(); triggerKey(83, false); }}
                        onPointerOut={(e) => { e.preventDefault(); triggerKey(83, false); }}
                        className="w-14 h-14 bg-red-600/90 border-2 border-red-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:bg-red-500 active:scale-95 transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                    >GAN</button>
                </div>
            </div>
        </div>

        {/* M-6: HOW TO PLAY OVERLAY */}
        {showTutorial && (
          <div 
            onClick={() => { setShowTutorial(false); localStorage.setItem('af_tutorial_seen', 'true'); }}
            className="absolute inset-0 z-[110] bg-black/80 flex flex-col items-center justify-center cursor-pointer animate-fade-in backdrop-blur-sm"
          >
            <div className="bg-neutral-900/90 border-2 border-red-500/50 p-8 rounded-2xl max-w-2xl w-[90%] flex flex-col items-center shadow-[0_0_50px_rgba(255,0,0,0.3)]">
              <h2 className="font-['Bebas_Neue'] text-4xl md:text-6xl text-white mb-8 tracking-widest">¿CÓMO JUGAR?</h2>
              
              <div className="grid grid-cols-2 gap-8 w-full">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-red-500 font-['Bebas_Neue'] text-xl tracking-wider mb-2">MOVIMIENTO</div>
                  <div className="flex gap-2 items-center">
                    <kbd className="px-3 py-2 bg-neutral-800 border-2 border-neutral-600 rounded text-white font-bold">▲</kbd>
                    <span className="text-neutral-400 font-['Bebas_Neue']">SALTAR</span>
                  </div>
                  <div className="flex gap-2 items-center mt-2">
                    <kbd className="px-3 py-2 bg-neutral-800 border-2 border-neutral-600 rounded text-white font-bold">◄</kbd>
                    <kbd className="px-3 py-2 bg-neutral-800 border-2 border-neutral-600 rounded text-white font-bold">▼</kbd>
                    <kbd className="px-3 py-2 bg-neutral-800 border-2 border-neutral-600 rounded text-white font-bold">►</kbd>
                    <span className="text-neutral-400 font-['Bebas_Neue']">MOVER / BLOQUEO</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <div className="text-red-500 font-['Bebas_Neue'] text-xl tracking-wider mb-2">ATAQUE</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col items-center">
                      <kbd className="px-4 py-2 bg-green-600 border-2 border-green-400 rounded-lg text-white font-bold">A</kbd>
                      <span className="text-xs text-neutral-400 mt-1">JAB</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <kbd className="px-4 py-2 bg-red-600 border-2 border-red-400 rounded-lg text-white font-bold">S</kbd>
                      <span className="text-xs text-neutral-400 mt-1">GANCHO</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <kbd className="px-4 py-2 bg-blue-600 border-2 border-blue-400 rounded-lg text-white font-bold">D</kbd>
                      <span className="text-xs text-neutral-400 mt-1">PATADA</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <kbd className="px-4 py-2 bg-purple-600 border-2 border-purple-400 rounded-lg text-white font-bold">W</kbd>
                      <span className="text-xs text-neutral-400 mt-1">ESPECIAL</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 text-neutral-500 font-['Bebas_Neue'] text-xl animate-pulse tracking-widest">
                TOCA PARA COMENZAR
              </div>
            </div>
          </div>
        )}

      {/* ROTATE DEVICE OVERLAY */}
      <div className="md:hidden fixed inset-0 z-[100] bg-black/95 flex-col items-center justify-center hidden portrait:flex">
         <span className="text-7xl mb-6 animate-spin" style={{ animationDuration: '3s' }}>🔄</span>
         <h2 className="text-4xl text-red-500 font-['Bebas_Neue'] tracking-widest text-center px-4 drop-shadow-[0_0_15px_rgba(255,0,0,0.8)]">GIRA TU TELÉFONO</h2>
         <p className="text-neutral-300 text-center px-8 mt-4 font-['Bebas_Neue'] text-xl tracking-wider">PARA UNA MEJOR EXPERIENCIA,<br/>JUEGA EN MODO HORIZONTAL.</p>
      </div>

        {/* INSTRUCTIONS */}
        <div className="font-['Bebas_Neue'] text-xs md:text-base text-neutral-500 tracking-[0.3em] md:tracking-[0.5em] text-center py-3 bg-black z-20 flex-shrink-0 hidden md:block">
          A: JAB <span className="text-neutral-700 mx-2">|</span> S: GANCHO <span className="text-neutral-700 mx-2">|</span> D: PATADA <span className="text-neutral-700 mx-2">|</span> W: ESPECIAL
        </div>
    </div>
  );
}

export default GameView;
