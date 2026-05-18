/**
 * WebRTCManager — Peer-to-peer data channel for low-latency game data.
 * 
 * Architecture:
 * - Socket.IO: signaling (offer/answer/ICE), lobby, HP, KO, rounds (reliable, authoritative)
 * - WebRTC DataChannel: player_move, player_attack (unreliable, P2P, ~20-60ms vs ~80-200ms)
 * 
 * Falls back gracefully to Socket.IO if WebRTC fails to connect.
 */
export default class WebRTCManager {
    constructor(socket, roomId, isInitiator) {
        this.socket = socket;
        this.roomId = roomId;
        this.isInitiator = isInitiator;
        this.pc = null;
        this.dataChannel = null;
        this.connected = false;
        this.onMessage = null; // callback: (eventName, data) => void
        this._pendingCandidates = [];
        this._setupSignaling();
    }

    /**
     * Initialize the RTCPeerConnection and start the handshake.
     */
    async init() {
        try {
            this.pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                ]
            });

            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    this.socket.emit('webrtc_signal', {
                        roomId: this.roomId,
                        type: 'candidate',
                        candidate: event.candidate
                    });
                }
            };

            this.pc.oniceconnectionstatechange = () => {
                const state = this.pc?.iceConnectionState;
                console.log(`[WebRTC] ICE state: ${state}`);
                if (state === 'connected' || state === 'completed') {
                    this.connected = true;
                    console.log('[WebRTC] ✅ P2P connected! Movement data now uses direct P2P.');
                } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    this.connected = false;
                    console.log('[WebRTC] ⚠️ P2P disconnected. Falling back to Socket.IO.');
                }
            };

            if (this.isInitiator) {
                // Create data channel (initiator creates it)
                this.dataChannel = this.pc.createDataChannel('game-data', {
                    ordered: false,       // Don't wait for ordering — we want latest data
                    maxRetransmits: 0     // Don't retransmit lost packets — mimics UDP
                });
                this._setupDataChannel(this.dataChannel);

                // Create and send offer
                const offer = await this.pc.createOffer();
                await this.pc.setLocalDescription(offer);
                this.socket.emit('webrtc_signal', {
                    roomId: this.roomId,
                    type: 'offer',
                    sdp: offer
                });
                console.log('[WebRTC] Offer sent (initiator)');
            } else {
                // Non-initiator waits for data channel
                this.pc.ondatachannel = (event) => {
                    this.dataChannel = event.channel;
                    this._setupDataChannel(this.dataChannel);
                };
            }

            // Flush any candidates that arrived before init
            this._pendingCandidates.forEach(c => {
                this.pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            });
            this._pendingCandidates = [];

        } catch (err) {
            console.warn('[WebRTC] Failed to initialize:', err.message);
            this.connected = false;
        }
    }

    _setupDataChannel(channel) {
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            this.connected = true;
            console.log('[WebRTC] DataChannel open');
        };

        channel.onclose = () => {
            this.connected = false;
            console.log('[WebRTC] DataChannel closed');
        };

        channel.onerror = (err) => {
            console.warn('[WebRTC] DataChannel error:', err);
            this.connected = false;
        };

        channel.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (this.onMessage) {
                    this.onMessage(msg.event, msg.data);
                }
            } catch (e) {
                // Ignore malformed messages
            }
        };
    }

    _setupSignaling() {
        this._onSignal = async (data) => {
            if (!data || data.roomId !== this.roomId) return;

            try {
                if (data.type === 'offer' && !this.isInitiator) {
                    if (!this.pc) await this.init();
                    await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    const answer = await this.pc.createAnswer();
                    await this.pc.setLocalDescription(answer);
                    this.socket.emit('webrtc_signal', {
                        roomId: this.roomId,
                        type: 'answer',
                        sdp: answer
                    });
                    console.log('[WebRTC] Answer sent');
                } else if (data.type === 'answer' && this.isInitiator) {
                    await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
                    console.log('[WebRTC] Answer received');
                } else if (data.type === 'candidate') {
                    if (this.pc && this.pc.remoteDescription) {
                        await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
                        this._pendingCandidates.push(data.candidate);
                    }
                }
            } catch (err) {
                console.warn('[WebRTC] Signal handling error:', err.message);
            }
        };

        this.socket.on('webrtc_signal', this._onSignal);
    }

    /**
     * Send game data over P2P if connected, otherwise returns false for fallback.
     * @param {string} eventName - The event name (e.g. 'player_move')
     * @param {object} data - The data payload
     * @returns {boolean} true if sent via P2P, false if caller should use Socket.IO
     */
    send(eventName, data) {
        if (this.connected && this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
                this.dataChannel.send(JSON.stringify({ event: eventName, data }));
                return true;
            } catch (e) {
                // Channel might have closed mid-send
                return false;
            }
        }
        return false;
    }

    /**
     * Clean up all resources.
     */
    destroy() {
        this.connected = false;
        if (this.socket) {
            this.socket.off('webrtc_signal', this._onSignal);
        }
        if (this.dataChannel) {
            try { this.dataChannel.close(); } catch (e) {}
            this.dataChannel = null;
        }
        if (this.pc) {
            try { this.pc.close(); } catch (e) {}
            this.pc = null;
        }
        this._pendingCandidates = [];
    }
}
