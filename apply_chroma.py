import cv2
import numpy as np
import glob
import os

images = glob.glob('client/public/assets/Gemini_Generated_Image_*.png')
target_names = ["EL NINJA.png", "LUCHADOR.png", "EL AGRESIVO.png", "EL CAMPEÓN.png"]

for i, path in enumerate(images):
    if i >= len(target_names): break
    
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None: continue
    
    # Resize exactly to 1408x768 to match the 11x4 grid (128x192 frames)
    img = cv2.resize(img, (1408, 768), interpolation=cv2.INTER_AREA)
    
    if img.shape[2] == 4:
        bgr = img[:, :, :3]
    else:
        bgr = img
        
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    
    # Define range of green color in HSV
    lower_green = np.array([35, 40, 40])
    upper_green = np.array([85, 255, 255])
    
    # Threshold the HSV image to get only green colors
    mask = cv2.inRange(hsv, lower_green, upper_green)
    
    # Bitwise-NOT to invert mask (green becomes 0, everything else 255)
    mask_inv = cv2.bitwise_not(mask)
    
    # Clean up edges slightly to remove green halos
    kernel = np.ones((2,2),np.uint8)
    mask_inv = cv2.erode(mask_inv, kernel, iterations=1)
    
    # Merge back into BGRA
    b, g, r = cv2.split(bgr)
    dst = cv2.merge([b, g, r, mask_inv])
    
    target_path = os.path.join('client/public/assets', target_names[i])
    cv2.imwrite(target_path, dst)
    print(f"Processed {os.path.basename(path)} -> {target_names[i]}")

# Clean up unused old files
old_files = glob.glob('client/public/assets/*movimientos*') + glob.glob('client/public/assets/*removebg*')
for f in old_files:
    try: os.remove(f)
    except: pass
for f in images:
    try: os.remove(f)
    except: pass
