import * as vscode from 'vscode';
import { Config, Name, NameType } from './config';

interface ParsedToken {
	range: vscode.Range;
	tokenType: string;
	tokenModifier: string[];
}

interface UriDiagnostics {
	uri: vscode.Uri;
	diagnostics: vscode.Diagnostic[];
}

export class NameHighlighter {

	private tokenTypes: string[] = ['keyword', 'variable', 'regexp', 'decorator'];
	private tokenModifiers: string[] = [];
	private legend: vscode.SemanticTokensLegend;
	private _validNameTokens: ValidNameTokens;

	constructor() {
		this.legend = new vscode.SemanticTokensLegend(this.tokenTypes, this.tokenModifiers);
		this._validNameTokens = this.validNameTokens() as ValidNameTokens;
	}

	activate(context: vscode.ExtensionContext) {
		context.subscriptions.push(
			vscode.languages.registerDocumentSemanticTokensProvider(
				{ language: 'proze' },
				this.validNameTokens(),
				this.legend
			)
		);
	}

	private validNameTokens(): vscode.DocumentSemanticTokensProvider {
		if (this._validNameTokens) {
			return this._validNameTokens;
		}
		return new ValidNameTokens(this.legend);
	}
}

export class NameErrors {
	private diagnosticCollection: vscode.DiagnosticCollection;

	private diagnosticMap: Map<string, UriDiagnostics> = new Map<string, UriDiagnostics>;

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('proze');
	}

	activate(context: vscode.ExtensionContext) {
		this.updateAllDocs();
		if (vscode.window.activeTextEditor) {
			this.updateDiagnostics(vscode.window.activeTextEditor.document);
		}
		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((editor) => {
				if (editor) {
					this.updateDiagnostics(editor.document);
				}
			})
		);
		context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument((doc) => {
				this.updateDiagnostics(doc);
			})
		);
	}

	updateAllDocs() {
		for (let doc of vscode.workspace.textDocuments) {
			this.updateDiagnostics(doc);
		}
	}

	private updateDiagnostics(doc: vscode.TextDocument) {
		if (doc.languageId === 'proze') {
			this.diagnosticCollection.clear();
			let diagnostics: vscode.Diagnostic[] = this.parseDocument(doc);
			this.diagnosticMap.set(
				doc.uri.toString(),
				{uri: doc.uri, diagnostics: diagnostics}
			);
			this.applyDiagnostics();
		}
	}

	private applyDiagnostics() {
		for (let diag of this.diagnosticMap.values()) {
			this.diagnosticCollection.set(diag.uri, diag.diagnostics);
		}
	}

	private parseDocument(doc: vscode.TextDocument): vscode.Diagnostic[] {
		let diagnostics: vscode.Diagnostic[] = [];
		const names = Config.getInstance().names(doc.uri);
		for (let i = 0; i < doc.lineCount; i++) {
			const line = doc.lineAt(i);
			for (let name of names) {
				let index = line.text.indexOf(name.name);
				if (index >= 0 && name.type === NameType.invalid) {
					this.addDiagnostic(
						diagnostics,
						`Invalid character name found: ${name.name}`,
						i, index,
						i, index + name.name.length
					);
				}
			}
		}
		return diagnostics;
	}

	private addDiagnostic(
		diagnostics: vscode.Diagnostic[],
		msg: string,
		line1: number,
		column1: number,
		line2: number,
		column2: number
	) {
		diagnostics.push(new vscode.Diagnostic(
			new vscode.Range(line1, column1, line2, column2),
			msg,
			vscode.DiagnosticSeverity.Error
		));
	}
}

class ValidNameTokens implements vscode.DocumentSemanticTokensProvider {

	constructor(
		private legend: vscode.SemanticTokensLegend
	) {}

	async provideDocumentSemanticTokens(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken
	): Promise<vscode.SemanticTokens> {
		const names = Config.getInstance().names(document.uri);
		const tokens = this.parseText(document.getText(), names);
		const builder = new vscode.SemanticTokensBuilder(this.legend);
		for(let token of tokens) {
			try {
				builder.push(token.range, token.tokenType, token.tokenModifier);
			}
			catch (e) {
				console.log(e);
			}
		}
		return builder.build();
	}

	private parseText(text: string, names: Name[]): ParsedToken[] {
		let tokens: ParsedToken[] = [];
		const lines = text.split(/\r\n|\r|\n/);
		for (let name of names) {
			for (let i=0; i < lines.length; i++) {
				// BUG this only finds the first instance of the name on the line but no others
				let index = lines[i].indexOf(name.name);
				if (index >= 0) {
					let tokenType: string = '';
					switch(name.type){
						case NameType.character:
							tokenType = 'keyword';
							break;
						case NameType.place:
							tokenType = 'variable';
							break;
						case NameType.thing:
							tokenType = 'regexp';
							break;
					}
					tokens.push({
						range: new vscode.Range(
							new vscode.Position(i, index),
							new vscode.Position(i, index + name.name.length)
						),
						tokenType: tokenType,
						tokenModifier: [],
					});
				}
			}
		}
		return tokens;
	}
}
