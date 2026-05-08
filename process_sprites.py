import os
from PIL import Image

def process_character(input_dir, output_file, cols=11, rows=4, f_width=128, f_height=192):
    print(f"Processing {input_dir}...")
    
    # Create the output image
    sheet_width = cols * f_width
    sheet_height = rows * f_height
    sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))
    
    # Get all frames, sorted
    files = sorted([f for f in os.listdir(input_dir) if f.endswith('.png')])
    
    for i, file in enumerate(files):
        if i >= cols * rows:
            break
            
        filepath = os.path.join(input_dir, file)
        img = Image.open(filepath).convert('RGBA')
        
        # Resize to frame size
        img = img.resize((f_width, f_height), Image.Resampling.LANCZOS)
        
        # Process pixels to remove pure green (#00FF00)
        # We can use a tolerance for compression artifacts if needed, but assuming pure green.
        # It's safer to use a slight tolerance for green screens.
        data = img.getdata()
        new_data = []
        for item in data:
            # (r, g, b, a)
            # If it's very green
            if item[1] > 200 and item[0] < 50 and item[2] < 50:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)
                
        img.putdata(new_data)
        
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
    base_dir = r"C:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets"
    
    ninja_dir = os.path.join(base_dir, "NINJA")
    agresivo_dir = os.path.join(base_dir, "EL_AGRESIVO")
    
    ninja_out = os.path.join(base_dir, "EL NINJA.png")
    agresivo_out = os.path.join(base_dir, "EL AGRESIVO.png")
    
    process_character(ninja_dir, ninja_out)
    process_character(agresivo_dir, agresivo_out)
    
    print("Done!")
