import * as vscode from 'vscode';

enum NameType {
	character = 'character',
	place = 'place',
	thing = 'thing',
	invalid = 'invalid',
}

interface Name {
	name: string,
	type: NameType,
}

interface ParsedToken {
	range: vscode.Range;
	tokenType: string;
	tokenModifier: string[];
}

const stubNames: Name[] = [
	{name: 'Jessica', type: NameType.character},
	{name: 'Fred', type: NameType.character},
	{name: 'ice cream shop', type: NameType.place},
	{name: 'solarium', type: NameType.place},
	{name: 'nightlance', type: NameType.thing},
	{name: 'razor brush', type: NameType.thing},
	{name: 'Gary', type: NameType.invalid},
	{name: 'purpletrain', type: NameType.invalid},
];

export class NameHighlighter {

	private names: Name[] = stubNames;
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
		return new ValidNameTokens(this.legend, this.names);
	}
}

interface UriDiagnostics {
	uri: vscode.Uri;
	diagnostics: vscode.Diagnostic[];
}

export class NameErrors {
	private names: Name[] = stubNames;
	private diagnosticCollection: vscode.DiagnosticCollection;

	private diagnosticMap: Map<string, UriDiagnostics> = new Map<string, UriDiagnostics>;

	constructor() {
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('proze');
	}

	// TODO create config file watcher for each workspace that has a config file
	//		- watch for changes to existing config files
	// 		- watch for the creation of a config file
	//		- parse all proze documents if any name changes occurred
	// let watcher = vscode.workspace.createFileSystemWatcher(path_to_config);
	// watcher.onDidChange(e => {
	// 	// See example: https://typescript.hotexamples.com/examples/vscode/FileSystemWatcher/-/typescript-filesystemwatcher-class-examples.html
	// });

	activate(context: vscode.ExtensionContext) {

		for (let doc of vscode.workspace.textDocuments) {
			this.parseDocument(doc);
		}
		
		if (vscode.window.activeTextEditor) {
			this.parseDocument(vscode.window.activeTextEditor.document);
		}
	
		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((editor) => {
				if (editor) {
					this.parseDocument(editor.document);
				}
			})
		);

		context.subscriptions.push(
			vscode.workspace.onDidOpenTextDocument((doc) => {
				this.parseDocument(doc);
			})
		);
	}

	private parseDocument(doc: vscode.TextDocument) {
		let diagnostics: vscode.Diagnostic[] = [];
		this.diagnosticCollection.clear();

		for (let i = 0; i < doc.lineCount; i++) {
			const line = doc.lineAt(i);
			for (let name of this.names) {
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

		// Set/overwrite existing diagnostics for the file.
		this.diagnosticMap.set(
			doc.uri.toString(),
			{
				uri: doc.uri,
				diagnostics: diagnostics
			}
		);

		// Reapply diagnostics for all files.
		for (let diag of this.diagnosticMap.values()) {
			this.diagnosticCollection.set(diag.uri, diag.diagnostics);
		}
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
		private legend: vscode.SemanticTokensLegend,
		private names: Name[]
	) {}

	async provideDocumentSemanticTokens(
		document: vscode.TextDocument,
		_token: vscode.CancellationToken
	): Promise<vscode.SemanticTokens> {
		const tokens = this.parseText(document.getText(), this.names);
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
