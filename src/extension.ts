import * as vscode from 'vscode';
import { NameHighlighter } from './names';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('proze.compile', () => {
		vscode.window.showErrorMessage('Compile command not implemented');
	});

	context.subscriptions.push(disposable);

	const names = new NameHighlighter();
	names.activate(context);
}

export function deactivate() {}
