import os
from PIL import Image
from rembg import remove, new_session

# We will process the images
files = ["EL NINJA.png", "LUCHADOR.png", "EL AGRESIVO.png", "EL CAMPEÓN.png"]
session = new_session('u2net') # default model

for f in files:
    path = f"client/public/assets/{f}"
    if not os.path.exists(path):
        print(f"Not found: {path}")
        continue
        
    print(f"Processing {path}...")
    
    # Open image
    img = Image.open(path)
    
    # 1. Resize to exactly 1408x768 (11 cols x 128px, 4 rows x 192px)
    print(f"  Resizing from {img.size} to 1408x768...")
    img = img.resize((1408, 768), Image.Resampling.LANCZOS)
    
    # 2. Remove background
    print("  Removing background...")
    img = remove(img, session=session)
    
    # 3. Save
    print("  Saving...")
    img.save(path)

print("Done processing all sprites!")
