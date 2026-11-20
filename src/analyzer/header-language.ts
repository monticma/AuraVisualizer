/**
 * header-language.ts — C ou C++ ? Le cas `.h`.
 *
 * Un en-tête `.h` ne dit pas son langage. Aura le classait toujours en **C**,
 * ce qui casse un dépôt C++ : la grammaire C ne connaît ni `class`, ni
 * `namespace`, ni `template`, donc les classes déclarées dans les en-têtes
 * disparaissent (symboles, heritage, dead code, City). Mesuré sur ThorV4 :
 * **0 classe** trouvée en C là où la grammaire C++ en trouve 14.
 *
 * La décision se prend sur un **échantillon de contenu**, pas sur le nom : un
 * en-tête qui parle C++ est un en-tête C++, quelle que soit son extension. Les
 * commentaires sont retirés avant l'analyse, pour que `// class Foo` dans une
 * doc ne suffise pas à changer de langage.
 *
 * Conservateur par construction : sans signal C++ explicite, on reste en C.
 * C'est le sens du doute — un en-tête C lu par la grammaire C++ resterait
 * lisible, mais l'inverse perd du code.
 */

/** Signaux sans ambiguïté d'un en-tête C++. */
const CXX_SIGNALS: RegExp[] = [
    /(^|\n)\s*(namespace|class|template)\b/,
    /(^|\n)\s*(public|private|protected)\s*:/,
    /\bstd::/,
    /\b[A-Za-z_]\w*\s*::\s*[~A-Za-z_]\w*\s*\(/,
    /\b(nullptr|constexpr|noexcept|override|decltype)\b/,
    /#\s*include\s*<(vector|string|iostream|map|set|memory|algorithm|utility|thread|chrono|fstream|sstream|array|tuple|optional|variant|functional|filesystem)>/,
];

/**
 * `extern "C"` et `__cplusplus` **ne sont pas** des signaux C++ : ce sont les
 * marqueurs d'un en-tête **C** conçu pour être appelé depuis C++. Les retourner
 * en C++ reclasserait 131 en-têtes C de ThorV2 pour rien.
 */

/** Retire les commentaires pour ne pas prendre une phrase pour du code. */
function stripComments(source: string): string {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/**
 * Langage d'un fichier, `.h` excepté : un en-tête est C++ s'il en montre un
 * signal, sinon on garde le langage par défaut de son extension.
 */
export function languageForHeader(extension: string, content: string, fallback: string): string {
    if (extension !== '.h') return fallback;
    const sample = stripComments(content.slice(0, 20000));
    return CXX_SIGNALS.some(signal => signal.test(sample)) ? 'cpp' : fallback;
}
