// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPACT_QUERY } from './useMediaQuery';

describe('responsive chrome styles', () => {
  it('gives every map header, filter, result and overlay control a 44px touch target', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync('src/styles/kb.css', 'utf8');
    document.head.append(style);
    const rules = [...style.sheet!.cssRules].filter(rule => rule instanceof CSSStyleRule) as CSSStyleRule[];
    const fixture = document.createElement('section');
    fixture.className = 'kb-map';
    fixture.innerHTML = '<div class="kb-controls"><div class="kb-search"><input class="input"><div class="kb-search-results"><button class="kb-list-item">Result</button></div></div><select class="input kb-page-filter"></select><button class="btn">Fit</button></div><div class="kb-filters"><button class="chip">mentions</button><div class="kb-focus"><div class="seg seg-sm"><button role="radio">1 hop</button></div><button class="btn ghost">Clear focus</button></div></div><div class="kb-map-zoom"><button class="btn">−</button><button class="btn">+</button></div><aside class="kb-detail"><button class="btn btn-icon">Close</button><button class="kb-source">Source</button></aside>';
    try {
      for (const element of fixture.querySelectorAll('button,input,select')) {
        const matching = rules.filter(rule => element.matches(rule.selectorText));
        expect(matching.some(rule => parseFloat(rule.style.getPropertyValue('min-height')) >= 44), element.outerHTML).toBe(true);
        expect(matching.some(rule => parseFloat(rule.style.getPropertyValue('min-width')) >= 44), element.outerHTML).toBe(true);
        expect(matching.some(rule => parseFloat(rule.style.getPropertyValue('min-height')) < 44), element.outerHTML).toBe(false);
      }
    } finally { style.remove(); }
  });

  it('sizes every header/toolbar button and the title input for touch at the compact breakpoint or with a coarse pointer', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync('src/styles/chrome.css', 'utf8');
    document.head.append(style);
    const media = [...style.sheet!.cssRules].find(rule => rule instanceof CSSMediaRule && rule.conditionText.includes('(pointer: coarse)') && rule.conditionText.includes(COMPACT_QUERY)) as CSSMediaRule;
    expect(media).toBeDefined();
    const rules = [...media.cssRules] as CSSStyleRule[];
    const fixture = document.createElement('div');
    fixture.innerHTML = '<header class="topbar"><button class="btn btn-icon"></button><div class="tools-inline"><div class="seg"><button role="radio"></button></div></div><input class="title-input"><div class="status-pill"><button class="btn status-retry"></button></div></header><nav class="toolstrip"><button class="btn btn-icon"></button><div class="seg"><button role="radio"></button></div></nav>';
    for (const bar of fixture.querySelectorAll('.topbar,.toolstrip')) {
      const token = rules.find(rule => bar.matches(rule.selectorText) && rule.style.getPropertyValue('--tap'))!;
      expect(parseFloat(token.style.getPropertyValue('--tap'))).toBeGreaterThanOrEqual(44);
    }
    for (const element of fixture.querySelectorAll('button,input')) {
      const matching = rules.filter(rule => element.matches(rule.selectorText));
      expect(matching.some(rule => rule.style.getPropertyValue('min-height') === 'var(--tap)')).toBe(true);
      expect(matching.some(rule => rule.style.getPropertyValue('min-width') === 'var(--tap)')).toBe(true);
    }
    style.remove();
  });
});
