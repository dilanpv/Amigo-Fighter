import os
from PIL import Image
import numpy as np

ASSETS_DIR = r'c:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets'
CHAR_FOLDERS = ['NINJA', 'El_Campeon', 'EL_AGRESIVO', 'El_Clasico']

def analyze_char(folder_name):
    char_dir = os.path.join(ASSETS_DIR, folder_name)
    if not os.path.exists(char_dir): return
    
    frames = sorted([f for f in os.listdir(char_dir) if f.endswith('.png')], 
                   key=lambda x: os.path.getctime(os.path.join(char_dir, x)))
    
    print(f"\n--- Análisis de Poses (Sin Fondo Verde) para {folder_name} ---")
    
    for i, f_name in enumerate(frames):
        img_path = os.path.join(char_dir, f_name)
        with Image.open(img_path) as img:
            img = img.convert('RGBA')
            data = np.array(img)
            
            # Identificar verde
            r = data[:,:,0]
            g = data[:,:,1]
            b = data[:,:,2]
            
            # Filtro de verde (ajustado para ser más permisivo si es necesario)
            green_mask = (r < 130) & (g > 170) & (b < 130)
            data[green_mask] = [0, 0, 0, 0]
            
            clean_img = Image.fromarray(data)
            bbox = clean_img.getbbox()
            
            if bbox:
                w = bbox[2] - bbox[0]
                h = bbox[3] - bbox[1]
                print(f"Idx {i:02d}: BBox={bbox} W={w} H={h} File={f_name}")
            else:
                print(f"Idx {i:02d}: VACÍO (Todo verde o transparente)")

if __name__ == "__main__":
    for char in CHAR_FOLDERS:
        analyze_char(char)
