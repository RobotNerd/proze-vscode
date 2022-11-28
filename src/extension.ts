import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('proze.compile', () => {
		vscode.window.showErrorMessage('Compile command not implemented');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
