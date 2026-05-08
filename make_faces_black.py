from PIL import Image
import os

def process_image(file_path, is_sprite=True):
    print(f"Procesando: {file_path}")
    try:
        img = Image.open(file_path).convert("RGBA")
    except Exception as e:
        print(f"Error al abrir {file_path}: {e}")
        return

    width, height = img.size
    pixels = img.load()
    
    # Umbral equilibrado: lo suficientemente alto para no coger piel/músculos, 
    # pero lo suficientemente bajo para coger el blanco de la cara.
    threshold = 190 

    if is_sprite:
        cols, rows = 11, 4
        fw, fh = width // cols, height // rows
        
        for r in range(rows):
            for c in range(cols):
                x_start, y_start = c * fw, r * fh
                
                # ROI MÁS PRECISA para evitar hombros y brazos
                # El Ninja tiene el blanco solo en la máscara central.
                # El Campeón tiene hombros anchos, así que estrechamos el área X.
                roi_x1 = x_start + int(fw * 0.40) # Más estrecho (antes 0.15)
                roi_x2 = x_start + int(fw * 0.60) # Más estrecho (antes 0.85)
                roi_y1 = y_start + int(fh * 0.08)
                roi_y2 = y_start + int(fh * 0.28) # Más corto (antes 0.45) para no tocar pecho
                
                for y in range(roi_y1, roi_y2):
                    for x in range(roi_x1, roi_x2):
                        r_val, g_val, b_val, a_val = pixels[x, y]
                        if a_val > 0 and r_val > threshold and g_val > threshold and b_val > threshold:
                            pixels[x, y] = (0, 0, 0, a_val)
    else:
        # Retratos de selección: El área de la cara suele ser más grande.
        # Ajustamos para ser más específicos en el centro superior.
        for y in range(int(height * 0.1), int(height * 0.35)):
            for x in range(int(width * 0.35), int(width * 0.65)):
                r_val, g_val, b_val, a_val = pixels[x, y]
                if a_val > 0 and r_val > threshold and g_val > threshold and b_val > threshold:
                    pixels[x, y] = (0, 0, 0, a_val)

    img.save(file_path, "PNG")
    print(f"Finalizado: {file_path}")

assets_dir = "client/public/assets"
if not os.path.exists(assets_dir):
    assets_dir = "client/src/assets"

sprites = ["LUCHADOR.png", "EL AGRESIVO.png", "EL NINJA.png", "EL CAMPEÓN.png"]
for s in sprites:
    path = os.path.join(assets_dir, s)
    if os.path.exists(path):
        process_image(path, is_sprite=True)

portraits = [
    "El_Ninja_seleccion.png",
    "El_Campeón_seleccion.png",
    "El_Agresivo_seleccion.png",
    "Luchador_seleccion.png"
]
for p in portraits:
    path = os.path.join(assets_dir, p)
    if os.path.exists(path):
        process_image(path, is_sprite=False)
    else:
        alt_p = p.replace('ó', 'o').replace('é', 'e')
        alt_path = os.path.join(assets_dir, alt_p)
        if os.path.exists(alt_path):
            process_image(alt_path, is_sprite=False)
