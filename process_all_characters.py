import os
from PIL import Image
import numpy as np

def process_character(input_dir, output_file, cols=11, rows=4, f_width=128, f_height=192):
    if not os.path.exists(input_dir):
        print(f"Directory {input_dir} does not exist. Skipping.")
        return
        
    print(f"Processing {input_dir}...")
    
    # Create the output image
    sheet_width = cols * f_width
    sheet_height = rows * f_height
    sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))
    
    # Get all frames, sorted
    files = sorted([f for f in os.listdir(input_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))])
    
    for i, file in enumerate(files):
        if i >= cols * rows:
            break
            
        filepath = os.path.join(input_dir, file)
        img = Image.open(filepath).convert('RGBA')
        
        # Resize to frame size
        img = img.resize((f_width, f_height), Image.Resampling.LANCZOS)
        
        # Process pixels to remove pure green (#00FF00) with tolerance
        data = np.array(img)
        r, g, b, a = data[:,:,0], data[:,:,1], data[:,:,2], data[:,:,3]
        
        # Green screen detection: green is high, red and blue are low
        green_mask = (g > 150) & (r < 120) & (b < 120) 
        
        # Set alpha to 0 for green pixels
        data[green_mask, 3] = 0
        
        img = Image.fromarray(data)
        
        # Calculate position
        row = i // cols
        col = i % cols
        x = col * f_width
        y = row * f_height
        
        # Paste into sheet
        sheet.paste(img, (x, y), img)
        
    # Save the output
    sheet.save(output_file)
    print(f"Saved to {output_file}")

if __name__ == '__main__':
    base_dir = r"c:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets"
    
    tasks = [
        ("NINJA", "EL_NINJA.png"),
        ("EL_AGRESIVO", "EL_AGRESIVO.png"),
        ("El_Campeon", "EL_CAMPEON.png"),
        ("El_Clasico", "EL_CLASICO.png"),
    ]
    
    for input_folder, output_name in tasks:
        input_path = os.path.join(base_dir, input_folder)
        output_path = os.path.join(base_dir, output_name)
        process_character(input_path, output_path)
    
    print("All characters processed successfully with clean names!")
