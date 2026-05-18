import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import CharacterSelect, { CHARACTERS } from './components/CharacterSelect';
import GameView from './components/GameView';
import TournamentLobby from './components/TournamentLobby';
import TournamentHub from './components/TournamentHub';
import BracketView from './components/BracketView';
import TournamentResults from './components/TournamentResults'; // H-4
import { socket } from './socket';

function App() {
  const [screen, setScreen] = useState('lobby'); // lobby, tournament_lobby, character, loading, bracket, game
  const [roomId, setRoomId] = useState('');
  const [playerData, setPlayerData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [tournamentPlayers, setTournamentPlayers] = useState([]);
  const [tournamentInfo, setTournamentInfo] = useState(null);
  const [matches, setMatches] = useState([]);
  const [round, setRound] = useState(0);
  const [opponentCount, setOpponentCount] = useState(0);
  const [bracketCountdown, setBracketCountdown] = useState(null);
  const [opponentInfo, setOpponentInfo] = useState(null); // M-5: opponent data for loading screen
  const [cpuDifficulty, setCpuDifficulty] = useState('normal'); // H-3: CPU difficulty
  const [tournamentWinner, setTournamentWinner] = useState(null); // H-4: Store winner for podium
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0); // N-9: rotating loading message index
  const [sessionStats, setSessionStats] = useState({ fights: 0, wins: 0, kos: 0 }); // N-16: session stats
  
  // Refs to always access fresh state inside socket callbacks
  const playerDataRef = React.useRef(playerData);
  const roomIdRef = React.useRef(roomId);
  React.useEffect(() => { playerDataRef.current = playerData; }, [playerData]);
  React.useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // N-9: Rotate loading messages reactively
  const LOADING_MSGS = [
    'ORGANIZANDO EL RING...', 'PELEADORES CALENTANDO...', 'PREPARANDO EL COMBATE...', 'LUCHADORES LISTOS...'
  ];
  useEffect(() => {
    if (screen !== 'loading') return;
    setLoadingMsgIdx(0);
    const timer = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % LOADING_MSGS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    // ✅ Empty dependency array: listeners are registered ONCE and never lost
    socket.on('connect', () => console.log('Connected to server'));

    socket.on('joined_room', ({ player, opponents }) => {
      setPlayerData(player);
      setOpponentCount(opponents.length);
      setScreen('character');
    });

    socket.on('player_joined', () => {
      setOpponentCount(prev => prev + 1);
    });

    socket.on('player_left', () => {
      setOpponentCount(prev => Math.max(0, prev - 1));
    });

    socket.on('room_full', () => {
      alert("ERROR: ¡La sala está llena!");
      setScreen('lobby');
    });

    socket.on('start_game', (data) => {
      setGameState(data);
      setScreen('game');
    });

    // TOURNAMENT EVENTS
    socket.on('tournament_players_update', (players) => {
        setTournamentPlayers(players);
    });

    socket.on('tournament_info', (data) => {
        setTournamentInfo(data);
        setScreen('tournament_lobby');
    });

    socket.on('tournament_started', (data) => {
        setMatches(data.matches);
        setRound(data.round);
        setBracketCountdown(5);
        setScreen('bracket');
    });

    socket.on('join_match', (data) => {
        // ✅ Preserve player name when going to character select for tournament match
        setRoomId(data.roomId);
        setOpponentInfo(data.opponent || null); // M-5: store opponent for loading screen
        setPlayerData(prev => prev ? { ...prev } : { name: 'Jugador', id: socket.id });
        setBracketCountdown(null);
        setScreen('character');
    });

    socket.on('next_round', (data) => {
        setMatches(data.matches);
        setRound(data.round);
        setBracketCountdown(5);
        setScreen('bracket');
    });

    socket.on('tournament_finished', (data) => {
        // H-4: Show podium instead of alert
        setTournamentWinner(data.winner);
        setScreen('tournament_results');
    });

    socket.on('tournament_cancelled', (msg) => {
        alert(msg);
        setScreen('tournament_hub');
    });

    return () => {
      socket.off('joined_room');
      socket.off('room_full');
      socket.off('start_game');
      socket.off('tournament_players_update');
      socket.off('tournament_info');
      socket.off('tournament_started');
      socket.off('join_match');
      socket.off('next_round');
      socket.off('tournament_finished');
      socket.off('tournament_cancelled');
      socket.off('player_joined');
      socket.off('player_left');
    };
  }, []); // ✅ Empty deps — never re-registers listeners

  const handleJoinRoom = (id, name) => {
    if (id === 'TOURNAMENT') {
        setPlayerData({ name, id: socket.id });
        setScreen('tournament_hub');
        return;
    }
    setRoomId(id);
    socket.emit('join_room', { roomId: id, playerName: name });
  };

  const handleJoinTournamentLobby = (tournamentId, info) => {
    setRoomId(tournamentId);
    socket.emit('join_tournament_lobby', { tournamentId });
  };

  const handleRegisterTournament = () => {
    let currentFace = playerData?.face;
    if (!currentFace) {
        const randomAvatarId = Math.floor(Math.random() * 5) + 1;
        currentFace = `https://api.dicebear.com/7.x/pixel-art/svg?seed=AmigoFighter${randomAvatarId}`;
        setPlayerData(prev => ({ ...prev, face: currentFace }));
    }
    socket.emit('register_tournament', { tournamentId: roomId, playerName: playerData.name, face: currentFace });
  };

  const handleStartTournament = () => {
    socket.emit('admin_start_tournament', { tournamentId: roomId });
  };

  const handleCharacterReady = (face, character) => {
    const updatedPlayer = { ...playerData, face, character };
    setPlayerData(updatedPlayer);
    socket.emit('player_ready', { roomId, face, character, playerName: playerData?.name });
    setScreen('loading');
  };

  const startCPUMatch = () => {
    // Select a random character for the CPU (excluding current player character optionally, or just any)
    // To make it fully random, we pick one from CHARACTERS
    const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
    
    // H-3: Pass difficulty and random CPU character to Phaser
    setGameState({ 
      players: [playerData], 
      cpuDifficulty,
      cpuCharacter: randomChar 
    });
    setScreen('game');
  };

  const handleGameEnd = (winnerId) => {
    // N-16: Track session stats
    if (playerData) {
      setSessionStats(prev => ({
        fights: prev.fights + 1,
        wins: winnerId && winnerId === playerData.id ? prev.wins + 1 : prev.wins,
        kos: winnerId ? prev.kos + 1 : prev.kos,
      }));
    }

    // M-10: Ensure we exit fullscreen and reset scroll on exit (critical for mobile)
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
    window.scrollTo(0, 0);

    if (roomId && typeof roomId === 'string' && roomId.startsWith('T-')) {
        if (winnerId) {
            socket.emit('report_win', { roomId, winnerId });
            setScreen('bracket');
        } else {
            // User intentionally left, forfeit match
            if (roomId) {
                socket.emit('leave_match', { roomId });
                socket.emit('leave_tournament', { tournamentId: roomId });
            }
            setScreen('tournament_hub');
        }
    } else {
        // Normal match — leave the room and go back to lobby
        if (roomId) socket.emit('leave_match', { roomId });
        setScreen('lobby');
    }
  };

  const handleLeaveTournamentLobby = () => {
    socket.emit('leave_tournament', { tournamentId: roomId });
    setScreen('tournament_hub');
  };

  return (
    <div className="min-h-screen bg-black">
      {screen === 'lobby' && <Lobby onJoin={handleJoinRoom} sessionStats={sessionStats} />}
      {screen === 'tournament_hub' && (
        <TournamentHub 
            playerName={playerData?.name}
            onJoinLobby={handleJoinTournamentLobby}
            onBack={() => setScreen('lobby')}
        />
      )}
      {screen === 'tournament_lobby' && (
        <TournamentLobby 
            players={tournamentPlayers} 
            onRegister={handleRegisterTournament}
            onStart={handleStartTournament}
            onBack={handleLeaveTournamentLobby}
            isAdmin={tournamentInfo?.isAdmin}
            tournamentName={tournamentInfo?.name}
        />
      )}
      {screen === 'character' && (
        <CharacterSelect 
          playerData={playerData} 
          opponentInfo={opponentInfo}
          onReady={handleCharacterReady} 
          onBack={() => {
              if (roomId && typeof roomId === 'string' && roomId.startsWith('T-')) {
                  socket.emit('leave_match', { roomId });
                  socket.emit('leave_tournament', { tournamentId: roomId });
                  setScreen('tournament_hub');
              } else {
                  setScreen('lobby');
              }
          }}
        />
      )}
      {screen === 'loading' && (
        <div className="screen min-h-screen flex flex-col items-center justify-center p-4 relative">
          <button 
            onClick={() => {
              if (roomId && typeof roomId === 'string' && roomId.startsWith('T-')) {
                  if (roomId) {
                      socket.emit('leave_match', { roomId });
                      socket.emit('leave_tournament', { tournamentId: roomId });
                  }
                  setScreen('tournament_hub');
              } else {
                  if (roomId) socket.emit('leave_match', { roomId });
                  setScreen('lobby');
              }
            }} 
            className="absolute top-4 left-4 md:top-8 md:left-8 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-['Bebas_Neue'] text-xl md:text-2xl tracking-widest border border-neutral-600 rounded transition-colors z-[120] shadow-md"
          >
            ← VOLVER
          </button>
          <div className="text-center w-full max-w-lg mt-12 md:mt-0">
            <h1 className="text-3xl md:text-6xl text-red-500 font-['Bebas_Neue'] tracking-widest mb-4 md:mb-6 drop-shadow-[0_0_30px_rgba(255,60,60,0.8)]">
              AMIGO FIGHTER
            </h1>
            <div className="text-base md:text-2xl text-white font-['Bebas_Neue'] tracking-[0.3em] md:tracking-[0.4em] mb-6 animate-pulse">
              {LOADING_MSGS[loadingMsgIdx]}
            </div>
            <div className="flex gap-2 md:gap-3 justify-center mb-6">
              {[0,1,2,3,4].map(i => (
                <div key={i} className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-red-500 shadow-[0_0_10px_#ff3c3c]"
                  style={{ animation: `bounce 1.2s ${i*0.15}s infinite alternate` }} />
              ))}
            </div>

            {/* M-5: Tournament mode — show opponent name, no CPU option */}
            {roomId.startsWith('T-') && (
              <div className="mt-6 md:mt-10 flex flex-col items-center gap-3">
                {opponentInfo?.face && (
                  <img src={opponentInfo.face} alt={opponentInfo.name}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-red-500 object-cover shadow-[0_0_15px_rgba(255,0,0,0.5)]" />
                )}
                <div className="text-neutral-300 font-['Bebas_Neue'] text-xl md:text-3xl tracking-[0.2em]">
                  VS <span className="text-red-400">{opponentInfo?.name || 'TU RIVAL'}</span>
                </div>
                <div className="text-neutral-500 font-['Bebas_Neue'] text-sm md:text-lg tracking-[0.2em] animate-pulse">
                  ESPERANDO QUE TU RIVAL ESTÉ LISTO...
                </div>
              </div>
            )}

            {/* Normal mode — no opponent yet */}
            {opponentCount === 0 && !roomId.startsWith('T-') && (
                <div className="mt-8 md:mt-12 flex flex-col items-center gap-3 md:gap-4">
                  <div className="text-neutral-400 font-['Bebas_Neue'] text-lg md:text-2xl tracking-[0.2em] animate-pulse">
                    ESPERANDO A UN RETADOR...
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <button 
                      onClick={startCPUMatch}
                      className="px-6 py-3 md:px-8 md:py-4 bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-600 hover:text-white font-['Bebas_Neue'] text-xl md:text-2xl tracking-widest transition-all duration-300 shadow-[0_0_15px_rgba(255,0,0,0.4)]"
                    >
                      JUGAR VS CPU
                    </button>
                    <div className="flex flex-wrap gap-1.5 md:gap-2 bg-neutral-900/80 p-1.5 md:p-2 border border-neutral-700 rounded shadow-inner justify-center">
                      {['facil', 'normal', 'dificil'].map(diff => (
                        <button
                          key={diff}
                          onClick={() => setCpuDifficulty(diff)}
                          className={`px-3 py-1.5 md:px-4 md:py-2 font-['Bebas_Neue'] tracking-wider text-sm md:text-lg transition-colors border ${cpuDifficulty === diff ? 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(255,0,0,0.6)]' : 'bg-black text-neutral-400 border-neutral-600 hover:text-white hover:border-neutral-400'}`}
                        >
                          {diff.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
            )}

            {/* Normal mode — opponent is connected and selecting character */}
            {opponentCount > 0 && !roomId.startsWith('T-') && (
                <div className="mt-6 md:mt-8 text-neutral-400 font-['Bebas_Neue'] text-lg md:text-xl tracking-widest animate-pulse">
                  RIVAL CONECTADO — ESPERANDO SELECCIÓN...
                </div>
            )}
            
          </div>
          <style>{`
            @keyframes bounce { to { transform: translateY(-16px); opacity:0.4; } }
          `}</style>
        </div>
      )}

      {screen === 'bracket' && (
          <BracketView matches={matches} round={round} countdown={bracketCountdown} onCountdownTick={setBracketCountdown} />
      )}
      {screen === 'game' && (
        <GameView 
          roomId={roomId} 
          playerData={playerData} 
          gameState={gameState}
          onEnd={handleGameEnd}
        />
      )}
      {/* H-4: Tournament podium screen */}
      {screen === 'tournament_results' && (
        <TournamentResults 
          winner={tournamentWinner} 
          onFinish={() => setScreen('tournament_hub')} 
        />
      )}
    </div>
  );
}

export default App;
