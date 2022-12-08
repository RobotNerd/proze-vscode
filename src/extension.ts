import { Config } from './config';
import { NameHighlighter, NameErrors } from './names';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('proze.compile', () => {
		vscode.window.showErrorMessage('Compile command not implemented');
	});

	context.subscriptions.push(disposable);

	const names = new NameHighlighter();
	names.activate(context);

	const nameErrors = new NameErrors();
	nameErrors.activate(context);

	Config.getInstance().load();
}

export function deactivate() {}
