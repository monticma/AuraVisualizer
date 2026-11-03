import { describe, it, expect } from 'vitest';
import {
    SHALLOW_FIX_COMMAND,
    buildGitHistoryInfo,
    formatCommitCount,
    parseCommitCount,
    parseShallowFlag,
    shallowBannerText,
    shallowRiskCaption,
} from '../git/shallow-core';

const shallow = (commits: number) => ({ shallow: true, commits });

describe('shallow-core — parseShallowFlag', () => {
    it('reads git booleans', () => {
        expect(parseShallowFlag('true\n')).toBe(true);
        expect(parseShallowFlag('false\n')).toBe(false);
        expect(parseShallowFlag(' TRUE ')).toBe(true);
    });

    it('ignores anything else', () => {
        expect(parseShallowFlag('')).toBeUndefined();
        expect(parseShallowFlag(undefined)).toBeUndefined();
        expect(parseShallowFlag('fatal: not a git repository')).toBeUndefined();
    });
});

describe('shallow-core — parseCommitCount', () => {
    it('reads a digit count', () => {
        expect(parseCommitCount('42\n')).toBe(42);
        expect(parseCommitCount('0')).toBe(0);
    });

    it('ignores noise', () => {
        expect(parseCommitCount('')).toBeUndefined();
        expect(parseCommitCount('12 commits')).toBeUndefined();
        expect(parseCommitCount(undefined)).toBeUndefined();
    });
});

describe('shallow-core — buildGitHistoryInfo', () => {
    it('flags a shallow checkout', () => {
        expect(buildGitHistoryInfo(true, 1)).toEqual({ shallow: true, commits: 1 });
    });

    it('never flags a complete history', () => {
        expect(buildGitHistoryInfo(false, 900)).toBeUndefined();
        expect(buildGitHistoryInfo(undefined, 12)).toBeUndefined();
    });

    it('keeps an unknown count at 0 instead of NaN', () => {
        expect(buildGitHistoryInfo(true, undefined)).toEqual({ shallow: true, commits: 0 });
        expect(buildGitHistoryInfo(true, Number.NaN)).toEqual({ shallow: true, commits: 0 });
        expect(buildGitHistoryInfo(true, -3)).toEqual({ shallow: true, commits: 0 });
        expect(buildGitHistoryInfo(true, 7.9)).toEqual({ shallow: true, commits: 7 });
    });
});

describe('shallow-core — wording', () => {
    it('pluralises the visible commit count', () => {
        expect(formatCommitCount(1)).toBe('1 commit visible');
        expect(formatCommitCount(0)).toBe('0 commits visible');
        expect(formatCommitCount(12)).toBe('12 commits visible');
    });

    it('builds the Time Travel banner', () => {
        expect(shallowBannerText(shallow(1))).toBe(
            'History incomplete — shallow clone (1 commit visible). '
            + 'Churn, co-change and complexity trends are underestimated.',
        );
        expect(shallowBannerText(shallow(0))).toBe(
            'History incomplete — shallow clone. '
            + 'Churn, co-change and complexity trends are underestimated.',
        );
    });

    it('builds the Risk caption', () => {
        expect(shallowRiskCaption(shallow(3))).toBe(
            'Churn is incomplete (shallow clone, 3 commits visible) — risk scores are underestimated.',
        );
        expect(shallowRiskCaption(shallow(0))).toBe(
            'Churn is incomplete (shallow clone) — risk scores are underestimated.',
        );
    });

    it('says nothing when the history is complete', () => {
        expect(shallowBannerText(undefined)).toBe('');
        expect(shallowBannerText({ shallow: false, commits: 900 })).toBe('');
        expect(shallowRiskCaption(undefined)).toBe('');
        expect(shallowRiskCaption({ shallow: false, commits: 900 })).toBe('');
    });

    it('exposes the fix command', () => {
        expect(SHALLOW_FIX_COMMAND).toBe('git fetch --unshallow');
    });
});
