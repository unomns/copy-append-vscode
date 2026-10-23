import * as vscode from 'vscode';

/** Status bar counter ("$(clippy) 3"). Hidden when nothing is collected. */
export class CounterStatusBar implements vscode.Disposable {
	private readonly item: vscode.StatusBarItem;

	constructor(clickCommand: string) {
		this.item = vscode.window.createStatusBarItem('copyAppend.counter', vscode.StatusBarAlignment.Right, 100);
		this.item.name = 'Copy Append';
		this.item.command = clickCommand;
	}

	update(count: number, enabled: boolean): void {
		if (!enabled || count === 0) {
			this.item.hide();
			return;
		}
		this.item.text = `$(clippy) ${count}`;
		this.item.tooltip = `Copy Append: ${count} part${count === 1 ? '' : 's'} collected. Click to preview.`;
		this.item.show();
	}

	dispose(): void {
		this.item.dispose();
	}
}

/** First line of a part, shortened, for the preview list. */
function summarize(part: string): string {
	const firstLine = part.split(/\r?\n/).find((l) => l.trim() !== '') ?? '(blank)';
	const trimmed = firstLine.trim();
	return trimmed.length > 80 ? trimmed.slice(0, 79) + '…' : trimmed;
}

/**
 * Shows the collected parts in a Quick Pick, with "Clear" and
 * "Open in Editor" actions at the top.
 */
export async function showPreview(parts: string[], fullText: string, onClear: () => Promise<void>): Promise<void> {
	if (parts.length === 0) {
		vscode.window.showInformationMessage('Copy Append: nothing collected.');
		return;
	}

	type Item = vscode.QuickPickItem & { action?: 'clear' | 'open' };
	const items: Item[] = [
		{ label: '$(trash) Clear', description: 'Empty the clipboard and reset the counter', action: 'clear' },
		{ label: '$(go-to-file) Open in Editor', description: 'Show the full collected text', action: 'open' },
		{ label: 'Collected parts', kind: vscode.QuickPickItemKind.Separator },
		...parts.map((part, i) => {
			const lines = part.split(/\r?\n/).length;
			return {
				label: `${i + 1}. ${summarize(part)}`,
				description: lines > 1 ? `${lines} lines` : undefined,
			};
		}),
	];

	const picked = await vscode.window.showQuickPick(items, {
		title: `Copy Append: ${parts.length} part${parts.length === 1 ? '' : 's'}`,
		placeHolder: 'Paste with Ctrl+V / Cmd+V, or pick an action',
	});

	if (picked?.action === 'clear') {
		await onClear();
	} else if (picked?.action === 'open') {
		const doc = await vscode.workspace.openTextDocument({ content: fullText });
		await vscode.window.showTextDocument(doc, { preview: true });
	}
}
