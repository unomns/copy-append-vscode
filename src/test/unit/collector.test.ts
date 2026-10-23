// Unit tests for the pure logic in collector.ts.
// They run in plain Node (`npm run test:unit`), without starting VS Code.

import * as assert from 'assert';
import {
	append,
	cleared,
	commentLine,
	createState,
	Doc,
	fileHeader,
	isInSync,
	parseSeparator,
	Sel,
	selectionsToSnippets,
} from '../../collector';

/** Fake document backed by an array of lines. */
function fakeDoc(lines: string[]): Doc {
	const text = lines.join('\n');
	const offset = (p: { line: number; character: number }) =>
		lines.slice(0, p.line).reduce((n, l) => n + l.length + 1, 0) + p.character;
	return {
		getRangeText: (start, end) => text.slice(offset(start), offset(end)),
		lineText: (line) => lines[line],
	};
}

/** Builds a selection from (line, char) to (line, char). */
function sel(sl: number, sc: number, el: number, ec: number): Sel {
	return {
		start: { line: sl, character: sc },
		end: { line: el, character: ec },
		isEmpty: sl === el && sc === ec,
	};
}

suite('append', () => {
	test('first append on an empty clipboard has one part', () => {
		const r = append('', ['a'], '\n', createState());
		assert.strictEqual(r.text, 'a');
		assert.deepStrictEqual(r.state.parts, ['a']);
	});

	test('appends to what we wrote last and keeps counting', () => {
		let r = append('', ['a'], '\n', createState());
		r = append(r.text, ['b'], '\n', r.state);
		r = append(r.text, ['c'], '\n', r.state);
		assert.strictEqual(r.text, 'a\nb\nc');
		assert.strictEqual(r.state.parts.length, 3);
		assert.strictEqual(r.wasReset, false);
	});

	test('several parts at once (multi-cursor) count individually', () => {
		const r = append('', ['a', 'b', 'c'], '\n', createState());
		assert.strictEqual(r.text, 'a\nb\nc');
		assert.strictEqual(r.state.parts.length, 3);
	});

	test('remembers the text it wrote', () => {
		const r = append('', ['a'], '\n', createState());
		assert.strictEqual(r.state.lastWritten, 'a');
		assert.ok(isInSync('a', r.state));
		assert.ok(!isInSync('other', r.state));
	});
});

suite('separators', () => {
	test('custom separator is used between parts', () => {
		let r = append('', ['a'], '\n---\n', createState());
		r = append(r.text, ['b'], '\n---\n', r.state);
		assert.strictEqual(r.text, 'a\n---\nb');
	});

	test('empty separator concatenates directly', () => {
		let r = append('', ['a'], '', createState());
		r = append(r.text, ['b'], '', r.state);
		assert.strictEqual(r.text, 'ab');
	});

	test('changing the separator does not rewrite earlier parts', () => {
		let r = append('', ['a', 'b'], '\n', createState());
		r = append(r.text, ['c'], ' | ', r.state);
		assert.strictEqual(r.text, 'a\nb | c');
	});

	test('parseSeparator turns typed escapes into characters', () => {
		assert.strictEqual(parseSeparator('\\n'), '\n');
		assert.strictEqual(parseSeparator('\\n\\n'), '\n\n');
		assert.strictEqual(parseSeparator('\\t'), '\t');
		assert.strictEqual(parseSeparator('\\r\\n'), '\r\n');
		assert.strictEqual(parseSeparator('\\\\n'), '\\n'); // escaped backslash stays literal
		assert.strictEqual(parseSeparator('\n'), '\n'); // real newline untouched
		assert.strictEqual(parseSeparator(', '), ', ');
	});
});

suite('reset detection', () => {
	test('foreign clipboard content becomes part 1', () => {
		let r = append('', ['a'], '\n', createState());
		r = append('copied elsewhere', ['b'], '\n', r.state);
		assert.strictEqual(r.wasReset, true);
		assert.strictEqual(r.text, 'copied elsewhere\nb');
		assert.deepStrictEqual(r.state.parts, ['copied elsewhere', 'b']);
	});

	test('non-empty clipboard on first use counts as part 1', () => {
		const r = append('existing', ['a'], '\n', createState());
		assert.strictEqual(r.wasReset, true);
		assert.strictEqual(r.text, 'existing\na');
		assert.strictEqual(r.state.parts.length, 2);
	});

	test('clipboard emptied externally restarts from zero', () => {
		let r = append('', ['a'], '\n', createState());
		r = append('', ['b'], '\n', r.state);
		assert.strictEqual(r.wasReset, true);
		assert.strictEqual(r.text, 'b');
		assert.strictEqual(r.state.parts.length, 1);
	});

	test('after Clear, the next append starts a fresh collection', () => {
		const r = append('', ['a'], '\n', cleared());
		assert.strictEqual(r.wasReset, false);
		assert.strictEqual(r.text, 'a');
		assert.strictEqual(r.state.parts.length, 1);
	});
});

suite('multi-selection', () => {
	const doc = fakeDoc(['zero', 'one', 'two', 'three']);

	test('selections are taken in document order, not creation order', () => {
		const snippets = selectionsToSnippets([sel(2, 0, 2, 3), sel(0, 0, 0, 4)], doc);
		assert.deepStrictEqual(snippets.map((s) => s.text), ['zero', 'two']);
	});

	test('empty selection takes the whole line', () => {
		const snippets = selectionsToSnippets([sel(1, 2, 1, 2)], doc);
		assert.deepStrictEqual(snippets, [{ text: 'one', startLine: 1, endLine: 1 }]);
	});

	test('several cursors on one line take it once', () => {
		const snippets = selectionsToSnippets([sel(1, 0, 1, 0), sel(1, 2, 1, 2)], doc);
		assert.strictEqual(snippets.length, 1);
	});

	test('mix of cursors and selections', () => {
		const snippets = selectionsToSnippets([sel(3, 1, 3, 1), sel(0, 1, 0, 3)], doc);
		assert.deepStrictEqual(snippets.map((s) => s.text), ['er', 'three']);
	});

	test('multi-line selection keeps its line range', () => {
		const [s] = selectionsToSnippets([sel(1, 0, 2, 3)], doc);
		assert.strictEqual(s.text, 'one\ntwo');
		assert.strictEqual(s.startLine, 1);
		assert.strictEqual(s.endLine, 2);
	});

	test('selection ending at column 0 excludes that line from the range', () => {
		const [s] = selectionsToSnippets([sel(1, 0, 3, 0)], doc);
		assert.strictEqual(s.text, 'one\ntwo\n');
		assert.strictEqual(s.endLine, 2);
	});
});

suite('file headers', () => {
	test('single line and ranges are 1-based', () => {
		assert.strictEqual(
			fileHeader('src/a.ts', { text: '', startLine: 0, endLine: 0 }, 'typescript'),
			'// src/a.ts:1',
		);
		assert.strictEqual(
			fileHeader('src/a.ts', { text: '', startLine: 9, endLine: 13 }, 'typescript'),
			'// src/a.ts:10-14',
		);
	});

	test('comment syntax follows the language', () => {
		assert.strictEqual(commentLine('x', 'python'), '# x');
		assert.strictEqual(commentLine('x', 'sql'), '-- x');
		assert.strictEqual(commentLine('x', 'html'), '<!-- x -->');
		assert.strictEqual(commentLine('x', 'css'), '/* x */');
		assert.strictEqual(commentLine('x', 'unknown-language'), '// x');
	});
});
