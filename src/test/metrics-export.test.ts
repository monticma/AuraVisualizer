import { describe, it, expect } from 'vitest';
import { metricsToCsv, metricsToJson, type MetricsRow } from '../report/metrics-export';

const row: MetricsRow = {
    file: 'src/a,b.ts',
    name: 'a"b',
    language: 'typescript',
    group: 'src',
    lines: 10,
    complexity: 3,
    fanIn: 2,
    fanOut: 1,
    churn: 4,
    authors: 2,
    riskScore: 42.345,
    riskBucket: 'medium',
};

describe('metrics export', () => {
    it('escapes CSV cells and keeps a stable header', () => {
        const csv = metricsToCsv([row, { ...row, file: 'src/c.ts', riskScore: null, riskBucket: null }]);
        const lines = csv.trimEnd().split('\n');
        expect(lines[0]).toBe('file,name,language,group,lines,complexity,fan_in,fan_out,churn,authors,risk_score,risk_bucket');
        expect(lines[1]).toBe('"src/a,b.ts","a""b",typescript,src,10,3,2,1,4,2,42.3,medium');
        expect(lines[2]).toContain('src/c.ts');
        expect(lines[2].endsWith(',,')).toBe(true);
        expect(metricsToCsv([row])).toBe(metricsToCsv([row]));
    });

    it('writes a versioned JSON envelope', () => {
        const json = JSON.parse(metricsToJson([row], { generatedAt: '2026-10-23T10:00:00.000Z' }));
        expect(json.version).toBe(1);
        expect(json.generatedAt).toBe('2026-10-23T10:00:00.000Z');
        expect(json.columns).toContain('risk_score');
        expect(json.rows).toHaveLength(1);
        expect(json.rows[0].riskScore).toBe(42.3);
        expect(json.rows[0].file).toBe('src/a,b.ts');
    });

    it('adds optional columns only when data exists', () => {
        const withoutOptional = metricsToCsv([row]);
        expect(withoutOptional.split('\n')[0]).not.toContain('tested');

        const withOptional = metricsToCsv([{ ...row, tested: true, cold: false, duplication: 0.12, cognitive: 9 }]);
        const header = withOptional.split('\n')[0];
        expect(header).toContain('tested');
        expect(header).toContain('cold');
        expect(header).toContain('duplication');
        expect(header).toContain('cognitive');
        expect(withOptional.split('\n')[1]).toContain('true,false,0.12,9');
    });
});
