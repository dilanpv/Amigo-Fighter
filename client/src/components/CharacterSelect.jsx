import React, { useState } from 'react';
import Cropper from 'react-easy-crop';

const getCroppedImg = (imageSrc, pixelCrop) => {
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  
  const image = new Image();
  image.src = imageSrc;
  
  return new Promise((resolve) => {
    image.onload = () => {
      ctx.beginPath();
      ctx.arc(pixelCrop.width / 2, pixelCrop.height / 2, pixelCrop.width / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y,
        pixelCrop.width, pixelCrop.height,
        0, 0,
        pixelCrop.width, pixelCrop.height
      );
      resolve(canvas.toDataURL('image/png'));
    };
  });
};

const CHARACTERS = [
  { 
    id: 'ninja', 
    name: 'EL NINJA', 
    img: '/assets/EL NINJA.png',
    cols: 11, rows: 4, 
    fWidth: 128, fHeight: 192,
    headPos: { top: '20%', left: '50%' } 
  },
  { 
    id: 'campeon', 
    name: 'EL CAMPEÓN', 
    img: '/assets/EL CAMPEÓN.png', 
    cols: 11, rows: 4, 
    fWidth: 128, fHeight: 192,
    headPos: { top: '20%', left: '50%' } 
  },
  { 
    id: 'agresivo', 
    name: 'EL AGRESIVO', 
    img: '/assets/EL AGRESIVO.png', 
    cols: 11, rows: 4, 
    fWidth: 128, fHeight: 192,
    headPos: { top: '20%', left: '50%' } 
  },
  { 
    id: 'luchador', 
    name: 'LUCHADOR', 
    img: '/assets/LUCHADOR.png', 
    cols: 11, rows: 4, 
    fWidth: 128, fHeight: 192,
    headPos: { top: '20%', left: '50%' } 
  },
];

// N-5/N-14: Generate random Dicebear avatar as default face so photo is optional
const getRandomDicebearFace = () => {
  const seed = Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${seed}`;
};

function CharacterSelect({ playerData, opponentInfo, onReady, onBack }) {
  const [selectedChar, setSelectedChar] = useState(CHARACTERS[0]);
  const [face, setFace] = useState(() => getRandomDicebearFace()); // N-5: default random avatar
  const [hasCustomFace, setHasCustomFace] = useState(false); // track if user uploaded custom
  const [stats, setStats] = useState({ str: 4, spd: 3, res: 3 });
  const [style, setStyle] = useState('Balanceado');
  const [points, setPoints] = useState(0);
  const [mobileStep, setMobileStep] = useState(1);

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const STYLE_PRESETS = {
    'Balanceado':  { str: 4, spd: 3, res: 3, pts: 0 },
    'Agresivo':    { str: 5, spd: 3, res: 2, pts: 0 },
    'Defensivo':   { str: 2, spd: 3, res: 5, pts: 0 },
    'Velocista':   { str: 2, spd: 5, res: 3, pts: 0 },
  };
  const STYLES = Object.keys(STYLE_PRESETS);

  const applyStyle = (s) => {
    setStyle(s);
    const preset = STYLE_PRESETS[s];
    setStats({ str: preset.str, spd: preset.spd, res: preset.res });
    setPoints(preset.pts);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        setImageSrc(ev.target.result);
        setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      setFace(croppedImage);
      setHasCustomFace(true); // N-5: mark as custom
      setShowCropper(false);
    } catch (e) {
      console.error(e);
    }
  };

  const updateStat = (name, val) => {
    if (val > 0 && points <= 0) return;
    if (val < 0 && stats[name] <= 1) return;
    
    setStats(prev => ({ ...prev, [name]: prev[name] + val }));
    setPoints(prev => prev - val);
  };

  return (
    <div className="screen min-h-[100dvh] p-2 md:p-4 bg-gradient-to-br from-neutral-900 to-black overflow-y-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-6 w-full max-w-6xl mx-auto mt-4 animate-fade-in-up">
          <button onClick={onBack} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 text-xl md:text-2xl font-['Bebas_Neue'] tracking-wider rounded border border-neutral-600 transition-colors w-fit shadow-md">
            ← VOLVER
          </button>
          <h2 className="text-4xl md:text-6xl text-red-500 m-0 font-['Bebas_Neue'] tracking-widest text-center md:text-right drop-shadow-[0_0_15px_rgba(255,60,60,0.8)]">
            SELECCIONA TU LUCHADOR
          </h2>
      </div>
      
      {/* VS BANNER (M-7) */}
      {opponentInfo && (
        <div className="w-full max-w-6xl mx-auto mb-6 flex items-center justify-center gap-4 md:gap-10 animate-fade-in">
          <div className="flex flex-col items-center">
             <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-800 rounded-full border-2 border-red-500 overflow-hidden shadow-[0_0_15px_rgba(255,0,0,0.4)]">
                {playerData?.face ? (
                  <img src={playerData.face} alt="Tú" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-['Bebas_Neue'] text-2xl">YOU</div>
                )}
             </div>
             <span className="text-white font-['Bebas_Neue'] text-sm md:text-lg tracking-widest mt-1">TÚ</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="text-red-500 font-['Bebas_Neue'] text-4xl md:text-6xl italic animate-pulse drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">VS</div>
          </div>

          <div className="flex flex-col items-center">
             <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-800 rounded-full border-2 border-neutral-600 overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                {opponentInfo.face ? (
                  <img src={opponentInfo.face} alt={opponentInfo.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white font-['Bebas_Neue'] text-2xl">?</div>
                )}
             </div>
             <span className="text-neutral-400 font-['Bebas_Neue'] text-sm md:text-lg tracking-widest mt-1">{(opponentInfo.name || 'OPONENTE').toUpperCase()}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 w-full max-w-6xl mx-auto flex-1 min-h-0 pb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        
        {/* LEFT: CHARACTER GRID & STATS */}
        <div className={`flex-1 flex flex-col gap-4 md:gap-6 bg-neutral-950/80 backdrop-blur-md border border-neutral-800 p-4 md:p-6 rounded-lg shadow-2xl overflow-y-auto ${mobileStep === 1 ? 'flex' : 'hidden lg:flex'}`}>
          
          <div>
            <h3 className="text-xl md:text-2xl text-red-500 mb-3 tracking-widest font-['Bebas_Neue']">ELIGE TU BASE</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
                {CHARACTERS.map(char => (
                <div 
                    key={char.id}
                    onClick={() => setSelectedChar(char)}
                    className={`relative aspect-[3/4] md:aspect-[2/3] bg-neutral-900 border-2 cursor-pointer overflow-hidden group transition-all duration-300 rounded-md
                      ${selectedChar.id === char.id ? 'border-red-500 shadow-[0_0_20px_rgba(255,60,60,0.6)] scale-105 z-10' : 'border-neutral-700 hover:border-red-400 hover:scale-[1.02]'}`}
                >
                    <div 
                      className="absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity"
                      style={{
                        backgroundImage: `url('${encodeURI(char.img)}')`,
                        backgroundSize: '1100% 400%',
                        backgroundPosition: '0% 0%',
                        backgroundRepeat: 'no-repeat'
                      }}
                    />
                    <div className="absolute bottom-0 w-full bg-red-600/90 text-white text-xs md:text-sm font-['Bebas_Neue'] tracking-wider text-center py-0.5 md:py-1 z-10">
                      {char.name}
                    </div>
                </div>
                ))}
            </div>
          </div>

          <div className="bg-black/40 p-4 rounded border border-neutral-800/50">
            <h3 className="text-xl md:text-2xl text-red-500 mb-3 tracking-widest font-['Bebas_Neue']">
              ESTADÍSTICAS <span className="text-white ml-2">({points} PTS RESTANTES)</span>
            </h3>
            {Object.entries({str: 'Fuerza', spd: 'Velocidad', res: 'Resistencia'}).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between mb-3 bg-neutral-900/50 p-2 rounded">
                    <span className="text-lg md:text-xl font-['Bebas_Neue'] tracking-wide text-neutral-300">{label}</span>
                    <div className="flex items-center gap-3 md:gap-4">
                        <button className="bg-neutral-800 hover:bg-red-600 text-white w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-xl md:text-2xl font-bold rounded transition-colors active:scale-95" onClick={() => updateStat(key, -1)}>-</button>
                        <span className="w-6 text-center font-bold text-red-500 text-2xl md:text-3xl font-['Bebas_Neue']">{stats[key]}</span>
                        <button className="bg-neutral-800 hover:bg-green-600 text-white w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-xl md:text-2xl font-bold rounded transition-colors active:scale-95" onClick={() => updateStat(key, 1)}>+</button>
                    </div>
                </div>
            ))}
          </div>

          <div className="bg-black/40 p-4 rounded border border-neutral-800/50">
            <h3 className="text-xl md:text-2xl text-red-500 mb-3 tracking-widest font-['Bebas_Neue']">ESTILO DE PELEA</h3>
            <div className="grid grid-cols-2 gap-2 md:gap-3">
                {STYLES.map(s => (
                    <button 
                        key={s}
                        onClick={() => applyStyle(s)}
                        className={`py-2 px-1 text-lg md:text-xl font-['Bebas_Neue'] tracking-wider rounded border transition-all duration-200 
                          ${style === s ? 'bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(255,0,0,0.4)] scale-[1.02]' : 'bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'}`}
                    >
                        {s.toUpperCase()}
                    </button>
                ))}
            </div>
          </div>
          <button 
            className="lg:hidden mt-2 w-full py-3 text-2xl font-['Bebas_Neue'] tracking-widest bg-red-600 hover:bg-red-500 text-white rounded transition-colors shadow-lg" 
            onClick={() => setMobileStep(2)}
          >
            SIGUIENTE: FOTO Y VISTA PREVIA
          </button>
        </div>

        {/* RIGHT: PREVIEW & START */}
        <div className={`flex-1 flex flex-col bg-neutral-950/80 backdrop-blur-md border border-neutral-800 p-4 md:p-6 rounded-lg shadow-2xl ${mobileStep === 2 ? 'flex' : 'hidden lg:flex'}`}>
          <button 
            className="lg:hidden mb-4 py-2 text-xl font-['Bebas_Neue'] tracking-widest bg-neutral-800 text-white rounded border border-neutral-600" 
            onClick={() => setMobileStep(1)}
          >
            ← VOLVER A SELECCIÓN
          </button>
          
          <div className="mb-4 border-b-2 border-red-600 pb-2">
            <div className="text-2xl md:text-3xl font-['Bebas_Neue'] tracking-widest text-red-500">
              JUGADOR: <span className="text-white">{playerData?.name || 'JUGADOR 1'}</span>
            </div>
          </div>

          <div className="relative flex-1 bg-black border border-neutral-800 rounded-md overflow-hidden flex items-center justify-center min-h-[200px] md:min-h-[300px] shadow-inner group">
            <div className="absolute inset-0 bg-gradient-to-t from-red-900/20 to-transparent pointer-events-none z-0"></div>
            
            <div className="relative transition-transform duration-500 group-hover:scale-105" style={{ width: '128px', height: '192px', transform: 'scale(1.8)' }}>
                <div 
                    className="w-full h-full opacity-95"
                    style={{
                        backgroundImage: `url('${encodeURI(selectedChar.img)}')`,
                        backgroundSize: '1100% 400%',
                        backgroundPosition: '0% 0%',
                        backgroundRepeat: 'no-repeat'
                    }}
                />
                
                {face && (
                <div 
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-10 border-2 border-red-500 rounded-full shadow-[0_0_15px_rgba(255,0,0,0.8)] overflow-hidden" 
                    style={{ 
                        top: selectedChar.headPos.top,
                        left: selectedChar.headPos.left,
                        width: '80px', 
                        height: '80px'
                    }}
                >
                    <img src={face} alt="Rostro" className="w-full h-full object-cover" />
                </div>
                )}
            </div>
            
            <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 bg-red-600 px-3 py-0.5 md:px-4 md:py-1 text-base md:text-3xl font-['Bebas_Neue'] tracking-widest text-white shadow-lg border border-red-400 z-20">
              {selectedChar.name}
            </div>
          </div>

          {/* N-5: Show current avatar preview and allow upload - photo is optional */}
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-neutral-900/50 border border-neutral-800 rounded p-3">
              <div className="w-12 h-12 rounded-full border-2 border-red-500 overflow-hidden flex-shrink-0 shadow-[0_0_10px_rgba(255,0,0,0.3)]">
                {face && <img src={face} alt="Avatar" className="w-full h-full object-cover" />}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-['Bebas_Neue'] text-sm text-neutral-400 tracking-widest">
                  {hasCustomFace ? '✅ FOTO PROPIA' : '🎲 AVATAR ALEATORIO'}
                </span>
                <span className="text-xs text-neutral-600">Opcional — puedes subir tu propia foto</span>
              </div>
              <button
                onClick={() => { setFace(getRandomDicebearFace()); setHasCustomFace(false); }}
                className="text-xs font-['Bebas_Neue'] tracking-wider text-neutral-500 hover:text-white border border-neutral-700 hover:border-neutral-500 px-2 py-1 rounded transition-colors"
              >🎲</button>
            </div>
            <div 
              className="border-2 border-dashed border-neutral-700 hover:border-red-500 bg-neutral-900/30 hover:bg-red-900/10 p-3 rounded text-center cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 group" 
              onClick={() => document.getElementById('face-input').click()}
            >
              <span className="text-xl text-neutral-500 group-hover:text-red-400 transition-colors">📷</span>
              <p className="text-sm font-['Bebas_Neue'] tracking-widest text-neutral-400 group-hover:text-white transition-colors">SUBIR FOTO DE PERFIL (OPCIONAL)</p>
              <input type="file" id="face-input" hidden accept="image/*" onChange={handleFile} />
            </div>
          </div>

          {/* N-5: Button no longer requires photo - only points must be 0 */}
          <button 
            onClick={() => onReady(face, { ...selectedChar, stats, style })} 
            disabled={points > 0}
            className={`mt-4 w-full py-4 text-2xl md:text-4xl font-['Bebas_Neue'] tracking-widest rounded transition-all duration-300 relative overflow-hidden group
              ${points > 0 ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-gradient-to-r from-red-700 to-red-900 text-white border border-red-500 hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-[0_0_40px_rgba(255,0,0,0.6)]'}`}
          >
            <span className="relative z-10">{points > 0 ? `GASTA ${points} PTS MÁS` : '¡CONFIRMAR Y PELEAR!'}</span>
            {points === 0 && (
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            )}
            {points === 0 && (
              <span className="absolute z-10 inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">¡CONFIRMAR Y PELEAR!</span>
            )}
          </button>
        </div>

      </div>

      {/* CROPPER MODAL */}
      {showCropper && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in-up">
          <div className="relative w-full max-w-md aspect-square bg-neutral-900 rounded-lg overflow-hidden border-2 border-red-500 shadow-[0_0_30px_rgba(255,0,0,0.3)]">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
            />
          </div>
          <div className="mt-6 flex gap-4 w-full max-w-md">
             <button onClick={() => setShowCropper(false)} className="flex-1 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-['Bebas_Neue'] text-2xl tracking-widest rounded border border-neutral-600 transition-colors">
               CANCELAR
             </button>
             <button onClick={handleCropComplete} className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-['Bebas_Neue'] text-2xl tracking-widest rounded border border-red-400 shadow-[0_0_15px_rgba(255,60,60,0.5)] transition-colors">
               CONFIRMAR
             </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CharacterSelect;
