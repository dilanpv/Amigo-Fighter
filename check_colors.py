from PIL import Image

def analyze(filename):
    img = Image.open(filename).convert('RGBA')
    width, height = img.size
    print(f"File: {filename}, Size: {width}x{height}")
    
    # Check top-left 20x20 pixels
    colors = set()
    for y in range(20):
        for x in range(20):
            r,g,b,a = img.getpixel((x,y))
            colors.add((r,g,b,a))
    
    print("Top-left colors:")
    for c in sorted(colors):
        print(c)

analyze('client/public/assets/EL NINJA.png')
