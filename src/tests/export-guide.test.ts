import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Elvanto export guide (public/index.html — the "How do I export these files
// from Elvanto?" button on the Import screen, and its sibling on the Connection
// Audit Data tab) is vanilla inline JS with no build step, so it can't be
// imported. Same approach as logo-crop-math.test.ts: extract the REAL function
// bodies out of the shipped HTML by name and evaluate them against a small DOM
// stub, so this exercises the actual shipped code rather than a copy that can
// drift.
//
// Regression guard for the 2026-07-30 bug: EXPORT_GUIDES was converted from a
// const object to a function (2026-07-12, so the guide copy could pick up
// customised labels at call time), but openExportGuide/_egGo/_egDraw kept
// indexing it as an object (`EXPORT_GUIDES[key]`), so opening either guide threw
// a TypeError and the button did nothing.
function extractFn(source: string, name: string): string {
  const re = new RegExp(`function ${name}\\([^)]*\\)\\s*\\{`);
  const m = re.exec(source);
  if (!m) throw new Error(`could not find function ${name} in index.html`);
  const start = m.index;
  let depth = 0;
  let i = start + m[0].length - 1; // at the opening '{'
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (depth === 0) break; }
  }
  return source.slice(start, i + 1);
}

type El = { textContent: string; innerHTML: string; disabled: boolean; scrollTop: number; onclick: null | (() => void); classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean } };

interface Harness {
  openExportGuide(key: string): void;
  closeExportGuide(): void;
  _egGo(d: number): void;
  els: Record<string, El>;
  shown(): boolean;
}

function buildHarness(): Harness {
  const html = readFileSync(join(__dirname, '../../public/index.html'), 'utf8');
  const dateNote = /const _EG_DATE_NOTE = [^\n]*\n/.exec(html);
  if (!dateNote) throw new Error('could not find _EG_DATE_NOTE in index.html');

  const src = [
    dateNote[0],
    extractFn(html, 'EXPORT_GUIDES'),
    extractFn(html, '_egGuide'),
    extractFn(html, 'openExportGuide'),
    extractFn(html, 'closeExportGuide'),
    extractFn(html, '_egGo'),
    extractFn(html, '_egDraw'),
  ].join('\n');

  const els: Record<string, El> = {};
  const mkEl = (): El => {
    const classes = new Set<string>();
    return {
      textContent: '', innerHTML: '', disabled: false, scrollTop: 0, onclick: null,
      classList: { add: (c) => { classes.add(c); }, remove: (c) => { classes.delete(c); }, contains: (c) => classes.has(c) },
    };
  };
  for (const id of ['egTitle', 'egX', 'egBody', 'egDots', 'egPrev', 'egNext', 'exportGuide']) els[id] = mkEl();

  const documentStub = { getElementById: (id: string) => els[id] ?? null };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function('document', 'L', 'icS', 'esc', `
    let _egKey = 'import', _egIdx = 0;
    ${src}
    return { openExportGuide, closeExportGuide, _egGo };
  `);

  const api = factory(
    documentStub,
    (k: string) => k,
    () => '',
    (s: string) => s,
  ) as Pick<Harness, 'openExportGuide' | 'closeExportGuide' | '_egGo'>;

  return { ...api, els, shown: () => els['egPrev'] !== undefined && els['exportGuide']!.classList.contains('show') };
}

describe('Elvanto export guide viewer', () => {
  let h: Harness;
  beforeAll(() => { h = buildHarness(); });

  it('opens the Import-screen guide without throwing', () => {
    expect(() => h.openExportGuide('import')).not.toThrow();
    expect(h.els['egTitle']!.textContent).toBe('Exporting from Elvanto');
    expect(h.shown()).toBe(true);
    // 2 steps -> 2 dots, Back disabled on the first, Next (not Done) showing.
    expect((h.els['egDots']!.innerHTML.match(/<i /g) ?? []).length).toBe(2);
    expect(h.els['egPrev']!.disabled).toBe(true);
    expect(h.els['egNext']!.textContent).toBe('Next');
    expect(h.els['egBody']!.innerHTML).toContain('Step 1 of 2');
  });

  it('opens the Connection Audit guide without throwing', () => {
    expect(() => h.openExportGuide('audit')).not.toThrow();
    expect(h.els['egTitle']!.textContent).toBe('Exporting the audit files');
    expect((h.els['egDots']!.innerHTML.match(/<i /g) ?? []).length).toBe(4);
    expect(h.els['egBody']!.innerHTML).toContain('Step 1 of 4');
  });

  it('steps forward and back, and shows Done on the last step', () => {
    h.openExportGuide('import');
    h._egGo(1);
    expect(h.els['egBody']!.innerHTML).toContain('Step 2 of 2');
    expect(h.els['egPrev']!.disabled).toBe(false);
    expect(h.els['egNext']!.textContent).toBe('Done');
    h._egGo(1); // past the end — no-op, must not throw
    expect(h.els['egBody']!.innerHTML).toContain('Step 2 of 2');
    h._egGo(-1);
    expect(h.els['egBody']!.innerHTML).toContain('Step 1 of 2');
  });

  it('falls back to the import guide for an unknown key', () => {
    expect(() => h.openExportGuide('nope')).not.toThrow();
    expect(h.els['egTitle']!.textContent).toBe('Exporting from Elvanto');
  });
});
