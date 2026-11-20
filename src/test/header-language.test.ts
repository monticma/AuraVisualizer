import { describe, expect, it } from 'vitest';
import { languageForHeader } from '../analyzer/header-language';

/** `.h` : le langage se lit dans le contenu, pas dans l'extension. */
describe('languageForHeader', () => {
    it('keeps C for a plain C header', () => {
        const content = [
            '#ifndef UTIL_H',
            '#define UTIL_H',
            '#include <stdint.h>',
            'typedef struct { int x; int y; } point_t;',
            'int add(int a, int b);',
            '#endif',
        ].join('\n');
        expect(languageForHeader('.h', content, 'c')).toBe('c');
    });

    it('detects a class', () => {
        expect(languageForHeader('.h', 'class Panel {\npublic:\n    void run();\n};', 'c')).toBe('cpp');
    });

    it('detects a namespace', () => {
        expect(languageForHeader('.h', 'namespace thor {\nint f();\n}', 'c')).toBe('cpp');
    });

    it('detects a template', () => {
        expect(languageForHeader('.h', 'template <typename T>\nT max(T a, T b);', 'c')).toBe('cpp');
    });

    it('detects an out-of-class definition', () => {
        expect(languageForHeader('.h', 'void Panel::run() {\n}', 'c')).toBe('cpp');
    });

    it('detects std:: and C++ standard headers', () => {
        expect(languageForHeader('.h', 'std::string name;', 'c')).toBe('cpp');
        expect(languageForHeader('.h', '#include <vector>\nint f();', 'c')).toBe('cpp');
    });

    it('keeps a C header guarded for C++ callers', () => {
        // `extern "C"` + `__cplusplus` marquent un en-tête **C** ; les basculer
        // en C++ reclasserait 131 en-têtes C de ThorV2 pour rien.
        const content = [
            '#ifndef API_H',
            '#define API_H',
            '#ifdef __cplusplus',
            'extern "C" {',
            '#endif',
            'int api_open(const char* path);',
            '#ifdef __cplusplus',
            '}',
            '#endif',
            '#endif',
        ].join('\n');
        expect(languageForHeader('.h', content, 'c')).toBe('c');
    });

    it('detects modern C++ keywords', () => {
        expect(languageForHeader('.h', 'void f() noexcept;', 'c')).toBe('cpp');
        expect(languageForHeader('.h', 'constexpr int k = 3;', 'c')).toBe('cpp');
    });

    it('is not fooled by a comment', () => {
        const content = [
            '/**',
            ' * This replaces the old class Panel design.',
            ' * See namespace thor for the C++ version.',
            ' */',
            'int add(int a, int b);',
        ].join('\n');
        expect(languageForHeader('.h', content, 'c')).toBe('c');
    });

    it('is not fooled by a line comment', () => {
        expect(languageForHeader('.h', '// TODO: move to class later\nint f(void);', 'c')).toBe('c');
    });

    it('never changes another extension', () => {
        expect(languageForHeader('.c', 'class Panel {};', 'c')).toBe('c');
        expect(languageForHeader('.hpp', 'int f();', 'cpp')).toBe('cpp');
        expect(languageForHeader('.ts', 'class Panel {}', 'typescript')).toBe('typescript');
    });
});
