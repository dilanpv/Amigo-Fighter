import React, { useEffect, useRef, useState } from 'react';
import * as Phaser from 'phaser';
import FighterGame from '../game/FighterGame';
import SoundManager from '../game/SoundManager';
import VirtualJoystick from './VirtualJoystick';
import { socket } from '../socket';

function GameView({ roomId, playerData, gameState, onEnd }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const soundRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  // ✅ FIX 1: HP viene del servidor (hp_update), no se calcula localmente
  const [hp, setHp] = useState({ p1: 100, p2: 100 });
  const [delayedHp, setDelayedHp] = useState({ p1: 100, p2: 100 });
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const timer = setTimeout(() => setDelayedHp(hp), 500);
    return () => clearTimeout(timer);
  }, [hp]);

  const [wins, setWins] = useState({ p1: 0, p2: 0 });
  const [round, setRound] = useState(1);
  const [matchWinnerId, setMatchWinnerId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showRoundAnnounce, setShowRoundAnnounce] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [rematchStatus, setRematchStatus] = useState(null);
  const [ping, setPing] = useState(null); // ✅ Phase 3: Ping HUD

  const roundEndingRef = useRef(false);
  const roundAnnounceRef = useRef(null);
  const safetyTimerRef = useRef(null);

  useEffect(() => {
    setShowTutorial(true);
  }, []);

  // ✅ Phase 3: Listen for ping updates from FighterGame
  useEffect(() => {
    const handlePing = (e) => setPing(e.detail.ping);
    window.addEventListener('update_ping', handlePing);
    return () => window.removeEventListener('update_ping', handlePing);
  }, []);

  // ✅ FIX 2: HP autoritativo desde el servidor
  useEffect(() => {
    const handleHpUpdate = (serverHp) => {
      // serverHp = { left: number, right: number }
      // Convertir lado a p1/p2 según el lado del jugador local
      const myPlayer = gameState.players.find(p => p.id === playerData.id);
      const mySide = myPlayer?.side || playerData.side || 'left';

      const p1Hp = mySide === 'left' ? serverHp.left : serverHp.right;
      const p2Hp = mySide === 'left' ? serverHp.right : serverHp.left;

      setHp({ p1: Math.max(0, p1Hp), p2: Math.max(0, p2Hp) });
    };

    socket.on('hp_update', handleHpUpdate);
    return () => socket.off('hp_update', handleHpUpdate);
  }, [playerData, gameState]);

  // ✅ FIX 3: El servidor controla el KO — server_ko reemplaza la detección local
  useEffect(() => {
    const handleServerKO = (data) => {
      const { loserId, winnerId } = data;
      if (gameRef.current) {
        gameRef.current.events.emit('gameOver', { loserId });
      }
      // Sonido de KO
      if (soundRef.current) soundRef.current.sfxKO?.();
    };

    socket.on('server_ko', handleServerKO);
    return () => socket.off('server_ko', handleServerKO);
  }, []);

  // ✅ FIX 4: match_over del servidor — reemplaza la lógica de victorias local
  useEffect(() => {
    const handleMatchOver = ({ winnerId, wins: serverWins }) => {
      roundEndingRef.current = true;

      // Convertir wins de left/right a p1/p2
      const myPlayer = gameState.players.find(p => p.id === playerData.id);
      const mySide = myPlayer?.side || playerData.side || 'left';
      const p1Wins = mySide === 'left' ? serverWins.left : serverWins.right;
      const p2Wins = mySide === 'left' ? serverWins.right : serverWins.left;

      setWins({ p1: p1Wins, p2: p2Wins });
      setMatchWinnerId(winnerId);
    };

    socket.on('match_over', handleMatchOver);
    return () => socket.off('match_over', handleMatchOver);
  }, [playerData, gameState]);

  // ✅ FIX 5: start_next_round del servidor — ambos clientes arrancan al mismo tiempo
  useEffect(() => {
    const handleNextRound = (data) => {
      roundEndingRef.current = false;

      // HP viene del servidor, no se resetea localmente
      if (data?.hp) {
        const myPlayer = gameState.players.find(p => p.id === playerData.id);
        const mySide = myPlayer?.side || playerData.side || 'left';
        const p1Hp = mySide === 'left' ? data.hp.left : data.hp.right;
        const p2Hp = mySide === 'left' ? data.hp.right : data.hp.left;
        setHp({ p1: p1Hp, p2: p2Hp });
        setDelayedHp({ p1: p1Hp, p2: p2Hp });
      }

      if (data?.wins) {
        const myPlayer = gameState.players.find(p => p.id === playerData.id);
        const mySide = myPlayer?.side || playerData.side || 'left';
        const p1Wins = mySide === 'left' ? data.wins.left : data.wins.right;
        const p2Wins = mySide === 'left' ? data.wins.right : data.wins.left;
        setWins({ p1: p1Wins, p2: p2Wins });
      }

      if (data?.round) setRound(data.round);
      else setRound(r => r + 1);

      setTimeLeft(60);
      triggerRoundAnnounce();

      if (gameRef.current) {
        gameRef.current.events.emit('resetRound');
      }
    };

    socket.on('start_next_round', handleNextRound);
    return () => socket.off('start_next_round', handleNextRound);
  }, [playerData, gameState]);

  useEffect(() => {
    const handleBothReady = () => {
      console.log('[GameView] both_players_in_ring received');
      if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
      setWaitingForOpponent(false);
      setShowTutorial(false);
      triggerRoundAnnounce();
      const tryStart = () => {
        if (gameRef.current) gameRef.current.events.emit('startMatch');
        else setTimeout(tryStart, 200);
      };
      tryStart();
    };
    socket.on('both_players_in_ring', handleBothReady);
    return () => socket.off('both_players_in_ring', handleBothReady);
  }, []);

  const triggerRoundAnnounce = () => {
    setShowRoundAnnounce(true);
    if (roundAnnounceRef.current) clearTimeout(roundAnnounceRef.current);
    roundAnnounceRef.current = setTimeout(() => setShowRoundAnnounce(false), 2200);
  };

  const triggerKey = (keyCode, isDown) => {
    window.dispatchEvent(new KeyboardEvent(isDown ? 'keydown' : 'keyup', { keyCode }));
    if (gameRef.current) {
      gameRef.current.events.emit('mobileInput', { keyCode, isDown });
    }
  };

  const joystickState = useRef({ up: false, down: false, left: false, right: false });
  const handleJoystickMove = (dir) => {
    const prev = joystickState.current;
    if (dir.up !== prev.up) triggerKey(38, dir.up);
    if (dir.down !== prev.down) triggerKey(40, dir.down);
    if (dir.left !== prev.left) triggerKey(37, dir.left);
    if (dir.right !== prev.right) triggerKey(39, dir.right);
    joystickState.current = dir;
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {});
      } else {
        await document.exitFullscreen();
      }
    } catch (err) { console.error(err); }
  };

  // Timer local — solo visual, no controla rondas
  useEffect(() => {
    let timer;
    if (hp.p1 > 0 && hp.p2 > 0 && timeLeft > 0 && !isPaused && !showTutorial && !roundEndingRef.current) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [hp.p1, hp.p2, timeLeft, isPaused, showTutorial]);

  // ✅ FIX 6: Timeout por tiempo — el cliente notifica al servidor
  useEffect(() => {
    if (timeLeft !== 0 || hp.p1 <= 0 || hp.p2 <= 0 || roundEndingRef.current) return;
    if (gameState.players.length > 1) {
      // En multijugador: el que tiene más HP gana — el servidor maneja el KO
      // Solo notificamos al servidor que el tiempo se acabó
      socket.emit('round_ended', { roomId, winnerId: hp.p1 >= hp.p2 ? playerData.id : opponent?.id });
    } else {
      // Modo CPU: manejamos localmente
      if (!gameRef.current) return;
      if (hp.p1 > hp.p2) {
        const scene = gameRef.current.scene.getScene('FighterGame');
        const oppPlayer = scene?.gameState.players.find(p => p.id !== scene.playerData.id);
        gameRef.current.events.emit('updateHP', { id: oppPlayer?.id || 'CPU', damage: 9999 });
      } else {
        gameRef.current.events.emit('updateHP', { id: playerData.id, damage: 9999 });
      }
    }
  }, [timeLeft]);

  useEffect(() => {
    const handleOpponentLeft = () => {
      if (hp.p1 > 0) {
        setMatchWinnerId(playerData.id);
        if (roomId?.startsWith('T-')) setTimeout(() => onEnd(playerData.id), 2000);
      }
    };
    socket.on('opponent_left_match', handleOpponentLeft);
    return () => socket.off('opponent_left_match', handleOpponentLeft);
  }, [hp.p1, playerData.id, roomId]);

  // N-6: Rematch listeners
  useEffect(() => {
    const onRematchRequested = () => {
      if (rematchStatus !== 'waiting') setRematchStatus('requested');
    };
    const onRematchAccepted = () => {
      setRematchStatus(null);
      setRound(1);
      setWins({ p1: 0, p2: 0 });
      setMatchWinnerId(null);
      setHp({ p1: 100, p2: 100 });
      setDelayedHp({ p1: 100, p2: 100 });
      setTimeLeft(60);
      roundEndingRef.current = false;
      if (gameRef.current) gameRef.current.events.emit('resetRound');
      triggerRoundAnnounce();
    };
    const onRematchDeclined = () => setRematchStatus('declined');

    socket.on('rematch_requested', onRematchRequested);
    socket.on('rematch_accepted', onRematchAccepted);
    socket.on('rematch_declined', onRematchDeclined);
    return () => {
      socket.off('rematch_requested', onRematchRequested);
      socket.off('rematch_accepted', onRematchAccepted);
      socket.off('rematch_declined', onRematchDeclined);
    };
  }, [rematchStatus]);

  // ✅ FIX 7: updateHP solo para modo CPU — en multijugador el HP viene de hp_update
  useEffect(() => {
    const handleResize = () => {
      if (gameRef.current?.scale) gameRef.current.scale.refresh();
    };

    if (!gameRef.current) {
      if (!soundRef.current) {
        soundRef.current = new SoundManager();
        soundRef.current.init();
      }

      const config = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 800, height: 450 },
        physics: { default: 'arcade', arcade: { gravity: { y: 1000 }, debug: false } },
        scene: FighterGame
      };

      const game = new Phaser.Game(config);
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
      game.scene.start('FighterGame', { socket, roomId, playerData, gameState, soundManager: soundRef.current });

      // ✅ updateHP solo para CPU — en multijugador el servidor manda hp_update
      game.events.on('updateHP', (data) => {
        if (gameState.players.length > 1) return; // ignorar en multijugador

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

            const winnerKey = newHP.p1 <= 0 ? 'p2' : 'p1';
            setTimeout(() => {
              setWins(w => {
                const nextWins = { ...w, [winnerKey]: w[winnerKey] + 1 };
                if (nextWins.p1 >= 2 || nextWins.p2 >= 2) {
                  const wId = nextWins.p1 >= 2 ? playerData.id : (opponent?.id || 'CPU');
                  setMatchWinnerId(wId);
                } else {
                  // CPU mode: reset local
                  setTimeout(() => {
                    roundEndingRef.current = false;
                    setRound(r => r + 1);
                    setHp({ p1: 100, p2: 100 });
                    setDelayedHp({ p1: 100, p2: 100 });
                    setTimeLeft(60);
                    triggerRoundAnnounce();
                    if (gameRef.current) gameRef.current.events.emit('resetRound');
                  }, 2500);
                }
                return nextWins;
              });
            }, 0);
          }
          return newHP;
        });
      });

      gameRef.current = game;
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (screen.orientation?.unlock) screen.orientation.unlock();
      if (gameRef.current) { gameRef.current.destroy(true); gameRef.current = null; }
      if (soundRef.current) { soundRef.current.destroy(); soundRef.current = null; }
    };
  }, [roomId, playerData, gameState]);

  const opponent = gameState.players.find(p => p.id !== playerData.id);

  return (
    <div className="fixed inset-0 flex flex-col bg-neutral-950 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black to-black opacity-80 z-0"></div>

      {/* HUD */}
      <div className="absolute top-0 left-0 w-full px-1 md:px-6 py-1 md:py-2 flex justify-between items-start md:items-center z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">

        {/* P1 */}
        <div className="w-[30%] md:w-[40%] max-w-[420px] pointer-events-auto">
          <div className="flex flex-row items-center gap-1 md:gap-2">
            <div className="w-7 h-7 md:w-16 md:h-16 border border-white md:border-2 bg-black overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.3)] flex-shrink-0 rounded-full">
              {playerData.face ? <img src={playerData.face} className="w-full h-full object-cover" alt="P1" /> : <div className="w-full h-full bg-blue-900" />}
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="font-['Bebas_Neue'] text-[10px] md:text-xl mb-0 md:mb-1 truncate text-white tracking-wider">{playerData.name}</div>
              <div className="relative overflow-hidden border border-neutral-700 md:border-2 h-2 md:h-6 bg-black w-full rounded shadow-inner">
                <div className="absolute top-0 bottom-0 left-0 bg-red-700 transition-all duration-500" style={{ width: `${delayedHp.p1}%` }}></div>
                <div className="absolute top-0 bottom-0 left-0 bg-green-500 shadow-[0_0_15px_#22c55e] transition-all duration-150" style={{ width: `${hp.p1}%` }}></div>
              </div>
              <div className="flex gap-1 mt-0.5 md:mt-1 justify-start">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 md:w-4 md:h-4 rounded-full border transition-all duration-500 ${i < wins.p1 ? 'bg-green-500 border-green-400 shadow-[0_0_10px_#22c55e] scale-110' : 'bg-neutral-900 border-neutral-600'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CENTER HUD */}
        <div className="flex flex-col items-center gap-0 md:gap-2 px-0.5 md:px-1 z-30 pointer-events-auto mt-0 md:mt-2">
          <div className="hidden md:flex gap-1 mb-1 opacity-40 hover:opacity-100 transition-opacity duration-300">
            {['👊', '🔥', '😂', '💀', '👑'].map(emoji => (
              <button key={emoji}
                onPointerDown={(e) => { e.preventDefault(); if (gameRef.current) gameRef.current.events.emit('triggerEmote', emoji); }}
                className="w-8 h-8 bg-neutral-900/90 border border-neutral-700 rounded-lg flex items-center justify-center text-sm hover:bg-neutral-800 active:scale-90 transition-all shadow-md"
              >{emoji}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <button onClick={() => onEnd(null)} className="px-1.5 py-0.5 md:px-4 md:py-2 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-[10px] md:text-lg tracking-widest border border-neutral-600 rounded hover:bg-neutral-800 hover:border-red-500">SALIR</button>
            <button onClick={handleFullscreen} className="md:hidden px-2 py-1 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-xs tracking-widest border border-neutral-600 rounded">⛶</button>
            <div className="flex flex-col items-center mx-0.5 md:mx-1 bg-black/50 p-1 md:p-2 border border-neutral-800 rounded relative">
              <div className="font-['Bebas_Neue'] text-[8px] md:text-sm text-red-500 tracking-widest">RONDA {round}</div>
              <div className={`font-['Bebas_Neue'] text-2xl md:text-5xl leading-none transition-all duration-300 ${timeLeft <= 10 && timeLeft > 0 && hp.p1 > 0 && hp.p2 > 0 ? 'text-orange-400 animate-pulse scale-110' : 'text-white'}`}>
                {hp.p1 <= 0 || hp.p2 <= 0 ? 'KO' : timeLeft}
              </div>
              
              {/* ✅ PING HUD (Phase 3) */}
              {ping !== null && (
                <div className="absolute top-[100%] left-1/2 -translate-x-1/2 mt-0.5 md:mt-1 bg-black/60 px-1 md:px-2 py-0.5 rounded border border-neutral-700 backdrop-blur-sm shadow-xl z-50 whitespace-nowrap">
                   <div className="flex items-center gap-1.5">
                     <div className={`w-1.5 h-1.5 rounded-full ${ping < 50 ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : ping < 120 ? 'bg-yellow-500' : 'bg-red-500 shadow-[0_0_5px_#ef4444]'}`}></div>
                     <span className="text-[8px] md:text-xs text-neutral-300 font-mono tracking-wide">{ping}ms</span>
                   </div>
                </div>
              )}
            </div>
            <button onClick={() => { if (soundRef.current) { const m = !isMuted; setIsMuted(m); soundRef.current.setMute(m); } }} className="px-1.5 py-0.5 md:px-3 md:py-2 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-xs md:text-base tracking-widest border border-neutral-600 rounded hover:bg-neutral-800 hover:border-yellow-500">
              {isMuted ? '🔇' : '🔊'}
            </button>
            <button onClick={() => { const scene = gameRef.current?.scene.getScene('FighterGame'); if (scene) { if (scene.scene.isPaused()) { scene.scene.resume(); setIsPaused(false); } else { scene.scene.pause(); setIsPaused(true); } } }} className="px-1.5 py-0.5 md:px-4 md:py-2 bg-neutral-900/80 text-white font-['Bebas_Neue'] text-[10px] md:text-lg tracking-widest border border-neutral-600 rounded hover:bg-neutral-800 hover:border-yellow-500">PAUSA</button>
          </div>
        </div>

        {/* P2 */}
        <div className="w-[30%] md:w-[40%] max-w-[420px] pointer-events-auto">
          <div className="flex flex-row-reverse items-center gap-1 md:gap-2 text-right">
            <div className="w-7 h-7 md:w-16 md:h-16 border border-red-500 md:border-2 bg-black overflow-hidden shadow-[0_0_15px_#ff3c3c] flex-shrink-0 rounded-full">
              {opponent?.face ? <img src={opponent.face} className="w-full h-full object-cover" alt="P2" /> : <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=CPU_Fighter" className="w-full h-full object-cover" alt="CPU" />}
            </div>
            <div className="flex-1 w-full min-w-0">
              <div className="font-['Bebas_Neue'] text-[10px] md:text-xl mb-0 md:mb-1 truncate text-white text-right tracking-wider">{opponent?.name || 'RETADOR'}</div>
              <div className="relative overflow-hidden border border-neutral-700 md:border-2 h-2 md:h-6 bg-black w-full rounded shadow-inner">
                <div className="absolute top-0 bottom-0 right-0 bg-neutral-600 transition-all duration-500" style={{ width: `${delayedHp.p2}%` }}></div>
                <div className="absolute top-0 bottom-0 right-0 bg-red-500 shadow-[0_0_15px_#ef4444] transition-all duration-150" style={{ width: `${hp.p2}%` }}></div>
              </div>
              <div className="flex flex-row-reverse gap-1 mt-0.5 md:mt-1 justify-start">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 md:w-4 md:h-4 rounded-full border transition-all duration-500 ${i < wins.p2 ? 'bg-red-500 border-red-400 shadow-[0_0_10px_#ef4444] scale-110' : 'bg-neutral-900 border-neutral-600'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PHASER */}
      <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center z-10">
        <div id="phaser-parent" ref={containerRef} className="w-full h-full md:max-w-[1200px] md:max-h-[800px] md:rounded-lg overflow-hidden md:border md:border-neutral-800 shadow-2xl" />

        {/* ROUND ANNOUNCE */}
        {showRoundAnnounce && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none" style={{ animation: 'roundFadeInOut 2.2s ease-in-out forwards' }}>
            <div className="font-['Bebas_Neue'] text-neutral-400 text-2xl md:text-4xl tracking-[0.5em] mb-2" style={{ animation: 'roundSlideDown 0.4s ease-out' }}>RONDA {round}</div>
            <div className="font-['Bebas_Neue'] text-7xl md:text-[10rem] text-red-500 leading-none drop-shadow-[0_0_40px_rgba(255,0,0,0.9)]" style={{ animation: 'roundPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>¡FIGHT!</div>
          </div>
        )}

        {/* KO OVERLAY */}
        {(hp.p1 <= 0 || hp.p2 <= 0) && !matchWinnerId && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <h2 className="font-['Bebas_Neue'] text-[15vw] md:text-[10vw] text-red-600 italic animate-pulse drop-shadow-[0_0_30px_#dc2626]">K.O.</h2>
          </div>
        )}

        {/* MATCH OVER */}
        {matchWinnerId && (
          <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-md">
            <div className="text-center p-8 bg-neutral-900/50 border border-neutral-700 rounded-xl shadow-2xl max-w-md w-[90%]">
              <h2 className="font-['Bebas_Neue'] text-5xl md:text-8xl italic mb-2 tracking-widest text-white">
                {matchWinnerId === playerData.id ? '¡GANASTE!' : 'PERDISTE'}
              </h2>
              <p className="font-['Bebas_Neue'] text-2xl md:text-4xl text-neutral-500 mb-6 tracking-[0.3em]">FIN DEL COMBATE</p>

              {rematchStatus === 'waiting' && <p className="font-['Bebas_Neue'] text-lg text-yellow-400 tracking-widest mb-4 animate-pulse">⏳ ESPERANDO AL RIVAL...</p>}
              {rematchStatus === 'requested' && <p className="font-['Bebas_Neue'] text-lg text-green-400 tracking-widest mb-4 animate-pulse">🥊 ¡TU RIVAL QUIERE REVANCHA!</p>}
              {rematchStatus === 'declined' && <p className="font-['Bebas_Neue'] text-lg text-red-400 tracking-widest mb-4">❌ EL RIVAL RECHAZÓ LA REVANCHA</p>}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {!roomId?.startsWith('T-') && (
                  <button
                    onClick={() => {
                      if (gameState.players.length === 1) {
                        setRematchStatus(null); setRound(1); setWins({ p1: 0, p2: 0 });
                        setMatchWinnerId(null); setHp({ p1: 100, p2: 100 });
                        setDelayedHp({ p1: 100, p2: 100 }); setTimeLeft(60);
                        roundEndingRef.current = false;
                        if (gameRef.current) gameRef.current.events.emit('resetRound');
                        triggerRoundAnnounce();
                      } else {
                        socket.emit('request_rematch', { roomId });
                        setRematchStatus('waiting');
                      }
                    }}
                    disabled={rematchStatus === 'waiting' || rematchStatus === 'declined'}
                    className={`px-8 py-4 font-['Bebas_Neue'] text-2xl md:text-3xl tracking-widest rounded-lg transition-all active:scale-95
                      ${rematchStatus === 'waiting' ? 'bg-yellow-700 text-yellow-200 cursor-wait'
                      : rematchStatus === 'requested' ? 'bg-green-600 text-white hover:bg-green-500 animate-pulse'
                      : rematchStatus === 'declined' ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_20px_#dc2626] hover:scale-105'}`}
                  >
                    {rematchStatus === 'waiting' ? '⏳ ESPERANDO...'
                      : rematchStatus === 'requested' ? '✅ ACEPTAR REVANCHA'
                      : rematchStatus === 'declined' ? 'RECHAZADA'
                      : 'REVANCHA'}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (rematchStatus === 'requested' && gameState.players.length > 1) socket.emit('decline_rematch', { roomId });
                    onEnd(matchWinnerId);
                  }}
                  className="px-8 py-4 bg-neutral-800 text-white font-['Bebas_Neue'] text-2xl md:text-3xl tracking-widest border border-neutral-600 rounded-lg hover:bg-neutral-700 hover:scale-105 active:scale-95"
                >SALIR</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE CONTROLS */}
      <div className="md:hidden absolute bottom-0 left-1 right-1 flex justify-between items-end z-40 pointer-events-none pb-2" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
        <div className="mb-2"><VirtualJoystick onMove={handleJoystickMove} /></div>
        <div className="flex flex-col items-end gap-1 pointer-events-auto">
          <div className="flex gap-1.5 justify-end mr-1 opacity-40 hover:opacity-100 transition-opacity">
            {['👊', '🔥', '😂', '💀', '👑'].map(emoji => (
              <button key={emoji} onPointerDown={(e) => { e.preventDefault(); if (gameRef.current) gameRef.current.events.emit('triggerEmote', emoji); }}
                className="w-8 h-8 bg-neutral-900/90 border border-neutral-700 rounded-lg flex items-center justify-center text-base active:scale-90">{emoji}</button>
            ))}
          </div>
          <div className="flex flex-col gap-2 opacity-70 mr-2 mb-2">
            <div className="flex gap-2 justify-end">
              <button onPointerDown={(e) => { e.preventDefault(); triggerKey(87, true); }} onPointerUp={(e) => { e.preventDefault(); triggerKey(87, false); }} onPointerOut={(e) => { e.preventDefault(); triggerKey(87, false); }} className="w-16 h-16 bg-purple-600/90 border-2 border-purple-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:scale-95">ESP</button>
              <button onPointerDown={(e) => { e.preventDefault(); triggerKey(68, true); }} onPointerUp={(e) => { e.preventDefault(); triggerKey(68, false); }} onPointerOut={(e) => { e.preventDefault(); triggerKey(68, false); }} className="w-16 h-16 bg-blue-600/90 border-2 border-blue-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:scale-95">PAT</button>
            </div>
            <div className="flex gap-2 justify-end mr-8">
              <button onPointerDown={(e) => { e.preventDefault(); triggerKey(65, true); }} onPointerUp={(e) => { e.preventDefault(); triggerKey(65, false); }} onPointerOut={(e) => { e.preventDefault(); triggerKey(65, false); }} className="w-16 h-16 bg-green-600/90 border-2 border-green-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:scale-95">JAB</button>
              <button onPointerDown={(e) => { e.preventDefault(); triggerKey(83, true); }} onPointerUp={(e) => { e.preventDefault(); triggerKey(83, false); }} onPointerOut={(e) => { e.preventDefault(); triggerKey(83, false); }} className="w-16 h-16 bg-red-600/90 border-2 border-red-400 rounded-full text-white font-['Bebas_Neue'] text-lg active:scale-95">GAN</button>
            </div>
          </div>
        </div>
      </div>

      {/* TUTORIAL */}
      {showTutorial && (
        <div className="absolute inset-0 z-[110] bg-black/90 flex flex-col items-center justify-center backdrop-blur-md p-4">
          <button 
            onClick={() => onEnd(null)} 
            className="absolute top-4 left-4 md:top-8 md:left-8 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-['Bebas_Neue'] text-xl md:text-2xl tracking-widest border border-neutral-600 rounded transition-colors z-[120] shadow-md"
          >
            ← VOLVER
          </button>
          <div className="w-full max-w-4xl bg-neutral-950/80 border-t-4 border-b-4 border-red-600 p-6 md:p-10 shadow-[0_0_60px_rgba(255,0,0,0.25)] relative overflow-hidden mt-12 md:mt-0">
            <h2 className="font-['Bebas_Neue'] text-5xl md:text-8xl text-white mb-2 md:mb-4 tracking-widest text-center">CONTROLES <span className="text-red-500">DE COMBATE</span></h2>
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mt-6 md:mt-10">
              <div className="flex flex-col items-center">
                <h3 className="text-red-500 font-['Bebas_Neue'] text-2xl md:text-3xl tracking-[0.3em] mb-6 border-b border-red-900/50 pb-2 w-full text-center">MOVIMIENTO</h3>
                {window.innerWidth < 768 ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full border-4 border-neutral-700 flex items-center justify-center relative">
                      <div className="w-8 h-8 bg-red-600 rounded-full animate-ping absolute"></div>
                      <div className="w-10 h-10 bg-red-600 rounded-full relative z-10"></div>
                    </div>
                    <p className="text-neutral-400 font-['Bebas_Neue'] text-xl tracking-widest mt-2">USA EL JOYSTICK VIRTUAL</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-center gap-3"><div className="w-12 h-12 bg-neutral-900 border-2 border-neutral-700 rounded-lg flex items-center justify-center text-white text-2xl">▲</div></div>
                    <div className="flex justify-center gap-3">
                      <div className="w-12 h-12 bg-neutral-900 border-2 border-neutral-700 rounded-lg flex items-center justify-center text-white text-2xl">◄</div>
                      <div className="w-12 h-12 bg-neutral-900 border-2 border-neutral-700 rounded-lg flex items-center justify-center text-white text-2xl">▼</div>
                      <div className="w-12 h-12 bg-neutral-900 border-2 border-neutral-700 rounded-lg flex items-center justify-center text-white text-2xl">►</div>
                    </div>
                    <p className="text-neutral-400 font-['Bebas_Neue'] text-xl tracking-widest mt-4 text-center">TECLAS DE DIRECCIÓN</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center">
                <h3 className="text-red-500 font-['Bebas_Neue'] text-2xl md:text-3xl tracking-[0.3em] mb-6 border-b border-red-900/50 pb-2 w-full text-center">ATAQUE</h3>
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  {[
                    { key: 'A', label: 'JAB', color: 'green' },
                    { key: 'S', label: 'GANCHO', color: 'red' },
                    { key: 'D', label: 'PATADA', color: 'blue' },
                    { key: 'W', label: 'ESPECIAL', color: 'purple' },
                  ].map(({ key, label, color }) => (
                    <div key={key} className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 md:w-14 md:h-14 bg-${color}-600/20 border-2 border-${color}-500 rounded-full flex items-center justify-center text-${color}-400 font-bold text-xl md:text-2xl`}>{key}</div>
                      <span className="text-xs md:text-sm text-neutral-500 font-bold tracking-widest uppercase">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center gap-4">
              {waitingForOpponent ? (
                <div className="px-12 py-4 bg-neutral-700/50 border border-neutral-500 text-white text-3xl font-['Bebas_Neue'] tracking-[0.2em] animate-pulse">ESPERANDO AL RIVAL...</div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      if (gameState.players.length === 1) {
                        setShowTutorial(false);
                        triggerRoundAnnounce();
                        if (gameRef.current) gameRef.current.events.emit('startMatch');
                      } else {
                        socket.emit('player_in_ring', { roomId });
                        setWaitingForOpponent(true);
                        // ✅ Safety timeout reducido — el servidor es más confiable ahora
                        safetyTimerRef.current = setTimeout(() => {
                          setWaitingForOpponent(prev => {
                            if (prev) {
                              setShowTutorial(false);
                              triggerRoundAnnounce();
                              if (gameRef.current) gameRef.current.events.emit('startMatch');
                            }
                            return false;
                          });
                        }, 8000); // 8 segundos de gracia
                      }
                    }}
                    className="px-12 py-4 bg-gradient-to-br from-red-700 to-red-900 border border-red-500 text-white text-3xl font-['Bebas_Neue'] tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,0,0,0.5)]"
                  >¡ENTRAR AL RING!</button>
                  <p className="text-neutral-500 font-['Bebas_Neue'] text-sm tracking-[0.3em] animate-pulse">EL COMBATE COMENZARÁ AL CERRAR ESTA VENTANA</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ROTATE DEVICE */}
      <div className="md:hidden fixed inset-0 z-[100] bg-black/95 flex-col items-center justify-center hidden portrait:flex">
        <span className="text-7xl mb-6 animate-spin" style={{ animationDuration: '3s' }}>🔄</span>
        <h2 className="text-4xl text-red-500 font-['Bebas_Neue'] tracking-widest text-center px-4">GIRA TU TELÉFONO</h2>
        <p className="text-neutral-300 text-center px-8 mt-4 font-['Bebas_Neue'] text-xl tracking-wider">PARA UNA MEJOR EXPERIENCIA,<br/>JUEGA EN MODO HORIZONTAL.</p>
      </div>

      <div className="font-['Bebas_Neue'] text-xs md:text-base text-neutral-500 tracking-[0.3em] md:tracking-[0.5em] text-center py-3 bg-black z-20 flex-shrink-0 hidden md:block">
        A: JAB <span className="text-neutral-700 mx-2">|</span> S: GANCHO <span className="text-neutral-700 mx-2">|</span> D: PATADA <span className="text-neutral-700 mx-2">|</span> W: ESPECIAL
      </div>
    </div>
  );
}

export default GameView;