const fs = require('fs');

// We'll read the first few bytes of the PNG to see if it has an alpha channel
// or we can just use a simple canvas check if we had canvas, but we don't.
// Let's just create a quick python or node script to check if there are any pixels with alpha < 255.
