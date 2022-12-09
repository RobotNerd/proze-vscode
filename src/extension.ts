import { Config } from './config';
import { NameHighlighter, NameErrors } from './names';
import * as vscode from 'vscode';

let watcher: vscode.FileSystemWatcher;

const names = new NameHighlighter();
const nameErrors = new NameErrors();


export async function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('proze.compile', () => {
		vscode.window.showErrorMessage('Compile command not implemented');
	});

	await Config.getInstance().load();
	context.subscriptions.push(disposable);
	names.activate(context);
	nameErrors.activate(context);
	addConfigWatcher();
}

async function addConfigWatcher() {
	watcher = vscode.workspace.createFileSystemWatcher(Config.configPattern);
	watcher.onDidChange(async uri => {
		await Config.getInstance().load();
		nameErrors.updateAllDocs();
	});
	watcher.onDidCreate(async uri => {
		await Config.getInstance().load();
		nameErrors.updateAllDocs();
	});
	// watcher.onDidDelete(uri => Config.getInstance().remove(uri));
}

export function deactivate() {
	watcher.dispose();
}
