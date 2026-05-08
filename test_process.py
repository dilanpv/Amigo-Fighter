import sys
from PIL import Image

def process_sheet(filepath):
    img = Image.open(filepath).convert("RGBA")
    data = img.load()
    width, height = img.size
    
    # 1. Remove green (Hue around 120, high saturation)
    # Simple color distance for green screen
    for y in range(height):
        for x in range(width):
            r, g, b, a = data[x, y]
            # If green is dominant
            if g > 100 and g > r * 1.3 and g > b * 1.3:
                data[x, y] = (0, 0, 0, 0)
    
    # 2. Slice and center
    cell_w = 128
    cell_h = 192
    cols = 11
    rows = 4
    
    new_img = Image.new("RGBA", (1408, 768), (0,0,0,0))
    
    for row in range(rows):
        for col in range(cols):
            box = (col*cell_w, row*cell_h, (col+1)*cell_w, (row+1)*cell_h)
            cell = img.crop(box)
            
            # Find bounding box of character in this cell
            bbox = cell.getbbox()
            if bbox:
                # Crop to character
                char_img = cell.crop(bbox)
                cw, ch = char_img.size
                
                # Center horizontally, align bottom
                # Assuming feet should be near the bottom, let's leave 10px padding at bottom
                new_x = (cell_w - cw) // 2
                new_y = cell_h - ch - 10
                
                # Prevent negative offsets if char is bigger than cell
                new_x = max(0, new_x)
                new_y = max(0, new_y)
                
                new_cell = Image.new("RGBA", (cell_w, cell_h), (0,0,0,0))
                # Resize if character is too big
                if cw > cell_w or ch > cell_h - 10:
                    char_img.thumbnail((cell_w, cell_h - 10), Image.Resampling.LANCZOS)
                    cw, ch = char_img.size
                    new_x = (cell_w - cw) // 2
                    new_y = cell_h - ch - 10
                    
                new_cell.paste(char_img, (new_x, new_y))
                new_img.paste(new_cell, (col*cell_w, row*cell_h))
                
    new_img.save("test_out.png")
    print("Done testing", filepath)

process_sheet("client/public/assets/EL CAMPEÓN.png")
