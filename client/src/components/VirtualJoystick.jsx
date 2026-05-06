import React, { useRef, useState, useEffect } from 'react';

export default function VirtualJoystick({ onMove }) {
    const padRef = useRef(null);
    const [stickPos, setStickPos] = useState({ x: 0, y: 0 });

    const handlePointerMove = (e) => {
        if (!padRef.current) return;
        const rect = padRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const maxDist = rect.width / 2;
        
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        
        setStickPos({ x: dx, y: dy });
        
        // Map dx, dy to 8-way directional pad
        let dir = { up: false, down: false, left: false, right: false };
        if (dist > maxDist * 0.2) {
            const angle = Math.atan2(dy, dx);
            if (angle < -Math.PI/8 && angle > -7*Math.PI/8) dir.up = true;
            if (angle > Math.PI/8 && angle < 7*Math.PI/8) dir.down = true;
            if (angle > 5*Math.PI/8 || angle < -5*Math.PI/8) dir.left = true;
            if (angle > -3*Math.PI/8 && angle < 3*Math.PI/8) dir.right = true;
        }
        onMove(dir);
    };

    const handlePointerUp = () => {
        setStickPos({ x: 0, y: 0 });
        onMove({ up: false, down: false, left: false, right: false });
    };

    // Prevent default touch actions on the joystick to avoid scrolling
    useEffect(() => {
        const el = padRef.current;
        if (el) {
            const preventDefault = (e) => e.preventDefault();
            el.addEventListener('touchstart', preventDefault, { passive: false });
            el.addEventListener('touchmove', preventDefault, { passive: false });
            return () => {
                el.removeEventListener('touchstart', preventDefault);
                el.removeEventListener('touchmove', preventDefault);
            };
        }
    }, []);

    return (
        <div 
            ref={padRef}
            className="w-36 h-36 bg-neutral-900/60 border-4 border-neutral-700/80 rounded-full relative touch-none shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-auto backdrop-blur-sm"
            onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); handlePointerMove(e); }}
            onPointerMove={(e) => { if (e.buttons > 0) handlePointerMove(e); }}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div 
                className="w-14 h-14 bg-red-600/90 border-2 border-red-400 rounded-full absolute shadow-lg shadow-red-900/50 transition-none"
                style={{
                    left: `calc(50% - 1.75rem + ${stickPos.x}px)`,
                    top: `calc(50% - 1.75rem + ${stickPos.y}px)`,
                }}
            />
        </div>
    );
}
