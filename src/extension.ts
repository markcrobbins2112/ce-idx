import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;
let logSequenceCounter = 0;

function formatObjectParam(obj: unknown): string {
	if (typeof obj === 'string') {
		return obj;
	}
	try {
		const json = JSON.stringify(obj);
		if (json.length > 120) {
			return json.substring(0, 120) + '... (truncated)';
		}
		return json;
	} catch {
		if (obj && typeof obj === 'object' && obj.constructor) {
			return `[Object: ${obj.constructor.name}]`;
		}
		return String(obj);
	}
}

function getFormattedTimestamp(): string {
	const now = new Date();
	const hh = String(now.getHours()).padStart(2, '0');
	const mm = String(now.getMinutes()).padStart(2, '0');
	const ss = String(now.getSeconds()).padStart(2, '0');
	logSequenceCounter++;
	const seq = String(logSequenceCounter).padStart(4, '0');
	return `[${hh}:${mm}:${ss}.${seq}]`;
}

function writeToChannel(emoji: string, message: string, ...args: unknown[]): void {
	if (!outputChannel) {
		return;
	}
	const timestamp = getFormattedTimestamp();
	const formattedArgs = args.map(formatObjectParam).join(' ');
	const line = `${timestamp} ${emoji} ${message}${formattedArgs ? ' ' + formattedArgs : ''}`;
	outputChannel.appendLine(line);
}

export const log = {
	info(message: string, ...args: unknown[]): void {
		writeToChannel('ℹ️', message, ...args);
	},
	warn(message: string, ...args: unknown[]): void {
		writeToChannel('⚠️', message, ...args);
	},
	error(message: string, ...args: unknown[]): void {
		writeToChannel('❌', message, ...args);
	},
	debug(message: string, ...args: unknown[]): void {
		writeToChannel('🔍', message, ...args);
		const err = new Error();
		if (err.stack && outputChannel) {
			const frames = err.stack.split('\n').slice(2).join('\n');
			outputChannel.appendLine('--- Stack Trace ---');
			outputChannel.appendLine(frames);
		}
	}
};

export function activate(context: vscode.ExtensionContext): void {
	outputChannel = vscode.window.createOutputChannel('Write That Down! Logs');
	outputChannel.show(true);

	log.info('Initializing QuickPick (v0.0.1)...');

	context.subscriptions.push(outputChannel);
	vscode.window.showInformationMessage('QuickPick v0.0.1 is now active.');
}

export function deactivate(): void {
	if (outputChannel) {
		outputChannel.dispose();
		outputChannel = undefined;
	}
}
