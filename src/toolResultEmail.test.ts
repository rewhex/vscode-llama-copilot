import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { parseSmtpRecipients } from './config';
import {
	buildCallIdToToolNameMap,
	serializeToolResultContent,
	collectToolResultEmailItems,
	toolNameMatchesWatchlist,
} from './toolResultEmail';

describe('parseSmtpRecipients', () => {
	it('splits comma-separated addresses and trims', () => {
		expect(parseSmtpRecipients('a@x.com, b@y.com')).toEqual(['a@x.com', 'b@y.com']);
		expect(parseSmtpRecipients('')).toEqual([]);
	});
});

describe('toolNameMatchesWatchlist', () => {
	it('matches exact names only', () => {
		expect(toolNameMatchesWatchlist('invoke_agent', ['invoke_agent'])).toBe(true);
		expect(toolNameMatchesWatchlist('invoke_agent', ['other'])).toBe(false);
		expect(toolNameMatchesWatchlist(undefined, ['invoke_agent'])).toBe(false);
	});
});

describe('serializeToolResultContent', () => {
	it('joins string-valued parts and truncates', () => {
		const parts = [{ value: 'hello' }, { value: ' world' }];
		expect(serializeToolResultContent(parts, 1000)).toBe('hello world');
		const long = 'x'.repeat(20);
		const out = serializeToolResultContent([{ value: long }], 10);
		expect(out.startsWith('xxxxxxxxxx')).toBe(true);
		expect(out.includes('truncated')).toBe(true);
	});
});

describe('buildCallIdToToolNameMap', () => {
	it('maps assistant tool call ids to names', () => {
		const assistant = vscode.LanguageModelChatMessage.Assistant([
			new vscode.LanguageModelToolCallPart('c1', 'invoke_agent', {}),
			new vscode.LanguageModelToolCallPart('c2', 'read_file', {}),
		]);
		const user = vscode.LanguageModelChatMessage.User([new vscode.LanguageModelToolResultPart('c1', [])]);
		const map = buildCallIdToToolNameMap([assistant, user]);
		expect(map.get('c1')).toBe('invoke_agent');
		expect(map.get('c2')).toBe('read_file');
	});

	it('later assistant messages override call ids', () => {
		const a1 = vscode.LanguageModelChatMessage.Assistant([
			new vscode.LanguageModelToolCallPart('id', 'first', {}),
		]);
		const a2 = vscode.LanguageModelChatMessage.Assistant([
			new vscode.LanguageModelToolCallPart('id', 'second', {}),
		]);
		const map = buildCallIdToToolNameMap([a1, a2]);
		expect(map.get('id')).toBe('second');
	});
});

describe('collectToolResultEmailItems', () => {
	it('keeps only watchlisted tool results with matching history', () => {
		const assistant = vscode.LanguageModelChatMessage.Assistant([
			new vscode.LanguageModelToolCallPart('x', 'invoke_agent', { task: 't' }),
		]);
		const user = vscode.LanguageModelChatMessage.User([
			new vscode.LanguageModelToolResultPart('x', [new vscode.LanguageModelTextPart('done')]),
		]);
		const items = collectToolResultEmailItems([assistant, user], {
			toolNames: ['invoke_agent'],
			maxBodyChars: 1000,
		});
		expect(items).toHaveLength(1);
		expect(items[0]!.callId).toBe('x');
		expect(items[0]!.toolName).toBe('invoke_agent');
		expect(items[0]!.body).toBe('done');
	});

	it('excludes tools not in the watchlist', () => {
		const assistant = vscode.LanguageModelChatMessage.Assistant([
			new vscode.LanguageModelToolCallPart('x', 'read_file', {}),
		]);
		const user = vscode.LanguageModelChatMessage.User([
			new vscode.LanguageModelToolResultPart('x', [new vscode.LanguageModelTextPart('body')]),
		]);
		const items = collectToolResultEmailItems([assistant, user], {
			toolNames: ['invoke_agent'],
			maxBodyChars: 1000,
		});
		expect(items).toHaveLength(0);
	});
});
