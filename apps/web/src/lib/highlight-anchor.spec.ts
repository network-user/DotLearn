import { describe, expect, it } from 'vitest';

import {
  HIGHLIGHT_MARK_ATTRIBUTE,
  applyHighlightMarks,
  captureSelectionContext,
  pruneHighlightMarks,
} from './highlight-anchor';

const buildRoot = (html: string): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
};

const markedText = (root: Element, id: string): string =>
  Array.from(root.querySelectorAll(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}="${id}"]`))
    .map((mark) => mark.textContent ?? '')
    .join('');

describe('applyHighlightMarks', () => {
  it('wraps an exact match in a mark element', () => {
    const root = buildRoot('<p>Indexes speed up reads at the cost of writes.</p>');
    const applied = applyHighlightMarks(root, [
      { id: 'h1', text: 'speed up reads', className: 'hl-yellow' },
    ]);
    expect(applied).toBe(1);
    expect(markedText(root, 'h1')).toBe('speed up reads');
    expect(root.querySelector('mark')?.className).toBe('hl-yellow');
    expect(root.textContent).toBe('Indexes speed up reads at the cost of writes.');
    root.remove();
  });

  it('matches across inline elements and collapsed whitespace shifts', () => {
    const root = buildRoot('<p>Hash tables give <code>O(1)</code>\n   average lookups.</p>');
    const applied = applyHighlightMarks(root, [
      { id: 'h2', text: 'give O(1) average', className: 'hl' },
    ]);
    expect(applied).toBe(1);
    expect(markedText(root, 'h2').replace(/\s+/g, ' ')).toBe('give O(1) average');
    root.remove();
  });

  it('skips silently when the stored text is gone', () => {
    const root = buildRoot('<p>Completely rewritten paragraph.</p>');
    const html = root.innerHTML;
    const applied = applyHighlightMarks(root, [
      { id: 'h3', text: 'text that no longer exists', className: 'hl' },
    ]);
    expect(applied).toBe(0);
    expect(root.innerHTML).toBe(html);
    root.remove();
  });

  it('disambiguates duplicate occurrences using stored context', () => {
    const root = buildRoot(
      '<p>First mention of the index here.</p><p>Second mention of the index at the end.</p>',
    );
    const applied = applyHighlightMarks(root, [
      {
        id: 'h4',
        text: 'the index',
        className: 'hl',
        prefix: 'Second mention of',
        suffix: 'at the end.',
      },
    ]);
    expect(applied).toBe(1);
    const mark = root.querySelector(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}="h4"]`);
    expect(mark?.closest('p')?.textContent).toContain('Second mention');
    root.remove();
  });

  it('updates the class of already-marked highlights instead of re-wrapping', () => {
    const root = buildRoot('<p>Stable anchor text lives here.</p>');
    applyHighlightMarks(root, [{ id: 'h5', text: 'anchor text', className: 'hl-a' }]);
    applyHighlightMarks(root, [{ id: 'h5', text: 'anchor text', className: 'hl-b' }]);
    const marks = root.querySelectorAll(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}="h5"]`);
    expect(marks.length).toBe(1);
    expect(marks[0]?.className).toBe('hl-b');
    root.remove();
  });
});

describe('pruneHighlightMarks', () => {
  it('unwraps marks that are no longer in the keep set and restores text', () => {
    const root = buildRoot('<p>Alpha beta gamma delta.</p>');
    applyHighlightMarks(root, [
      { id: 'keep', text: 'Alpha beta', className: 'hl' },
      { id: 'drop', text: 'gamma delta', className: 'hl' },
    ]);
    pruneHighlightMarks(root, new Set(['keep']));
    expect(root.querySelectorAll(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}="drop"]`).length).toBe(0);
    expect(root.querySelectorAll(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}="keep"]`).length).toBe(1);
    expect(root.textContent).toBe('Alpha beta gamma delta.');
    root.remove();
  });
});

describe('captureSelectionContext', () => {
  it('captures normalized text before and after the selection', () => {
    const root = buildRoot(
      '<p>Before words.</p><p>The chosen part sits here.</p><p>After words.</p>',
    );
    const target = root.querySelectorAll('p')[1]?.firstChild;
    expect(target).toBeTruthy();
    const range = document.createRange();
    range.setStart(target as Text, 4);
    range.setEnd(target as Text, 15);
    const context = captureSelectionContext(root, range);
    expect(context.prefix.endsWith('Before words.The')).toBe(true);
    expect(context.suffix.startsWith('sits here.After words.')).toBe(true);
    root.remove();
  });
});
