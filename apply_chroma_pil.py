from PIL import Image
import glob
import os

images = glob.glob('client/public/assets/Gemini_Generated_Image_*.png')
target_names = ["EL NINJA.png", "LUCHADOR.png", "EL AGRESIVO.png", "EL CAMPEÓN.png"]

for i, path in enumerate(images):
    if i >= len(target_names): break
    
    img = Image.open(path).convert("RGBA")
    
    # Resize exactly to 1408x768 to match the 11x4 grid (128x192 frames)
    img = img.resize((1408, 768), Image.Resampling.LANCZOS)
    
    data = img.getdata()
    new_data = []
    
    # Simple chroma key: Green screen removal
    for item in data:
        r, g, b, a = item
        # If green is the dominant color
        if g > 100 and r < g * 0.85 and b < g * 0.85:
            new_data.append((255, 255, 255, 0)) # Transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    target_path = os.path.join('client/public/assets', target_names[i])
    img.save(target_path, "PNG")
    print(f"Processed {os.path.basename(path)} -> {target_names[i]}")

# Clean up unused old files
old_files = glob.glob('client/public/assets/*movimientos*') + glob.glob('client/public/assets/*removebg*')
for f in old_files:
    try: os.remove(f)
    except: pass

# Remove original Gemini files
for f in images:
    try: os.remove(f)
    except: pass
