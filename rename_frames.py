import os
import glob

base_dir = r"c:\Users\Dilan\Documents\Proyectos\Amigo Fighter\client\public\assets"
folders = ["EL_AGRESIVO", "NINJA"]

for folder in folders:
    folder_path = os.path.join(base_dir, folder)
    if not os.path.exists(folder_path):
        print(f"Directory not found: {folder_path}")
        continue
        
    # Get all png files
    files = glob.glob(os.path.join(folder_path, "*.png"))
    
    # Filter files that contain 'Gemini' in their name
    files_to_rename = [f for f in files if "Gemini" in os.path.basename(f)]
    
    if not files_to_rename:
        print(f"No Gemini files to rename in {folder}")
        continue
        
    # Sort files by creation time (on Windows this works correctly for downloaded files)
    files_to_rename.sort(key=lambda x: os.path.getctime(x))
    
    print(f"Renaming {len(files_to_rename)} files in {folder}...")
    for i, old_path in enumerate(files_to_rename, start=1):
        # Using 2 digits (e.g., frame_01.png) so they order correctly alphabetically
        new_name = f"frame_{i:02d}.png"
        new_path = os.path.join(folder_path, new_name)
        
        # Prevent accidental overwrites if frame_XX.png already exists
        if os.path.exists(new_path):
            print(f"Warning: {new_name} already exists. Skipping.")
            continue
            
        try:
            os.rename(old_path, new_path)
        except Exception as e:
            print(f"Error renaming {old_path}: {e}")
            
    print(f"Finished {folder}.")
