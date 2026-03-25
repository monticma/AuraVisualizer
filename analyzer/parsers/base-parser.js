/**
 * base-parser.js — Base class for language-specific parsers.
 * 
 * Architecture note: Each parser implements a `parse(fileInfo)` method that returns
 * an array of Relation objects. This extensible design allows adding deeper analysis
 * (AST-based, function calls, symbol resolution) in future versions by extending
 * or replacing individual parsers.
 */

/**
 * @typedef {Object} Relation
 * @property {string} source - Source file relative path (id)
 * @property {string} target - Target file reference (may need resolution)
 * @property {string} type - Relation type (include, import, require, script, stylesheet, css-import)
 * @property {string} label - Human-readable label for the relation
 * @property {string} [resolvedTarget] - Resolved relative path of the target (set by graph-builder)
 */

export class BaseParser {
    /**
     * @param {string} language - Language identifier
     */
    constructor(language) {
        this.language = language;
    }

    /**
     * Parse a file and extract relations.
     * Override this method in subclasses.
     * @param {Object} fileInfo - File info object from scanner
     * @returns {Array<Relation>} Array of relations found
     */
    parse(fileInfo) {
        return [];
    }

    /**
     * Extract all regex matches from content.
     * Utility for subclasses.
     * @param {string} content - File content
     * @param {RegExp} regex - Regex with capture groups
     * @param {string} type - Relation type
     * @param {string} sourceId - Source file id
     * @param {Function} [labelFn] - Optional function to generate label from match
     * @returns {Array<Relation>}
     */
    extractMatches(content, regex, type, sourceId, labelFn) {
        const relations = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const target = match[1];
            if (target) {
                relations.push({
                    source: sourceId,
                    target: target,
                    type: type,
                    label: labelFn ? labelFn(match) : `${type}: ${target}`
                });
            }
        }
        return relations;
    }
}
