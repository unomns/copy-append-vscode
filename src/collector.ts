// Pure logic for Copy Append.
//
// Nothing in this file imports 'vscode', so it can be unit-tested with plain
// mocha in Node. extension.ts is the thin layer that feeds it real editor data
// and writes the result to the system clipboard.

/** What the extension remembers between appends (one instance per window). */
export interface CollectorState {
	/** Exact text the extension last wrote to the clipboard, or undefined if never. */
	lastWritten: string | undefined;
	/** The collected parts, in order. Used for the counter and the preview. */
	parts: string[];
}

export function createState(): CollectorState {
	return { lastWritten: undefined, parts: [] };
}

/** Result of an append: the new clipboard text and the new state. */
export interface AppendResult {
	text: string;
	state: CollectorState;
	/** True when the clipboard no longer matched what we wrote, so counting restarted. */
	wasReset: boolean;
}

/**
 * Appends `newParts` to the current clipboard content.
 *
 * Reset detection: if the clipboard differs from what we last wrote, the user
 * copied something else in the meantime. That clipboard content becomes part 1
 * of a fresh collection (or nothing, if the clipboard is empty).
 */
export function append(
	clipboard: string,
	newParts: string[],
	separator: string,
	state: CollectorState,
): AppendResult {
	const wasReset = clipboard !== state.lastWritten;
	let parts: string[];
	if (wasReset) {
		parts = clipboard === '' ? [] : [clipboard];
	} else {
		parts = [...state.parts];
	}

	// Build on the clipboard text itself (not parts.join) so the existing
	// content is kept byte-for-byte, even if the separator setting changed.
	const pieces = clipboard === '' ? newParts : [clipboard, ...newParts];
	const text = pieces.join(separator);

	parts.push(...newParts);
	return { text, state: { lastWritten: text, parts }, wasReset };
}

/** State after "Copy Append: Clear" has emptied the clipboard. */
export function cleared(): CollectorState {
	return { lastWritten: '', parts: [] };
}

/**
 * True when the clipboard still holds what we last wrote. Used to hide a
 * stale counter after the user copied something else normally.
 */
export function isInSync(clipboard: string, state: CollectorState): boolean {
	return clipboard === state.lastWritten;
}

/**
 * Turns escape sequences typed in the Settings UI ("\n", "\t", "\r") into real
 * characters. In settings.json "\n" is already a newline, so this is harmless.
 */
export function parseSeparator(raw: string): string {
	return raw.replace(/\\(r|n|t|\\)/g, (_, ch: string) =>
		({ r: '\r', n: '\n', t: '\t', '\\': '\\' })[ch] as string,
	);
}

// ---------------------------------------------------------------------------
// Selections
// ---------------------------------------------------------------------------

/** Minimal position/selection shapes, structurally compatible with vscode's. */
export interface Pos {
	line: number;
	character: number;
}
export interface Sel {
	start: Pos;
	end: Pos;
	isEmpty: boolean;
}

/** Minimal document shape, so tests can pass a fake. */
export interface Doc {
	getRangeText(start: Pos, end: Pos): string;
	lineText(line: number): string;
}

/** One piece of text to append, with the (0-based) lines it came from. */
export interface Snippet {
	text: string;
	startLine: number;
	endLine: number;
}

/**
 * Turns the editor's selections into snippets, in document order
 * (selections are stored in the order they were created, not top-to-bottom).
 *
 * An empty selection (just a cursor) takes the whole line, like VS Code's
 * Copy. Several cursors on the same line take that line only once.
 */
export function selectionsToSnippets(selections: readonly Sel[], doc: Doc): Snippet[] {
	const sorted = [...selections].sort(
		(a, b) => a.start.line - b.start.line || a.start.character - b.start.character,
	);

	const snippets: Snippet[] = [];
	const linesTaken = new Set<number>();
	for (const sel of sorted) {
		if (sel.isEmpty) {
			const line = sel.start.line;
			if (linesTaken.has(line)) {
				continue;
			}
			linesTaken.add(line);
			snippets.push({ text: doc.lineText(line), startLine: line, endLine: line });
		} else {
			// A selection ending at column 0 (e.g. after selecting whole lines)
			// does not really include that last line, so leave it out of the range.
			const endLine =
				sel.end.character === 0 && sel.end.line > sel.start.line ? sel.end.line - 1 : sel.end.line;
			snippets.push({
				text: doc.getRangeText(sel.start, sel.end),
				startLine: sel.start.line,
				endLine,
			});
		}
	}
	return snippets;
}

// ---------------------------------------------------------------------------
// File headers
// ---------------------------------------------------------------------------

// Line comment syntax per language id. Anything not listed uses "//".
const HASH = ['python', 'shellscript', 'yaml', 'ruby', 'perl', 'r', 'dockerfile', 'makefile',
	'toml', 'powershell', 'coffeescript', 'julia', 'elixir', 'nix', 'properties', 'ignore', 'cmake'];
const DASH = ['sql', 'lua', 'haskell', 'elm', 'ada'];
const PERCENT = ['latex', 'tex', 'bibtex', 'matlab', 'erlang'];
const SEMI = ['clojure', 'lisp', 'scheme', 'ini'];
const BLOCK: Record<string, [string, string]> = {
	html: ['<!--', '-->'],
	xml: ['<!--', '-->'],
	xsl: ['<!--', '-->'],
	markdown: ['<!--', '-->'],
	vue: ['<!--', '-->'],
	svelte: ['<!--', '-->'],
	css: ['/*', '*/'],
};

/** Wraps `text` in a one-line comment suitable for the given language. */
export function commentLine(text: string, languageId: string): string {
	if (BLOCK[languageId]) {
		const [open, close] = BLOCK[languageId];
		return `${open} ${text} ${close}`;
	}
	if (HASH.includes(languageId)) {
		return `# ${text}`;
	}
	if (DASH.includes(languageId)) {
		return `-- ${text}`;
	}
	if (PERCENT.includes(languageId)) {
		return `% ${text}`;
	}
	if (SEMI.includes(languageId)) {
		return `; ${text}`;
	}
	if (languageId === 'bat') {
		return `REM ${text}`;
	}
	if (languageId === 'vb') {
		return `' ${text}`;
	}
	return `// ${text}`;
}

/**
 * Builds the header comment for a snippet, e.g. "// src/app.ts:10-14".
 * Lines are 0-based in, 1-based out (as shown in the editor).
 */
export function fileHeader(fileName: string, snippet: Snippet, languageId: string): string {
	const start = snippet.startLine + 1;
	const end = snippet.endLine + 1;
	const range = start === end ? `${start}` : `${start}-${end}`;
	return commentLine(`${fileName}:${range}`, languageId);
}
