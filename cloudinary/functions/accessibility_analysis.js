// Cloudinary Custom Function: accessibility_analysis
// Deploy: npx cloudinary functions:deploy accessibility_analysis --path ./cloudinary/functions

const { createCanvas, loadImage } = require('canvas');
const Tesseract = require('tesseract.js');

// WCAG 2.2 contrast ratios
const MIN_CONTRAST = {
  AA: { normal: 4.5, large: 3.0 },
  AAA: { normal: 7.0, large: 4.5 },
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance(rgb) {
  return rgb.map((c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
}

function contrastRatio(fg, bg) {
  const [L1, L2] = [fg, bg].map((rgb) => {
    const lin = relativeLuminance(rgb);
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  });
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

function rgbToHex(rgb) {
  return '#' + rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('');
}

function sampleRegion(imageData, x, y, width, height, imgWidth) {
  const samples = [];
  const step = Math.max(1, Math.floor(Math.sqrt(width * height / 100)));
  for (let sy = y; sy < y + height; sy += step) {
    for (let sx = x; sx < x + width; sx += step) {
      const idx = (sy * imgWidth + sx) * 4;
      if (idx + 3 < imageData.data.length) {
        samples.push([imageData.data[idx], imageData.data[idx + 1], imageData.data[idx + 2]]);
      }
    }
  }
  if (samples.length === 0) return [0, 0, 0];
  return samples.reduce((a, b) => a.map((v, i) => v + b[i]), [0, 0, 0]).map((v) => v / samples.length);
}

function detectTextRegions(canvas) {
  return new Promise((resolve) => {
    canvas.toBuffer((err, buffer) => {
      Tesseract.recognize(buffer, 'eng', { logger: () => {} })
        .then(({ data: { blocks } }) => {
          const regions = [];
          for (const block of blocks) {
            for (const par of block.paragraphs) {
              for (const line of par.lines) {
                regions.push({
                  x: line.bbox.x0,
                  y: line.bbox.y0,
                  width: line.bbox.x1 - line.bbox.x0,
                  height: line.bbox.y1 - line.bbox.y0,
                  text: line.text,
                  fontSize: line.bbox.y1 - line.bbox.y0,
                });
              }
            }
          }
          resolve(regions);
        })
        .catch(() => resolve([]));
    });
  });
}

function drawAnnotations(canvas, violations) {
  const ctx = canvas.getContext('2d');
  for (const v of violations) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(v.bounds.x, v.bounds.y, v.bounds.width, v.bounds.height);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.font = '14px Arial';
    ctx.fillText(`${v.rule} (${v.actualRatio?.toFixed(1)}:1)`, v.bounds.x, v.bounds.y - 5);
  }
  return canvas.toBuffer('image/png');
}

function applyFixes(canvas, violations) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (const v of violations) {
    if (!v.suggestedFg || !v.bounds) continue;
    const targetRgb = hexToRgb(v.suggestedFg);

    for (let y = v.bounds.y; y < v.bounds.y + v.bounds.height; y++) {
      for (let x = v.bounds.x; x < v.bounds.x + v.bounds.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const alpha = data[idx + 3] / 255;
        if (alpha > 0.5) {
          data[idx] = targetRgb[0];
          data[idx + 1] = targetRgb[1];
          data[idx + 2] = targetRgb[2];
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toBuffer('image/png');
}

function calculateFix(fgHex, bgHex, requiredRatio) {
  const fgRgb = hexToRgb(fgHex);
  const bgRgb = hexToRgb(bgHex);
  const currentRatio = contrastRatio(fgRgb, bgRgb);

  if (currentRatio >= requiredRatio) return fgHex;

  const bgLum = 0.2126 * (bgRgb[0] / 255) + 0.7152 * (bgRgb[1] / 255) + 0.0722 * (bgRgb[2] / 255);
  const targetLum = (bgLum + 0.05) / requiredRatio - 0.05;
  const factor = targetLum / (0.2126 * (fgRgb[0] / 255) + 0.7152 * (fgRgb[1] / 255) + 0.0722 * (fgRgb[2] / 255));

  const newRgb = fgRgb.map((c) => Math.min(255, c * factor));
  return rgbToHex(newRgb);
}

exports.handler = async function (imageBuffer, options = {}) {
  const img = await loadImage(imageBuffer);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  // 1. Detect text regions via OCR
  const textRegions = await detectTextRegions(canvas);

  // 2. Analyze each text region for contrast
  const violations = [];

  for (const region of textRegions) {
    if (region.width < 5 || region.height < 5) continue;

    // Sample foreground (text) and background
    const fg = sampleRegion(imageData, region.x, region.y, region.width, region.height, img.width);
    const bgX = Math.max(0, region.x - 5);
    const bgY = Math.max(0, region.y - 5);
    const bg = sampleRegion(imageData, bgX, bgY, region.width + 10, region.height + 10, img.width);

    const fgHex = rgbToHex(fg);
    const bgHex = rgbToHex(bg);
    const ratio = contrastRatio(fg, bg);

    const isLargeText = region.fontSize >= 18;
    const required = isLargeText ? MIN_CONTRAST.AA.large : MIN_CONTRAST.AA.normal;

    if (ratio < required) {
      const suggestedFg = calculateFix(fgHex, bgHex, required);
      violations.push({
        rule: '1.4.3',
        severity: 'AA',
        type: 'contrast',
        bounds: region,
        actualRatio: ratio,
        requiredRatio: required,
        fgColor: fgHex,
        bgColor: bgHex,
        suggestedFg,
        confidence: 0.85,
      });
    }
  }

  // 3. Generate annotated and fixed images
  const annotatedBuffer = drawAnnotations(canvas, violations);
  const fixedBuffer = applyFixes(canvas, violations);

  return {
    violations,
    annotatedImage: annotatedBuffer,
    fixedImage: fixedBuffer,
    metadata: {
      width: img.width,
      height: img.height,
      textRegionsFound: textRegions.length,
      analysisTimestamp: new Date().toISOString(),
    },
  };
};