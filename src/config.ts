import * as Path from 'path';
import * as YAML from 'yaml';
import * as vscode from 'vscode';
import { config } from 'process';

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

    static configPattern = '**/config.*';

    private static instance: Config;
    private configurations: Map<string, ConfigInterface> = new Map<string, ConfigInterface>();

    private constructor() {}

    get(uri: vscode.Uri): ConfigInterface | undefined {
        const key = this.projectKey(uri);
        return this.configurations.get(key);
    }

    static getInstance(): Config {
        if (!this.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }

    private isFileInRootFolder(uri: vscode.Uri): boolean {
        let isInRoot = false;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders !== undefined) {
            for (const folder of workspaceFolders) {
                let fileFolder = uri.path.substring(0, uri.path.lastIndexOf("/"));
                if (fileFolder === folder.uri.path) {
                    isInRoot = true;
                    break;
                }
            }
        }
        return isInRoot;
    }

    async load() {
        const files: vscode.Uri[] = await vscode.workspace.findFiles(Config.configPattern);
        for (const file of files) {
            if (!this.isFileInRootFolder(file)){
                continue;
            }
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

    private projectKey(uri: vscode.Uri): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let key: string = '';
        if (workspaceFolders !== undefined) {
            for (const folder of workspaceFolders) {
                let root = folder.uri.path;
                if (uri.path.startsWith(root) && key.length < root.length) {
                    key = root;
                }
            }
        }
        return key;
    }

    private updateNameList() {
        let addNames = (config: ConfigInterface, names: string[] | undefined, type: NameType) => {
            if (names) {
                for (let name of names) {
                    config.nameList?.push({name, type});
                }
            }
        };

        for (const config of this.configurations.values()) {
            config.nameList = [];
            addNames(config, config.names?.character, NameType.character);
            addNames(config, config.names?.place, NameType.place);
            addNames(config, config.names?.thing, NameType.thing);
            addNames(config, config.names?.invalid, NameType.invalid);
        }
    }
}
