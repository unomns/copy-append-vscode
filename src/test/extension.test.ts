// Integration tests: run the real commands inside a VS Code instance
// (`npm test`). Note: they use the real system clipboard.

import * as assert from 'assert';
import * as vscode from 'vscode';

const clipboard = vscode.env.clipboard;

/** Opens an untitled editor with the given lines and the given selections. */
async function openEditor(lines: string[], selections: vscode.Selection[], language = 'plaintext') {
	const doc = await vscode.workspace.openTextDocument({ content: lines.join('\n'), language });
	const editor = await vscode.window.showTextDocument(doc);
	editor.selections = selections;
	return editor;
}

const sel = (sl: number, sc: number, el: number, ec: number) => new vscode.Selection(sl, sc, el, ec);
const appendCmd = () => vscode.commands.executeCommand('copyAppend.append');

async function setConfig(key: string, value: unknown) {
	await vscode.workspace.getConfiguration('copyAppend').update(key, value, vscode.ConfigurationTarget.Global);
}

suite('Copy Append (integration)', () => {
	setup(async () => {
		await vscode.commands.executeCommand('copyAppend.clear');
	});

	teardown(async () => {
		await setConfig('separator', undefined);
		await setConfig('addFileHeader', undefined);
		await vscode.commands.executeCommand('workbench.action.closeAllEditors');
	});

	test('appends selections from several places', async () => {
		const editor = await openEditor(['alpha', 'beta', 'gamma'], [sel(0, 0, 0, 5)]);
		await appendCmd();
		editor.selections = [sel(2, 0, 2, 5)];
		await appendCmd();
		assert.strictEqual(await clipboard.readText(), 'alpha\ngamma');
	});

	test('no selection appends the current line', async () => {
		await openEditor(['alpha', 'beta'], [sel(1, 2, 1, 2)]);
		await appendCmd();
		assert.strictEqual(await clipboard.readText(), 'beta');
	});

	test('multiple cursors append in document order', async () => {
		await openEditor(['one', 'two', 'three'], [sel(2, 0, 2, 5), sel(0, 0, 0, 3)]);
		await appendCmd();
		assert.strictEqual(await clipboard.readText(), 'one\nthree');
	});

	test('a normal copy in between starts a new collection', async () => {
		const editor = await openEditor(['one', 'two'], [sel(0, 0, 0, 3)]);
		await appendCmd();
		await clipboard.writeText('copied normally');
		editor.selections = [sel(1, 0, 1, 3)];
		await appendCmd();
		assert.strictEqual(await clipboard.readText(), 'copied normally\ntwo');
	});

	test('separator setting with typed escapes', async () => {
		await setConfig('separator', '\\n---\\n');
		await openEditor(['a', 'b'], [sel(0, 0, 0, 1), sel(1, 0, 1, 1)]);
		await appendCmd();
		assert.strictEqual(await clipboard.readText(), 'a\n---\nb');
	});

	test('file header uses the language comment syntax', async () => {
		await setConfig('addFileHeader', true);
		const editor = await openEditor(['x = 1', 'y = 2'], [sel(0, 0, 1, 5)], 'python');
		await appendCmd();
		const name = vscode.workspace.asRelativePath(editor.document.uri);
		assert.strictEqual(await clipboard.readText(), `# ${name}:1-2\nx = 1\ny = 2`);
	});

	test('paste and clear inserts the collection, then starts fresh', async () => {
		const editor = await openEditor(['one', 'two', ''], [sel(0, 0, 0, 3), sel(1, 0, 1, 3)]);
		await appendCmd();
		editor.selections = [sel(2, 0, 2, 0)];
		await vscode.commands.executeCommand('copyAppend.pasteAndClear');
		assert.strictEqual(editor.document.lineAt(2).text + '\n' + editor.document.lineAt(3).text, 'one\ntwo');
		assert.strictEqual(await clipboard.readText(), '');
	});

	test('clear empties the clipboard', async () => {
		await openEditor(['a'], [sel(0, 0, 0, 1)]);
		await appendCmd();
		await vscode.commands.executeCommand('copyAppend.clear');
		assert.strictEqual(await clipboard.readText(), '');
	});
});
