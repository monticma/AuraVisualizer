/**
 * vue-parser.test.ts — Tests for the regex-based Vue SFC parser.
 */

import { describe, it, expect } from 'vitest';
import { VueParser } from '../analyzer/parsers/vue-parser';
import { makeFileInfo } from './helpers';

const parser = new VueParser();

function rels(content: string) {
    const file = makeFileInfo({ id: 'MyComponent.vue', content, language: 'vue', extension: '.vue' });
    return parser.parse(file);
}

describe('VueParser', () => {
    it('extracts external script and style sources', () => {
        const content = [
            '<template><div>{{ msg }}</div></template>',
            '<script src="./logic.js"></script>',
            '<style src="./style.css"></style>',
        ].join('\n');
        const relations = rels(content);
        expect(relations).toContainEqual(expect.objectContaining({ target: './logic.js', type: 'script' }));
        expect(relations).toContainEqual(expect.objectContaining({ target: './style.css', type: 'stylesheet' }));
    });

    it('extracts imports inside the inline script block', () => {
        const content = [
            '<template><div>{{ msg }}</div></template>',
            '<script>',
            "import Child from './Child.vue';",
            "import { helper } from '../utils/helper.js';",
            "import './global.css';",
            "const legacy = require('./legacy.js');",
            'export default { name: "MyComponent" };',
            '</script>',
        ].join('\n');
        const relations = rels(content);
        const targets = relations.map(r => r.target);
        expect(targets).toContain('./Child.vue');
        expect(targets).toContain('../utils/helper.js');
        expect(targets).toContain('./global.css');
        expect(targets).toContain('./legacy.js');
        expect(relations.filter(r => r.type === 'import')).toHaveLength(3);
        expect(relations).toContainEqual(expect.objectContaining({ target: './legacy.js', type: 'require' }));
    });

    it('extracts @import from style blocks', () => {
        const content = [
            '<template><div /></template>',
            '<script>export default {};</script>',
            '<style scoped>',
            "@import './base.css';",
            '@import url("./theme.css");',
            '.a { color: red; }',
            '</style>',
        ].join('\n');
        const relations = rels(content);
        const imports = relations.filter(r => r.type === 'css-import').map(r => r.target);
        expect(imports).toContain('./base.css');
        expect(imports).toContain('./theme.css');
    });

    it('ignores imports mentioned outside script/style blocks', () => {
        const content = [
            '<template><p>import Fake from "./fake.vue";</p></template>',
            '<script>export default {};</script>',
        ].join('\n');
        const relations = rels(content);
        expect(relations.map(r => r.target)).not.toContain('./fake.vue');
    });

    it('deduplicates repeated targets', () => {
        const content = [
            '<script>',
            "import { a } from './shared.js';",
            "import { b } from './shared.js';",
            '</script>',
        ].join('\n');
        const relations = rels(content).filter(r => r.target === './shared.js');
        expect(relations).toHaveLength(1);
    });
});
