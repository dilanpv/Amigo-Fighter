"""
Mask ONLY the face region of character sprites to black.
Targets the skin-colored / white face area in the upper head portion.
Does NOT touch the body, clothes, or any other area.
"""
import os
import numpy as np
from PIL import Image

def mask_face_region(img, f_width=128, f_height=192):
    """
    Mask the face area of a single frame to black.
    The face is located in the upper portion of the sprite (roughly y=15 to y=55),
    centered horizontally (roughly x=35 to x=93).
    We only darken pixels that are light-colored (skin/white tones).
    """
    data = np.array(img)
    
    # Face region bounds (tuned for 128x192 frames)
    face_top = 12
    face_bottom = 55
    face_left = 30
    face_right = 98
    
    # Extract the face region
    region = data[face_top:face_bottom, face_left:face_right]
    r, g, b, a = region[:,:,0], region[:,:,1], region[:,:,2], region[:,:,3]
    
    # Detect "skin" or "white/light" pixels in the face area
    # These are pixels that are: bright (high luminance), not too saturated, and visible (alpha > 0)
    brightness = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
    
    # Target light pixels (skin tones, white, beige) but not pure black or very dark colors
    # Also avoid touching hair/mask accessories that might be colorful
    is_light = brightness > 140
    is_visible = a > 50
    
    # Additional: skip very saturated colors (hair, accessories) 
    max_channel = np.maximum(np.maximum(r.astype(int), g.astype(int)), b.astype(int))
    min_channel = np.minimum(np.minimum(r.astype(int), g.astype(int)), b.astype(int))
    saturation = max_channel - min_channel
    is_not_saturated = saturation < 120  # Skip vivid colored pixels
    
    mask = is_light & is_visible & is_not_saturated
    
    # Apply black mask
    region[mask, 0] = 15  # R - very dark gray, not pure black for slight depth
    region[mask, 1] = 15  # G
    region[mask, 2] = 20  # B - slight blue tint for "shadow" feel
    
    data[face_top:face_bottom, face_left:face_right] = region
    return Image.fromarray(data)


def process_character_folder(folder_path):
    """Process all individual frames in a character folder."""
    if not os.path.exists(folder_path):
        print(f"  Folder not found: {folder_path}")
        return 0
    
    count = 0
    for f in sorted(os.listdir(folder_path)):
        if not f.lower().endswith('.png'):
            continue
        filepath = os.path.join(folder_path, f)
        try:
            img = Image.open(filepath).convert('RGBA')
            img = mask_face_region(img)
            img.save(filepath)
            count += 1
        except Exception as e:
            print(f"  Error processing {f}: {e}")
    return count


def process_selection_image(filepath):
    """Process a selection portrait image (different dimensions)."""
    if not os.path.exists(filepath):
        print(f"  Selection image not found: {filepath}")
        return
    
    img = Image.open(filepath).convert('RGBA')
    w, h = img.size
    data = np.array(img)
    
    # Selection images are full character portraits, face is in upper ~30%
    face_top = int(h * 0.06)
    face_bottom = int(h * 0.30)
    face_left = int(w * 0.22)
    face_right = int(w * 0.78)
    
    region = data[face_top:face_bottom, face_left:face_right]
    r, g, b, a = region[:,:,0], region[:,:,1], region[:,:,2], region[:,:,3]
    
    brightness = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
    is_light = brightness > 140
    is_visible = a > 50
    
    max_channel = np.maximum(np.maximum(r.astype(int), g.astype(int)), b.astype(int))
    min_channel = np.minimum(np.minimum(r.astype(int), g.astype(int)), b.astype(int))
    saturation = max_channel - min_channel
    is_not_saturated = saturation < 120
    
    mask = is_light & is_visible & is_not_saturated
    
    region[mask, 0] = 15
    region[mask, 1] = 15
    region[mask, 2] = 20
    
    data[face_top:face_bottom, face_left:face_right] = region
    img = Image.fromarray(data)
    img.save(filepath)
    print(f"  Masked selection: {os.path.basename(filepath)}")


if __name__ == '__main__':
    base = r"c:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets"
    
    # 1. Process individual frame folders
    folders = ['NINJA', 'EL_AGRESIVO', 'El_Campeon', 'El_Clasico']
    for folder in folders:
        path = os.path.join(base, folder)
        count = process_character_folder(path)
        print(f"Masked {count} frames in {folder}")
    
    # 2. Process selection portrait images
    selection_images = [
        'El_Ninja_seleccion.png',
        'El_Agresivo_seleccion.png', 
        'El_Campeón_seleccion.png',
        'Luchador_seleccion.png'
    ]
    for sel in selection_images:
        process_selection_image(os.path.join(base, sel))
    
    print("\n✅ Face masking complete! Now run process_all_characters.py to rebuild spritesheets.")
