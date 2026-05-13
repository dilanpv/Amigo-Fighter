const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Health check for Render/Deployment
app.get('/health', (req, res) => res.send('OK'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7, // 10MB
    // === Low-latency optimizations for real-time fighting game ===
    transports: ['websocket'],       // WebSocket only — skip long-polling overhead
    allowUpgrades: false,            // No transport upgrade dance
    pingInterval: 10000,             // 10s heartbeat interval
    pingTimeout: 5000,               // 5s timeout before disconnect
    perMessageDeflate: false,        // Disable compression for speed (fight data is small)
    httpCompression: false,          // No HTTP compression on WS
    connectTimeout: 8000,            // 8s connection timeout
    connectionStateRecovery: {
        maxDisconnectionDuration: 5000, // 5s grace period for mobile reconnects
        skipMiddlewares: true
    }
});

const rooms = new Map();
const tournaments = new Map(); // Multiple tournaments now

function getAvailableTournaments() {
    return Array.from(tournaments.values())
        .map(t => ({
            id: t.id,
            name: t.name,
            creatorId: t.creatorId,
            active: t.active,
            players: t.players,
            brackets: t.brackets,
            round: t.round,
            matches: t.matches
        }));
}

// Helper: Generate single elimination bracket AND register rooms for each match
function generateBrackets(players, tournamentId, roundNum) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        const matchId = `T-${tournamentId}-R${roundNum}-${i}`;
        if (shuffled[i + 1]) {
            matches.push({ p1: shuffled[i], p2: shuffled[i + 1], winner: null, id: matchId });
            // ✅ Create the room so player_ready can find it
            rooms.set(matchId, { players: [] });
        } else {
            matches.push({ p1: shuffled[i], p2: null, winner: shuffled[i], id: matchId, bye: true });
        }
    }
    return matches;
}

function processTournamentWin(roomId, winnerId) {
    // Buscar en qué torneo está el match
    let foundTournament = null;
    let match = null;

    for (let [id, t] of tournaments.entries()) {
        const m = t.matches.find(m => m.id === roomId);
        if (m) {
            foundTournament = t;
            match = m;
            break;
        }
    }

    if (match && !match.winner) {
        match.winner = foundTournament.players.find(p => p.id === winnerId);
        if (!match.winner) {
            match.winner = (match.p1 && match.p1.id === winnerId) ? match.p1 : match.p2;
        }
        if (!match.winner) return;

        console.log(`Match ${roomId} winner: ${match.winner.name}`);
        
        // ✅ M-4: Clean up the finished match room to prevent memory leaks
        rooms.delete(roomId);
        
        const unfinished = foundTournament.matches.filter(m => !m.winner);
        if (unfinished.length === 0) {
            const winners = foundTournament.matches.map(m => m.winner);
            if (winners.length === 1) {
                io.to(foundTournament.id).emit('tournament_finished', { winner: winners[0] });
                foundTournament.active = false;
                foundTournament.players = [];
                // ✅ M-4: Clean up all remaining rooms from this tournament
                foundTournament.matches.forEach(m => rooms.delete(m.id));
            } else {
                foundTournament.round++;
                foundTournament.matches = generateBrackets(winners, foundTournament.id, foundTournament.round);
                io.to(foundTournament.id).emit('next_round', { matches: foundTournament.matches, round: foundTournament.round });
                // Notify next round players of their match
                setTimeout(() => {
                    foundTournament.matches.forEach(m => {
                        if (!m.bye) {
                            // Pre-warm rooms for next round
                            const matchRoom = rooms.get(m.id);
                            if (matchRoom) {
                                matchRoom.players = [];
                                matchRoom.inRing = false;
                            }
                            io.to(m.p1.id).emit('join_match', { roomId: m.id, opponent: m.p2, tournamentId: foundTournament.id });
                            io.to(m.p2.id).emit('join_match', { roomId: m.id, opponent: m.p1, tournamentId: foundTournament.id });
                        }
                    });
                }, 5000); // 5s delay to show bracket screen
            }
        }
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Enviar torneos disponibles al conectarse
    socket.on('get_tournaments', () => {
        socket.emit('available_tournaments', getAvailableTournaments());
    });

    // --- LOBBY & ROOMS ---
    socket.on('join_room', (data) => {
        const { roomId, playerName, playerFace } = data;
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, { players: [] });
        }
        
        const room = rooms.get(roomId);
        if (room.players.length >= 2) {
            socket.emit('room_full');
            return;
        }

        const player = {
            id: socket.id,
            name: playerName,
            face: playerFace,
            side: room.players.length === 0 ? 'left' : 'right'
        };

        room.players.push(player);
        socket.join(roomId);
        
        socket.emit('joined_room', { player, opponents: room.players.filter(p => p.id !== socket.id) });
        socket.to(roomId).emit('player_joined', player);
    });

    // --- TOURNAMENT LOGIC ---
    socket.on('create_tournament', (data) => {
        const { name } = data;
        const tournamentId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newTournament = {
            id: tournamentId,
            name: name || `TORNEO ${tournamentId}`,
            creatorId: socket.id,
            active: false,
            players: [],
            brackets: [],
            round: 0,
            matches: [],
            timeout: setTimeout(() => {
                const t = tournaments.get(tournamentId);
                if (t && !t.active) {
                    tournaments.delete(tournamentId);
                    io.emit('available_tournaments', getAvailableTournaments());
                    io.to(tournamentId).emit('tournament_cancelled', 'El torneo ha sido cancelado por inactividad (sin iniciar).');
                }
            }, 3 * 60 * 1000) // 3 minutes timeout
        };
        tournaments.set(tournamentId, newTournament);
        io.emit('available_tournaments', getAvailableTournaments());
        
        // Remove timeout from response
        const { timeout, ...clientTournament } = newTournament;
        socket.emit('tournament_created', clientTournament);
    });

    socket.on('join_tournament_lobby', (data) => {
        const { tournamentId } = data;
        socket.join(tournamentId);
        const t = tournaments.get(tournamentId);
        if (t) {
            socket.emit('tournament_players_update', t.players);
            const { timeout, ...clientTournament } = t;
            socket.emit('tournament_info', { ...clientTournament, isAdmin: t.creatorId === socket.id });
        }
    });

    socket.on('join_tournament', (data) => {
        const { tournamentId, playerName } = data;
        const tournament = tournaments.get(tournamentId);
        if (tournament && !tournament.active) {
            const exists = tournament.players.find(p => p.id === socket.id);
            if (!exists) {
                tournament.players.push({
                    id: socket.id,
                    name: playerName
                });
            }
            const { timeout: _t, ...safeT } = tournament;
            io.emit('tournament_info', safeT);
            io.emit('available_tournaments', getAvailableTournaments());
        }
    });

    socket.on('leave_tournament', (data) => {
        const { tournamentId } = data;
        const t = tournaments.get(tournamentId);
        if (t && !t.active) {
            const prevCount = t.players.length;
            t.players = t.players.filter(p => p.id !== socket.id);
            if (t.players.length !== prevCount) {
                io.to(t.id).emit('tournament_players_update', t.players);
                const { timeout: _t2, ...safeT2 } = t;
                io.emit('tournament_info', safeT2);
                io.emit('available_tournaments', getAvailableTournaments());
            }
        }
        socket.leave(tournamentId);
    });

    socket.on('admin_start_tournament', (data) => {
        const { tournamentId } = data;
        const t = tournaments.get(tournamentId);
        if (!t || t.creatorId !== socket.id) return;

        if (t.players.length < 2) {
            socket.emit('error', 'Not enough players (min 2)');
            return;
        }
        
        if (t.timeout) clearTimeout(t.timeout);

        t.active = true;
        t.round = 1;
        t.matches = generateBrackets(t.players, t.id, 1);
        
        io.to(t.id).emit('tournament_started', { matches: t.matches, round: 1 });
        io.emit('available_tournaments', getAvailableTournaments());
        
        // Delay join_match so players can see the bracket screen for a few seconds
        setTimeout(() => {
            t.matches.forEach(m => {
                if (!m.bye) {
                    // Pre-warm rooms: ensure both players are in the socket room before match starts
                    const matchRoom = rooms.get(m.id);
                    if (matchRoom) {
                        matchRoom.players = []; // Reset for fresh match
                        matchRoom.inRing = false;
                    }
                    io.to(m.p1.id).emit('join_match', { roomId: m.id, opponent: m.p2, tournamentId: t.id });
                    io.to(m.p2.id).emit('join_match', { roomId: m.id, opponent: m.p1, tournamentId: t.id });
                }
            });
        }, 5000); // 5s delay to show bracket
    });

    socket.on('register_tournament', (data) => {
        const { tournamentId, playerName, face } = data;
        const t = tournaments.get(tournamentId);
        if (!t || t.active) return;

        // ✅ H-5: Prevent duplicate registration
        const alreadyRegistered = t.players.some(p => p.id === socket.id);
        if (alreadyRegistered) {
            socket.emit('tournament_players_update', t.players); // re-sync in case client is out of sync
            return;
        }

        const player = { id: socket.id, name: playerName, face: face };
        t.players.push(player);
        io.to(t.id).emit('tournament_players_update', t.players);
    });

    socket.on('report_win', (data) => {
        const { roomId, winnerId } = data;
        processTournamentWin(roomId, winnerId);
    });

    // --- GAME EVENTS ---
    socket.on('player_ready', (data) => {
        const { roomId, face, character, playerName } = data;
        let room = rooms.get(roomId);
        // ✅ Fallback: if room doesn't exist yet (e.g., race condition), create it
        if (!room) {
            room = { players: [] };
            rooms.set(roomId, room);
        }

        let player = room.players.find(p => p.id === socket.id);
        // ✅ If player not in room yet (tournament match), add them with their name
        if (!player) {
            player = { id: socket.id, name: playerName || 'Jugador', side: room.players.length === 0 ? 'left' : 'right' };
            room.players.push(player);
            socket.join(roomId);
        }

        player.face = face;
        player.character = character;
        player.name = playerName || player.name;
        player.ready = true;
        socket.to(roomId).emit('opponent_ready', { id: socket.id, face, character });
        
        if (room.players.length === 2 && room.players.every(p => p.ready)) {
            io.to(roomId).emit('start_game', { players: room.players });
        }
    });

    socket.on('player_in_ring', (data) => {
        const { roomId } = data;
        let room = rooms.get(roomId);
        
        // Fallback: create room if it doesn't exist (can happen in tournament race conditions)
        if (!room) {
            console.warn(`[player_in_ring] Room ${roomId} not found, creating it for ${socket.id}`);
            room = { players: [] };
            rooms.set(roomId, room);
        }
        
        // Ensure socket is in the socket.io room
        socket.join(roomId);
        
        let player = room.players.find(p => p.id === socket.id);
        if (!player) {
            // Player not found in room — add them (tournament edge case)
            console.warn(`[player_in_ring] Player ${socket.id} not in room ${roomId}, adding`);
            player = { id: socket.id, name: 'Jugador', side: room.players.length === 0 ? 'left' : 'right' };
            room.players.push(player);
        }
        
        player.inRing = true;
        console.log(`[player_in_ring] ${socket.id} is in ring for ${roomId}. Players: ${room.players.map(p => p.id + ':' + (p.inRing ? 'READY' : 'waiting')).join(', ')}`);
        
        if (room.players.length >= 2 && room.players.every(p => p.inRing)) {
            console.log(`[both_players_in_ring] Emitting for room ${roomId}`);
            io.to(roomId).emit('both_players_in_ring');
        } else if (room.players.length < 2) {
            // Only 1 player in room — the other might not have done player_ready yet
            // Re-check after a short delay
            setTimeout(() => {
                const r = rooms.get(roomId);
                if (r && r.players.length >= 2 && r.players.every(p => p.inRing)) {
                    console.log(`[both_players_in_ring] Delayed emit for room ${roomId}`);
                    io.to(roomId).emit('both_players_in_ring');
                }
            }, 3000);
        }
    });

    socket.on('player_move', (data) => {
        const { roomId, ...moveData } = data;
        socket.volatile.to(roomId).emit('opponent_move', moveData);
    });

    socket.on('player_attack', (data) => {
        const { roomId, ...attackData } = data;
        socket.to(roomId).emit('opponent_attack', attackData);
    });

    socket.on('player_hit', (data) => {
        const { roomId, ...hitData } = data;
        socket.to(roomId).emit('opponent_hit', hitData);
    });

    socket.on('player_emote', (data) => {
        const { roomId, emote } = data;
        socket.to(roomId).emit('opponent_emote', { id: socket.id, emote });
    });

    // N-6: Rematch system for non-tournament matches
    socket.on('request_rematch', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (!room) return;

        // Initialize rematch tracking if not present
        if (!room.rematchRequests) room.rematchRequests = new Set();
        room.rematchRequests.add(socket.id);

        // Notify opponent that rematch was requested
        socket.to(roomId).emit('rematch_requested', { by: socket.id });

        // If both players requested rematch, accept
        const roomPlayerIds = room.players.map(p => p.id);
        const allRequested = roomPlayerIds.every(pid => room.rematchRequests.has(pid));
        if (room.players.length === 2 && allRequested) {
            // Reset room state for new match
            room.rematchRequests = new Set();
            room.players.forEach(p => { p.ready = false; p.inRing = false; });
            io.to(roomId).emit('rematch_accepted');
            console.log(`Rematch accepted in room ${roomId}`);
        }
    });

    socket.on('decline_rematch', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            room.rematchRequests = new Set();
            socket.to(roomId).emit('rematch_declined');
        }
    });

    socket.on('leave_match', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                io.to(roomId).emit('opponent_left_match');
                io.to(roomId).emit('player_left', socket.id);
            }
            if (room.players.length === 0) rooms.delete(roomId);
        }
        socket.leave(roomId);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // M-7: Grace period para micro-cortes de red en móviles
        setTimeout(() => {
            if (io.sockets.sockets.has(socket.id) || socket.recovered) {
                console.log(`Socket ${socket.id} recovered within grace period. Ignoring disconnect.`);
                return;
            }

            // Handle tournament logic
            for (let [id, t] of tournaments.entries()) {
                if (t.active) {
                    const activeMatch = t.matches.find(m => !m.winner && ((m.p1 && m.p1.id === socket.id) || (m.p2 && m.p2.id === socket.id)));
                    if (activeMatch) {
                        const winner = (activeMatch.p1 && activeMatch.p1.id === socket.id) ? activeMatch.p2 : activeMatch.p1;
                        if (winner) {
                            console.log(`Player ${socket.id} disconnected. Match ${activeMatch.id} won by ${winner.name} (forfeit).`);
                            processTournamentWin(activeMatch.id, winner.id);
                        }
                    }
                } else {
                    const prevCount = t.players.length;
                    t.players = t.players.filter(p => p.id !== socket.id);
                    if (t.players.length !== prevCount) {
                        io.to(t.id).emit('tournament_players_update', t.players);
                    }
                }
                
                // Si el creador se desconecta y no está activo, borrar torneo
                if (t.creatorId === socket.id && !t.active) {
                    if (t.timeout) clearTimeout(t.timeout);
                    tournaments.delete(id);
                    io.emit('available_tournaments', getAvailableTournaments());
                    io.to(t.id).emit('tournament_cancelled', 'El torneo ha sido cancelado porque el creador se desconectó.');
                }
            }

            // Clean up rooms
            rooms.forEach((room, roomId) => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    io.to(roomId).emit('opponent_left_match');
                    io.to(roomId).emit('player_left', socket.id);
                    if (room.players.length === 0) rooms.delete(roomId);
                }
            });
        }, 5000); // 5 segundos de espera
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
