# Cloudinary Custom Function: accessibility_analysis (Python version)
# Deploy: cloudinary functions:deploy accessibility_analysis --path ./cloudinary/functions_python
# Requirements: pip install -r requirements-python.txt

import json
import base64
import io
from PIL import Image, ImageDraw, ImageFont
import pytesseract
import cv2
import numpy as np

# WCAG 2.2 contrast ratios
MIN_CONTRAST = {
    'AA': {'normal': 4.5, 'large': 3.0},
    'AAA': {'normal': 7.0, 'large': 4.5},
}

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return '#{:02x}{:02x}{:02x}'.format(*rgb)

def relative_luminance(rgb):
    def channel(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = [channel(c) for c in rgb]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def contrast_ratio(fg_rgb, bg_rgb):
    l1 = relative_luminance(fg_rgb)
    l2 = relative_luminance(bg_rgb)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)

def sample_region(image_array, x, y, w, h, step=2):
    """Sample average color in region"""
    h_img, w_img = image_array.shape[:2]
    x = max(0, min(x, w_img - 1))
    y = max(0, min(y, h_img - 1))
    w = min(w, w_img - x)
    h = min(h, h_img - y)
    if w <= 0 or h <= 0:
        return np.array([0, 0, 0])
    region = image_array[y:y+h:step, x:x+w:step]
    return np.mean(region.reshape(-1, 3), axis=0)

def detect_text_regions(image_array):
    """Use Tesseract OCR to find text regions"""
    # Convert to RGB for tesseract
    if len(image_array.shape) == 3 and image_array.shape[2] == 3:
        rgb = image_array
    else:
        rgb = cv2.cvtColor(image_array, cv2.COLOR_BGR2RGB)
    
    # Run OCR
    data = pytesseract.image_to_data(rgb, output_type=pytesseract.Output.DICT)
    
    regions = []
    n_boxes = len(data['level'])
    for i in range(n_boxes):
        if int(data['conf'][i]) > 30:  # Filter low confidence
            x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
            text = data['text'][i].strip()
            if text and w > 5 and h > 5:
                regions.append({
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'text': text,
                    'font_size': h
                })
    return regions

def draw_annotations(image_array, violations):
    """Draw violation boxes on image"""
    annotated = image_array.copy()
    draw = ImageDraw.Draw(Image.fromarray(annotated))
    
    for v in violations:
        b = v['bounds']
        draw.rectangle([b['x'], b['y'], b['x']+b['width'], b['y']+b['height']], outline='red', width=3)
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except:
            font = ImageFont.load_default()
        draw.text((b['x'], max(0, b['y']-20)), f"{v['rule']} ({v['actualRatio']:.1f}:1)", fill='red', font=font)
    
    return np.array(annotated)

def apply_fixes(image_array, violations):
    """Apply color fixes to violations"""
    fixed = image_array.copy()
    
    for v in violations:
        if 'suggestedFg' not in v or 'bounds' not in v:
            continue
        target_rgb = hex_to_rgb(v['suggestedFg'])
        b = v['bounds']
        
        y_start, y_end = max(0, b['y']), min(fixed.shape[0], b['y'] + b['height'])
        x_start, x_end = max(0, b['x']), min(fixed.shape[1], b['x'] + b['width'])
        
        if y_start < y_end and x_start < x_end:
            # Only replace non-transparent pixels (alpha > 0.5)
            if fixed.shape[2] == 4:
                alpha = fixed[y_start:y_end, x_start:x_end, 3] / 255.0
                mask = alpha > 0.5
                fixed[y_start:y_end, x_start:x_end][mask] = target_rgb
            else:
                fixed[y_start:y_end, x_start:x_end] = target_rgb
    
    return fixed

def calculate_fix(fg_hex, bg_hex, required_ratio):
    """Calculate minimal color change to meet contrast"""
    fg_rgb = np.array(hex_to_rgb(fg_hex), dtype=float)
    bg_rgb = np.array(hex_to_rgb(bg_hex), dtype=float)
    current = contrast_ratio(fg_rgb, bg_rgb)
    
    if current >= required_ratio:
        return fg_hex
    
    # Binary search on lightness in OKLab-like space
    # Simple approach: scale towards white/black based on background
    bg_lum = relative_luminance(bg_rgb)
    target_lum = (bg_lum + 0.05) / required_ratio - 0.05
    current_lum = relative_luminance(fg_rgb)
    
    if current_lum > bg_lum:
        # Foreground lighter than background - make it lighter
        factor = target_lum / current_lum if current_lum > 0 else 1
        new_rgb = np.clip(fg_rgb * factor, 0, 255)
    else:
        # Foreground darker - make it darker
        factor = target_lum / current_lum if current_lum > 0 else 1
        new_rgb = np.clip(fg_rgb * factor, 0, 255)
    
    return rgb_to_hex(new_rgb.astype(int))

def handler(image_bytes, options=None):
    """Main handler for Cloudinary function"""
    if options is None:
        options = {}
    
    # Load image
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    image_array = np.array(img)
    h, w = image_array.shape[:2]
    
    # 1. Detect text regions via OCR
    text_regions = detect_text_regions(image_array)
    
    # 2. Analyze each text region for contrast
    violations = []
    
    for region in text_regions:
        if region['width'] < 5 or region['height'] < 5:
            continue
        
        # Sample foreground (text) and background
        fg = sample_region(image_array, region['x'], region['y'], region['width'], region['height'])
        bg_x = max(0, region['x'] - 5)
        bg_y = max(0, region['y'] - 5)
        bg = sample_region(image_array, bg_x, bg_y, region['width'] + 10, region['height'] + 10)
        
        fg_hex = rgb_to_hex(fg.astype(int))
        bg_hex = rgb_to_hex(bg.astype(int))
        ratio = contrast_ratio(fg.astype(int), bg.astype(int))
        
        is_large = region['font_size'] >= 18
        required = MIN_CONTRAST['AA']['large'] if is_large else MIN_CONTRAST['AA']['normal']
        
        if ratio < required:
            suggested_fg = calculate_fix(fg_hex, bg_hex, required)
            violations.append({
                'rule': '1.4.3',
                'severity': 'AA',
                'type': 'contrast',
                'bounds': region,
                'actualRatio': round(ratio, 2),
                'requiredRatio': required,
                'fgColor': fg_hex,
                'bgColor': bg_hex,
                'suggestedFg': suggested_fg,
                'confidence': 0.85,
            })
    
    # 3. Generate annotated and fixed images
    annotated_array = draw_annotations(image_array, violations)
    fixed_array = apply_fixes(image_array, violations)
    
    # Convert back to bytes
    def array_to_bytes(arr):
        out = io.BytesIO()
        Image.fromarray(arr).save(out, format='PNG')
        return out.getvalue()
    
    annotated_bytes = array_to_bytes(annotated_array)
    fixed_bytes = array_to_bytes(fixed_array)
    
    return {
        'violations': violations,
        'annotatedImage': base64.b64encode(annotated_bytes).decode('utf-8'),
        'fixedImage': base64.b64encode(fixed_bytes).decode('utf-8'),
        'metadata': {
            'width': w,
            'height': h,
            'textRegionsFound': len(text_regions),
            'analysisTimestamp': __import__('datetime').datetime.utcnow().isoformat() + 'Z'
        }
    }

# For local testing
if __name__ == '__main__':
    import sys
    with open(sys.argv[1], 'rb') as f:
        result = handler(f.read())
    print(json.dumps(result, indent=2))