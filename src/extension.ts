// Copy Append: collect text from several places into the clipboard,
// then paste it all at once with the normal Ctrl+V / Cmd+V.
//
// This file connects VS Code (editor, clipboard, settings, status bar) to the
// pure logic in collector.ts.

import * as vscode from 'vscode';
import {
	append,
	cleared,
	CollectorState,
	createState,
	fileHeader,
	isInSync,
	parseSeparator,
	selectionsToSnippets,
} from './collector';
import { CounterStatusBar, showPreview } from './statusBar';

const CMD_APPEND = 'copyAppend.append';
const CMD_CLEAR = 'copyAppend.clear';
const CMD_PASTE_CLEAR = 'copyAppend.pasteAndClear';
const CMD_PREVIEW = 'copyAppend.showCollected';

/** How often to check whether the clipboard was replaced, while collecting. */
const SYNC_INTERVAL_MS = 3000;

function config() {
	const cfg = vscode.workspace.getConfiguration('copyAppend');
	return {
		separator: parseSeparator(cfg.get<string>('separator', '\n')),
		addFileHeader: cfg.get<boolean>('addFileHeader', false),
		showStatusBar: cfg.get<boolean>('showStatusBar', true),
	};
}

export function activate(context: vscode.ExtensionContext) {
	let state: CollectorState = createState();
	const statusBar = new CounterStatusBar(CMD_PREVIEW);
	let syncTimer: ReturnType<typeof setInterval> | undefined;

	// Commands run one after another, so two quick presses can't both read
	// the clipboard before either has written it.
	let queue: Promise<void> = Promise.resolve();
	const serialized = (fn: () => Promise<void>) => (): Promise<void> => {
		queue = queue.then(fn, fn);
		return queue;
	};

	/** Refreshes the counter and starts/stops the clipboard watcher. */
	function render() {
		statusBar.update(state.parts.length, config().showStatusBar);
		const collecting = state.parts.length > 0;
		if (collecting && !syncTimer) {
			syncTimer = setInterval(checkSync, SYNC_INTERVAL_MS);
		} else if (!collecting && syncTimer) {
			clearInterval(syncTimer);
			syncTimer = undefined;
		}
	}

	/**
	 * If the user copied something else normally, the collection is over:
	 * forget it so the counter disappears. The next append will start again.
	 */
	async function checkSync() {
		if (state.parts.length > 0 && !isInSync(await vscode.env.clipboard.readText(), state)) {
			state = createState();
			render();
		}
	}

	async function copyAppend() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showInformationMessage('Copy Append: open a text editor first.');
			return;
		}
		const { separator, addFileHeader } = config();
		const doc = editor.document;

		const snippets = selectionsToSnippets(editor.selections, {
			getRangeText: (start, end) => doc.getText(new vscode.Range(start.line, start.character, end.line, end.character)),
			lineText: (line) => doc.lineAt(line).text,
		});

		const fileName = vscode.workspace.asRelativePath(doc.uri);
		const newParts = snippets.map((s) =>
			addFileHeader ? `${fileHeader(fileName, s, doc.languageId)}\n${s.text}` : s.text,
		);

		const clipboard = await vscode.env.clipboard.readText();
		const result = append(clipboard, newParts, separator, state);
		await vscode.env.clipboard.writeText(result.text);
		state = result.state;
		render();

		const n = state.parts.length;
		// After a normal copy, mention that the old collection was replaced.
		const note = result.wasReset && n > newParts.length ? ', new collection' : '';
		vscode.window.setStatusBarMessage(`$(clippy) Appended (${n} part${n === 1 ? '' : 's'}${note})`, 2500);
	}

	async function clear() {
		await vscode.env.clipboard.writeText('');
		state = cleared();
		render();
		vscode.window.setStatusBarMessage('$(clippy) Clipboard cleared', 2000);
	}

	/**
	 * Pastes the collected text, then clears, so the next append starts fresh.
	 * Uses VS Code's own paste so multi-cursor and formatting behave as usual.
	 */
	async function pasteAndClear() {
		await vscode.commands.executeCommand('editor.action.clipboardPasteAction');
		await clear();
	}

	async function preview() {
		await checkSync(); // don't show stale parts
		await showPreview(state.parts, state.lastWritten ?? '', serialized(clear));
	}

	context.subscriptions.push(
		statusBar,
		vscode.commands.registerCommand(CMD_APPEND, serialized(copyAppend)),
		vscode.commands.registerCommand(CMD_CLEAR, serialized(clear)),
		vscode.commands.registerCommand(CMD_PASTE_CLEAR, serialized(pasteAndClear)),
		vscode.commands.registerCommand(CMD_PREVIEW, preview),
		// Coming back to VS Code is a good moment to notice an outside copy.
		vscode.window.onDidChangeWindowState((e) => e.focused && checkSync()),
		vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('copyAppend') && render()),
		{ dispose: () => syncTimer && clearInterval(syncTimer) },
	);
}

export function deactivate() {}
