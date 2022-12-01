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

export class NameHighlighter {

	tokenTypes: string[] = ['keyword', 'variable', 'regexp', 'decorator'];
	tokenModifiers: string[] = [];
	legend: vscode.SemanticTokensLegend;
	private _tokenProvider: TokenProvider;

	diagnosticCollection: vscode.DiagnosticCollection;

	// TODO build a trie from the names for quick lookup when parsing text
	names: Name[] = [
		{name: 'Jessica', type: NameType.character},
		{name: 'Fred', type: NameType.character},
		{name: 'ice cream shop', type: NameType.place},
		{name: 'solarium', type: NameType.place},
		{name: 'nightlance', type: NameType.thing},
		{name: 'razor brush', type: NameType.thing},
		{name: 'Gary', type: NameType.invalid},
		{name: 'purpletrain', type: NameType.invalid},
	];

	constructor() {
		this.legend = new vscode.SemanticTokensLegend(this.tokenTypes, this.tokenModifiers);
		this.diagnosticCollection = vscode.languages.createDiagnosticCollection('proze');
		this._tokenProvider = this.tokenProvider() as TokenProvider;
	}

	activate(context: vscode.ExtensionContext) {
		this.activateSyntaxHighlighter(context);
		this.activateErrorDiagnostics(context);
	}

	private activateErrorDiagnostics(context: vscode.ExtensionContext) {
		if (vscode.window.activeTextEditor) {
			this.diagnosticCollection.set(vscode.window.activeTextEditor.document.uri, this.diagnostics());
		}
	
		context.subscriptions.push(
			vscode.workspace.onDidChangeTextDocument((editor) => {
				if (editor) {
					this.diagnosticCollection.set(editor.document.uri, this.diagnostics());
				}
			})
		);
	}

	private activateSyntaxHighlighter(context: vscode.ExtensionContext) {
		context.subscriptions.push(
			vscode.languages.registerDocumentSemanticTokensProvider(
				{ language: 'proze' },
				this.tokenProvider(),
				this.legend
			)
		);
	}

	diagnostics(): vscode.Diagnostic[] {
		return this._tokenProvider.diagnostics;
	}

	private tokenProvider(): vscode.DocumentSemanticTokensProvider {
		if (this._tokenProvider) {
			return this._tokenProvider;
		}
		return new TokenProvider(this.legend, this.names);
	}
}

interface ParsedToken {
	range: vscode.Range;
	tokenType: string;
	tokenModifier: string[];
}

class TokenProvider implements vscode.DocumentSemanticTokensProvider {

	diagnostics: vscode.Diagnostic[] = [];

	constructor(
		private legend: vscode.SemanticTokensLegend,
		private names: Name[]
	) {}

	async provideDocumentSemanticTokens(
		document: vscode.TextDocument,
		token: vscode.CancellationToken
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
						case NameType.invalid:
							tokenType = 'decorator';
							this.addDiagnostic(
								`Invalid character name found: ${name.name}`,
								i, index,
								i, index + name.name.length
							);
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

	private addDiagnostic(
		msg: string,
		line1: number,
		column1: number,
		line2: number,
		column2: number
	) {
		this.diagnostics.push(new vscode.Diagnostic(
			new vscode.Range(line1, column1, line2, column2),
			msg,
			vscode.DiagnosticSeverity.Error
		));
	}
}
