import * as Phaser from 'phaser';
import SoundManager from './SoundManager';

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
        this.cpuDifficulty = data.cpuDifficulty || 'normal'; // H-3
        this.sound_mgr = data.soundManager || null; // N-4: shared SoundManager instance
        
        // Character specs & Stats
        this.charSpec = this.playerData.character || { 
            fWidth: 128, fHeight: 192, img: '/assets/Luchador.png', cols: 11,
            stats: { str: 3, spd: 3, res: 3 }, style: 'Balanceado'
        };
        this.stats = this.charSpec.stats;
    }

    preload() {
        this.gameState.players.forEach(p => {
            const spec = p.character || this.charSpec;
            this.load.spritesheet(`fighter_${p.id}`, encodeURI(spec.img || '/assets/Luchador.png'), {
                frameWidth: spec.fWidth || 128,
                frameHeight: spec.fHeight || 192
            });

            if (p.face) {
                this.load.image(`face_${p.id}`, p.face);
            }
        });
        
        this.load.spritesheet('fighter_CPU', '/assets/Luchador.png', { frameWidth: 128, frameHeight: 192 });
    }

    create() {
        this.setupArena();
        this.setupAnimations();
        this.spawnPlayers();
        this.setupPhysics();
        this.setupInputs();
        this.setupSocketListeners();

        // N-4: Start BGM when combat begins
        if (this.sound_mgr) {
            this.sound_mgr.startBGM();
            this.sound_mgr.sfxVoFight(); // "¡FIGHT!" voice SFX
        }

        // Escuchar evento de reinicio de ronda desde la UI (via game.events, no scene.events)
        this.game.events.on('resetRound', this.resetPositions, this);
        this.game.events.on('gameOver', this.handleGameOver, this);
        this.game.events.on('triggerEmote', (emote) => {
            this.showEmote(this.playerData.id, emote);
            this.socket.emit('player_emote', { roomId: this.roomId, emote });
        });
    }

    setupArena() {
        // === FONDO DEGRADADO (cielo de estadio oscuro) ===
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x06060f, 0x06060f, 0x12122a, 0x12122a, 1);
        bg.fillRect(0, 0, 800, 450);

        // === SILUETA DE MULTITUD ===
        const crowd = this.add.graphics();
        crowd.fillStyle(0x111120, 1);
        for (let x = 0; x < 800; x += 18) {
            const h = 20 + Math.sin(x * 0.3) * 8 + (x % 17) * 0.7;
            crowd.fillRect(x, 290 - h, 14, h);
        }

        // === CONOS DE LUZ (spotlights) ===
        const lights = this.add.graphics();
        [120, 300, 500, 680].forEach(sx => {
            lights.fillStyle(0xffeedd, 0.04);
            lights.fillTriangle(sx, 0, sx - 60, 320, sx + 60, 320);
        });

        // === GLOW DEL SUELO DEL RING ===
        const ringGlow = this.add.graphics();
        ringGlow.fillStyle(0xff2222, 0.07);
        ringGlow.fillEllipse(400, 390, 700, 50);
        this.tweens.add({
            targets: ringGlow,
            alpha: { from: 0.6, to: 1 },
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // === SUELO DEL RING ===
        const floor = this.add.graphics();
        floor.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0d0d18, 0x0d0d18, 1);
        floor.fillRect(0, 360, 800, 90);
        this.add.rectangle(400, 362, 800, 2, 0xffffff, 0.08);

        // === POSTES DEL RING ===
        const postG = this.add.graphics();
        postG.fillGradientStyle(0x555555, 0x333333, 0x222222, 0x444444, 1);
        postG.fillRect(42, 190, 16, 175);
        postG.fillGradientStyle(0x555555, 0x333333, 0x222222, 0x444444, 1);
        postG.fillRect(742, 190, 16, 175);
        this.add.circle(50, 190, 10, 0x888888);
        this.add.circle(750, 190, 10, 0x888888);

        // === CUERDAS DEL RING ===
        [220, 258, 296].forEach((ry, i) => {
            const shade = Math.floor(0xcc - i * 0x22);
            this.add.rectangle(400, ry + 2, 700, 3, 0x000000, 0.4);
            this.add.rectangle(400, ry, 700, 4, (shade << 16));
            this.add.rectangle(400, ry - 1, 700, 1, 0xff6666, 0.3);
        });

        // === FOCOS DEL ESTADIO ===
        const lampG = this.add.graphics();
        [80, 260, 400, 540, 720].forEach((lx, idx) => {
            const ly = 18 + (idx % 2) * 12;
            lampG.fillStyle(0xffffff, 0.9);
            lampG.fillCircle(lx, ly, 5);
            lampG.fillStyle(0xffffee, 0.05);
            lampG.fillCircle(lx, ly, 22);
        });

        // === Texturas de partículas en memoria ===
        const g = this.make.graphics({x:0, y:0, add:false});
        g.fillStyle(0xffffff, 1);
        g.fillCircle(4, 4, 4);
        g.generateTexture('particle_star', 8, 8);
        
        const dg = this.make.graphics({x:0, y:0, add:false});
        dg.fillStyle(0xdcdcdc, 0.6);
        dg.fillCircle(3, 3, 3);
        dg.generateTexture('particle_dust', 6, 6);
    }


    emitDust(x, y) {
        const emitter = this.add.particles(x, y, 'particle_dust', {
            speedX: { min: -100, max: 100 },
            speedY: { min: -60, max: 0 },
            scale: { start: 1.2, end: 0 },
            lifespan: 400,
            quantity: 10,
            emitting: false
        });
        emitter.explode();
        this.time.delayedCall(450, () => emitter.destroy());
    }

    setupAnimations() {
        const createAnimFor = (playerId) => {
            const textureKey = `fighter_${playerId}`;
            if (!this.textures.exists(textureKey)) return;
            const totalFrames = this.textures.get(textureKey).frameTotal;
            const maxIdx = Math.max(0, totalFrames - 2); 
            const safeF = (idx) => Math.min(idx, maxIdx);

            const anims = [
                { key: 'idle', start: 0, end: safeF(3), rate: 8, repeat: -1 },
                { key: 'walk_fwd', start: safeF(4), end: safeF(9), rate: 10, repeat: -1 },
                { key: 'jump', start: safeF(10), end: safeF(12), rate: 8, repeat: 0 },
                { key: 'jab', start: safeF(13), end: safeF(16), rate: 15, repeat: 0 },
                { key: 'hook', start: safeF(17), end: safeF(20), rate: 12, repeat: 0 },
                { key: 'kick', start: safeF(21), end: safeF(24), rate: 12, repeat: 0 },
                { key: 'hit', start: safeF(25), end: safeF(27), rate: 10, repeat: 0 },
                { key: 'special', start: safeF(30), end: safeF(33), rate: 9, repeat: 0 },
                { key: 'block', start: safeF(37), end: safeF(38), rate: 6, repeat: 0 },
                { key: 'ko', start: safeF(39), end: safeF(42), rate: 8, repeat: 0 },
            ];
            
            anims.forEach(a => {
                const fullKey = `${a.key}_${playerId}`;
                if (!this.anims.exists(fullKey)) {
                    this.anims.create({
                        key: fullKey,
                        frames: this.anims.generateFrameNumbers(textureKey, { start: a.start, end: Math.max(a.start, a.end) }),
                        frameRate: a.rate,
                        repeat: a.repeat
                    });
                }
            });
        };

        this.gameState.players.forEach(p => createAnimFor(p.id));
        createAnimFor('CPU');
    }

    spawnPlayers() {
        const isSinglePlayer = this.gameState.players.length === 1;
        
        const getHeadOffset = (spec) => {
            if (!spec || !spec.headPos) return -80;
            const topPct = parseFloat(spec.headPos.top) / 100;
            const h = spec.fHeight || 192;
            return (-h / 2) + (h * topPct) + 15;
        };
        
        // Spawn Local Player
        const p = this.gameState.players.find(pl => pl.id === this.playerData.id) || this.gameState.players[0];
        const side = this.playerData.side || 'left';
        const x = side === 'left' ? 180 : 620;
        
        const localFighter = {
            id: p.id,
            sprite: this.physics.add.sprite(x, 330, `fighter_${p.id}`),
            startX: x,
            startY: 330,
            startFlipX: side === 'right',
            isLocal: true,
            state: 'idle',
            hasHit: false,
            spec: p.character || this.charSpec
        };
        localFighter.sprite.setCollideWorldBounds(true);
        localFighter.sprite.setFlipX(side === 'right');
        
        if (this.textures.exists(`face_${p.id}`)) {
            const faceYOffset = getHeadOffset(localFighter.spec);
            localFighter.face = this.add.image(x, 330 + faceYOffset, `face_${p.id}`).setScale(0.12);
            // Apply Circular Mask (radio 40px)
            const maskShape = this.add.graphics().fillCircle(0, 0, 40).setVisible(false);
            localFighter.face.setMask(maskShape.createGeometryMask());
            localFighter.maskShape = maskShape;
        }
        this.players[p.id] = localFighter;

        // Spawn Opponent
        if (!isSinglePlayer) {
            const oppData = this.gameState.players.find(pl => pl.id !== p.id);
            const oppSide = side === 'left' ? 'right' : 'left';
            const oppX = oppSide === 'left' ? 180 : 620;
            const oppFighter = {
                id: oppData.id,
                sprite: this.physics.add.sprite(oppX, 330, `fighter_${oppData.id}`),
                startX: oppX,
                startY: 330,
                startFlipX: oppSide === 'right',
                isLocal: false,
                state: 'idle',
                hasHit: false,
                spec: oppData.character || this.charSpec
            };
            oppFighter.sprite.setCollideWorldBounds(true);
            oppFighter.sprite.setFlipX(oppSide === 'right');
            
            if (this.textures.exists(`face_${oppData.id}`)) {
                const faceYOffset = getHeadOffset(oppFighter.spec);
                oppFighter.face = this.add.image(oppX, 330 + faceYOffset, `face_${oppData.id}`).setScale(0.12);
                const maskShape = this.add.graphics().fillCircle(0, 0, 40).setVisible(false);
                oppFighter.face.setMask(maskShape.createGeometryMask());
                oppFighter.maskShape = maskShape;
            }
            this.players[oppData.id] = oppFighter;
        } else {
            // CPU
            const oppSide = side === 'left' ? 'right' : 'left';
            const oppX = oppSide === 'left' ? 180 : 620;
            const cpu = {
                id: 'CPU',
                sprite: this.physics.add.sprite(oppX, 330, 'fighter_CPU'),
                startX: oppX,
                startY: 330,
                startFlipX: oppSide === 'right',
                isLocal: false,
                isCPU: true,
                state: 'idle',
                hasHit: false,
                spec: { stats: { str: 2, spd: 2, res: 2 } },
                cpuTimer: 90
            };
            cpu.sprite.setCollideWorldBounds(true);
            cpu.sprite.setFlipX(oppSide === 'right');
            cpu.sprite.setTint(0xaaaaaa);
            this.players['CPU'] = cpu;
        }
    }

    setupPhysics() {
        const ground = this.add.rectangle(400, 390, 800, 20, 0x000, 0);
        this.physics.add.existing(ground, true);
        Object.values(this.players).forEach(p => {
            this.physics.add.collider(p.sprite, ground);
        });
    }

    setupInputs() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.attackKeys = this.input.keyboard.addKeys('A,S,D,W');
    }

    setupSocketListeners() {
        // Store references so we can remove them in shutdown()
        this._onOpponentMove = (data) => {
            const opp = this.players[data.id];
            if (opp && opp.state !== 'attacking') {
                if (opp.moveTween) opp.moveTween.stop();
                opp.moveTween = this.tweens.add({
                    targets: opp.sprite,
                    x: data.x,
                    y: data.y,
                    duration: 60,
                    ease: 'Linear'
                });
                opp.sprite.play(`${data.anim}_${opp.id}`, true);
                opp.sprite.setFlipX(data.flip);
            }
        };

        this._onOpponentAttack = (data) => {
            const opp = this.players[data.id];
            if (opp) {
                opp.state = 'attacking';
                opp.sprite.play(`${data.type}_${opp.id}`, true);
                opp.sprite.once('animationcomplete', () => opp.state = 'idle');
            }
        };

        // C-1: Use finalDamage (pre-calculated by attacker) to prevent HP divergence
        this._onOpponentHit = (data) => {
            this.handleHit(data.targetId, data.finalDamage ?? data.damage, data.attackerX, data.isCombo, true);
        };

        this._onOpponentEmote = (data) => {
            this.showEmote(data.id, data.emote);
        };

        this.socket.on('opponent_move',   this._onOpponentMove);
        this.socket.on('opponent_attack', this._onOpponentAttack);
        this.socket.on('opponent_hit',    this._onOpponentHit);
        this.socket.on('opponent_emote',  this._onOpponentEmote);
    }

    // ✅ Phaser calls shutdown() automatically when the scene is destroyed
    shutdown() {
        if (this.socket) {
            this.socket.off('opponent_move',   this._onOpponentMove);
            this.socket.off('opponent_attack', this._onOpponentAttack);
            this.socket.off('opponent_hit',    this._onOpponentHit);
            this.socket.off('opponent_emote',  this._onOpponentEmote);
        }
        if (this.game) {
            this.game.events.off('resetRound', this.resetPositions, this);
            this.game.events.off('gameOver',   this.handleGameOver,  this);
        }
        // N-4: Stop BGM when scene is destroyed
        if (this.sound_mgr) this.sound_mgr.stopBGM();
        // Cancel any pending timers on players
        Object.values(this.players || {}).forEach(p => {
            if (p.attackTimer) this.time.removeEvent(p.attackTimer);
            if (p.moveTween)   p.moveTween.stop();
        });
    }

    resetPositions() {
        this.gameOver = false;
        Object.values(this.players).forEach(p => {
            p.state = 'idle';
            p.hasHit = false;
            p.sprite.clearTint();
            p.sprite.setVelocity(0, 0);
            p.sprite.x = p.startX;
            p.sprite.y = p.startY;
            p.sprite.setFlipX(p.startFlipX);
            p.sprite.play(`idle_${p.id}`, true);
            if (p.isCPU) {
                p.cpuTimer = 90; // Wait 1.5s before attacking
            }
        });
        this.syncGraphics();
        // N-4: Round reset SFX
        if (this.sound_mgr) this.sound_mgr.sfxVoFight();
        
        const fightText = this.add.text(400, 200, '¡FIGHT!', {
            fontFamily: 'Bebas Neue, sans-serif',
            fontSize: '80px',
            color: '#ff0000',
            stroke: '#ffffff',
            strokeThickness: 5
        }).setOrigin(0.5).setAlpha(0).setScale(0.5);
        
        this.tweens.add({
            targets: fightText,
            alpha: 1,
            scale: 1.2,
            duration: 400,
            yoyo: true,
            hold: 500,
            onComplete: () => fightText.destroy()
        });
    }

    handleGameOver(data) {
        this.gameOver = true;
        // N-4: KO SFX
        if (this.sound_mgr) this.sound_mgr.sfxKO();

        Object.values(this.players).forEach(p => {
            if (p.moveTween) p.moveTween.stop();
            if (p.attackTimer) this.time.removeEvent(p.attackTimer);
            p.sprite.setVelocity(0, 0);

            if (data && data.loserId === p.id) {
                p.state = 'ko';
                p.sprite.play(`ko_${p.id}`, true);
                p.sprite.setTint(0xaaaaaa);
            } else {
                p.state = 'idle';
                p.sprite.play(`idle_${p.id}`, true);
            }
        });
    }

    update() {
        if (this.gameOver) return;
        const local = this.players[this.playerData.id];
        if (!local || local.state === 'hit' || local.state === 'ko') return;

        this.handleLocalInput(local);
        
        // Handle CPU
        if (this.players['CPU']) {
            this.handleCPU(this.players['CPU'], local);
        }

        this.syncGraphics();
        this.checkCombatCollision(local);
        
        if (this.players['CPU']) {
            this.checkCombatCollision(this.players['CPU']);
        }
    }

    handleCPU(cpu, player) {
        // H-3: CPU Difficulty configs
        const CPU_CONFIGS = {
            facil:   { reactionMin: 50, reactionMax: 70, blockChance: 0.10, comboChance: 0.00, jumpChance: 0.03 },
            normal:  { reactionMin: 15, reactionMax: 30, blockChance: 0.35, comboChance: 0.00, jumpChance: 0.05 },
            dificil: { reactionMin:  5, reactionMax: 15, blockChance: 0.55, comboChance: 0.30, jumpChance: 0.08 },
        };
        const diff = CPU_CONFIGS[this.cpuDifficulty] || CPU_CONFIGS.normal;

        if (cpu.state === 'ko' || cpu.state === 'hit' || cpu.state === 'attacking') return;

        const dist   = Math.abs(cpu.sprite.x - player.sprite.x);
        const onGround = cpu.sprite.body.blocked.down;

        // Reactive block when player attacks nearby
        if (player.state === 'attacking' && dist < 120 && onGround) {
            if (Math.random() < diff.blockChance && cpu.state !== 'blocking') {
                cpu.sprite.setVelocityX(0);
                cpu.state = 'blocking';
                cpu.sprite.play(`block_${cpu.id}`, true);
                cpu.cpuTimer = 25;
                return;
            }
        }

        if (cpu.state === 'blocking' && player.state !== 'attacking' && cpu.cpuTimer <= 10) {
            cpu.state = 'idle';
        }

        cpu.cpuTimer--;
        if (cpu.cpuTimer > 0) return;

        cpu.cpuTimer = diff.reactionMin + Math.random() * (diff.reactionMax - diff.reactionMin);

        if (dist > 100) {
            const dir = player.sprite.x > cpu.sprite.x ? 1 : -1;
            cpu.sprite.setVelocityX(dir * 180);
            cpu.sprite.play(`walk_fwd_${cpu.id}`, true);
            cpu.sprite.setFlipX(dir === -1);
        } else {
            cpu.sprite.setVelocityX(0);
            const r = Math.random();
            // Dificil: can chain a quick double attack
            if (diff.comboChance > 0 && r < diff.comboChance) {
                this.executeAttack(cpu, 'jab');
                this.time.delayedCall(350, () => {
                    if (!this.gameOver && cpu.state !== 'ko') this.executeAttack(cpu, 'hook');
                });
            } else if (r < 0.30) { this.executeAttack(cpu, 'jab'); }
            else if (r < 0.55)   { this.executeAttack(cpu, 'hook'); }
            else if (r < 0.72)   { this.executeAttack(cpu, 'kick'); }
            else if (r < 0.85)   { this.executeAttack(cpu, 'special'); }
            else if (onGround && r < 0.85 + diff.jumpChance) {
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

        // Attacks
        if (Phaser.Input.Keyboard.JustDown(this.attackKeys.A)) this.executeAttack(local, 'jab');
        else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.S)) this.executeAttack(local, 'hook');
        else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.D)) this.executeAttack(local, 'kick');
        else if (Phaser.Input.Keyboard.JustDown(this.attackKeys.W)) this.executeAttack(local, 'special');

        // Blocking
        if (this.cursors.down.isDown && onGround) {
            local.sprite.setVelocityX(0);
            local.state = 'blocking';
            anim = 'block';
            moved = true;
        }
        // Movement
        else if (this.cursors.left.isDown) {
            local.sprite.setVelocityX(-(160 + this.stats.spd * 20));
            local.sprite.setFlipX(true);
            anim = onGround ? 'walk_fwd' : 'jump';
            moved = true;
        } else if (this.cursors.right.isDown) {
            local.sprite.setVelocityX(160 + this.stats.spd * 20);
            local.sprite.setFlipX(false);
            anim = onGround ? 'walk_fwd' : 'jump';
            moved = true;
        } else {
            local.sprite.setVelocityX(0);
        }

        if (onGround && !local.wasOnGround) {
            this.emitDust(local.sprite.x, 390); // landed
            if (this.sound_mgr) this.sound_mgr.sfxLand(); // N-4
        }

        if (this.cursors.up.isDown && onGround) {
            local.sprite.setVelocityY(-550);
            anim = 'jump';
            moved = true;
            this.emitDust(local.sprite.x, 390); // jumped
            if (this.sound_mgr) this.sound_mgr.sfxJump(); // N-4
        }

        local.wasOnGround = onGround;

        if (moved || anim !== local.lastAnim) {
            local.sprite.play(`${anim}_${local.id}`, true);
            this.socket.emit('player_move', {
                roomId: this.roomId, id: this.playerData.id,
                x: local.sprite.x, y: local.sprite.y,
                anim: anim, flip: local.sprite.flipX
            });
            local.lastAnim = anim;
        }
    }

    executeAttack(f, type) {
        f.state = 'attacking';
        f.hasHit = false;
        f.sprite.play(`${type}_${f.id}`, true);
        // N-4: Attack SFX (only for local player to avoid duplicate)
        if (f.isLocal && this.sound_mgr) {
            if (type === 'jab')     this.sound_mgr.sfxJab();
            else if (type === 'hook')    this.sound_mgr.sfxHook();
            else if (type === 'kick')    this.sound_mgr.sfxKick();
            else if (type === 'special') this.sound_mgr.sfxSpecial();
        }
        this.socket.emit('player_attack', { roomId: this.roomId, id: this.playerData.id, type });
        
        // Timeout de seguridad en caso de que la animación sea interrumpida
        if (f.attackTimer) this.time.removeEvent(f.attackTimer);
        f.attackTimer = this.time.delayedCall(600, () => {
            if (f.state === 'attacking') f.state = 'idle';
        });

        f.sprite.once(`animationcomplete`, () => {
            if (f.state === 'attacking') f.state = 'idle';
        });
    }

    checkCombatCollision(attacker) {
        if (attacker.state !== 'attacking' || attacker.hasHit) return;
        const currentAnim = attacker.sprite.anims.currentAnim;
        if (!currentAnim) return;

        // H-2: Per-attack hitbox configuration
        const ATTACK_HITBOXES = {
            jab:     { xOffset: 60, yOffset:  -5, halfW: 45, halfH: 50, activeFrom: 2 },
            hook:    { xOffset: 70, yOffset:  -5, halfW: 55, halfH: 65, activeFrom: 3 },
            kick:    { xOffset: 80, yOffset:  20, halfW: 60, halfH: 75, activeFrom: 3 },
            special: { xOffset: 55, yOffset: -20, halfW: 65, halfH: 85, activeFrom: 2 },
        };
        const attackType = Object.keys(ATTACK_HITBOXES).find(k => currentAnim.key.includes(k)) || 'jab';
        const hb = ATTACK_HITBOXES[attackType];

        const frame = attacker.sprite.anims.currentFrame?.index ?? 0;
        if (frame < hb.activeFrom) return; // H-2: only active during correct animation frames

        const direction = attacker.sprite.flipX ? -1 : 1;
        const hitboxCX = attacker.sprite.x + (direction * hb.xOffset);
        const hitboxCY = attacker.sprite.y + hb.yOffset;

        Object.values(this.players).forEach(defender => {
            if (defender.id === attacker.id) return;

            const defRect = defender.sprite.getBounds();
            const defLeft  = defRect.left  + 15;
            const defRight = defRect.right  - 15;
            const defTop   = defRect.top;
            const defBottom = defRect.bottom;

            const isHit = hitboxCX + hb.halfW > defLeft  &&
                          hitboxCX - hb.halfW < defRight  &&
                          hitboxCY + hb.halfH > defTop    &&
                          hitboxCY - hb.halfH < defBottom;

            if (isHit) {
                attacker.hasHit = true;
                attacker.comboCount = (attacker.comboCount || 0) + 1;

                // --- Attacker damage calculation ---
                const BASE_DAMAGE = { jab: 8, hook: 12, kick: 10, special: 20 };
                let baseDamage = BASE_DAMAGE[attackType] ?? 8;

                if (attacker.spec.style === 'Agresivo') baseDamage *= 1.2;
                else if (attacker.spec.style === 'Defensivo') baseDamage *= 0.8;

                let rawDamage = baseDamage + ((attacker.spec.stats?.str || this.stats.str) * 1.5);

                // --- Combo multiplier ---
                let isCombo = false;
                if (attacker.comboCount >= 3) {
                    rawDamage *= 1.5;
                    isCombo = true;
                    attacker.comboCount = 0;
                }

                // --- Defender damage reductions (pre-calculated here so BOTH clients use same value) ---
                // C-1 fix: finalDamage is computed once by the attacker and sent to defender
                let finalDamage = rawDamage - (defender.spec.stats?.res || 0);
                if (defender.spec.style === 'Defensivo') finalDamage *= 0.8;
                if (defender.spec.style === 'Agresivo')  finalDamage *= 1.1;
                if (defender.state === 'blocking')        finalDamage *= 0.3;
                finalDamage = Math.max(1, Math.round(finalDamage));

                // Emit the pre-calculated damage so defender doesn't recalculate
                this.socket.emit('player_hit', {
                    roomId: this.roomId,
                    targetId: defender.id,
                    finalDamage,          // C-1: use finalDamage, not raw damage
                    attackerX: attacker.sprite.x,
                    isCombo
                });
                // Apply locally with flag so handleHit skips recalculation
                this.handleHit(defender.id, finalDamage, attacker.sprite.x, isCombo, true);
            }
        });
    }

    // C-1: isPreCalculated=true skips defender stat recalculation (damage already computed by attacker)
    handleHit(targetId, damage, attackerX, isCombo = false, isPreCalculated = false) {
        const target = this.players[targetId];
        if (!target) return;

        target.comboCount = 0;

        let finalDamage;
        if (isPreCalculated) {
            // Damage already includes all reductions — use as-is
            finalDamage = damage;
        } else {
            // Fallback: compute reductions locally (only used by CPU matches where no socket is involved)
            finalDamage = damage - (target.spec.stats?.res || 0);
            if (target.spec.style === 'Defensivo') finalDamage *= 0.8;
            if (target.spec.style === 'Agresivo')  finalDamage *= 1.1;
            if (target.state === 'blocking')        finalDamage *= 0.3;
            finalDamage = Math.max(1, Math.round(finalDamage));
        }

        const prevState = target.state; // N-4 fix: capture state before overwrite
        target.state = 'hit';
        target.sprite.play(`hit_${target.id}`, true);
        target.sprite.setTint(0xff0000);
        // N-4: Hit / Block SFX
        if (this.sound_mgr) {
            if (prevState === 'blocking') this.sound_mgr.sfxBlock();
            else if (isCombo) this.sound_mgr.sfxCombo();
            else this.sound_mgr.sfxHit();
        }

        // Impact FX
        const color = attackerX > target.sprite.x ? 0xffcccc : 0xccffff;
        const emitter = this.add.particles(target.sprite.x, target.sprite.y - 30, 'particle_star', {
            speed: { min: 200, max: 600 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            blendMode: 'ADD',
            lifespan: 350,
            tint: color,
            gravityY: 600,
            quantity: 15,
            emitting: false
        });
        emitter.explode();
        this.time.delayedCall(500, () => emitter.destroy());

        this.cameras.main.shake(isCombo ? 300 : 150, isCombo ? 0.03 : 0.01);

        if (isCombo) {
            const comboText = this.add.text(target.sprite.x, target.sprite.y - 80, '¡COMBO CRÍTICO!', {
                fontFamily: 'Bebas Neue, sans-serif',
                fontSize: '28px',
                color: '#ff0000',
                stroke: '#ffffff',
                strokeThickness: 3
            }).setOrigin(0.5);
            this.tweens.add({
                targets: comboText,
                y: comboText.y - 40,
                alpha: 0,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => comboText.destroy()
            });
        }

        const dir = target.sprite.x > attackerX ? 1 : -1;
        target.sprite.setVelocityX(dir * (isCombo ? 400 : 200 + finalDamage * 5));
        this.time.delayedCall(200, () => {
            target.sprite.clearTint();
            if (target.state !== 'ko') target.state = 'idle';
        });
        this.game.events.emit('updateHP', { id: targetId, damage: finalDamage });
    }

    showEmote(playerId, emote) {
        const p = this.players[playerId];
        if (!p) return;

        const text = this.add.text(p.sprite.x, p.sprite.y - 120, emote, {
            fontSize: '48px'
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            y: text.y - 60,
            alpha: 0,
            duration: 1500,
            ease: 'Cubic.out',
            onComplete: () => text.destroy()
        });
    }

    syncGraphics() {
        Object.values(this.players).forEach(p => {
            if (p.face) {
                p.face.x = p.sprite.x;
                const topPct = p.spec?.headPos ? parseFloat(p.spec.headPos.top) / 100 : 0.15;
                const h = p.spec?.fHeight || 192;
                const faceYOffset = (-h / 2) + (h * topPct) + 15;
                p.face.y = p.sprite.y + faceYOffset;
                p.face.setFlipX(p.sprite.flipX);
                
                if (p.maskShape) {
                    p.maskShape.x = p.face.x;
                    p.maskShape.y = p.face.y;
                }
            }
        });
    }
}
