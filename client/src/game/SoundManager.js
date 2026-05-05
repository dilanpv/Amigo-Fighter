/**
 * SoundManager — Motor de audio procedural para Amigo Fighter
 * Usa Web Audio API puro. Sin archivos externos, todo generado en tiempo real.
 */
export default class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.bgmNodes = [];
        this.muted = false;
        this._bgmScheduled = false;
        this._bgmStartTime = 0;
        this._bgmLoopId = null;
        this.volume = 0.7;
    }

    /**
     * Inicializa el AudioContext (debe llamarse desde un gesto del usuario)
     */
    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
            this.masterGain.connect(this.ctx.destination);
        } catch (e) {
            console.warn('[SoundManager] Web Audio API no disponible:', e);
        }
    }

    setMute(muted) {
        this.muted = muted;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.1);
        }
    }

    setVolume(v) {
        this.volume = v;
        if (this.masterGain && !this.muted) {
            this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
        }
    }

    // ════════════════════════════════════════════════════════
    // HELPERS INTERNOS
    // ════════════════════════════════════════════════════════

    _osc(type, freq, startT, duration, gainPeak = 0.5, gainEnd = 0) {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startT);
        g.gain.setValueAtTime(0.001, startT);
        g.gain.linearRampToValueAtTime(gainPeak, startT + 0.01);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, gainEnd), startT + duration);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(startT);
        osc.stop(startT + duration + 0.05);
    }

    _freqSweep(type, startFreq, endFreq, startT, duration, gainPeak = 0.5) {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, startT);
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), startT + duration);
        g.gain.setValueAtTime(0.001, startT);
        g.gain.linearRampToValueAtTime(gainPeak, startT + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, startT + duration);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(startT);
        osc.stop(startT + duration + 0.05);
    }

    _noise(startT, duration, gainPeak = 0.3, filterFreq = 4000) {
        if (!this.ctx || this.muted) return;
        const bufSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        filter.Q.value = 0.8;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(gainPeak, startT);
        g.gain.exponentialRampToValueAtTime(0.001, startT + duration);
        source.connect(filter);
        filter.connect(g);
        g.connect(this.masterGain);
        source.start(startT);
        source.stop(startT + duration);
    }

    // ════════════════════════════════════════════════════════
    // SFX — ATAQUES
    // ════════════════════════════════════════════════════════

    sfxJab() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._noise(t, 0.06, 0.25, 3000);
        this._freqSweep('square', 800, 300, t, 0.08, 0.15);
    }

    sfxHook() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._noise(t, 0.10, 0.35, 1500);
        this._freqSweep('sawtooth', 600, 150, t, 0.14, 0.2);
    }

    sfxKick() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._noise(t, 0.12, 0.3, 900);
        this._freqSweep('sine', 400, 80, t, 0.18, 0.25);
        this._osc('square', 220, t + 0.04, 0.1, 0.15);
    }

    sfxSpecial() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        // Efecto de carga + impacto
        this._freqSweep('sawtooth', 200, 900, t, 0.15, 0.3);
        this._noise(t + 0.12, 0.18, 0.5, 2000);
        this._freqSweep('square', 500, 50, t + 0.15, 0.25, 0.35);
        this._osc('sine', 110, t + 0.1, 0.3, 0.2);
    }

    sfxHit() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._noise(t, 0.08, 0.4, 2500);
        this._freqSweep('sine', 300, 80, t, 0.12, 0.3);
    }

    sfxBlock() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._noise(t, 0.05, 0.2, 800);
        this._osc('square', 150, t, 0.06, 0.1);
    }

    sfxCombo() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        // Arpeggio ascendente
        [440, 550, 660, 880].forEach((f, i) => {
            this._osc('square', f, t + i * 0.06, 0.1, 0.3);
        });
        this._noise(t + 0.24, 0.15, 0.4, 3000);
    }

    sfxKO() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        // Golpe profundo
        this._freqSweep('sine', 120, 20, t, 0.6, 0.8);
        this._noise(t, 0.2, 0.5, 500);
        // Eco descendente
        this._freqSweep('sawtooth', 880, 110, t + 0.1, 0.8, 0.3);
        this._freqSweep('sawtooth', 660, 80, t + 0.3, 0.7, 0.2);
        // Silencio dramático con reverb sintético
        this._osc('sine', 55, t + 0.5, 1.5, 0.4, 0);
    }

    sfxVoFight() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        // "¡FIGHT!" — tres tonos cortos ascendentes
        [330, 440, 660].forEach((f, i) => {
            this._osc('sawtooth', f, t + i * 0.08, 0.12, 0.4);
        });
    }

    sfxJump() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._freqSweep('sine', 200, 500, t, 0.15, 0.2);
        this._noise(t, 0.04, 0.1, 5000);
    }

    sfxLand() {
        if (!this.ctx) this.init();
        const t = this.ctx.currentTime;
        this._freqSweep('sine', 150, 60, t, 0.1, 0.3);
        this._noise(t, 0.06, 0.2, 700);
    }

    // ════════════════════════════════════════════════════════
    // BGM — Música de pelea procedural
    // Patrón: kick + bassline + lead riff en loop de 2 compases
    // ════════════════════════════════════════════════════════

    _kick(t) {
        this._freqSweep('sine', 180, 40, t, 0.25, 0.4);
        this._noise(t, 0.04, 0.15, 400);
    }

    _hihat(t, open = false) {
        this._noise(t, open ? 0.12 : 0.04, open ? 0.08 : 0.12, 8000);
    }

    _snare(t) {
        this._noise(t, 0.12, 0.2, 3000);
        this._osc('sine', 200, t, 0.1, 0.1);
    }

    _bass(t, freq, dur = 0.22) {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const dist = this.ctx.createWaveShaper();
        const g = this.ctx.createGain();
        // Light distortion curve
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 256 - 1;
            curve[i] = (Math.PI + 100) * x / (Math.PI + 100 * Math.abs(x));
        }
        dist.curve = curve;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(dist);
        dist.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    _lead(t, freq, dur = 0.12) {
        if (!this.ctx || this.muted) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(t);
        osc.stop(t + dur + 0.02);
    }

    startBGM() {
        if (!this.ctx) this.init();
        if (this._bgmLoopId) return;

        const BPM = 148;
        const beat = 60 / BPM;
        const bar = beat * 4;

        // Bass line notas (C minor pentatonic): C2=65.4, Eb2=77.8, F2=87.3, G2=98, Bb2=116.5
        const bassLine = [65.4, 65.4, 98, 77.8, 65.4, 87.3, 65.4, 116.5];
        // Lead riff (C3=130.8, Eb3=155.6, F3=174.6, G3=196, Bb3=233.1)
        const leadLine = [196, 233.1, 196, 174.6, 155.6, 130.8, 155.6, 0, 196, 0, 233.1, 0, 174.6, 155.6, 130.8, 0];

        const scheduleBar = (startT) => {
            for (let b = 0; b < 4; b++) {
                const bt = startT + b * beat;
                // Kick pattern: beats 1, 3 + offbeat
                if (b === 0 || b === 2) this._kick(bt);
                if (b === 1) this._kick(bt + beat * 0.5);
                // Snare: beats 2, 4
                if (b === 1 || b === 3) this._snare(bt);
                // Hi-hats: every 8th note
                this._hihat(bt, false);
                this._hihat(bt + beat * 0.5, false);
                // Bass
                this._bass(bt, bassLine[b * 2], beat * 0.45);
                this._bass(bt + beat * 0.5, bassLine[b * 2 + 1], beat * 0.4);
            }
            // Lead riff (16ths)
            leadLine.forEach((freq, i) => {
                if (freq > 0) {
                    this._lead(startT + i * (beat * 0.5), freq, beat * 0.45);
                }
            });
        };

        let nextBarTime = this.ctx.currentTime + 0.05;
        const LOOKAHEAD = 0.2;
        const SCHEDULE_INTERVAL = 100; // ms

        const tick = () => {
            while (nextBarTime < this.ctx.currentTime + LOOKAHEAD + bar) {
                scheduleBar(nextBarTime);
                nextBarTime += bar * 2; // 2 bars per loop
            }
            this._bgmLoopId = setTimeout(tick, SCHEDULE_INTERVAL);
        };
        tick();
    }

    stopBGM() {
        if (this._bgmLoopId) {
            clearTimeout(this._bgmLoopId);
            this._bgmLoopId = null;
        }
        // Fade out master
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.3);
            setTimeout(() => {
                if (this.masterGain && !this._bgmLoopId) {
                    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
                }
            }, 1200);
        }
    }

    destroy() {
        this.stopBGM();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }
}
