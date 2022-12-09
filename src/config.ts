import * as Path from 'path';
import * as YAML from 'yaml';
import * as vscode from 'vscode';

// TODO merge this (or find abstraction) with the config parsing in the compiler module

export enum NameType {
	character = 'character',
	place = 'place',
	thing = 'thing',
	invalid = 'invalid',
}

export interface Name {
	name: string,
	type: NameType,
}

export interface ConfigNames {
    character?: string[];
    place?: string[];
    thing?: string[];
    invalid?: string [];
}

export interface ConfigInterface {
    names?: ConfigNames;
    nameList?: Name[];
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

    private updateNameList() {
        for (const config of this.configurations.values()) {
            config.nameList = [];
            if (config.names?.character) {
                for (let name of config.names?.character) {
                    config.nameList.push({ name: name, type: NameType.character });
                }
            }
            if (config.names?.place) {
                for (let name of config.names?.place) {
                    config.nameList.push({ name: name, type: NameType.place });
                }
            }
            if (config.names?.thing) {
                for (let name of config.names?.thing) {
                    config.nameList.push({ name: name, type: NameType.thing });
                }
            }
            if (config.names?.invalid) {
                for (let name of config.names?.invalid) {
                    config.nameList.push({ name: name, type: NameType.invalid });
                }
            }
        }
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

    async load() {
        const files: vscode.Uri[] = await vscode.workspace.findFiles('**/config.*');  // TODO only want config in project root
        for (const file of files) {
            let ext = Path.parse(file.path).ext;
            const raw: Uint8Array = await vscode.workspace.fs.readFile(file);
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
        }
        this.updateNameList();
    }

    get(uri: vscode.Uri): ConfigInterface | undefined {
        const key = this.projectKey(uri);
        return this.configurations.get(key);
    }

    names(uri: vscode.Uri): Name[] {
        const config = this.get(uri);
        if (config?.nameList) {
            return config.nameList;
        }
        return [];
    }

    private parseJSON(content: string): ConfigInterface {
        return JSON.parse(content);
    }

    private parseYAML(content: string): ConfigInterface {
        return YAML.parse(content);
    }
}
