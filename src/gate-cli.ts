/**
 * gate-cli.ts — `node out/gate.js` : le verdict, utilisable en CI.
 *
 *   node out/gate.js [--root .] [--base origin/main] [--json] [--markdown file]
 *                    [--update-baseline] [--allow-stale] [--quiet]
 *
 * Codes de sortie :
 *   0  le gate passe
 *   1  une règle est franchie
 *   2  configuration invalide, analyse absente ou périmée — on ne juge pas
 *
 * Le code 2 est distinct exprès : en CI, « ton gate.json est invalide » ou
 * « l'analyse date d'avant la PR » ne doit pas se confondre avec « ton code est
 * en faute ». Un rouge qu'on ne peut pas distinguer d'une erreur de plomberie
 * finit ignoré.
 */

import fs from 'fs';
import path from 'path';
import { GraphDB } from './graph-db';
import { runGate, writeGateBaseline } from './gate/gate-run';
import { gateMarkdown } from './gate/gate-core';

interface CliArgs {
    root: string;
    base?: string;
    json: boolean;
    markdown?: string;
    updateBaseline: boolean;
    allowStale: boolean;
    quiet: boolean;
    help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
    const args: CliArgs = { root: process.cwd(), json: false, updateBaseline: false, allowStale: false, quiet: false, help: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case '--root': args.root = argv[++i] || args.root; break;
            case '--base': args.base = argv[++i]; break;
            case '--json': args.json = true; break;
            case '--markdown': args.markdown = argv[++i]; break;
            case '--update-baseline': args.updateBaseline = true; break;
            case '--allow-stale': args.allowStale = true; break;
            case '--quiet': args.quiet = true; break;
            case '--help':
            case '-h': args.help = true; break;
            default:
                if (arg.startsWith('--')) {
                    console.error(`Aura gate: option inconnue ${arg}`);
                    args.help = true;
                }
        }
    }
    return args;
}

const USAGE = `Aura Gate — le verdict sur le graphe analysé

  node out/gate.js [options]

  --root <dir>         racine du dépôt (défaut : dossier courant)
  --base <ref>         ne juger que les fichiers modifiés depuis <ref>
                       (ex. origin/main) — implique un périmètre « delta »
  --json               sortie JSON (pour un agent ou un script)
  --markdown <file>    écrit un rapport Markdown prêt pour la PR
  --update-baseline    gèle la dette courante dans .aura/gate-baseline.json
  --allow-stale        juge même si l'analyse ne correspond plus au checkout
  --quiet              n'imprime que les échecs
  -h, --help           cette aide

Config : .aura/gate.json · Baseline : .aura/gate-baseline.json
Codes de sortie : 0 ok · 1 règle franchie · 2 configuration ou fraîcheur
`;

async function main(): Promise<number> {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(USAGE);
        return 0;
    }

    const root = path.resolve(args.root);
    const dbPath = path.join(root, '.aura', 'graph.db');
    if (!fs.existsSync(dbPath)) {
        const message = `Aura gate : aucune analyse à ${dbPath}. Lancez « Aura: Visualize Codebase » (ou laissez l'extension analyser le dépôt) avant de gate.`;
        if (args.json) console.log(JSON.stringify({ ok: false, code: 2, error: message }, null, 2));
        else console.error(message);
        return 2;
    }

    const db = new GraphDB();
    try {
        await db.open(dbPath);
    } catch (err) {
        // Cas réel (mesuré) : l'éditeur réécrit `.aura/graph.db` pendant la
        // lecture et sql.js répond « database disk image is malformed ». Ce
        // n'est pas un échec de règle — on refuse de conclure, code 2.
        const detail = err instanceof Error ? err.message : String(err);
        const message = `Aura gate : la base .aura/graph.db est illisible (${detail}). `
            + 'Elle est peut-être en cours de réécriture par l\'éditeur — relancez l\'analyse puis le gate.';
        if (args.json) console.log(JSON.stringify({ ok: false, code: 2, error: message }, null, 2));
        else console.error(message);
        return 2;
    }

    try {
        return await gateWithDb(db, args, root);
    } finally {
        try { db.close(); } catch { /* rien à faire */ }
    }
}

async function gateWithDb(db: GraphDB, args: CliArgs, root: string): Promise<number> {

    if (args.updateBaseline) {
        const written = await writeGateBaseline(db, { root });
        if (!written) {
            console.error('Aura gate : impossible de geler la baseline (aucun graphe).');
            return 2;
        }
        if (!args.quiet) console.log(`Baseline gelée → ${path.relative(root, written.file)}`);
        return 0;
    }

    const context = await runGate(db, {
        root,
        ...(args.base ? { base: args.base } : {}),
        ...(args.allowStale ? { allowStale: true } : {}),
    });
    const verdict = context.verdict;

    if (args.markdown) {
        fs.mkdirSync(path.dirname(path.resolve(args.markdown)), { recursive: true });
        fs.writeFileSync(path.resolve(args.markdown), gateMarkdown(verdict), 'utf8');
    }

    if (args.json) {
        console.log(JSON.stringify({
            ok: verdict.ok,
            code: verdict.code,
            summary: verdict.summary,
            scope: verdict.scope,
            checked: verdict.checked,
            totals: verdict.totals,
            failures: verdict.failures,
            baselined: verdict.baselined.length,
            config_missing: context.configMissing,
            changed_files: context.changedFiles,
        }, null, 2));
    } else {
        const icon = verdict.ok ? '✅' : (verdict.code === 2 ? '⛔' : '❌');
        if (!args.quiet || !verdict.ok) console.log(`${icon} ${verdict.summary}`);
        for (const failure of verdict.failures.slice(0, 20)) {
            const where = failure.file ? `${failure.file} ` : '';
            console.log(`   · ${failure.rule} — ${where}${failure.value} (limite ${failure.limit})${failure.detail ? ` · ${failure.detail}` : ''}`);
        }
        if (verdict.failures.length > 20) console.log(`   … ${verdict.failures.length - 20} de plus`);
        if (verdict.baselined.length > 0 && !args.quiet) {
            console.log(`   ${verdict.baselined.length} dépassement(s) gelé(s) dans la baseline (non bloquants)`);
        }
        if (context.configMissing && !args.quiet) {
            console.log('   (aucune config .aura/gate.json — défauts appliqués, aucun budget)');
        }
    }

    return verdict.code;
}

main()
    .then(code => process.exit(code))
    .catch(error => {
        console.error('Aura gate : ' + (error instanceof Error ? error.message : String(error)));
        process.exit(2);
    });
