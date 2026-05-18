const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.get('/health', (req, res) => res.send('OK'));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7,
    pingInterval: 10000,
    pingTimeout: 5000,
    perMessageDeflate: false,
    httpCompression: false,
    connectTimeout: 8000,
    connectionStateRecovery: {
        maxDisconnectionDuration: 5000,
        skipMiddlewares: true
    }
});

const rooms = new Map();
const tournaments = new Map();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getAvailableTournaments() {
    return Array.from(tournaments.values()).map(t => ({
        id: t.id, name: t.name, creatorId: t.creatorId,
        active: t.active, players: t.players,
        brackets: t.brackets, round: t.round, matches: t.matches
    }));
}

function generateBrackets(players, tournamentId, roundNum) {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
        const matchId = `T-${tournamentId}-R${roundNum}-${i}`;
        if (shuffled[i + 1]) {
            matches.push({ p1: shuffled[i], p2: shuffled[i + 1], winner: null, id: matchId });
            rooms.set(matchId, createRoomState());
        } else {
            matches.push({ p1: shuffled[i], p2: null, winner: shuffled[i], id: matchId, bye: true });
        }
    }
    return matches;
}

// ✅ FIX 1: HP AUTORITATIVO — el servidor lleva el HP real
function createRoomState() {
    return {
        players: [],
        hp: { left: 100, right: 100 },
        ringStarted: false,
        roundTransitioning: false,
        round: 1,
        wins: { left: 0, right: 0 },
        rematchRequests: new Set()
    };
}

function resetRoomHp(room) {
    room.hp = { left: 100, right: 100 };
    room.roundTransitioning = false;
    // ✅ Limpiar posiciones y estado de ataque de los jugadores
    room.players.forEach(p => {
        p.x = p.side === 'left' ? 180 : 620; // reset to spawn position
        p.y = undefined;
        p.positionHistory = []; // ✅ True Lag Compensation
        p.isAttacking = false;
        if (p.attackTimeout) { clearTimeout(p.attackTimeout); p.attackTimeout = null; }
    });
}

// ✅ FIX 2: Rate limiter por socket
function createRateLimiter(maxPerSec) {
    const counts = new Map();
    return function(socketId) {
        const now = Date.now();
        const entry = counts.get(socketId) || { count: 0, reset: now + 1000 };
        if (now > entry.reset) { entry.count = 0; entry.reset = now + 1000; }
        entry.count++;
        counts.set(socketId, entry);
        return entry.count <= maxPerSec;
    };
}

const attackRateLimit = createRateLimiter(10);  // max 10 ataques/seg
const moveRateLimit   = createRateLimiter(32);  // max ~30fps de movimiento (reduce bandwidth 50%)

function processTournamentWin(roomId, winnerId) {
    let foundTournament = null;
    let match = null;

    for (let [id, t] of tournaments.entries()) {
        const m = t.matches.find(m => m.id === roomId);
        if (m) { foundTournament = t; match = m; break; }
    }

    if (match && !match.winner) {
        match.winner = foundTournament.players.find(p => p.id === winnerId);
        if (!match.winner) {
            match.winner = (match.p1 && match.p1.id === winnerId) ? match.p1 : match.p2;
        }
        if (!match.winner) return;

        console.log(`Match ${roomId} winner: ${match.winner.name}`);
        rooms.delete(roomId);

        const unfinished = foundTournament.matches.filter(m => !m.winner);
        if (unfinished.length === 0) {
            const winners = foundTournament.matches.map(m => m.winner);
            if (winners.length === 1) {
                io.to(foundTournament.id).emit('tournament_finished', { winner: winners[0] });
                foundTournament.active = false;
                foundTournament.players = [];
                foundTournament.matches.forEach(m => rooms.delete(m.id));
            } else {
                foundTournament.round++;
                foundTournament.matches = generateBrackets(winners, foundTournament.id, foundTournament.round);
                io.to(foundTournament.id).emit('next_round', { matches: foundTournament.matches, round: foundTournament.round });
                setTimeout(() => {
                    foundTournament.matches.forEach(m => {
                        if (!m.bye) {
                            const p1Online = io.sockets.sockets.has(m.p1.id);
                            const p2Online = io.sockets.sockets.has(m.p2.id);

                            if (!p1Online || !p2Online) {
                                const autoWinnerId = p1Online ? m.p1.id : (p2Online ? m.p2.id : m.p1.id);
                                console.log(`[Tournament] Match ${m.id} auto-forfeit due to offline player. Winner: ${autoWinnerId}`);
                                processTournamentWin(m.id, autoWinnerId);
                                return;
                            }

                            const matchRoom = rooms.get(m.id);
                            if (matchRoom) { matchRoom.players = []; matchRoom.ringStarted = false; }
                            io.to(m.p1.id).emit('join_match', { roomId: m.id, opponent: m.p2, tournamentId: foundTournament.id });
                            io.to(m.p2.id).emit('join_match', { roomId: m.id, opponent: m.p1, tournamentId: foundTournament.id });
                        }
                    });
                }, 5000);
            }
        }
    }
}

// ─── SOCKET EVENTS ────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('get_tournaments', () => {
        socket.emit('available_tournaments', getAvailableTournaments());
    });

    // --- LOBBY & ROOMS ---
    socket.on('join_room', (data) => {
        const { roomId, playerName, playerFace } = data;
        if (!rooms.has(roomId)) rooms.set(roomId, createRoomState());

        const room = rooms.get(roomId);
        if (room.players.length >= 2) { socket.emit('room_full'); return; }

        const player = {
            id: socket.id,
            name: playerName,
            face: playerFace,
            side: room.players.length === 0 ? 'left' : 'right',
            x: room.players.length === 0 ? 180 : 620
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
                    io.to(tournamentId).emit('tournament_cancelled', 'El torneo fue cancelado por inactividad.');
                }
            }, 3 * 60 * 1000)
        };
        tournaments.set(tournamentId, newTournament);
        io.emit('available_tournaments', getAvailableTournaments());
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
            if (!exists) tournament.players.push({ id: socket.id, name: playerName });
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
        if (t.players.length < 2) { socket.emit('error', 'Not enough players (min 2)'); return; }
        if (t.timeout) clearTimeout(t.timeout);

        t.active = true;
        t.round = 1;
        t.matches = generateBrackets(t.players, t.id, 1);

        io.to(t.id).emit('tournament_started', { matches: t.matches, round: 1 });
        io.emit('available_tournaments', getAvailableTournaments());

        setTimeout(() => {
            t.matches.forEach(m => {
                if (!m.bye) {
                    const p1Online = io.sockets.sockets.has(m.p1.id);
                    const p2Online = io.sockets.sockets.has(m.p2.id);

                    if (!p1Online || !p2Online) {
                        const autoWinnerId = p1Online ? m.p1.id : (p2Online ? m.p2.id : m.p1.id);
                        console.log(`[Tournament] Match ${m.id} auto-forfeit due to offline player. Winner: ${autoWinnerId}`);
                        processTournamentWin(m.id, autoWinnerId);
                        return;
                    }

                    const matchRoom = rooms.get(m.id);
                    if (matchRoom) { matchRoom.players = []; matchRoom.ringStarted = false; }
                    io.to(m.p1.id).emit('join_match', { roomId: m.id, opponent: m.p2, tournamentId: t.id });
                    io.to(m.p2.id).emit('join_match', { roomId: m.id, opponent: m.p1, tournamentId: t.id });
                }
            });
        }, 5000);
    });

    socket.on('register_tournament', (data) => {
        const { tournamentId, playerName, face } = data;
        const t = tournaments.get(tournamentId);
        if (!t || t.active) return;
        const alreadyRegistered = t.players.some(p => p.id === socket.id);
        if (alreadyRegistered) { socket.emit('tournament_players_update', t.players); return; }
        const player = { id: socket.id, name: playerName, face };
        t.players.push(player);
        io.to(t.id).emit('tournament_players_update', t.players);
    });

    socket.on('report_win', (data) => {
        const { roomId, winnerId } = data;
        processTournamentWin(roomId, winnerId);
    });

    socket.on('player_ready', (data) => {
        const { roomId, face, character, playerName } = data;
        let room = rooms.get(roomId);
        if (!room) { room = createRoomState(); rooms.set(roomId, room); }

        let player = room.players.find(p => p.id === socket.id);
        if (!player) {
            const side = room.players.length === 0 ? 'left' : 'right';
            player = { id: socket.id, name: playerName || 'Jugador', side, x: side === 'left' ? 180 : 620 };
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

    // ✅ FIX 3: ring start con flag para evitar doble emisión
    socket.on('player_in_ring', (data) => {
        const { roomId } = data;
        let room = rooms.get(roomId);

        if (!room) {
            console.warn(`[player_in_ring] Room ${roomId} not found, creating for ${socket.id}`);
            room = createRoomState();
            rooms.set(roomId, room);
        }

        socket.join(roomId);

        let player = room.players.find(p => p.id === socket.id);
        if (!player) {
            player = { id: socket.id, name: 'Jugador', side: room.players.length === 0 ? 'left' : 'right' };
            room.players.push(player);
        }

        player.inRing = true;
        console.log(`[player_in_ring] ${socket.id} ready in ${roomId}. Ready: ${room.players.filter(p => p.inRing).length}/2`);

        // ✅ FIX: flag ringStarted evita doble emisión
        if (!room.ringStarted && room.players.filter(p => p.inRing).length >= 2) {
            room.ringStarted = true;
            console.log(`[both_players_in_ring] Emitting for room ${roomId}`);
            // ✅ Reiniciar HP al iniciar la partida
            resetRoomHp(room);
            io.to(roomId).emit('both_players_in_ring');
            // ✅ Enviar HP inicial a ambos jugadores
            io.to(roomId).emit('hp_update', room.hp);
        } else if (!room.ringStarted) {
            // Re-check after delay in case of race condition
            setTimeout(() => {
                const r = rooms.get(roomId);
                if (r && !r.ringStarted && r.players.filter(p => p.inRing).length >= 2) {
                    r.ringStarted = true;
                    resetRoomHp(r);
                    console.log(`[both_players_in_ring] Delayed emit for room ${roomId}`);
                    io.to(roomId).emit('both_players_in_ring');
                    io.to(roomId).emit('hp_update', r.hp);
                }
            }, 2000);
        }
    });

    // ✅ FIX 4: Tracking de posiciones autoritativas (sin rate limit para precisión de hits)
    socket.on('player_move', (data) => {
        const { roomId, ...moveData } = data;
        // Trackear posiciones en el servidor para validar hits
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === moveData.id || p.id === socket.id);
            if (player) {
                player.x = moveData.x;
                player.y = moveData.y;
                player.anim = moveData.anim;
                player.flip = moveData.flip;
                player.lastMoveTime = Date.now();
                
                // ✅ True Lag Compensation: Guardar historial
                if (!player.positionHistory) player.positionHistory = [];
                player.positionHistory.push({ x: moveData.x, time: Date.now() });
                // Mantener solo el último segundo (~30 snapshots)
                while (player.positionHistory.length > 30) player.positionHistory.shift();
            }
        }
        socket.volatile.to(roomId).emit('opponent_move', moveData);
    });

    // ✅ Ping request handler (Phase 3)
    socket.on('ping_request', (callback) => {
        if (typeof callback === 'function') callback();
    });

    // ✅ FIX 5: Rate limiting en ataques + tracking de estado de ataque
    socket.on('player_attack', (data) => {
        if (!attackRateLimit(socket.id)) return;
        const { roomId, ...attackData } = data;
        // Trackear que el jugador está atacando (para validar hits)
        const room = rooms.get(roomId);
        if (room) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.isAttacking = true;
                player.lastAttackTime = Date.now();
                player.lastAttackType = attackData.type;
                // Limpiar estado de ataque después de 800ms
                if (player.attackTimeout) clearTimeout(player.attackTimeout);
                player.attackTimeout = setTimeout(() => { player.isAttacking = false; }, 800);
            }
        }
        socket.to(roomId).emit('opponent_attack', attackData);
    });

    // ✅ WebRTC Signaling Relay — el servidor solo retransmite señales P2P
    socket.on('webrtc_signal', (data) => {
        const { roomId, ...signalData } = data;
        socket.to(roomId).emit('webrtc_signal', { roomId, ...signalData });
    });

    // ✅ FIX 6: HP AUTORITATIVO + TRUE LAG COMPENSATION
    socket.on('player_hit', (data) => {
        const { roomId, id, targetId, finalDamage, attackerX, isCombo, hitTimestamp } = data;
        const room = rooms.get(roomId);
        if (!room || room.roundTransitioning) return;

        // Validar que el atacante es quien está en la sala
        const attacker = room.players.find(p => p.id === id || p.id === socket.id);
        if (!attacker) return;

        // Validar rango de daño (anti-cheat básico)
        const MAX_DAMAGE = 50;
        const validatedDamage = Math.min(Math.max(0, Math.round(finalDamage)), MAX_DAMAGE);
        if (validatedDamage <= 0) return;

        // Determinar lado del defensor
        const defender = room.players.find(p => p.id === targetId);
        const defenderSide = defender?.side || (attacker.side === 'left' ? 'right' : 'left');

        // ✅ True Lag Compensation: Buscar dónde estaba el defensor en el hitTimestamp
        let defenderX = defender?.x;
        if (defender && defender.positionHistory && hitTimestamp) {
            let wasInHitbox = false;
            // Aumentado a 260 porque los sprites miden 250px de ancho (125px desde el centro) 
            // más el offset del hitbox (hasta 115px). Distancia máxima teórica = ~240px.
            const MAX_HIT_DISTANCE = 260; 

            for (const snapshot of defender.positionHistory) {
                if (Math.abs(attackerX - snapshot.x) <= MAX_HIT_DISTANCE) {
                    wasInHitbox = true;
                    defenderX = snapshot.x;
                    break;
                }
            }

            if (!wasInHitbox) {
                const currentDist = Math.abs(attackerX - (defender.x || 0));
                console.log(`[hit_debug] attackerX: ${attackerX}, defenderX: ${defender.x}, currentDist: ${currentDist}`);
                if (currentDist > MAX_HIT_DISTANCE + 40) { // Tolerancia extra para el presente
                    console.log(`[hit_rejected] Room ${roomId}: True Lag Comp falló (dist=${currentDist}px)`);
                    return; // Hit rechazado, nunca estuvo en rango recientemente
                }
            }
        } else if (attacker.x !== undefined && defender && defender.x !== undefined) {
            // Fallback: usar distancia actual
            const dx = Math.abs(attackerX - defender.x);
            console.log(`[hit_debug] Fallback attackerX: ${attackerX}, defenderX: ${defender.x}, dx: ${dx}`);
            const MAX_HIT_DISTANCE = 300; // Tolerancia legacy aumentada
            if (dx > MAX_HIT_DISTANCE) {
                console.log(`[hit_rejected] Room ${roomId}: Fallback distance ${Math.round(dx)}px > ${MAX_HIT_DISTANCE}px`);
                return;
            }
        }

        // Aplicar daño al HP autoritativo del servidor
        room.hp[defenderSide] = Math.max(0, room.hp[defenderSide] - validatedDamage);

        console.log(`[hit] Room ${roomId}: ${defenderSide} HP = ${room.hp[defenderSide]} (-${validatedDamage}) dist=${attacker.x !== undefined && defender?.x !== undefined ? Math.round(Math.abs(attacker.x - defender.x)) : '?'}px`);

        // ✅ Emitir HP actualizado a AMBOS jugadores simultáneamente
        io.to(roomId).emit('hp_update', room.hp);

        // ✅ Propagar el hit visual al oponente
        socket.to(roomId).emit('opponent_hit', { targetId, finalDamage: validatedDamage, attackerX, isCombo });

        // ✅ FIX 7: El SERVIDOR detecta el KO y controla la transición de ronda
        if (room.hp[defenderSide] <= 0 && !room.roundTransitioning) {
            room.roundTransitioning = true;
            const winnerId = defenderSide === 'left'
                ? room.players.find(p => p.side === 'right')?.id
                : room.players.find(p => p.side === 'left')?.id;

            console.log(`[KO] Room ${roomId}: ${defenderSide} KO. Winner: ${winnerId}`);

            // Notificar KO a ambos jugadores
            io.to(roomId).emit('server_ko', { loserId: targetId, winnerId });

            // El servidor espera y emite el inicio de la siguiente ronda
            setTimeout(() => {
                const r = rooms.get(roomId);
                if (!r) return;

                // Actualizar victorias
                if (!r.wins) r.wins = { left: 0, right: 0 };
                const winnerSide = defenderSide === 'left' ? 'right' : 'left';
                r.wins[winnerSide]++;

                if (r.wins.left >= 2 || r.wins.right >= 2) {
                    // Fin del match
                    io.to(roomId).emit('match_over', {
                        winnerId,
                        wins: r.wins
                    });
                    // Reportar victoria en torneo si aplica
                    if (roomId.startsWith('T-') && winnerId) {
                        processTournamentWin(roomId, winnerId);
                    }
                } else {
                    // Siguiente ronda
                    resetRoomHp(r);
                    r.round = (r.round || 1) + 1;
                    console.log(`[start_next_round] Room ${roomId} Round ${r.round}`);
                    io.to(roomId).emit('start_next_round', { hp: r.hp, wins: r.wins, round: r.round });
                }
            }, 2500);
        }
    });

    socket.on('player_emote', (data) => {
        const { roomId, emote } = data;
        socket.to(roomId).emit('opponent_emote', { id: socket.id, emote });
    });

    // ✅ FIX 8: round_ended se dispara cuando se acaba el tiempo localmente en el cliente
    socket.on('round_ended', (data) => {
        const { roomId, winnerId } = data;
        const room = rooms.get(roomId);
        if (!room || room.roundTransitioning) return;

        room.roundTransitioning = true;
        console.log(`[timeout] Room ${roomId}. Winner assigned: ${winnerId || 'Draw'}`);
        
        const winner = room.players.find(p => p.id === winnerId);
        const loser = room.players.find(p => p.id !== winnerId);
        
        io.to(roomId).emit('server_ko', { loserId: loser?.id || 'CPU', winnerId: winner?.id });

        setTimeout(() => {
            if (!rooms.has(roomId)) return;
            const r = rooms.get(roomId);
            r.roundTransitioning = false;
            
            if (winner) {
                if (!r.wins) r.wins = { left: 0, right: 0 };
                r.wins[winner.side]++;
            }

            if (r.wins && (r.wins.left >= 2 || r.wins.right >= 2)) {
                io.to(roomId).emit('match_over', { winnerId, wins: r.wins });
                if (roomId.startsWith('T-') && winnerId) {
                    processTournamentWin(roomId, winnerId);
                }
            } else {
                resetRoomHp(r);
                r.round = (r.round || 1) + 1;
                console.log(`[start_next_round_timeout] Room ${roomId} Round ${r.round}`);
                io.to(roomId).emit('start_next_round', { hp: r.hp, wins: r.wins, round: r.round });
            }
        }, 2500);
    });

    // --- REMATCH ---
    socket.on('request_rematch', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (!room) return;

        if (!room.rematchRequests) room.rematchRequests = new Set();
        room.rematchRequests.add(socket.id);
        socket.to(roomId).emit('rematch_requested', { by: socket.id });

        const roomPlayerIds = room.players.map(p => p.id);
        const allRequested = roomPlayerIds.every(pid => room.rematchRequests.has(pid));
        if (room.players.length === 2 && allRequested) {
            room.rematchRequests = new Set();
            room.players.forEach(p => { p.ready = false; p.inRing = false; });
            // ✅ Reset completo del estado de la sala
            resetRoomHp(room);
            room.ringStarted = false;
            room.round = 1;
            room.wins = { left: 0, right: 0 };
            io.to(roomId).emit('rematch_accepted');
            console.log(`Rematch accepted in room ${roomId}`);
        }
    });

    socket.on('decline_rematch', (data) => {
        const { roomId } = data;
        const room = rooms.get(roomId);
        if (room) { room.rematchRequests = new Set(); }
        socket.to(roomId).emit('rematch_declined');
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
                
                // ✅ Inmediatamente dar la victoria al oponente en torneo
                if (roomId.startsWith('T-')) {
                    const opponent = room.players[0]; // El que queda
                    if (opponent) {
                        console.log(`[leave_match] Forfeit in ${roomId}. Winner: ${opponent.id}`);
                        processTournamentWin(roomId, opponent.id);
                    }
                }
            }
            if (room.players.length === 0) rooms.delete(roomId);
        }
        socket.leave(roomId);
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        setTimeout(() => {
            if (io.sockets.sockets.has(socket.id) || socket.recovered) {
                console.log(`Socket ${socket.id} recovered. Ignoring disconnect.`);
                return;
            }

            for (let [id, t] of tournaments.entries()) {
                if (t.active) {
                    const activeMatch = t.matches.find(m =>
                        !m.winner && ((m.p1 && m.p1.id === socket.id) || (m.p2 && m.p2.id === socket.id))
                    );
                    if (activeMatch) {
                        const winner = (activeMatch.p1 && activeMatch.p1.id === socket.id) ? activeMatch.p2 : activeMatch.p1;
                        if (winner) {
                            console.log(`Forfeit: ${socket.id} disconnected. ${winner.name} wins ${activeMatch.id}`);
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

                if (t.creatorId === socket.id && !t.active) {
                    if (t.timeout) clearTimeout(t.timeout);
                    tournaments.delete(id);
                    io.emit('available_tournaments', getAvailableTournaments());
                    io.to(t.id).emit('tournament_cancelled', 'El torneo fue cancelado porque el creador se desconectó.');
                }
            }

            rooms.forEach((room, roomId) => {
                const playerIndex = room.players.findIndex(p => p.id === socket.id);
                if (playerIndex !== -1) {
                    room.players.splice(playerIndex, 1);
                    io.to(roomId).emit('opponent_left_match');
                    io.to(roomId).emit('player_left', socket.id);
                    if (room.players.length === 0) rooms.delete(roomId);
                }
            });
        }, 5000);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));