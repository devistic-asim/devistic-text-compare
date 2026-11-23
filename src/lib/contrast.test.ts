import { describe, expect, it } from 'vitest';

function channel(hex: string): number[] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function luminance(hex: string): number {
  const linear = channel(hex).map((part) => {
    const srgb = part / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pairs used by the UI. Brand green #20B683 is too light for white text or as
 * small text on the light background, so buttons use dark text and a darker edge.
 */
const textPairs: Array<[string, string, string]> = [
  ['navy on light bg', '#1E293B', '#F5F9FC'],
  ['navy on white', '#1E293B', '#FFFFFF'],
  ['slate on light bg', '#637285', '#F5F9FC'],
  ['slate on white', '#637285', '#FFFFFF'],
  ['button text on green', '#06281C', '#20B683'],
  ['removed text', '#7F1D1D', '#FDECEC'],
  ['removed token', '#7F1D1D', '#F6C1C1'],
  ['added text', '#145C3E', '#E5F7EF'],
  ['added token', '#145C3E', '#B7E8D2'],
  ['navy on yellow chip', '#1E293B', '#FFEB5B'],
  ['light text on dark bg', '#F5F9FC', '#0B1220'],
  ['light text on dark surface', '#F5F9FC', '#1E293B'],
  ['dark secondary', '#C5D0DC', '#0B1220'],
  ['dark secondary on surface', '#C5D0DC', '#1E293B'],
  ['dark removed text', '#FFD7D7', '#3F1D24'],
  ['dark removed token', '#FFD7D7', '#6E2A32'],
  ['dark added text', '#C8F8E4', '#12352A'],
  ['dark added token', '#C8F8E4', '#1C6B4A'],
  ['link on light', '#0E5A40', '#F5F9FC'],
  ['cyan link on dark', '#3BC1E6', '#0B1220'],
  ['cyan link on surface', '#3BC1E6', '#1E293B'],
];

describe('WCAG contrast', () => {
  it('keeps text pairs at AA 4.5:1', () => {
    for (const [name, foreground, background] of textPairs) {
      expect(contrast(foreground, background), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the focus and button edges at 3:1 against adjacent surfaces', () => {
    expect(contrast('#0E5A40', '#FFFFFF')).toBeGreaterThanOrEqual(3);
    expect(contrast('#0E5A40', '#F5F9FC')).toBeGreaterThanOrEqual(3);
    expect(contrast('#3BC1E6', '#0B1220')).toBeGreaterThanOrEqual(3);
    expect(contrast('#3BC1E6', '#1E293B')).toBeGreaterThanOrEqual(3);
    expect(contrast('#20B683', '#0B1220')).toBeGreaterThanOrEqual(3);
  });
});
