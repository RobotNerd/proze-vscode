import * as Path from 'path';
import * as YAML from 'yaml';
import * as vscode from 'vscode';

// TODO merge this (or find abstraction) with the config parsing in the compiler module

export interface ConfigNames {
    character?: string[];
    place?: string[];
    thing?: string[];
    invalid?: string [];
}

export interface ConfigInterface {
    names?: ConfigNames;
}

export class Config {

    private static instance: Config;
    private configurations: Map<string, ConfigInterface> = new Map<string, ConfigInterface>();

    private constructor() {}

    static getInstance(): Config {
        if (!this.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }

    private projectKey(uri: vscode.Uri): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders !== undefined) {
            for (const folder of workspaceFolders) {
                let root = folder.uri.path;
                if (uri.path.startsWith(root)) {
                    return root;
                }
            }
        }
        return '';
    }

    load() {
        vscode.workspace.findFiles('**/config.*')
            .then((files: vscode.Uri[]) => {
                for (const file of files) {
                    let ext = Path.parse(file.path).ext;
                    vscode.workspace.fs.readFile(file).then((raw: Uint8Array) => {
                        let content = raw.toString();
                        const key = this.projectKey(file);
                        switch(ext) {
                            case '.json':
                                this.configurations.set(key, this.parseJSON(content));
                                break;
                            case '.yaml':
                            case '.yml':
                                this.configurations.set(key, this.parseYAML(content));
                                break;
                        }
                    });
                }
            });
    }

    get(uri: vscode.Uri): ConfigInterface | undefined {
        const key = this.projectKey(uri);
        return this.configurations.get(key);
    }

    private parseJSON(content: string): ConfigInterface {
        return JSON.parse(content);
    }

    private parseYAML(content: string): ConfigInterface {
        return YAML.parse(content);
    }
}
