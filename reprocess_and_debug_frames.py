import os
from PIL import Image, ImageDraw, ImageFont
import glob

# Configuración
ASSETS_DIR = r'c:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets'
CHAR_FOLDERS = ['NINJA', 'El_Campeon', 'EL_AGRESIVO', 'El_Clasico']
OUTPUT_FILE_NAMES = {
    'NINJA': 'EL_NINJA.png',
    'El_Campeon': 'EL_CAMPEON.png',
    'EL_AGRESIVO': 'EL_AGRESIVO.png',
    'El_Clasico': 'EL_CLASICO.png'
}

def process_character(folder_name):
    char_dir = os.path.join(ASSETS_DIR, folder_name)
    if not os.path.exists(char_dir):
        print(f"Error: No existe el directorio {char_dir}")
        return

    # Obtener todos los archivos PNG
    frames = glob.glob(os.path.join(char_dir, "*.png"))
    
    # ORDENAR POR TIEMPO DE CREACIÓN (MÁS PROBABLE QUE SEA EL ORDEN DE SUBIDA)
    frames.sort(key=os.path.getctime)
    
    if not frames:
        print(f"No hay frames en {folder_name}")
        return

    print(f"Procesando {folder_name} ({len(frames)} frames) ordenados por tiempo...")

    # Configuración de la cuadrícula
    cols = 11
    rows = (len(frames) + cols - 1) // cols
    frame_w, frame_h = 128, 192
    
    spritesheet = Image.new('RGBA', (cols * frame_w, rows * frame_h), (0, 0, 0, 0))
    
    # También crearemos una versión "Debug" con el índice escrito
    debug_sheet = Image.new('RGBA', (cols * frame_w, rows * frame_h), (0, 0, 0, 255))
    draw = ImageDraw.Draw(debug_sheet)
    
    # Intentar cargar una fuente, si no usar la de sistema
    try:
        font = ImageFont.truetype("arial.ttf", 24)
    except:
        font = ImageFont.load_default()

    for i, frame_path in enumerate(frames):
        try:
            with Image.open(frame_path) as img:
                img = img.convert('RGBA')
                
                # Quitar fondo verde (asumiendo que los nuevos también tienen o para limpiar)
                data = img.getdata()
                new_data = []
                for item in data:
                    # Detectar verde brillante (R < 100, G > 180, B < 100)
                    if item[0] < 120 and item[1] > 180 and item[2] < 120:
                        new_data.append((0, 0, 0, 0))
                    else:
                        new_data.append(item)
                img.putdata(new_data)
                
                # Redimensionar al tamaño estándar de frame
                img = img.resize((frame_w, frame_h), Image.Resampling.LANCZOS)
                
                row = i // cols
                col = i % cols
                pos = (col * frame_w, row * frame_h)
                
                spritesheet.paste(img, pos, img)
                
                # Para el debug sheet
                debug_sheet.paste(img, pos, img)
                draw.text((pos[0] + 5, pos[1] + 5), str(i), fill="white", font=font)
                draw.rectangle([pos, (pos[0]+frame_w, pos[1]+frame_h)], outline="red")
        except Exception as e:
            print(f"Error procesando frame {frame_path}: {e}")

    # Guardar resultados
    output_path = os.path.join(ASSETS_DIR, OUTPUT_FILE_NAMES[folder_name])
    spritesheet.save(output_path)
    
    # Guardar debug sheet para que el usuario verifique los índices
    debug_path = os.path.join(ASSETS_DIR, f"DEBUG_{OUTPUT_FILE_NAMES[folder_name]}")
    debug_sheet.save(debug_path)
    
    print(f"Hecho: {OUTPUT_FILE_NAMES[folder_name]} generado y guardado en {output_path}")
    print(f"DEBUG: Generada hoja de índices en {debug_path} (¡REVISA ESTO!)")

if __name__ == "__main__":
    for folder in CHAR_FOLDERS:
        process_character(folder)
