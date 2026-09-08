export interface OKLab {
  L: number;
  a: number;
  b: number;
}

export function hexToOKLab(hex: string): OKLab {
  const rgb = hexToRgb(hex);
  const linear = rgb.map((c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const l = 0.4124564 * linear[0] + 0.3575761 * linear[1] + 0.1804375 * linear[2];
  const m = 0.2126729 * linear[0] + 0.7151522 * linear[1] + 0.072175 * linear[2];
  const s = 0.0193339 * linear[0] + 0.119192 * linear[1] + 0.9503041 * linear[2];
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, a, b };
}

export function OKLabToHex({ L, a, b }: OKLab): string {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const rgb = linear.map((c) => {
    c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(255, c * 255)));
  });
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex: string): number[] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

export function contrastRatio(fg: OKLab, bg: OKLab): number {
  const L1 = fg.L;
  const L2 = bg.L;
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

export interface ColorFixResult {
  fixedHex: string;
  actualRatio: number;
  deltaE: number;
}

export function calculateContrastFix(
  fgHex: string,
  bgHex: string,
  requiredRatio: number,
): ColorFixResult {
  const fgOKLab = hexToOKLab(fgHex);
  const bgOKLab = hexToOKLab(bgHex);
  const currentRatio = contrastRatio(fgOKLab, bgOKLab);

  if (currentRatio >= requiredRatio) {
    return { fixedHex: fgHex, actualRatio: currentRatio, deltaE: 0 };
  }

  let low = 0;
  let high = 1;
  let best = fgOKLab;

  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    const testOKLab = { ...fgOKLab, L: mid };
    const ratio = contrastRatio(testOKLab, bgOKLab);

    if (ratio >= requiredRatio) {
      best = testOKLab;
      if (fgOKLab.L > bgOKLab.L) high = mid;
      else low = mid;
    } else {
      if (fgOKLab.L > bgOKLab.L) low = mid;
      else high = mid;
    }
  }

  const fixedHex = OKLabToHex(best);
  const deltaE = Math.sqrt(
    Math.pow(best.L - fgOKLab.L, 2) + Math.pow(best.a - fgOKLab.a, 2) + Math.pow(best.b - fgOKLab.b, 2),
  );

  return { fixedHex, actualRatio: requiredRatio, deltaE };
}

export function getRequiredRatio(fontSize: number, isBold: boolean, level: 'AA' | 'AAA' = 'AA'): number {
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && isBold);
  if (level === 'AAA') return isLargeText ? 4.5 : 7.0;
  return isLargeText ? 3.0 : 4.5;
}