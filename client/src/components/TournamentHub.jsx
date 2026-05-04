import React, { useState, useEffect } from 'react';
import { socket } from '../socket';

function TournamentHub({ onJoinLobby, onBack, playerName }) {
    const [tournaments, setTournaments] = useState([]);
    const [newTourneyName, setNewTourneyName] = useState('');

    useEffect(() => {
        socket.emit('get_tournaments');

        socket.on('available_tournaments', (data) => {
            setTournaments(data);
        });
        
        socket.on('tournament_created', (data) => {
            onJoinLobby(data.id, data);
        });

        return () => {
            socket.off('available_tournaments');
            socket.off('tournament_created');
        };
    }, [onJoinLobby]);

    const handleCreate = (e) => {
        e.preventDefault();
        socket.emit('create_tournament', { name: newTourneyName.trim() });
    };

    return (
        <div className="screen min-h-screen flex flex-col items-center p-4 bg-gradient-to-br from-neutral-900 to-black overflow-y-auto">
            <div className="w-full max-w-5xl flex flex-col md:flex-row md:items-center gap-4 mb-8 mt-4 animate-fade-in-up">
                <button onClick={onBack} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 text-xl md:text-2xl font-['Bebas_Neue'] tracking-wider rounded border border-neutral-600 transition-colors w-fit shadow-md">
                    ← VOLVER
                </button>
                <h1 className="text-5xl md:text-7xl text-red-500 m-0 font-['Bebas_Neue'] tracking-widest drop-shadow-[0_0_15px_rgba(255,60,60,0.8)] md:ml-auto text-center md:text-right">
                    <span className="text-white">ZONA DE</span> TORNEOS
                </h1>
            </div>

            <div className="flex flex-col md:flex-row gap-6 w-full max-w-5xl flex-1 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                
                {/* LISTA DE TORNEOS DISPONIBLES */}
                <div className="flex-1 bg-neutral-950/80 backdrop-blur-md border border-neutral-800 p-6 rounded-lg shadow-2xl flex flex-col min-h-[300px]">
                    <h2 className="text-2xl md:text-3xl text-red-500 mb-4 pb-2 border-b-2 border-red-600 font-['Bebas_Neue'] tracking-widest">
                        TORNEOS DISPONIBLES ({tournaments.length})
                    </h2>
                    <div className="flex-1 overflow-y-auto flex flex-col gap-3">
                        {tournaments.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-neutral-500 text-lg md:text-xl font-['Bebas_Neue'] tracking-widest text-center">NO HAY TORNEOS ACTIVOS. ¡CREA UNO!</p>
                            </div>
                        ) : (
                            tournaments.map(t => (
                                <div key={t.id} className={`flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded border-l-4 transition-colors ${t.active ? 'bg-neutral-800/80 border-yellow-500' : 'bg-neutral-900/50 border-green-500 hover:bg-neutral-800/80'}`}>
                                    <div className="flex flex-col">
                                        <span className="text-2xl md:text-3xl font-['Bebas_Neue'] tracking-widest text-white">{t.name}</span>
                                        <span className="text-sm text-neutral-400 font-bold tracking-widest">SALA: {t.id} | JUGADORES: {t.players.length}</span>
                                    </div>
                                    {t.active ? (
                                        <button 
                                            disabled
                                            className="bg-yellow-600/50 text-white/50 px-6 py-2 text-xl font-['Bebas_Neue'] tracking-wider rounded border border-yellow-400/50 cursor-not-allowed w-full md:w-auto"
                                        >
                                            EN CURSO
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => onJoinLobby(t.id, t)}
                                            className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 text-xl font-['Bebas_Neue'] tracking-wider rounded border border-green-400 transition-colors shadow-[0_0_10px_rgba(74,222,128,0.3)] hover:shadow-[0_0_20px_rgba(74,222,128,0.5)] w-full md:w-auto"
                                        >
                                            UNIRSE
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* CREAR TORNEO */}
                <div className="flex-1 flex flex-col bg-neutral-950/80 backdrop-blur-md border border-neutral-800 p-6 rounded-lg shadow-2xl">
                    <h2 className="text-2xl md:text-3xl text-red-500 mb-4 pb-2 border-b-2 border-red-600 font-['Bebas_Neue'] tracking-widest">
                        CREAR NUEVO TORNEO
                    </h2>
                    
                    <form onSubmit={handleCreate} className="flex flex-col gap-6 flex-1 justify-center">
                        <div className="flex flex-col group">
                            <label className="text-red-500 tracking-[0.2em] mb-2 text-sm md:text-base font-semibold group-focus-within:text-red-400 transition-colors">
                                NOMBRE DEL TORNEO
                            </label>
                            <input 
                                type="text" 
                                className="w-full bg-black/60 border border-neutral-700 text-white p-3 md:p-4 text-xl md:text-2xl font-['Bebas_Neue'] outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/50 transition-all duration-300 placeholder-neutral-600 shadow-inner"
                                placeholder="EJ. TORNEO UNIVERSITARIO"
                                value={newTourneyName}
                                onChange={(e) => setNewTourneyName(e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            className="w-full relative group overflow-hidden bg-gradient-to-br from-red-700 to-red-900 border border-red-500 text-white p-4 text-2xl md:text-3xl font-['Bebas_Neue'] tracking-[0.1em] hover:scale-[1.02] active:scale-95 transition-all duration-300 shadow-[0_4px_15px_rgba(255,0,0,0.4)] hover:shadow-[0_0_30px_rgba(255,0,0,0.8)] rounded"
                        >
                            <span className="relative z-10">CREAR TORNEO</span>
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            <span className="absolute z-10 inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">CREAR TORNEO</span>
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
}

export default TournamentHub;
