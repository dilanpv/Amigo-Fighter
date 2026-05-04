import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import CharacterSelect from './components/CharacterSelect';
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
  
  // Refs to always access fresh state inside socket callbacks
  const playerDataRef = React.useRef(playerData);
  const roomIdRef = React.useRef(roomId);
  React.useEffect(() => { playerDataRef.current = playerData; }, [playerData]);
  React.useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

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
    // H-3: Pass difficulty to Phaser via gameState custom field
    setGameState({ players: [playerData], cpuDifficulty });
    setScreen('game');
  };

  const handleGameEnd = (winnerId) => {
    if (roomId.startsWith('T-')) {
        // Tournament match — report win if there's a winner, then return to bracket
        if (winnerId) socket.emit('report_win', { roomId, winnerId });
        setScreen('bracket');
    } else {
        // Normal match — leave the room and go back to lobby
        socket.emit('leave_match', { roomId });
        setScreen('lobby');
    }
  };

  const LOADING_MSGS = [
    'ORGANIZANDO EL RING...', 'PELEADORES CALENTANDO...', 'PREPARANDO EL COMBATE...', 'LUCHADORES LISTOS...'
  ];

  const handleLeaveTournamentLobby = () => {
    socket.emit('leave_tournament', { tournamentId: roomId });
    setScreen('tournament_hub');
  };

  return (
    <div className="min-h-screen bg-black">
      {screen === 'lobby' && <Lobby onJoin={handleJoinRoom} />}
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
          onBack={() => setScreen('lobby')}
        />
      )}
      {screen === 'loading' && (
        <div className="screen">
          <div style={{textAlign:'center'}}>
            <h1 style={{fontSize:'clamp(2rem,8vw,5rem)', color:'#ff3c3c', textShadow:'0 0 30px #ff3c3c', marginBottom:'20px', letterSpacing:'4px'}}>
              AMIGO FIGHTER
            </h1>
            <div style={{fontSize:'clamp(1rem,4vw,2rem)', color:'#fff', letterSpacing:'6px', marginBottom:'30px', animation:'pulse 1.5s infinite'}}>
              {LOADING_MSGS[Math.floor(Date.now() / 1000) % LOADING_MSGS.length]}
            </div>
            <div style={{display:'flex', gap:'12px', justifyContent:'center'}}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{
                  width:'14px', height:'14px', borderRadius:'50%',
                  background: '#ff3c3c',
                  boxShadow:'0 0 10px #ff3c3c',
                  animation:`bounce 1.2s ${i*0.15}s infinite alternate`
                }} />
              ))}
            </div>

            {/* M-5: Tournament mode — show opponent name, no CPU option */}
            {roomId.startsWith('T-') && (
              <div className="mt-10 flex flex-col items-center gap-3">
                {opponentInfo?.face && (
                  <img src={opponentInfo.face} alt={opponentInfo.name}
                    className="w-16 h-16 rounded-full border-2 border-red-500 object-cover shadow-[0_0_15px_rgba(255,0,0,0.5)]" />
                )}
                <div className="text-neutral-300 font-['Bebas_Neue'] text-2xl md:text-3xl tracking-[0.2em]">
                  VS <span className="text-red-400">{opponentInfo?.name || 'TU RIVAL'}</span>
                </div>
                <div className="text-neutral-500 font-['Bebas_Neue'] text-lg tracking-[0.2em] animate-pulse">
                  ESPERANDO QUE TU RIVAL ESTÉ LISTO...
                </div>
              </div>
            )}

            {/* Normal mode — no opponent yet */}
            {opponentCount === 0 && !roomId.startsWith('T-') && (
                <div className="mt-12 flex flex-col items-center gap-4">
                  <div className="text-neutral-400 font-['Bebas_Neue'] text-xl md:text-2xl tracking-[0.2em] animate-pulse">
                    ESPERANDO A UN RETADOR...
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <button 
                      onClick={startCPUMatch}
                      className="px-8 py-4 bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-600 hover:text-white font-['Bebas_Neue'] text-2xl tracking-widest transition-all duration-300 shadow-[0_0_15px_rgba(255,0,0,0.4)]"
                    >
                      JUGAR VS CPU
                    </button>
                    <div className="flex gap-2 bg-neutral-900/80 p-2 border border-neutral-700 rounded shadow-inner">
                      {['facil', 'normal', 'dificil'].map(diff => (
                        <button
                          key={diff}
                          onClick={() => setCpuDifficulty(diff)}
                          className={`px-4 py-2 font-['Bebas_Neue'] tracking-wider text-lg transition-colors border ${cpuDifficulty === diff ? 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(255,0,0,0.6)]' : 'bg-black text-neutral-400 border-neutral-600 hover:text-white hover:border-neutral-400'}`}
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
                <div className="mt-8 text-neutral-400 font-['Bebas_Neue'] text-xl tracking-widest animate-pulse">
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
