import os
from PIL import Image

def optimize_backgrounds(input_dir, output_dir, target_size=(800, 450)):
    if not os.path.exists(input_dir):
        print(f"Directory {input_dir} does not exist.")
        return
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    print(f"Optimizing backgrounds in {input_dir}...")
    
    files = [f for f in os.listdir(input_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    for file in files:
        filepath = os.path.join(input_dir, file)
        out_path = os.path.join(output_dir, file)
        
        img = Image.open(filepath).convert('RGB')
        img = img.resize(target_size, Image.Resampling.LANCZOS)
        
        # Save with optimization
        img.save(out_path, "JPEG", quality=85, optimize=True)
        print(f"Optimized {file} and saved as JPEG.")

if __name__ == '__main__':
    base_assets = r"c:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets"
    escenarios_dir = os.path.join(base_assets, "Escenarios")
    
    # We'll save them back in the same place but as smaller files
    # Actually, to keep .png extension (as coded in the game), we'll save as PNG but optimized
    # or we can change them to .jpg for even better compression.
    # Let's stick to PNG but smaller dimensions.
    
    files = [f for f in os.listdir(escenarios_dir) if f.lower().endswith('.png')]
    for file in files:
        path = os.path.join(escenarios_dir, file)
        img = Image.open(path)
        if img.size != (800, 450):
            print(f"Resizing {file}...")
            img = img.resize((800, 450), Image.Resampling.LANCZOS)
            img.save(path, optimize=True)
            
    print("Backgrounds optimized!")
