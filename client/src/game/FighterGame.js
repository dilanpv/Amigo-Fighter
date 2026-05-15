import * as Phaser from 'phaser';

export default class FighterGame extends Phaser.Scene {
    constructor() {
        super('FighterGame');
    }

    init(data) {
        this.socket = data.socket;
        this.roomId = data.roomId;
        this.playerData = data.playerData;
        this.gameState = data.gameState;
        this.players = {};
        this.hp = { p1: 100, p2: 100 };
        this.gameOver = false;
        this.matchStarted = false;
        this.cpuDifficulty = data.cpuDifficulty || 'normal';
        this.sound_mgr = data.soundManager || null;
        this.charSpec = this.playerData.character || {
            fWidth: 128, fHeight: 192, img: '/assets/LUCHADOR.png', cols: 11,
            stats: { str: 3, spd: 3, res: 3 }, style: 'Balanceado'
        };
        this.stats = this.charSpec.stats;
    }

    preload() {
        this.gameState.players.forEach(p => {
            const spec = p.character || this.charSpec;
            this.load.spritesheet(`fighter_${p.id}`, encodeURI(spec.img || '/assets/LUCHADOR.png'), {
                frameWidth: spec.fWidth || 128,
                frameHeight: spec.fHeight || 192
            });
            if (p.face) this.load.image(`face_${p.id}`, p.face);
        });

        const cpuSpec = this.gameState.cpuCharacter || { img: '/assets/EL_AGRESIVO.png', fWidth: 128, fHeight: 192 };
        this.load.spritesheet('fighter_CPU', encodeURI(cpuSpec.img), {
            frameWidth: cpuSpec.fWidth || 128,
            frameHeight: cpuSpec.fHeight || 192
        });

        this.stages = [
            "Gemini_Generated_Image_18znjw18znjw18zn.png",
            "Gemini_Generated_Image_291wo1291wo1291w.png",
            "Gemini_Generated_Image_7v9x2x7v9x2x7v9x.png",
            "Gemini_Generated_Image_atsrnjatsrnjatsr.png",
            "Gemini_Generated_Image_csadcmcsadcmcsad.png",
            "Gemini_Generated_Image_m0y0i3m0y0i3m0y0.png",
            "Gemini_Generated_Image_muj2mgmuj2mgmuj2.png",
            "Gemini_Generated_Image_rh84d8rh84d8rh84.png",
            "Gemini_Generated_Image_rvqzpgrvqzpgrvqz.png",
            "Gemini_Generated_Image_whk0gpwhk0gpwhk0.png"
        ];
        let seed = 0;
        const roomStr = String(this.roomId || 'test');
        for (let i = 0; i < roomStr.length; i++) seed += roomStr.charCodeAt(i);
        this.selectedStage = this.stages[seed % this.stages.length];
        this.load.image('bg_stage', encodeURI(`/assets/Escenarios/${this.selectedStage}`));

        this.load.on('loaderror', (file) => console.error('Asset error:', file.src, file.key));
    }

    create() {
        this.physics.world.setBounds(0, -500, 800, 1000);
        this.setupArena();
        this.setupAnimations();
        this.spawnPlayers();
        this.setupPhysics();
        this.setupInputs();
        this.setupSocketListeners();

        if (this.sound_mgr) {
            this.sound_mgr.startBGM();
            this.sound_mgr.sfxVoFight?.();
        }

        this.game.events.on('resetRound', this.resetPositions, this);
        this.game.events.on('gameOver', this.handleGameOver, this);
        this.game.events.on('triggerEmote', (emote) => {
            this.showEmote(this.playerData.id, emote);
            this.socket.emit('player_emote', { roomId: this.roomId, emote });
        });

        // ✅ updateHP solo para modo CPU
        this.game.events.on('updateHP', (data) => {
            if (this.gameState.players.length > 1) return;
            // En CPU mode, propagar a GameView para que actualice el estado
            this.game.events.emit('cpuHpUpdate', data);
        });

        this.game.events.once('startMatch', () => {
            this.matchStarted = true;
            this.resetPositions();
        });
    }

    setupArena() {
        if (this.textures.exists('bg_stage')) {
            const bg = this.add.image(400, 225, 'bg_stage');
            bg.setDisplaySize(800, 450);
            const g = this.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4);
            g.generateTexture('particle_star', 8, 8);
            const dg = this.make.graphics({ x: 0, y: 0, add: false });
            dg.fillStyle(0xdcdcdc, 0.6); dg.fillCircle(3, 3, 3);
            dg.generateTexture('particle_dust', 6, 6);
            return;
        }

        const bg = this.add.graphics();
        bg.fillGradientStyle(0x06060f, 0x06060f, 0x12122a, 0x12122a, 1);
        bg.fillRect(0, 0, 800, 450);

        const crowd = this.add.graphics();
        crowd.fillStyle(0x111120, 1);
        for (let x = 0; x < 800; x += 18) {
            const h = 20 + Math.sin(x * 0.3) * 8 + (x % 17) * 0.7;
            crowd.fillRect(x, 290 - h, 14, h);
        }

        const lights = this.add.graphics();
        [120, 300, 500, 680].forEach(sx => {
            lights.fillStyle(0xffeedd, 0.04);
            lights.fillTriangle(sx, 0, sx - 60, 320, sx + 60, 320);
        });

        const ringGlow = this.add.graphics();
        ringGlow.fillStyle(0xff2222, 0.07);
        ringGlow.fillEllipse(400, 390, 700, 50);
        this.tweens.add({ targets: ringGlow, alpha: { from: 0.6, to: 1 }, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        const floor = this.add.graphics();
        floor.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0d0d18, 0x0d0d18, 1);
        floor.fillRect(0, 410, 800, 40);
        this.add.rectangle(400, 412, 800, 2, 0xffffff, 0.08);

        const postG = this.add.graphics();
        postG.fillGradientStyle(0x555555, 0x333333, 0x222222, 0x444444, 1);
        postG.fillRect(42, 190, 16, 175);
        postG.fillGradientStyle(0x555555, 0x333333, 0x222222, 0x444444, 1);
        postG.fillRect(742, 190, 16, 175);
        this.add.circle(50, 190, 10, 0x888888);
        this.add.circle(750, 190, 10, 0x888888);

        [220, 258, 296].forEach((ry, i) => {
            const shade = Math.floor(0xcc - i * 0x22);
            this.add.rectangle(400, ry + 2, 700, 3, 0x000000, 0.4);
            this.add.rectangle(400, ry, 700, 4, (shade << 16));
            this.add.rectangle(400, ry - 1, 700, 1, 0xff6666, 0.3);
        });

        const lampG = this.add.graphics();
        [80, 260, 400, 540, 720].forEach((lx, idx) => {
            const ly = 18 + (idx % 2) * 12;
            lampG.fillStyle(0xffffff, 0.9); lampG.fillCircle(lx, ly, 5);
            lampG.fillStyle(0xffffee, 0.05); lampG.fillCircle(lx, ly, 22);
        });

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4);
        g.generateTexture('particle_star', 8, 8);
        const dg = this.make.graphics({ x: 0, y: 0, add: false });
        dg.fillStyle(0xdcdcdc, 0.6); dg.fillCircle(3, 3, 3);
        dg.generateTexture('particle_dust', 6, 6);
    }

    emitDust(x, y) {
        const emitter = this.add.particles(x, y, 'particle_dust', {
            speedX: { min: -100, max: 100 }, speedY: { min: -60, max: 0 },
            scale: { start: 1.2, end: 0 }, lifespan: 400, quantity: 10, emitting: false
        });
        emitter.explode();
        this.time.delayedCall(450, () => emitter.destroy());
    }

    setupAnimations() {
        const CHARACTER_FRAMES = {
            'DEFAULT': [
                { key: 'idle', start: 0, end: 3, rate: 8, repeat: -1 },
                { key: 'walk_fwd', start: 4, end: 9, rate: 10, repeat: -1 },
                { key: 'jump', start: 10, end: 12, rate: 8, repeat: 0 },
                { key: 'jab', start: 13, end: 16, rate: 15, repeat: 0 },
                { key: 'hook', start: 17, end: 20, rate: 12, repeat: 0 },
                { key: 'kick', start: 21, end: 24, rate: 12, repeat: 0 },
                { key: 'hit', start: 25, end: 27, rate: 10, repeat: 0 },
                { key: 'special', start: 28, end: 31, rate: 9, repeat: 0 },
                { key: 'block', start: 32, end: 33, rate: 6, repeat: 0 },
                { key: 'ko', start: 34, end: 37, rate: 6, repeat: 0 },
            ],
            'ninja': [
                { key: 'idle', start: 0, end: 3, rate: 8, repeat: -1 },
                { key: 'walk_fwd', start: 4, end: 9, rate: 10, repeat: -1 },
                { key: 'jump', start: 10, end: 12, rate: 8, repeat: 0 },
                { key: 'jab', start: 13, end: 16, rate: 15, repeat: 0 },
                { key: 'hook', start: 17, end: 20, rate: 12, repeat: 0 },
                { key: 'kick', start: 21, end: 24, rate: 12, repeat: 0 },
                { key: 'hit', start: 25, end: 27, rate: 10, repeat: 0 },
                { key: 'special', start: 28, end: 31, rate: 9, repeat: 0 },
                { key: 'block', start: 32, end: 33, rate: 6, repeat: 0 },
                { key: 'ko', start: 34, end: 36, rate: 6, repeat: 0 },
            ]
        };

        const createAnimFor = (playerId, characterId) => {
            const textureKey = `fighter_${playerId}`;
            if (!this.textures.exists(textureKey)) return;
            const totalFrames = this.textures.get(textureKey).frameTotal;
            const maxIdx = Math.max(0, totalFrames - 2);
            const safeF = (idx) => Math.min(idx, maxIdx);
            const anims = CHARACTER_FRAMES[characterId] || CHARACTER_FRAMES['DEFAULT'];
            anims.forEach(a => {
                const fullKey = `${a.key}_${playerId}`;
                if (!this.anims.exists(fullKey)) {
                    this.anims.create({
                        key: fullKey,
                        frames: this.anims.generateFrameNumbers(textureKey, {
                            start: safeF(a.start),
                            end: Math.max(safeF(a.start), safeF(a.end))
                        }),
                        frameRate: a.rate,
                        repeat: a.repeat
                    });
                }
            });
        };

        this.gameState.players.forEach(p => createAnimFor(p.id, p.character?.id || 'luchador'));
        createAnimFor('CPU', this.gameState.cpuCharacter?.id || 'agresivo');
    }

    spawnPlayers() {
        const isSinglePlayer = this.gameState.players.length === 1;
        const getHeadOffset = (spec) => {
            const topPct = spec?.headPos ? parseFloat(spec.headPos.top) / 100 : 0.20;
            const h = spec?.fHeight || 192;
            return (-h / 2) + (h * topPct) - 45;
        };

        const p = this.gameState.players.find(pl => pl.id === this.playerData.id) || this.gameState.players[0];
        const side = this.playerData.side || 'left';
        const x = side === 'left' ? 180 : 620;

        const localFighter = {
            id: p.id,
            sprite: this.physics.add.sprite(x, 314, `fighter_${p.id}`),
            startX: x, startY: 314, startFlipX: side === 'right',
            isLocal: true, state: 'idle', hasHit: false,
            spec: p.character || this.charSpec,
            side
        };
        localFighter.sprite.setCollideWorldBounds(true);
        localFighter.sprite.setFlipX(side === 'right');
        localFighter.sprite.setDepth(10);

        if (this.textures.exists(`face_${p.id}`)) {
            const faceYOffset = getHeadOffset(localFighter.spec);
            localFighter.face = this.add.image(x, 314 + faceYOffset, `face_${p.id}`);
            localFighter.face.setDisplaySize(52, 52);
            localFighter.face.setDepth(12);
        }
        this.players[p.id] = localFighter;

        if (!isSinglePlayer) {
            const oppData = this.gameState.players.find(pl => pl.id !== p.id);
            const oppSide = side === 'left' ? 'right' : 'left';
            const oppX = oppSide === 'left' ? 180 : 620;
            const oppFighter = {
                id: oppData.id,
                sprite: this.physics.add.sprite(oppX, 314, `fighter_${oppData.id}`),
                startX: oppX, startY: 314, startFlipX: oppSide === 'right',
                isLocal: false, state: 'idle', hasHit: false,
                spec: oppData.character || this.charSpec,
                side: oppSide
            };
            oppFighter.sprite.setCollideWorldBounds(true);
            oppFighter.sprite.setFlipX(oppSide === 'right');
            oppFighter.sprite.setDepth(10);

            if (this.textures.exists(`face_${oppData.id}`)) {
                const faceYOffset = getHeadOffset(oppFighter.spec);
                oppFighter.face = this.add.image(oppX, 314 + faceYOffset, `face_${oppData.id}`);
                oppFighter.face.setDisplaySize(52, 52);
                oppFighter.face.setDepth(12);
            }
            this.players[oppData.id] = oppFighter;
        } else {
            const oppSide = side === 'left' ? 'right' : 'left';
            const oppX = oppSide === 'left' ? 180 : 620;
            const cpu = {
                id: 'CPU',
                sprite: this.physics.add.sprite(oppX, 314, 'fighter_CPU'),
                startX: oppX, startY: 314, startFlipX: oppSide === 'right',
                isLocal: false, isCPU: true, state: 'idle', hasHit: false,
                spec: this.gameState.cpuCharacter || { stats: { str: 2, spd: 2, res: 2 }, headPos: { top: '15%', left: '48%' }, fHeight: 192 },
                cpuTimer: 90,
                side: oppSide
            };
            cpu.sprite.setCollideWorldBounds(true);
            cpu.sprite.setFlipX(oppSide === 'right');
            cpu.sprite.setDepth(10);
            cpu.sprite.setTint(0xffaaaa);
            cpu.face = null;
            this.players['CPU'] = cpu;
        }
    }

    setupPhysics() {
        const ground = this.add.rectangle(400, 420, 800, 20, 0x000, 0);
        this.physics.add.existing(ground, true);
        const sprites = [];
        Object.values(this.players).forEach(p => {
            this.physics.add.collider(p.sprite, ground);
            p.sprite.body.setSize(70, 180);
            p.sprite.body.setOffset(29, 12);
            sprites.push(p.sprite);
        });
        if (sprites.length >= 2) this.physics.add.collider(sprites[0], sprites[1]);
    }

    setupInputs() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.attackKeys = this.input.keyboard.addKeys('A,S,D,W');
    }

    setupSocketListeners() {
        this._onOpponentMove = (data) => {
            const opp = this.players[data.id];
            if (opp && opp.state !== 'attacking' && opp.state !== 'falling' && opp.state !== 'ko') {
                if (opp.moveTween) opp.moveTween.stop();
                opp.targetX = data.x;
                opp.targetY = data.y;
                opp.lastNetUpdate = this.time.now;
                opp.sprite.play(`${data.anim}_${opp.id}`, true);
                opp.sprite.setFlipX(data.flip);
            }
        };

        this._onOpponentAttack = (data) => {
            const opp = this.players[data.id];
            if (opp) {
                opp.state = 'attacking';
                opp.sprite.play(`${data.type}_${opp.id}`, true);
                if (opp.attackTimer) this.time.removeEvent(opp.attackTimer);
                opp.attackTimer = this.time.delayedCall(600, () => {
                    if (opp.state === 'attacking') opp.state = 'idle';
                });
                opp.sprite.once('animationcomplete', () => {
                    if (opp.state === 'attacking') opp.state = 'idle';
                });
            }
        };

        // ✅ FIX: opponent_hit solo hace efectos visuales — el HP viene de hp_update del servidor
        this._onOpponentHit = (data) => {
            this.handleHitVisuals(data.targetId, data.finalDamage ?? data.damage, data.attackerX, data.isCombo);
        };

        // ✅ FIX: server_ko — el servidor dicta quién cae
        this._onServerKO = (data) => {
            this.handleGameOver({ loserId: data.loserId });
        };

        this._onOpponentEmote = (data) => {
            this.showEmote(data.id, data.emote);
        };

        this.socket.on('opponent_move', this._onOpponentMove);
        this.socket.on('opponent_attack', this._onOpponentAttack);
        this.socket.on('opponent_hit', this._onOpponentHit);
        this.socket.on('server_ko', this._onServerKO);
        this.socket.on('opponent_emote', this._onOpponentEmote);
    }

    shutdown() {
        if (this.socket) {
            this.socket.off('opponent_move', this._onOpponentMove);
            this.socket.off('opponent_attack', this._onOpponentAttack);
            this.socket.off('opponent_hit', this._onOpponentHit);
            this.socket.off('server_ko', this._onServerKO);
            this.socket.off('opponent_emote', this._onOpponentEmote);
        }
        if (this.game) {
            this.game.events.off('resetRound', this.resetPositions, this);
            this.game.events.off('gameOver', this.handleGameOver, this);
        }
        if (this.sound_mgr) this.sound_mgr.stopBGM?.();
        Object.values(this.players || {}).forEach(p => {
            if (p.attackTimer) this.time.removeEvent(p.attackTimer);
            if (p.moveTween) p.moveTween.stop();
        });
    }

    resetPositions() {
        this.gameOver = false;
        Object.values(this.players).forEach(p => {
            p.state = 'idle'; p.hasHit = false;
            p.sprite.clearTint();
            p.sprite.setVelocity(0, 0);
            p.sprite.x = p.startX; p.sprite.y = p.startY;
            p.sprite.setFlipX(p.startFlipX);
            p.sprite.play(`idle_${p.id}`, true);
            if (p.isCPU) p.cpuTimer = 90;
        });
        this.syncGraphics();
        if (this.sound_mgr) this.sound_mgr.sfxVoFight?.();

        const fightText = this.add.text(400, 200, '¡FIGHT!', {
            fontFamily: 'Bebas Neue, sans-serif', fontSize: '80px',
            color: '#ff0000', stroke: '#ffffff', strokeThickness: 5
        }).setOrigin(0.5).setAlpha(0).setScale(0.5);

        this.tweens.add({
            targets: fightText, alpha: 1, scale: 1.2, duration: 400,
            yoyo: true, hold: 500, onComplete: () => fightText.destroy()
        });
    }

    handleGameOver(data) {
        this.gameOver = true;
        if (this.sound_mgr) this.sound_mgr.sfxKO?.();

        Object.values(this.players).forEach(p => {
            if (p.moveTween) p.moveTween.stop();
            if (p.attackTimer) this.time.removeEvent(p.attackTimer);
            p.sprite.setVelocity(0, 0);

            if (data && data.loserId === p.id) {
                p.state = 'falling';
                p.sprite.play(`ko_${p.id}`, true);
                p.sprite.setTint(0xff6666);
                this.time.delayedCall(800, () => {
                    p.sprite.anims.pause();
                    p.state = 'ko';
                    p.sprite.setTint(0x666666);
                });
            } else {
                p.state = 'idle';
                p.sprite.play(`idle_${p.id}`, true);
            }
        });
    }

    update() {
        if (!this.matchStarted) return;
        if (this.gameOver) { this.syncGraphics(); return; }

        const local = this.players[this.playerData.id];
        if (!local || local.state === 'hit' || local.state === 'falling' || local.state === 'ko') return;

        this.handleLocalInput(local);
        if (this.players['CPU']) this.handleCPU(this.players['CPU'], local);

        this.syncGraphics();
        this.checkCombatCollision(local);
        if (this.players['CPU']) this.checkCombatCollision(this.players['CPU']);

        // M-2: Lag compensation — interpolación adaptativa
        Object.values(this.players).forEach(p => {
            if (!p.isLocal && !p.isCPU && p.targetX !== undefined && p.state !== 'attacking' && p.state !== 'hit' && p.state !== 'ko') {
                const dx = Math.abs(p.sprite.x - p.targetX);
                const dy = Math.abs(p.sprite.y - p.targetY);
                const lerpX = dx > 50 ? 0.95 : dx > 15 ? 0.85 : 0.7;
                const lerpY = dy > 50 ? 0.95 : dy > 15 ? 0.85 : 0.7;
                p.sprite.x = Phaser.Math.Linear(p.sprite.x, p.targetX, lerpX);
                p.sprite.y = Phaser.Math.Linear(p.sprite.y, p.targetY, lerpY);
                if (dx < 0.5) p.sprite.x = p.targetX;
                if (dy < 0.5) p.sprite.y = p.targetY;
            }
        });
    }

    handleCPU(cpu, player) {
        const CPU_CONFIGS = {
            facil:   { reactionMin: 8,  reactionMax: 18, blockChance: 0.55, comboChance: 0.40, jumpChance: 0.15, dodgeChance: 0.20, counterChance: 0.15 },
            normal:  { reactionMin: 3,  reactionMax: 8,  blockChance: 0.75, comboChance: 0.65, jumpChance: 0.20, dodgeChance: 0.35, counterChance: 0.30 },
            dificil: { reactionMin: 1,  reactionMax: 3,  blockChance: 0.92, comboChance: 0.90, jumpChance: 0.30, dodgeChance: 0.50, counterChance: 0.45 },
        };
        const diff = { ...(CPU_CONFIGS[this.cpuDifficulty] || CPU_CONFIGS.dificil) };

        const playerStyle = player.spec?.style || 'Balanceado';
        if (playerStyle === 'Agresivo') {
            diff.blockChance = Math.min(0.98, diff.blockChance + 0.20);
            diff.dodgeChance = Math.min(0.70, diff.dodgeChance + 0.25);
            diff.counterChance = Math.min(0.65, diff.counterChance + 0.25);
        } else if (playerStyle === 'Defensivo') {
            diff.comboChance = Math.min(0.95, diff.comboChance + 0.20);
        } else if (playerStyle === 'Velocista') {
            diff.reactionMin = Math.max(1, diff.reactionMin - 2);
            diff.reactionMax = Math.max(2, diff.reactionMax - 3);
            diff.blockChance = Math.min(0.95, diff.blockChance + 0.10);
        }

        if (cpu.state === 'ko' || cpu.state === 'hit' || cpu.state === 'attacking') return;

        const dist = Math.abs(cpu.sprite.x - player.sprite.x);
        const onGround = cpu.sprite.body.blocked.down;

        if (player.state === 'attacking' && dist < 140 && onGround) {
            if (Math.random() < diff.blockChance && cpu.state !== 'blocking') {
                cpu.sprite.setVelocityX(0);
                cpu.state = 'blocking';
                cpu.sprite.play(`block_${cpu.id}`, true);
                cpu.cpuTimer = 20;
                return;
            }
        }

        if (cpu.state === 'blocking' && player.state !== 'attacking' && cpu.cpuTimer <= 8) {
            cpu.state = 'idle';
            if (Math.random() < diff.counterChance && dist < 100) {
                this.executeAttack(cpu, 'hook');
                cpu.cpuTimer = 5;
                return;
            }
        }

        cpu.cpuTimer--;
        if (cpu.cpuTimer > 0) return;
        cpu.cpuTimer = diff.reactionMin + Math.random() * (diff.reactionMax - diff.reactionMin);

        if (dist > 100) {
            const dir = player.sprite.x > cpu.sprite.x ? 1 : -1;
            const cpuSpeedMult = cpu.spec.style === 'Velocista' ? 1.4 : cpu.spec.style === 'Agresivo' ? 1.15 : 1.0;
            cpu.sprite.setVelocityX(dir * 220 * cpuSpeedMult);
            cpu.sprite.play(`walk_fwd_${cpu.id}`, true);
            cpu.sprite.setFlipX(dir === -1);
            if (dist > 200 && onGround && Math.random() < 0.25) {
                cpu.sprite.setVelocityY(-500);
                cpu.sprite.play(`jump_${cpu.id}`, true);
            }
        } else {
            cpu.sprite.setVelocityX(0);
            const r = Math.random();
            if (player.state === 'attacking' && r < diff.dodgeChance && cpu.state !== 'blocking') {
                const escapeDir = cpu.sprite.x > player.sprite.x ? 1 : -1;
                cpu.sprite.setVelocityX(escapeDir * 350);
                cpu.cpuTimer = 6;
                return;
            }
            if (diff.comboChance > 0 && r < diff.comboChance) {
                this.executeAttack(cpu, 'jab');
                this.time.delayedCall(250, () => { if (!this.gameOver && cpu.state !== 'ko') this.executeAttack(cpu, 'hook'); });
                this.time.delayedCall(500, () => { if (!this.gameOver && cpu.state !== 'ko') this.executeAttack(cpu, 'kick'); });
            } else if (r < 0.28) { this.executeAttack(cpu, 'jab'); }
            else if (r < 0.50)   { this.executeAttack(cpu, 'hook'); }
            else if (r < 0.68)   { this.executeAttack(cpu, 'kick'); }
            else if (r < 0.82)   { this.executeAttack(cpu, 'special'); }
            else if (onGround && r < 0.82 + diff.jumpChance) {
                cpu.sprite.setVelocityY(-500);
                cpu.sprite.play(`jump_${cpu.id}`, true);
            } else {
                cpu.sprite.play(`idle_${cpu.id}`, true);
            }
        }
    }

    handleLocalInput(local) {
        const onGround = local.sprite.body.blocked.down;
        if (local.state === 'attacking') return;

        let moved = false;
        let anim = 'idle';

        if (Phaser.Input.Keyboard.JustDown(this.attackKeys.A)) this.executeAttack(local, 'jab');
        else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.S)) this.executeAttack(local, 'hook');
        else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.D)) this.executeAttack(local, 'kick');
        else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.W)) this.executeAttack(local, 'special');

        const styleSpeedMult = local.spec.style === 'Velocista' ? 1.5 : local.spec.style === 'Agresivo' ? 1.1 : local.spec.style === 'Defensivo' ? 0.85 : 1.0;
        const baseSpeed = 160 + (this.stats.spd * 20);

        if (this.cursors.down.isDown && onGround) {
            local.sprite.setVelocityX(0);
            local.state = 'blocking';
            anim = 'block';
            moved = true;
        } else if (this.cursors.left.isDown) {
            local.sprite.setVelocityX(-(baseSpeed * styleSpeedMult));
            local.sprite.setFlipX(true);
            anim = onGround ? 'walk_fwd' : 'jump';
            moved = true;
        } else if (this.cursors.right.isDown) {
            local.sprite.setVelocityX(baseSpeed * styleSpeedMult);
            local.sprite.setFlipX(false);
            anim = onGround ? 'walk_fwd' : 'jump';
            moved = true;
        } else {
            local.sprite.setVelocityX(0);
            if (local.state === 'blocking') local.state = 'idle';
        }

        if (onGround && !local.wasOnGround) {
            this.emitDust(local.sprite.x, 410);
            if (this.sound_mgr) this.sound_mgr.sfxLand?.();
        }

        if (this.cursors.up.isDown && onGround) {
            local.sprite.setVelocityY(-550);
            anim = 'jump';
            moved = true;
            this.emitDust(local.sprite.x, 410);
            if (this.sound_mgr) this.sound_mgr.sfxJump?.();
        }

        local.wasOnGround = onGround;

        if (moved || anim !== local.lastAnim) {
            local.sprite.play(`${anim}_${local.id}`, true);
            const now = this.time.now;
            const animChanged = anim !== local.lastAnim;
            if (!local.lastEmitTime || now - local.lastEmitTime >= 16 || animChanged) {
                this.socket.emit('player_move', {
                    roomId: this.roomId, id: this.playerData.id,
                    x: Math.round(local.sprite.x), y: Math.round(local.sprite.y),
                    anim, flip: local.sprite.flipX
                });
                local.lastEmitTime = now;
            }
            local.lastAnim = anim;
        }
    }

    executeAttack(f, type) {
        f.state = 'attacking';
        f.hasHit = false;
        f.sprite.play(`${type}_${f.id}`, true);
        if (f.isLocal && this.sound_mgr) {
            if (type === 'jab')          this.sound_mgr.sfxJab?.();
            else if (type === 'hook')    this.sound_mgr.sfxHook?.();
            else if (type === 'kick')    this.sound_mgr.sfxKick?.();
            else if (type === 'special') this.sound_mgr.sfxSpecial?.();
        }
        this.socket.emit('player_attack', { roomId: this.roomId, id: this.playerData.id, type });
        if (f.attackTimer) this.time.removeEvent(f.attackTimer);
        f.attackTimer = this.time.delayedCall(600, () => { if (f.state === 'attacking') f.state = 'idle'; });
        f.sprite.once('animationcomplete', () => { if (f.state === 'attacking') f.state = 'idle'; });
    }

    checkCombatCollision(attacker) {
        if (attacker.state !== 'attacking' || attacker.hasHit) return;
        const currentAnim = attacker.sprite.anims.currentAnim;
        if (!currentAnim) return;

        const ATTACK_HITBOXES = {
            jab:     { xOffset: 50, yOffset: -5,  halfW: 25, halfH: 35, activeFrom: 0 },
            hook:    { xOffset: 60, yOffset: -5,  halfW: 35, halfH: 45, activeFrom: 1 },
            kick:    { xOffset: 75, yOffset: 20,  halfW: 40, halfH: 55, activeFrom: 1 },
            special: { xOffset: 60, yOffset: -20, halfW: 45, halfH: 65, activeFrom: 1 },
        };
        const attackType = Object.keys(ATTACK_HITBOXES).find(k => currentAnim.key.includes(k)) || 'jab';
        const hb = ATTACK_HITBOXES[attackType];
        const frame = attacker.sprite.anims.currentFrame?.index ?? 0;
        if (frame < hb.activeFrom) return;

        const direction = attacker.sprite.flipX ? -1 : 1;
        const hitboxCX = attacker.sprite.x + (direction * hb.xOffset);
        const hitboxCY = attacker.sprite.y + hb.yOffset;

        Object.values(this.players).forEach(defender => {
            if (defender.id === attacker.id) return;

            const defRect = defender.sprite.getBounds();
            const isHit =
                hitboxCX + hb.halfW > defRect.left  + 15 &&
                hitboxCX - hb.halfW < defRect.right - 15 &&
                hitboxCY + hb.halfH > defRect.top        &&
                hitboxCY - hb.halfH < defRect.bottom;

            if (isHit) {
                attacker.hasHit = true;
                attacker.comboCount = (attacker.comboCount || 0) + 1;

                const BASE_DAMAGE = { jab: 3, hook: 5, kick: 4, special: 9 };
                let baseDamage = BASE_DAMAGE[attackType] ?? 3;

                if (attacker.spec.style === 'Agresivo')    baseDamage *= 1.5;
                else if (attacker.spec.style === 'Defensivo') baseDamage *= 0.7;
                else if (attacker.spec.style === 'Velocista') baseDamage *= 0.9;

                let rawDamage = baseDamage + ((attacker.spec.stats?.str || this.stats.str) * 0.8);

                let isCombo = false;
                if (attacker.comboCount >= 3) { rawDamage *= 1.6; isCombo = true; attacker.comboCount = 0; }

                let finalDamage = rawDamage - (defender.spec.stats?.res || 0) * 0.5;
                if (defender.spec.style === 'Defensivo') finalDamage *= 0.55;
                if (defender.spec.style === 'Agresivo')  finalDamage *= 1.25;
                if (defender.spec.style === 'Velocista') finalDamage *= 0.85;

                if (defender.state === 'blocking') {
                    finalDamage = defender.spec.style === 'Defensivo' ? 0 : Math.max(1, Math.round(finalDamage * 0.15));
                } else {
                    finalDamage = Math.max(1, Math.round(finalDamage));
                }

                // ✅ Emitir al servidor — el servidor valida y actualiza el HP autoritativo
                this.socket.emit('player_hit', {
                    roomId: this.roomId,
                    targetId: defender.id,
                    finalDamage,
                    attackerX: attacker.sprite.x,
                    isCombo
                });

                // ✅ Efectos visuales locales inmediatos (no esperamos al servidor para la animación)
                this.handleHitVisuals(defender.id, finalDamage, attacker.sprite.x, isCombo);

                // ✅ Para modo CPU: actualizar HP local
                if (this.gameState.players.length === 1) {
                    this.game.events.emit('updateHP', { id: defender.id, damage: finalDamage });
                }
            }
        });
    }

    // ✅ FIX CLAVE: handleHitVisuals solo hace efectos — NO actualiza HP
    // El HP lo actualiza el servidor via hp_update → GameView → HUD
    handleHitVisuals(targetId, damage, attackerX, isCombo = false) {
        const target = this.players[targetId];
        if (!target) return;

        target.comboCount = 0;

        if (damage === 0) {
            target.sprite.play(`block_${target.id}`, true);
            if (this.sound_mgr) this.sound_mgr.sfxBlock?.();
            const dir = target.sprite.x > attackerX ? 1 : -1;
            target.sprite.setVelocityX(dir * 100);
            return;
        }

        const prevState = target.state;
        target.state = 'hit';
        target.sprite.play(`hit_${target.id}`, true);
        target.sprite.setTint(0xff0000);

        if (this.sound_mgr) {
            if (prevState === 'blocking') this.sound_mgr.sfxBlock?.();
            else if (isCombo)            this.sound_mgr.sfxCombo?.();
            else                         this.sound_mgr.sfxHit?.();
        }

        const color = attackerX > target.sprite.x ? 0xffcccc : 0xccffff;
        const emitter = this.add.particles(target.sprite.x, target.sprite.y - 30, 'particle_star', {
            speed: { min: 200, max: 600 }, angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 }, blendMode: 'ADD',
            lifespan: 350, tint: color, gravityY: 600, quantity: 15, emitting: false
        });
        emitter.explode();
        this.time.delayedCall(500, () => emitter.destroy());

        this.cameras.main.shake(isCombo ? 300 : 150, isCombo ? 0.03 : 0.01);

        if (isCombo) {
            const comboText = this.add.text(target.sprite.x, target.sprite.y - 80, '¡COMBO CRÍTICO!', {
                fontFamily: 'Bebas Neue, sans-serif', fontSize: '28px',
                color: '#ff0000', stroke: '#ffffff', strokeThickness: 3
            }).setOrigin(0.5);
            this.tweens.add({
                targets: comboText, y: comboText.y - 40, alpha: 0, duration: 1000,
                ease: 'Power2', onComplete: () => comboText.destroy()
            });
        }

        const dir = target.sprite.x > attackerX ? 1 : -1;
        target.sprite.setVelocityX(dir * (isCombo ? 400 : 200 + damage * 5));
        this.time.delayedCall(200, () => {
            target.sprite.clearTint();
            if (target.state !== 'ko' && target.state !== 'falling') target.state = 'idle';
        });
    }

    showEmote(playerId, emote) {
        const p = this.players[playerId];
        if (!p) return;
        const text = this.add.text(p.sprite.x, p.sprite.y - 120, emote, { fontSize: '48px' }).setOrigin(0.5);
        this.tweens.add({ targets: text, y: text.y - 60, alpha: 0, duration: 1500, ease: 'Cubic.out', onComplete: () => text.destroy() });
    }

    syncGraphics() {
        Object.values(this.players).forEach(p => {
            if (p.face) {
                let animOffsetY = 0, animOffsetX = 0;
                const anim = p.sprite.anims.currentAnim?.key || '';
                if (anim.includes('hit'))   { animOffsetY = 12; animOffsetX = -10; }
                if (anim.includes('block')) { animOffsetY = 8; animOffsetX = -4; }
                if (anim.includes('ko') || anim.includes('falling')) { animOffsetY = 40; }
                if (anim.includes('jump'))  { animOffsetY = -10; }
                if (anim.includes('jab') || anim.includes('hook') || anim.includes('kick')) { animOffsetX = 8; }

                const topPct = p.spec?.headPos ? parseFloat(p.spec.headPos.top) / 100 : 0.20;
                const h = p.spec?.fHeight || 192;
                const baseFaceYOffset = (-h / 2) + (h * topPct) - 45;
                const dir = p.sprite.flipX ? -1 : 1;

                p.face.x = p.sprite.x + (animOffsetX * dir);
                p.face.y = p.sprite.y + baseFaceYOffset + animOffsetY;
                p.face.setFlipX(p.sprite.flipX);
            }
        });
    }
}