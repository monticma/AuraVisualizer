"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/web-tree-sitter/tree-sitter.js
var require_tree_sitter = __commonJS({
  "node_modules/web-tree-sitter/tree-sitter.js"(exports, module) {
    "use strict";
    var Module = void 0 !== Module ? Module : {};
    var TreeSitter = function() {
      var initPromise, document = "object" == typeof window ? { currentScript: window.document.currentScript } : null;
      class Parser {
        constructor() {
          this.initialize();
        }
        initialize() {
          throw new Error("cannot construct a Parser before calling `init()`");
        }
        static init(moduleOptions) {
          return initPromise || (Module = Object.assign({}, Module, moduleOptions), initPromise = new Promise((resolveInitPromise) => {
            var moduleOverrides = Object.assign({}, Module), arguments_ = [], thisProgram = "./this.program", quit_ = (e, t) => {
              throw t;
            }, ENVIRONMENT_IS_WEB = "object" == typeof window, ENVIRONMENT_IS_WORKER = "function" == typeof importScripts, ENVIRONMENT_IS_NODE = "object" == typeof process && "object" == typeof process.versions && "string" == typeof process.versions.node, scriptDirectory = "", read_, readAsync, readBinary, setWindowTitle;
            function locateFile(e) {
              return Module.locateFile ? Module.locateFile(e, scriptDirectory) : scriptDirectory + e;
            }
            function logExceptionOnExit(e) {
              if (e instanceof ExitStatus)
                return;
              err("exiting due to exception: " + e);
            }
            if (ENVIRONMENT_IS_NODE) {
              var fs = require("fs"), nodePath = require("path");
              scriptDirectory = ENVIRONMENT_IS_WORKER ? nodePath.dirname(scriptDirectory) + "/" : __dirname + "/", read_ = (e, t) => (e = isFileURI(e) ? new URL(e) : nodePath.normalize(e), fs.readFileSync(e, t ? void 0 : "utf8")), readBinary = (e) => {
                var t = read_(e, true);
                return t.buffer || (t = new Uint8Array(t)), t;
              }, readAsync = (e, t, r) => {
                e = isFileURI(e) ? new URL(e) : nodePath.normalize(e), fs.readFile(e, function(e2, _) {
                  e2 ? r(e2) : t(_.buffer);
                });
              }, process.argv.length > 1 && (thisProgram = process.argv[1].replace(/\\/g, "/")), arguments_ = process.argv.slice(2), "undefined" != typeof module && (module.exports = Module), quit_ = (e, t) => {
                if (keepRuntimeAlive())
                  throw process.exitCode = e, t;
                logExceptionOnExit(t), process.exit(e);
              }, Module.inspect = function() {
                return "[Emscripten Module object]";
              };
            } else
              (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && (ENVIRONMENT_IS_WORKER ? scriptDirectory = self.location.href : void 0 !== document && document.currentScript && (scriptDirectory = document.currentScript.src), scriptDirectory = 0 !== scriptDirectory.indexOf("blob:") ? scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1) : "", read_ = (e) => {
                var t = new XMLHttpRequest();
                return t.open("GET", e, false), t.send(null), t.responseText;
              }, ENVIRONMENT_IS_WORKER && (readBinary = (e) => {
                var t = new XMLHttpRequest();
                return t.open("GET", e, false), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
              }), readAsync = (e, t, r) => {
                var _ = new XMLHttpRequest();
                _.open("GET", e, true), _.responseType = "arraybuffer", _.onload = () => {
                  200 == _.status || 0 == _.status && _.response ? t(_.response) : r();
                }, _.onerror = r, _.send(null);
              }, setWindowTitle = (e) => document.title = e);
            var out = Module.print || console.log.bind(console), err = Module.printErr || console.warn.bind(console);
            Object.assign(Module, moduleOverrides), moduleOverrides = null, Module.arguments && (arguments_ = Module.arguments), Module.thisProgram && (thisProgram = Module.thisProgram), Module.quit && (quit_ = Module.quit);
            var STACK_ALIGN = 16, dynamicLibraries = Module.dynamicLibraries || [], wasmBinary;
            Module.wasmBinary && (wasmBinary = Module.wasmBinary);
            var noExitRuntime = Module.noExitRuntime || true, wasmMemory;
            "object" != typeof WebAssembly && abort("no native wasm support detected");
            var ABORT = false, EXITSTATUS, UTF8Decoder = "undefined" != typeof TextDecoder ? new TextDecoder("utf8") : void 0, buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
            function UTF8ArrayToString(e, t, r) {
              for (var _ = t + r, n = t; e[n] && !(n >= _); )
                ++n;
              if (n - t > 16 && e.buffer && UTF8Decoder)
                return UTF8Decoder.decode(e.subarray(t, n));
              for (var s = ""; t < n; ) {
                var a = e[t++];
                if (128 & a) {
                  var o = 63 & e[t++];
                  if (192 != (224 & a)) {
                    var i = 63 & e[t++];
                    if ((a = 224 == (240 & a) ? (15 & a) << 12 | o << 6 | i : (7 & a) << 18 | o << 12 | i << 6 | 63 & e[t++]) < 65536)
                      s += String.fromCharCode(a);
                    else {
                      var l = a - 65536;
                      s += String.fromCharCode(55296 | l >> 10, 56320 | 1023 & l);
                    }
                  } else
                    s += String.fromCharCode((31 & a) << 6 | o);
                } else
                  s += String.fromCharCode(a);
              }
              return s;
            }
            function UTF8ToString(e, t) {
              return e ? UTF8ArrayToString(HEAPU8, e, t) : "";
            }
            function stringToUTF8Array(e, t, r, _) {
              if (!(_ > 0))
                return 0;
              for (var n = r, s = r + _ - 1, a = 0; a < e.length; ++a) {
                var o = e.charCodeAt(a);
                if (o >= 55296 && o <= 57343)
                  o = 65536 + ((1023 & o) << 10) | 1023 & e.charCodeAt(++a);
                if (o <= 127) {
                  if (r >= s)
                    break;
                  t[r++] = o;
                } else if (o <= 2047) {
                  if (r + 1 >= s)
                    break;
                  t[r++] = 192 | o >> 6, t[r++] = 128 | 63 & o;
                } else if (o <= 65535) {
                  if (r + 2 >= s)
                    break;
                  t[r++] = 224 | o >> 12, t[r++] = 128 | o >> 6 & 63, t[r++] = 128 | 63 & o;
                } else {
                  if (r + 3 >= s)
                    break;
                  t[r++] = 240 | o >> 18, t[r++] = 128 | o >> 12 & 63, t[r++] = 128 | o >> 6 & 63, t[r++] = 128 | 63 & o;
                }
              }
              return t[r] = 0, r - n;
            }
            function stringToUTF8(e, t, r) {
              return stringToUTF8Array(e, HEAPU8, t, r);
            }
            function lengthBytesUTF8(e) {
              for (var t = 0, r = 0; r < e.length; ++r) {
                var _ = e.charCodeAt(r);
                _ <= 127 ? t++ : _ <= 2047 ? t += 2 : _ >= 55296 && _ <= 57343 ? (t += 4, ++r) : t += 3;
              }
              return t;
            }
            function updateGlobalBufferAndViews(e) {
              buffer = e, Module.HEAP8 = HEAP8 = new Int8Array(e), Module.HEAP16 = HEAP16 = new Int16Array(e), Module.HEAP32 = HEAP32 = new Int32Array(e), Module.HEAPU8 = HEAPU8 = new Uint8Array(e), Module.HEAPU16 = HEAPU16 = new Uint16Array(e), Module.HEAPU32 = HEAPU32 = new Uint32Array(e), Module.HEAPF32 = HEAPF32 = new Float32Array(e), Module.HEAPF64 = HEAPF64 = new Float64Array(e);
            }
            var INITIAL_MEMORY = Module.INITIAL_MEMORY || 33554432;
            wasmMemory = Module.wasmMemory ? Module.wasmMemory : new WebAssembly.Memory({ initial: INITIAL_MEMORY / 65536, maximum: 32768 }), wasmMemory && (buffer = wasmMemory.buffer), INITIAL_MEMORY = buffer.byteLength, updateGlobalBufferAndViews(buffer);
            var wasmTable = new WebAssembly.Table({ initial: 20, element: "anyfunc" }), __ATPRERUN__ = [], __ATINIT__ = [], __ATMAIN__ = [], __ATPOSTRUN__ = [], __RELOC_FUNCS__ = [], runtimeInitialized = false;
            function keepRuntimeAlive() {
              return noExitRuntime;
            }
            function preRun() {
              if (Module.preRun)
                for ("function" == typeof Module.preRun && (Module.preRun = [Module.preRun]); Module.preRun.length; )
                  addOnPreRun(Module.preRun.shift());
              callRuntimeCallbacks(__ATPRERUN__);
            }
            function initRuntime() {
              runtimeInitialized = true, callRuntimeCallbacks(__RELOC_FUNCS__), callRuntimeCallbacks(__ATINIT__);
            }
            function preMain() {
              callRuntimeCallbacks(__ATMAIN__);
            }
            function postRun() {
              if (Module.postRun)
                for ("function" == typeof Module.postRun && (Module.postRun = [Module.postRun]); Module.postRun.length; )
                  addOnPostRun(Module.postRun.shift());
              callRuntimeCallbacks(__ATPOSTRUN__);
            }
            function addOnPreRun(e) {
              __ATPRERUN__.unshift(e);
            }
            function addOnInit(e) {
              __ATINIT__.unshift(e);
            }
            function addOnPostRun(e) {
              __ATPOSTRUN__.unshift(e);
            }
            var runDependencies = 0, runDependencyWatcher = null, dependenciesFulfilled = null;
            function addRunDependency(e) {
              runDependencies++, Module.monitorRunDependencies && Module.monitorRunDependencies(runDependencies);
            }
            function removeRunDependency(e) {
              if (runDependencies--, Module.monitorRunDependencies && Module.monitorRunDependencies(runDependencies), 0 == runDependencies && (null !== runDependencyWatcher && (clearInterval(runDependencyWatcher), runDependencyWatcher = null), dependenciesFulfilled)) {
                var t = dependenciesFulfilled;
                dependenciesFulfilled = null, t();
              }
            }
            function abort(e) {
              throw Module.onAbort && Module.onAbort(e), err(e = "Aborted(" + e + ")"), ABORT = true, EXITSTATUS = 1, e += ". Build with -sASSERTIONS for more info.", new WebAssembly.RuntimeError(e);
            }
            var dataURIPrefix = "data:application/octet-stream;base64,", wasmBinaryFile, tempDouble, tempI64;
            function isDataURI(e) {
              return e.startsWith(dataURIPrefix);
            }
            function isFileURI(e) {
              return e.startsWith("file://");
            }
            function getBinary(e) {
              try {
                if (e == wasmBinaryFile && wasmBinary)
                  return new Uint8Array(wasmBinary);
                if (readBinary)
                  return readBinary(e);
                throw "both async and sync fetching of the wasm failed";
              } catch (e2) {
                abort(e2);
              }
            }
            function getBinaryPromise() {
              if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
                if ("function" == typeof fetch && !isFileURI(wasmBinaryFile))
                  return fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(e) {
                    if (!e.ok)
                      throw "failed to load wasm binary file at '" + wasmBinaryFile + "'";
                    return e.arrayBuffer();
                  }).catch(function() {
                    return getBinary(wasmBinaryFile);
                  });
                if (readAsync)
                  return new Promise(function(e, t) {
                    readAsync(wasmBinaryFile, function(t2) {
                      e(new Uint8Array(t2));
                    }, t);
                  });
              }
              return Promise.resolve().then(function() {
                return getBinary(wasmBinaryFile);
              });
            }
            function createWasm() {
              var e = { env: asmLibraryArg, wasi_snapshot_preview1: asmLibraryArg, "GOT.mem": new Proxy(asmLibraryArg, GOTHandler), "GOT.func": new Proxy(asmLibraryArg, GOTHandler) };
              function t(e2, t2) {
                var r2 = e2.exports;
                r2 = relocateExports(r2, 1024);
                var _2 = getDylinkMetadata(t2);
                _2.neededDynlibs && (dynamicLibraries = _2.neededDynlibs.concat(dynamicLibraries)), mergeLibSymbols(r2, "main"), Module.asm = r2, addOnInit(Module.asm.__wasm_call_ctors), __RELOC_FUNCS__.push(Module.asm.__wasm_apply_data_relocs), removeRunDependency("wasm-instantiate");
              }
              function r(e2) {
                t(e2.instance, e2.module);
              }
              function _(t2) {
                return getBinaryPromise().then(function(t3) {
                  return WebAssembly.instantiate(t3, e);
                }).then(function(e2) {
                  return e2;
                }).then(t2, function(e2) {
                  err("failed to asynchronously prepare wasm: " + e2), abort(e2);
                });
              }
              if (addRunDependency("wasm-instantiate"), Module.instantiateWasm)
                try {
                  return Module.instantiateWasm(e, t);
                } catch (e2) {
                  return err("Module.instantiateWasm callback failed with error: " + e2), false;
                }
              return wasmBinary || "function" != typeof WebAssembly.instantiateStreaming || isDataURI(wasmBinaryFile) || isFileURI(wasmBinaryFile) || ENVIRONMENT_IS_NODE || "function" != typeof fetch ? _(r) : fetch(wasmBinaryFile, { credentials: "same-origin" }).then(function(t2) {
                return WebAssembly.instantiateStreaming(t2, e).then(r, function(e2) {
                  return err("wasm streaming compile failed: " + e2), err("falling back to ArrayBuffer instantiation"), _(r);
                });
              }), {};
            }
            wasmBinaryFile = "tree-sitter.wasm", isDataURI(wasmBinaryFile) || (wasmBinaryFile = locateFile(wasmBinaryFile));
            var ASM_CONSTS = {};
            function ExitStatus(e) {
              this.name = "ExitStatus", this.message = "Program terminated with exit(" + e + ")", this.status = e;
            }
            var GOT = {}, CurrentModuleWeakSymbols = /* @__PURE__ */ new Set([]), GOTHandler = { get: function(e, t) {
              var r = GOT[t];
              return r || (r = GOT[t] = new WebAssembly.Global({ value: "i32", mutable: true })), CurrentModuleWeakSymbols.has(t) || (r.required = true), r;
            } };
            function callRuntimeCallbacks(e) {
              for (; e.length > 0; )
                e.shift()(Module);
            }
            function getDylinkMetadata(e) {
              var t = 0, r = 0;
              function _() {
                for (var r2 = 0, _2 = 1; ; ) {
                  var n2 = e[t++];
                  if (r2 += (127 & n2) * _2, _2 *= 128, !(128 & n2))
                    break;
                }
                return r2;
              }
              function n() {
                var r2 = _();
                return UTF8ArrayToString(e, (t += r2) - r2, r2);
              }
              function s(e2, t2) {
                if (e2)
                  throw new Error(t2);
              }
              var a = "dylink.0";
              if (e instanceof WebAssembly.Module) {
                var o = WebAssembly.Module.customSections(e, a);
                0 === o.length && (a = "dylink", o = WebAssembly.Module.customSections(e, a)), s(0 === o.length, "need dylink section"), r = (e = new Uint8Array(o[0])).length;
              } else {
                s(!(1836278016 == new Uint32Array(new Uint8Array(e.subarray(0, 24)).buffer)[0]), "need to see wasm magic number"), s(0 !== e[8], "need the dylink section to be first"), t = 9;
                var i = _();
                r = t + i, a = n();
              }
              var l = { neededDynlibs: [], tlsExports: /* @__PURE__ */ new Set(), weakImports: /* @__PURE__ */ new Set() };
              if ("dylink" == a) {
                l.memorySize = _(), l.memoryAlign = _(), l.tableSize = _(), l.tableAlign = _();
                for (var u = _(), d = 0; d < u; ++d) {
                  var c = n();
                  l.neededDynlibs.push(c);
                }
              } else {
                s("dylink.0" !== a);
                for (; t < r; ) {
                  var m = e[t++], p = _();
                  if (1 === m)
                    l.memorySize = _(), l.memoryAlign = _(), l.tableSize = _(), l.tableAlign = _();
                  else if (2 === m)
                    for (u = _(), d = 0; d < u; ++d)
                      c = n(), l.neededDynlibs.push(c);
                  else if (3 === m)
                    for (var f = _(); f--; ) {
                      var h = n();
                      256 & _() && l.tlsExports.add(h);
                    }
                  else if (4 === m)
                    for (f = _(); f--; ) {
                      n(), h = n();
                      1 == (3 & _()) && l.weakImports.add(h);
                    }
                  else
                    t += p;
                }
              }
              return l;
            }
            function getValue(e, t = "i8") {
              switch (t.endsWith("*") && (t = "*"), t) {
                case "i1":
                case "i8":
                  return HEAP8[e >> 0];
                case "i16":
                  return HEAP16[e >> 1];
                case "i32":
                case "i64":
                  return HEAP32[e >> 2];
                case "float":
                  return HEAPF32[e >> 2];
                case "double":
                  return HEAPF64[e >> 3];
                case "*":
                  return HEAPU32[e >> 2];
                default:
                  abort("invalid type for getValue: " + t);
              }
              return null;
            }
            function asmjsMangle(e) {
              return 0 == e.indexOf("dynCall_") || ["stackAlloc", "stackSave", "stackRestore", "getTempRet0", "setTempRet0"].includes(e) ? e : "_" + e;
            }
            function mergeLibSymbols(e, t) {
              for (var r in e)
                if (e.hasOwnProperty(r)) {
                  asmLibraryArg.hasOwnProperty(r) || (asmLibraryArg[r] = e[r]);
                  var _ = asmjsMangle(r);
                  Module.hasOwnProperty(_) || (Module[_] = e[r]), "__main_argc_argv" == r && (Module._main = e[r]);
                }
            }
            var LDSO = { loadedLibsByName: {}, loadedLibsByHandle: {} };
            function dynCallLegacy(e, t, r) {
              var _ = Module["dynCall_" + e];
              return r && r.length ? _.apply(null, [t].concat(r)) : _.call(null, t);
            }
            var wasmTableMirror = [];
            function getWasmTableEntry(e) {
              var t = wasmTableMirror[e];
              return t || (e >= wasmTableMirror.length && (wasmTableMirror.length = e + 1), wasmTableMirror[e] = t = wasmTable.get(e)), t;
            }
            function dynCall(e, t, r) {
              return e.includes("j") ? dynCallLegacy(e, t, r) : getWasmTableEntry(t).apply(null, r);
            }
            function createInvokeFunction(e) {
              return function() {
                var t = stackSave();
                try {
                  return dynCall(e, arguments[0], Array.prototype.slice.call(arguments, 1));
                } catch (e2) {
                  if (stackRestore(t), e2 !== e2 + 0)
                    throw e2;
                  _setThrew(1, 0);
                }
              };
            }
            var ___heap_base = 78144;
            function zeroMemory(e, t) {
              return HEAPU8.fill(0, e, e + t), e;
            }
            function getMemory(e) {
              if (runtimeInitialized)
                return zeroMemory(_malloc(e), e);
              var t = ___heap_base, r = t + e + 15 & -16;
              return ___heap_base = r, GOT.__heap_base.value = r, t;
            }
            function isInternalSym(e) {
              return ["__cpp_exception", "__c_longjmp", "__wasm_apply_data_relocs", "__dso_handle", "__tls_size", "__tls_align", "__set_stack_limits", "_emscripten_tls_init", "__wasm_init_tls", "__wasm_call_ctors", "__start_em_asm", "__stop_em_asm"].includes(e);
            }
            function uleb128Encode(e, t) {
              e < 128 ? t.push(e) : t.push(e % 128 | 128, e >> 7);
            }
            function sigToWasmTypes(e) {
              for (var t = { i: "i32", j: "i32", f: "f32", d: "f64", p: "i32" }, r = { parameters: [], results: "v" == e[0] ? [] : [t[e[0]]] }, _ = 1; _ < e.length; ++_)
                r.parameters.push(t[e[_]]), "j" === e[_] && r.parameters.push("i32");
              return r;
            }
            function generateFuncType(e, t) {
              var r = e.slice(0, 1), _ = e.slice(1), n = { i: 127, p: 127, j: 126, f: 125, d: 124 };
              t.push(96), uleb128Encode(_.length, t);
              for (var s = 0; s < _.length; ++s)
                t.push(n[_[s]]);
              "v" == r ? t.push(0) : t.push(1, n[r]);
            }
            function convertJsFunctionToWasm(e, t) {
              if ("function" == typeof WebAssembly.Function)
                return new WebAssembly.Function(sigToWasmTypes(t), e);
              var r = [1];
              generateFuncType(t, r);
              var _ = [0, 97, 115, 109, 1, 0, 0, 0, 1];
              uleb128Encode(r.length, _), _.push.apply(_, r), _.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
              var n = new WebAssembly.Module(new Uint8Array(_));
              return new WebAssembly.Instance(n, { e: { f: e } }).exports.f;
            }
            function updateTableMap(e, t) {
              if (functionsInTableMap)
                for (var r = e; r < e + t; r++) {
                  var _ = getWasmTableEntry(r);
                  _ && functionsInTableMap.set(_, r);
                }
            }
            var functionsInTableMap = void 0, freeTableIndexes = [];
            function getEmptyTableSlot() {
              if (freeTableIndexes.length)
                return freeTableIndexes.pop();
              try {
                wasmTable.grow(1);
              } catch (e) {
                if (!(e instanceof RangeError))
                  throw e;
                throw "Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.";
              }
              return wasmTable.length - 1;
            }
            function setWasmTableEntry(e, t) {
              wasmTable.set(e, t), wasmTableMirror[e] = wasmTable.get(e);
            }
            function addFunction(e, t) {
              if (functionsInTableMap || (functionsInTableMap = /* @__PURE__ */ new WeakMap(), updateTableMap(0, wasmTable.length)), functionsInTableMap.has(e))
                return functionsInTableMap.get(e);
              var r = getEmptyTableSlot();
              try {
                setWasmTableEntry(r, e);
              } catch (_) {
                if (!(_ instanceof TypeError))
                  throw _;
                setWasmTableEntry(r, convertJsFunctionToWasm(e, t));
              }
              return functionsInTableMap.set(e, r), r;
            }
            function updateGOT(e, t) {
              for (var r in e)
                if (!isInternalSym(r)) {
                  var _ = e[r];
                  r.startsWith("orig$") && (r = r.split("$")[1], t = true), GOT[r] || (GOT[r] = new WebAssembly.Global({ value: "i32", mutable: true })), (t || 0 == GOT[r].value) && ("function" == typeof _ ? GOT[r].value = addFunction(_) : "number" == typeof _ ? GOT[r].value = _ : err("unhandled export type for `" + r + "`: " + typeof _));
                }
            }
            function relocateExports(e, t, r) {
              var _ = {};
              for (var n in e) {
                var s = e[n];
                "object" == typeof s && (s = s.value), "number" == typeof s && (s += t), _[n] = s;
              }
              return updateGOT(_, r), _;
            }
            function resolveGlobalSymbol(e, t) {
              var r;
              return t && (r = asmLibraryArg["orig$" + e]), r || (r = asmLibraryArg[e]) && r.stub && (r = void 0), r || (r = Module[asmjsMangle(e)]), !r && e.startsWith("invoke_") && (r = createInvokeFunction(e.split("_")[1])), r;
            }
            function alignMemory(e, t) {
              return Math.ceil(e / t) * t;
            }
            function loadWebAssemblyModule(binary, flags, handle) {
              var metadata = getDylinkMetadata(binary);
              function loadModule() {
                var firstLoad = !handle || !HEAP8[handle + 12 >> 0];
                if (firstLoad) {
                  var memAlign = Math.pow(2, metadata.memoryAlign);
                  memAlign = Math.max(memAlign, STACK_ALIGN);
                  var memoryBase = metadata.memorySize ? alignMemory(getMemory(metadata.memorySize + memAlign), memAlign) : 0, tableBase = metadata.tableSize ? wasmTable.length : 0;
                  handle && (HEAP8[handle + 12 >> 0] = 1, HEAPU32[handle + 16 >> 2] = memoryBase, HEAP32[handle + 20 >> 2] = metadata.memorySize, HEAPU32[handle + 24 >> 2] = tableBase, HEAP32[handle + 28 >> 2] = metadata.tableSize);
                } else
                  memoryBase = HEAPU32[handle + 16 >> 2], tableBase = HEAPU32[handle + 24 >> 2];
                var tableGrowthNeeded = tableBase + metadata.tableSize - wasmTable.length, moduleExports;
                function resolveSymbol(e) {
                  var t = resolveGlobalSymbol(e, false);
                  return t || (t = moduleExports[e]), t;
                }
                tableGrowthNeeded > 0 && wasmTable.grow(tableGrowthNeeded);
                var proxyHandler = { get: function(e, t) {
                  switch (t) {
                    case "__memory_base":
                      return memoryBase;
                    case "__table_base":
                      return tableBase;
                  }
                  if (t in asmLibraryArg)
                    return asmLibraryArg[t];
                  var r;
                  t in e || (e[t] = function() {
                    return r || (r = resolveSymbol(t)), r.apply(null, arguments);
                  });
                  return e[t];
                } }, proxy = new Proxy({}, proxyHandler), info = { "GOT.mem": new Proxy({}, GOTHandler), "GOT.func": new Proxy({}, GOTHandler), env: proxy, wasi_snapshot_preview1: proxy };
                function postInstantiation(instance) {
                  function addEmAsm(addr, body) {
                    for (var args = [], arity = 0; arity < 16 && -1 != body.indexOf("$" + arity); arity++)
                      args.push("$" + arity);
                    args = args.join(",");
                    var func = "(" + args + " ) => { " + body + "};";
                    ASM_CONSTS[start] = eval(func);
                  }
                  if (updateTableMap(tableBase, metadata.tableSize), moduleExports = relocateExports(instance.exports, memoryBase), flags.allowUndefined || reportUndefinedSymbols(), "__start_em_asm" in moduleExports)
                    for (var start = moduleExports.__start_em_asm, stop = moduleExports.__stop_em_asm; start < stop; ) {
                      var jsString = UTF8ToString(start);
                      addEmAsm(start, jsString), start = HEAPU8.indexOf(0, start) + 1;
                    }
                  var applyRelocs = moduleExports.__wasm_apply_data_relocs;
                  applyRelocs && (runtimeInitialized ? applyRelocs() : __RELOC_FUNCS__.push(applyRelocs));
                  var init = moduleExports.__wasm_call_ctors;
                  return init && (runtimeInitialized ? init() : __ATINIT__.push(init)), moduleExports;
                }
                if (flags.loadAsync) {
                  if (binary instanceof WebAssembly.Module) {
                    var instance = new WebAssembly.Instance(binary, info);
                    return Promise.resolve(postInstantiation(instance));
                  }
                  return WebAssembly.instantiate(binary, info).then(function(e) {
                    return postInstantiation(e.instance);
                  });
                }
                var module = binary instanceof WebAssembly.Module ? binary : new WebAssembly.Module(binary), instance = new WebAssembly.Instance(module, info);
                return postInstantiation(instance);
              }
              return CurrentModuleWeakSymbols = metadata.weakImports, flags.loadAsync ? metadata.neededDynlibs.reduce(function(e, t) {
                return e.then(function() {
                  return loadDynamicLibrary(t, flags);
                });
              }, Promise.resolve()).then(function() {
                return loadModule();
              }) : (metadata.neededDynlibs.forEach(function(e) {
                loadDynamicLibrary(e, flags);
              }), loadModule());
            }
            function loadDynamicLibrary(e, t, r) {
              t = t || { global: true, nodelete: true };
              var _ = LDSO.loadedLibsByName[e];
              if (_)
                return t.global && !_.global && (_.global = true, "loading" !== _.module && mergeLibSymbols(_.module, e)), t.nodelete && _.refcount !== 1 / 0 && (_.refcount = 1 / 0), _.refcount++, r && (LDSO.loadedLibsByHandle[r] = _), !t.loadAsync || Promise.resolve(true);
              function n(e2) {
                if (t.fs && t.fs.findObject(e2)) {
                  var r2 = t.fs.readFile(e2, { encoding: "binary" });
                  return r2 instanceof Uint8Array || (r2 = new Uint8Array(r2)), t.loadAsync ? Promise.resolve(r2) : r2;
                }
                if (e2 = locateFile(e2), t.loadAsync)
                  return new Promise(function(t2, r3) {
                    readAsync(e2, (e3) => t2(new Uint8Array(e3)), r3);
                  });
                if (!readBinary)
                  throw new Error(e2 + ": file not found, and synchronous loading of external files is not available");
                return readBinary(e2);
              }
              function s() {
                if ("undefined" != typeof preloadedWasm && preloadedWasm[e]) {
                  var _2 = preloadedWasm[e];
                  return t.loadAsync ? Promise.resolve(_2) : _2;
                }
                return t.loadAsync ? n(e).then(function(e2) {
                  return loadWebAssemblyModule(e2, t, r);
                }) : loadWebAssemblyModule(n(e), t, r);
              }
              function a(t2) {
                _.global && mergeLibSymbols(t2, e), _.module = t2;
              }
              return _ = { refcount: t.nodelete ? 1 / 0 : 1, name: e, module: "loading", global: t.global }, LDSO.loadedLibsByName[e] = _, r && (LDSO.loadedLibsByHandle[r] = _), t.loadAsync ? s().then(function(e2) {
                return a(e2), true;
              }) : (a(s()), true);
            }
            function reportUndefinedSymbols() {
              for (var e in GOT)
                if (0 == GOT[e].value) {
                  var t = resolveGlobalSymbol(e, true);
                  if (!t && !GOT[e].required)
                    continue;
                  if ("function" == typeof t)
                    GOT[e].value = addFunction(t, t.sig);
                  else {
                    if ("number" != typeof t)
                      throw new Error("bad export type for `" + e + "`: " + typeof t);
                    GOT[e].value = t;
                  }
                }
            }
            function preloadDylibs() {
              dynamicLibraries.length ? (addRunDependency("preloadDylibs"), dynamicLibraries.reduce(function(e, t) {
                return e.then(function() {
                  return loadDynamicLibrary(t, { loadAsync: true, global: true, nodelete: true, allowUndefined: true });
                });
              }, Promise.resolve()).then(function() {
                reportUndefinedSymbols(), removeRunDependency("preloadDylibs");
              })) : reportUndefinedSymbols();
            }
            function setValue(e, t, r = "i8") {
              switch (r.endsWith("*") && (r = "*"), r) {
                case "i1":
                case "i8":
                  HEAP8[e >> 0] = t;
                  break;
                case "i16":
                  HEAP16[e >> 1] = t;
                  break;
                case "i32":
                  HEAP32[e >> 2] = t;
                  break;
                case "i64":
                  tempI64 = [t >>> 0, (tempDouble = t, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[e >> 2] = tempI64[0], HEAP32[e + 4 >> 2] = tempI64[1];
                  break;
                case "float":
                  HEAPF32[e >> 2] = t;
                  break;
                case "double":
                  HEAPF64[e >> 3] = t;
                  break;
                case "*":
                  HEAPU32[e >> 2] = t;
                  break;
                default:
                  abort("invalid type for setValue: " + r);
              }
            }
            var ___memory_base = new WebAssembly.Global({ value: "i32", mutable: false }, 1024), ___stack_pointer = new WebAssembly.Global({ value: "i32", mutable: true }, 78144), ___table_base = new WebAssembly.Global({ value: "i32", mutable: false }, 1), nowIsMonotonic = true, _emscripten_get_now;
            function __emscripten_get_now_is_monotonic() {
              return nowIsMonotonic;
            }
            function _abort() {
              abort("");
            }
            function _emscripten_date_now() {
              return Date.now();
            }
            function _emscripten_memcpy_big(e, t, r) {
              HEAPU8.copyWithin(e, t, t + r);
            }
            function getHeapMax() {
              return 2147483648;
            }
            function emscripten_realloc_buffer(e) {
              try {
                return wasmMemory.grow(e - buffer.byteLength + 65535 >>> 16), updateGlobalBufferAndViews(wasmMemory.buffer), 1;
              } catch (e2) {
              }
            }
            function _emscripten_resize_heap(e) {
              var t = HEAPU8.length;
              e >>>= 0;
              var r = getHeapMax();
              if (e > r)
                return false;
              for (var _ = 1; _ <= 4; _ *= 2) {
                var n = t * (1 + 0.2 / _);
                if (n = Math.min(n, e + 100663296), emscripten_realloc_buffer(Math.min(r, (s = Math.max(e, n)) + ((a = 65536) - s % a) % a)))
                  return true;
              }
              var s, a;
              return false;
            }
            __emscripten_get_now_is_monotonic.sig = "i", Module._abort = _abort, _abort.sig = "v", _emscripten_date_now.sig = "d", _emscripten_get_now = ENVIRONMENT_IS_NODE ? () => {
              var e = process.hrtime();
              return 1e3 * e[0] + e[1] / 1e6;
            } : () => performance.now(), _emscripten_get_now.sig = "d", _emscripten_memcpy_big.sig = "vppp", _emscripten_resize_heap.sig = "ip";
            var SYSCALLS = { DEFAULT_POLLMASK: 5, calculateAt: function(e, t, r) {
              if (PATH.isAbs(t))
                return t;
              var _;
              -100 === e ? _ = FS.cwd() : _ = SYSCALLS.getStreamFromFD(e).path;
              if (0 == t.length) {
                if (!r)
                  throw new FS.ErrnoError(44);
                return _;
              }
              return PATH.join2(_, t);
            }, doStat: function(e, t, r) {
              try {
                var _ = e(t);
              } catch (e2) {
                if (e2 && e2.node && PATH.normalize(t) !== PATH.normalize(FS.getPath(e2.node)))
                  return -54;
                throw e2;
              }
              HEAP32[r >> 2] = _.dev, HEAP32[r + 8 >> 2] = _.ino, HEAP32[r + 12 >> 2] = _.mode, HEAPU32[r + 16 >> 2] = _.nlink, HEAP32[r + 20 >> 2] = _.uid, HEAP32[r + 24 >> 2] = _.gid, HEAP32[r + 28 >> 2] = _.rdev, tempI64 = [_.size >>> 0, (tempDouble = _.size, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[r + 40 >> 2] = tempI64[0], HEAP32[r + 44 >> 2] = tempI64[1], HEAP32[r + 48 >> 2] = 4096, HEAP32[r + 52 >> 2] = _.blocks;
              var n = _.atime.getTime(), s = _.mtime.getTime(), a = _.ctime.getTime();
              return tempI64 = [Math.floor(n / 1e3) >>> 0, (tempDouble = Math.floor(n / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[r + 56 >> 2] = tempI64[0], HEAP32[r + 60 >> 2] = tempI64[1], HEAPU32[r + 64 >> 2] = n % 1e3 * 1e3, tempI64 = [Math.floor(s / 1e3) >>> 0, (tempDouble = Math.floor(s / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[r + 72 >> 2] = tempI64[0], HEAP32[r + 76 >> 2] = tempI64[1], HEAPU32[r + 80 >> 2] = s % 1e3 * 1e3, tempI64 = [Math.floor(a / 1e3) >>> 0, (tempDouble = Math.floor(a / 1e3), +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[r + 88 >> 2] = tempI64[0], HEAP32[r + 92 >> 2] = tempI64[1], HEAPU32[r + 96 >> 2] = a % 1e3 * 1e3, tempI64 = [_.ino >>> 0, (tempDouble = _.ino, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[r + 104 >> 2] = tempI64[0], HEAP32[r + 108 >> 2] = tempI64[1], 0;
            }, doMsync: function(e, t, r, _, n) {
              if (!FS.isFile(t.node.mode))
                throw new FS.ErrnoError(43);
              if (2 & _)
                return 0;
              var s = HEAPU8.slice(e, e + r);
              FS.msync(t, s, n, r, _);
            }, varargs: void 0, get: function() {
              return SYSCALLS.varargs += 4, HEAP32[SYSCALLS.varargs - 4 >> 2];
            }, getStr: function(e) {
              return UTF8ToString(e);
            }, getStreamFromFD: function(e) {
              var t = FS.getStream(e);
              if (!t)
                throw new FS.ErrnoError(8);
              return t;
            } };
            function _proc_exit(e) {
              EXITSTATUS = e, keepRuntimeAlive() || (Module.onExit && Module.onExit(e), ABORT = true), quit_(e, new ExitStatus(e));
            }
            function exitJS(e, t) {
              EXITSTATUS = e, _proc_exit(e);
            }
            _proc_exit.sig = "vi";
            var _exit = exitJS;
            function _fd_close(e) {
              try {
                var t = SYSCALLS.getStreamFromFD(e);
                return FS.close(t), 0;
              } catch (e2) {
                if ("undefined" == typeof FS || !(e2 instanceof FS.ErrnoError))
                  throw e2;
                return e2.errno;
              }
            }
            function convertI32PairToI53Checked(e, t) {
              return t + 2097152 >>> 0 < 4194305 - !!e ? (e >>> 0) + 4294967296 * t : NaN;
            }
            function _fd_seek(e, t, r, _, n) {
              try {
                var s = convertI32PairToI53Checked(t, r);
                if (isNaN(s))
                  return 61;
                var a = SYSCALLS.getStreamFromFD(e);
                return FS.llseek(a, s, _), tempI64 = [a.position >>> 0, (tempDouble = a.position, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (0 | Math.min(+Math.floor(tempDouble / 4294967296), 4294967295)) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[n >> 2] = tempI64[0], HEAP32[n + 4 >> 2] = tempI64[1], a.getdents && 0 === s && 0 === _ && (a.getdents = null), 0;
              } catch (e2) {
                if ("undefined" == typeof FS || !(e2 instanceof FS.ErrnoError))
                  throw e2;
                return e2.errno;
              }
            }
            function doWritev(e, t, r, _) {
              for (var n = 0, s = 0; s < r; s++) {
                var a = HEAPU32[t >> 2], o = HEAPU32[t + 4 >> 2];
                t += 8;
                var i = FS.write(e, HEAP8, a, o, _);
                if (i < 0)
                  return -1;
                n += i, void 0 !== _ && (_ += i);
              }
              return n;
            }
            function _fd_write(e, t, r, _) {
              try {
                var n = doWritev(SYSCALLS.getStreamFromFD(e), t, r);
                return HEAPU32[_ >> 2] = n, 0;
              } catch (e2) {
                if ("undefined" == typeof FS || !(e2 instanceof FS.ErrnoError))
                  throw e2;
                return e2.errno;
              }
            }
            function _tree_sitter_log_callback(e, t) {
              if (currentLogCallback) {
                const r = UTF8ToString(t);
                currentLogCallback(r, 0 !== e);
              }
            }
            function _tree_sitter_parse_callback(e, t, r, _, n) {
              var s = currentParseCallback(t, { row: r, column: _ });
              "string" == typeof s ? (setValue(n, s.length, "i32"), stringToUTF16(s, e, 10240)) : setValue(n, 0, "i32");
            }
            function handleException(e) {
              if (e instanceof ExitStatus || "unwind" == e)
                return EXITSTATUS;
              quit_(1, e);
            }
            function allocateUTF8OnStack(e) {
              var t = lengthBytesUTF8(e) + 1, r = stackAlloc(t);
              return stringToUTF8Array(e, HEAP8, r, t), r;
            }
            function stringToUTF16(e, t, r) {
              if (void 0 === r && (r = 2147483647), r < 2)
                return 0;
              for (var _ = t, n = (r -= 2) < 2 * e.length ? r / 2 : e.length, s = 0; s < n; ++s) {
                var a = e.charCodeAt(s);
                HEAP16[t >> 1] = a, t += 2;
              }
              return HEAP16[t >> 1] = 0, t - _;
            }
            function AsciiToString(e) {
              for (var t = ""; ; ) {
                var r = HEAPU8[e++ >> 0];
                if (!r)
                  return t;
                t += String.fromCharCode(r);
              }
            }
            _exit.sig = "vi", _fd_close.sig = "ii", _fd_seek.sig = "iijip", _fd_write.sig = "iippp";
            var asmLibraryArg = { __heap_base: ___heap_base, __indirect_function_table: wasmTable, __memory_base: ___memory_base, __stack_pointer: ___stack_pointer, __table_base: ___table_base, _emscripten_get_now_is_monotonic: __emscripten_get_now_is_monotonic, abort: _abort, emscripten_get_now: _emscripten_get_now, emscripten_memcpy_big: _emscripten_memcpy_big, emscripten_resize_heap: _emscripten_resize_heap, exit: _exit, fd_close: _fd_close, fd_seek: _fd_seek, fd_write: _fd_write, memory: wasmMemory, tree_sitter_log_callback: _tree_sitter_log_callback, tree_sitter_parse_callback: _tree_sitter_parse_callback }, asm = createWasm(), ___wasm_call_ctors = Module.___wasm_call_ctors = function() {
              return (___wasm_call_ctors = Module.___wasm_call_ctors = Module.asm.__wasm_call_ctors).apply(null, arguments);
            }, ___wasm_apply_data_relocs = Module.___wasm_apply_data_relocs = function() {
              return (___wasm_apply_data_relocs = Module.___wasm_apply_data_relocs = Module.asm.__wasm_apply_data_relocs).apply(null, arguments);
            }, _malloc = Module._malloc = function() {
              return (_malloc = Module._malloc = Module.asm.malloc).apply(null, arguments);
            }, _calloc = Module._calloc = function() {
              return (_calloc = Module._calloc = Module.asm.calloc).apply(null, arguments);
            }, _realloc = Module._realloc = function() {
              return (_realloc = Module._realloc = Module.asm.realloc).apply(null, arguments);
            }, _free = Module._free = function() {
              return (_free = Module._free = Module.asm.free).apply(null, arguments);
            }, _ts_language_symbol_count = Module._ts_language_symbol_count = function() {
              return (_ts_language_symbol_count = Module._ts_language_symbol_count = Module.asm.ts_language_symbol_count).apply(null, arguments);
            }, _ts_language_version = Module._ts_language_version = function() {
              return (_ts_language_version = Module._ts_language_version = Module.asm.ts_language_version).apply(null, arguments);
            }, _ts_language_field_count = Module._ts_language_field_count = function() {
              return (_ts_language_field_count = Module._ts_language_field_count = Module.asm.ts_language_field_count).apply(null, arguments);
            }, _ts_language_symbol_name = Module._ts_language_symbol_name = function() {
              return (_ts_language_symbol_name = Module._ts_language_symbol_name = Module.asm.ts_language_symbol_name).apply(null, arguments);
            }, _ts_language_symbol_for_name = Module._ts_language_symbol_for_name = function() {
              return (_ts_language_symbol_for_name = Module._ts_language_symbol_for_name = Module.asm.ts_language_symbol_for_name).apply(null, arguments);
            }, _ts_language_symbol_type = Module._ts_language_symbol_type = function() {
              return (_ts_language_symbol_type = Module._ts_language_symbol_type = Module.asm.ts_language_symbol_type).apply(null, arguments);
            }, _ts_language_field_name_for_id = Module._ts_language_field_name_for_id = function() {
              return (_ts_language_field_name_for_id = Module._ts_language_field_name_for_id = Module.asm.ts_language_field_name_for_id).apply(null, arguments);
            }, _memset = Module._memset = function() {
              return (_memset = Module._memset = Module.asm.memset).apply(null, arguments);
            }, _memcpy = Module._memcpy = function() {
              return (_memcpy = Module._memcpy = Module.asm.memcpy).apply(null, arguments);
            }, _ts_parser_delete = Module._ts_parser_delete = function() {
              return (_ts_parser_delete = Module._ts_parser_delete = Module.asm.ts_parser_delete).apply(null, arguments);
            }, _ts_parser_reset = Module._ts_parser_reset = function() {
              return (_ts_parser_reset = Module._ts_parser_reset = Module.asm.ts_parser_reset).apply(null, arguments);
            }, _ts_parser_set_language = Module._ts_parser_set_language = function() {
              return (_ts_parser_set_language = Module._ts_parser_set_language = Module.asm.ts_parser_set_language).apply(null, arguments);
            }, _ts_parser_timeout_micros = Module._ts_parser_timeout_micros = function() {
              return (_ts_parser_timeout_micros = Module._ts_parser_timeout_micros = Module.asm.ts_parser_timeout_micros).apply(null, arguments);
            }, _ts_parser_set_timeout_micros = Module._ts_parser_set_timeout_micros = function() {
              return (_ts_parser_set_timeout_micros = Module._ts_parser_set_timeout_micros = Module.asm.ts_parser_set_timeout_micros).apply(null, arguments);
            }, _memmove = Module._memmove = function() {
              return (_memmove = Module._memmove = Module.asm.memmove).apply(null, arguments);
            }, _memcmp = Module._memcmp = function() {
              return (_memcmp = Module._memcmp = Module.asm.memcmp).apply(null, arguments);
            }, _ts_query_new = Module._ts_query_new = function() {
              return (_ts_query_new = Module._ts_query_new = Module.asm.ts_query_new).apply(null, arguments);
            }, _ts_query_delete = Module._ts_query_delete = function() {
              return (_ts_query_delete = Module._ts_query_delete = Module.asm.ts_query_delete).apply(null, arguments);
            }, _iswspace = Module._iswspace = function() {
              return (_iswspace = Module._iswspace = Module.asm.iswspace).apply(null, arguments);
            }, _iswalnum = Module._iswalnum = function() {
              return (_iswalnum = Module._iswalnum = Module.asm.iswalnum).apply(null, arguments);
            }, _ts_query_pattern_count = Module._ts_query_pattern_count = function() {
              return (_ts_query_pattern_count = Module._ts_query_pattern_count = Module.asm.ts_query_pattern_count).apply(null, arguments);
            }, _ts_query_capture_count = Module._ts_query_capture_count = function() {
              return (_ts_query_capture_count = Module._ts_query_capture_count = Module.asm.ts_query_capture_count).apply(null, arguments);
            }, _ts_query_string_count = Module._ts_query_string_count = function() {
              return (_ts_query_string_count = Module._ts_query_string_count = Module.asm.ts_query_string_count).apply(null, arguments);
            }, _ts_query_capture_name_for_id = Module._ts_query_capture_name_for_id = function() {
              return (_ts_query_capture_name_for_id = Module._ts_query_capture_name_for_id = Module.asm.ts_query_capture_name_for_id).apply(null, arguments);
            }, _ts_query_string_value_for_id = Module._ts_query_string_value_for_id = function() {
              return (_ts_query_string_value_for_id = Module._ts_query_string_value_for_id = Module.asm.ts_query_string_value_for_id).apply(null, arguments);
            }, _ts_query_predicates_for_pattern = Module._ts_query_predicates_for_pattern = function() {
              return (_ts_query_predicates_for_pattern = Module._ts_query_predicates_for_pattern = Module.asm.ts_query_predicates_for_pattern).apply(null, arguments);
            }, _ts_tree_copy = Module._ts_tree_copy = function() {
              return (_ts_tree_copy = Module._ts_tree_copy = Module.asm.ts_tree_copy).apply(null, arguments);
            }, _ts_tree_delete = Module._ts_tree_delete = function() {
              return (_ts_tree_delete = Module._ts_tree_delete = Module.asm.ts_tree_delete).apply(null, arguments);
            }, _ts_init = Module._ts_init = function() {
              return (_ts_init = Module._ts_init = Module.asm.ts_init).apply(null, arguments);
            }, _ts_parser_new_wasm = Module._ts_parser_new_wasm = function() {
              return (_ts_parser_new_wasm = Module._ts_parser_new_wasm = Module.asm.ts_parser_new_wasm).apply(null, arguments);
            }, _ts_parser_enable_logger_wasm = Module._ts_parser_enable_logger_wasm = function() {
              return (_ts_parser_enable_logger_wasm = Module._ts_parser_enable_logger_wasm = Module.asm.ts_parser_enable_logger_wasm).apply(null, arguments);
            }, _ts_parser_parse_wasm = Module._ts_parser_parse_wasm = function() {
              return (_ts_parser_parse_wasm = Module._ts_parser_parse_wasm = Module.asm.ts_parser_parse_wasm).apply(null, arguments);
            }, _ts_language_type_is_named_wasm = Module._ts_language_type_is_named_wasm = function() {
              return (_ts_language_type_is_named_wasm = Module._ts_language_type_is_named_wasm = Module.asm.ts_language_type_is_named_wasm).apply(null, arguments);
            }, _ts_language_type_is_visible_wasm = Module._ts_language_type_is_visible_wasm = function() {
              return (_ts_language_type_is_visible_wasm = Module._ts_language_type_is_visible_wasm = Module.asm.ts_language_type_is_visible_wasm).apply(null, arguments);
            }, _ts_tree_root_node_wasm = Module._ts_tree_root_node_wasm = function() {
              return (_ts_tree_root_node_wasm = Module._ts_tree_root_node_wasm = Module.asm.ts_tree_root_node_wasm).apply(null, arguments);
            }, _ts_tree_edit_wasm = Module._ts_tree_edit_wasm = function() {
              return (_ts_tree_edit_wasm = Module._ts_tree_edit_wasm = Module.asm.ts_tree_edit_wasm).apply(null, arguments);
            }, _ts_tree_get_changed_ranges_wasm = Module._ts_tree_get_changed_ranges_wasm = function() {
              return (_ts_tree_get_changed_ranges_wasm = Module._ts_tree_get_changed_ranges_wasm = Module.asm.ts_tree_get_changed_ranges_wasm).apply(null, arguments);
            }, _ts_tree_cursor_new_wasm = Module._ts_tree_cursor_new_wasm = function() {
              return (_ts_tree_cursor_new_wasm = Module._ts_tree_cursor_new_wasm = Module.asm.ts_tree_cursor_new_wasm).apply(null, arguments);
            }, _ts_tree_cursor_delete_wasm = Module._ts_tree_cursor_delete_wasm = function() {
              return (_ts_tree_cursor_delete_wasm = Module._ts_tree_cursor_delete_wasm = Module.asm.ts_tree_cursor_delete_wasm).apply(null, arguments);
            }, _ts_tree_cursor_reset_wasm = Module._ts_tree_cursor_reset_wasm = function() {
              return (_ts_tree_cursor_reset_wasm = Module._ts_tree_cursor_reset_wasm = Module.asm.ts_tree_cursor_reset_wasm).apply(null, arguments);
            }, _ts_tree_cursor_goto_first_child_wasm = Module._ts_tree_cursor_goto_first_child_wasm = function() {
              return (_ts_tree_cursor_goto_first_child_wasm = Module._ts_tree_cursor_goto_first_child_wasm = Module.asm.ts_tree_cursor_goto_first_child_wasm).apply(null, arguments);
            }, _ts_tree_cursor_goto_next_sibling_wasm = Module._ts_tree_cursor_goto_next_sibling_wasm = function() {
              return (_ts_tree_cursor_goto_next_sibling_wasm = Module._ts_tree_cursor_goto_next_sibling_wasm = Module.asm.ts_tree_cursor_goto_next_sibling_wasm).apply(null, arguments);
            }, _ts_tree_cursor_goto_parent_wasm = Module._ts_tree_cursor_goto_parent_wasm = function() {
              return (_ts_tree_cursor_goto_parent_wasm = Module._ts_tree_cursor_goto_parent_wasm = Module.asm.ts_tree_cursor_goto_parent_wasm).apply(null, arguments);
            }, _ts_tree_cursor_current_node_type_id_wasm = Module._ts_tree_cursor_current_node_type_id_wasm = function() {
              return (_ts_tree_cursor_current_node_type_id_wasm = Module._ts_tree_cursor_current_node_type_id_wasm = Module.asm.ts_tree_cursor_current_node_type_id_wasm).apply(null, arguments);
            }, _ts_tree_cursor_current_node_is_named_wasm = Module._ts_tree_cursor_current_node_is_named_wasm = function() {
              return (_ts_tree_cursor_current_node_is_named_wasm = Module._ts_tree_cursor_current_node_is_named_wasm = Module.asm.ts_tree_cursor_current_node_is_named_wasm).apply(null, arguments);
            }, _ts_tree_cursor_current_node_is_missing_wasm = Module._ts_tree_cursor_current_node_is_missing_wasm = function() {
              return (_ts_tree_cursor_current_node_is_missing_wasm = Module._ts_tree_cursor_current_node_is_missing_wasm = Module.asm.ts_tree_cursor_current_node_is_missing_wasm).apply(null, arguments);
            }, _ts_tree_cursor_current_node_id_wasm = Module._ts_tree_cursor_current_node_id_wasm = function() {
              return (_ts_tree_cursor_current_node_id_wasm = Module._ts_tree_cursor_current_node_id_wasm = Module.asm.ts_tree_cursor_current_node_id_wasm).apply(null, arguments);
            }, _ts_tree_cursor_start_position_wasm = Module._ts_tree_cursor_start_position_wasm = function() {
              return (_ts_tree_cursor_start_position_wasm = Module._ts_tree_cursor_start_position_wasm = Module.asm.ts_tree_cursor_start_position_wasm).apply(null, arguments);
            }, _ts_tree_cursor_end_position_wasm = Module._ts_tree_cursor_end_position_wasm = function() {
              return (_ts_tree_cursor_end_position_wasm = Module._ts_tree_cursor_end_position_wasm = Module.asm.ts_tree_cursor_end_position_wasm).apply(null, arguments);
            }, _ts_tree_cursor_start_index_wasm = Module._ts_tree_cursor_start_index_wasm = function() {
              return (_ts_tree_cursor_start_index_wasm = Module._ts_tree_cursor_start_index_wasm = Module.asm.ts_tree_cursor_start_index_wasm).apply(null, arguments);
            }, _ts_tree_cursor_end_index_wasm = Module._ts_tree_cursor_end_index_wasm = function() {
              return (_ts_tree_cursor_end_index_wasm = Module._ts_tree_cursor_end_index_wasm = Module.asm.ts_tree_cursor_end_index_wasm).apply(null, arguments);
            }, _ts_tree_cursor_current_field_id_wasm = Module._ts_tree_cursor_current_field_id_wasm = function() {
              return (_ts_tree_cursor_current_field_id_wasm = Module._ts_tree_cursor_current_field_id_wasm = Module.asm.ts_tree_cursor_current_field_id_wasm).apply(null, arguments);
            }, _ts_tree_cursor_current_node_wasm = Module._ts_tree_cursor_current_node_wasm = function() {
              return (_ts_tree_cursor_current_node_wasm = Module._ts_tree_cursor_current_node_wasm = Module.asm.ts_tree_cursor_current_node_wasm).apply(null, arguments);
            }, _ts_node_symbol_wasm = Module._ts_node_symbol_wasm = function() {
              return (_ts_node_symbol_wasm = Module._ts_node_symbol_wasm = Module.asm.ts_node_symbol_wasm).apply(null, arguments);
            }, _ts_node_child_count_wasm = Module._ts_node_child_count_wasm = function() {
              return (_ts_node_child_count_wasm = Module._ts_node_child_count_wasm = Module.asm.ts_node_child_count_wasm).apply(null, arguments);
            }, _ts_node_named_child_count_wasm = Module._ts_node_named_child_count_wasm = function() {
              return (_ts_node_named_child_count_wasm = Module._ts_node_named_child_count_wasm = Module.asm.ts_node_named_child_count_wasm).apply(null, arguments);
            }, _ts_node_child_wasm = Module._ts_node_child_wasm = function() {
              return (_ts_node_child_wasm = Module._ts_node_child_wasm = Module.asm.ts_node_child_wasm).apply(null, arguments);
            }, _ts_node_named_child_wasm = Module._ts_node_named_child_wasm = function() {
              return (_ts_node_named_child_wasm = Module._ts_node_named_child_wasm = Module.asm.ts_node_named_child_wasm).apply(null, arguments);
            }, _ts_node_child_by_field_id_wasm = Module._ts_node_child_by_field_id_wasm = function() {
              return (_ts_node_child_by_field_id_wasm = Module._ts_node_child_by_field_id_wasm = Module.asm.ts_node_child_by_field_id_wasm).apply(null, arguments);
            }, _ts_node_next_sibling_wasm = Module._ts_node_next_sibling_wasm = function() {
              return (_ts_node_next_sibling_wasm = Module._ts_node_next_sibling_wasm = Module.asm.ts_node_next_sibling_wasm).apply(null, arguments);
            }, _ts_node_prev_sibling_wasm = Module._ts_node_prev_sibling_wasm = function() {
              return (_ts_node_prev_sibling_wasm = Module._ts_node_prev_sibling_wasm = Module.asm.ts_node_prev_sibling_wasm).apply(null, arguments);
            }, _ts_node_next_named_sibling_wasm = Module._ts_node_next_named_sibling_wasm = function() {
              return (_ts_node_next_named_sibling_wasm = Module._ts_node_next_named_sibling_wasm = Module.asm.ts_node_next_named_sibling_wasm).apply(null, arguments);
            }, _ts_node_prev_named_sibling_wasm = Module._ts_node_prev_named_sibling_wasm = function() {
              return (_ts_node_prev_named_sibling_wasm = Module._ts_node_prev_named_sibling_wasm = Module.asm.ts_node_prev_named_sibling_wasm).apply(null, arguments);
            }, _ts_node_parent_wasm = Module._ts_node_parent_wasm = function() {
              return (_ts_node_parent_wasm = Module._ts_node_parent_wasm = Module.asm.ts_node_parent_wasm).apply(null, arguments);
            }, _ts_node_descendant_for_index_wasm = Module._ts_node_descendant_for_index_wasm = function() {
              return (_ts_node_descendant_for_index_wasm = Module._ts_node_descendant_for_index_wasm = Module.asm.ts_node_descendant_for_index_wasm).apply(null, arguments);
            }, _ts_node_named_descendant_for_index_wasm = Module._ts_node_named_descendant_for_index_wasm = function() {
              return (_ts_node_named_descendant_for_index_wasm = Module._ts_node_named_descendant_for_index_wasm = Module.asm.ts_node_named_descendant_for_index_wasm).apply(null, arguments);
            }, _ts_node_descendant_for_position_wasm = Module._ts_node_descendant_for_position_wasm = function() {
              return (_ts_node_descendant_for_position_wasm = Module._ts_node_descendant_for_position_wasm = Module.asm.ts_node_descendant_for_position_wasm).apply(null, arguments);
            }, _ts_node_named_descendant_for_position_wasm = Module._ts_node_named_descendant_for_position_wasm = function() {
              return (_ts_node_named_descendant_for_position_wasm = Module._ts_node_named_descendant_for_position_wasm = Module.asm.ts_node_named_descendant_for_position_wasm).apply(null, arguments);
            }, _ts_node_start_point_wasm = Module._ts_node_start_point_wasm = function() {
              return (_ts_node_start_point_wasm = Module._ts_node_start_point_wasm = Module.asm.ts_node_start_point_wasm).apply(null, arguments);
            }, _ts_node_end_point_wasm = Module._ts_node_end_point_wasm = function() {
              return (_ts_node_end_point_wasm = Module._ts_node_end_point_wasm = Module.asm.ts_node_end_point_wasm).apply(null, arguments);
            }, _ts_node_start_index_wasm = Module._ts_node_start_index_wasm = function() {
              return (_ts_node_start_index_wasm = Module._ts_node_start_index_wasm = Module.asm.ts_node_start_index_wasm).apply(null, arguments);
            }, _ts_node_end_index_wasm = Module._ts_node_end_index_wasm = function() {
              return (_ts_node_end_index_wasm = Module._ts_node_end_index_wasm = Module.asm.ts_node_end_index_wasm).apply(null, arguments);
            }, _ts_node_to_string_wasm = Module._ts_node_to_string_wasm = function() {
              return (_ts_node_to_string_wasm = Module._ts_node_to_string_wasm = Module.asm.ts_node_to_string_wasm).apply(null, arguments);
            }, _ts_node_children_wasm = Module._ts_node_children_wasm = function() {
              return (_ts_node_children_wasm = Module._ts_node_children_wasm = Module.asm.ts_node_children_wasm).apply(null, arguments);
            }, _ts_node_named_children_wasm = Module._ts_node_named_children_wasm = function() {
              return (_ts_node_named_children_wasm = Module._ts_node_named_children_wasm = Module.asm.ts_node_named_children_wasm).apply(null, arguments);
            }, _ts_node_descendants_of_type_wasm = Module._ts_node_descendants_of_type_wasm = function() {
              return (_ts_node_descendants_of_type_wasm = Module._ts_node_descendants_of_type_wasm = Module.asm.ts_node_descendants_of_type_wasm).apply(null, arguments);
            }, _ts_node_is_named_wasm = Module._ts_node_is_named_wasm = function() {
              return (_ts_node_is_named_wasm = Module._ts_node_is_named_wasm = Module.asm.ts_node_is_named_wasm).apply(null, arguments);
            }, _ts_node_has_changes_wasm = Module._ts_node_has_changes_wasm = function() {
              return (_ts_node_has_changes_wasm = Module._ts_node_has_changes_wasm = Module.asm.ts_node_has_changes_wasm).apply(null, arguments);
            }, _ts_node_has_error_wasm = Module._ts_node_has_error_wasm = function() {
              return (_ts_node_has_error_wasm = Module._ts_node_has_error_wasm = Module.asm.ts_node_has_error_wasm).apply(null, arguments);
            }, _ts_node_is_missing_wasm = Module._ts_node_is_missing_wasm = function() {
              return (_ts_node_is_missing_wasm = Module._ts_node_is_missing_wasm = Module.asm.ts_node_is_missing_wasm).apply(null, arguments);
            }, _ts_query_matches_wasm = Module._ts_query_matches_wasm = function() {
              return (_ts_query_matches_wasm = Module._ts_query_matches_wasm = Module.asm.ts_query_matches_wasm).apply(null, arguments);
            }, _ts_query_captures_wasm = Module._ts_query_captures_wasm = function() {
              return (_ts_query_captures_wasm = Module._ts_query_captures_wasm = Module.asm.ts_query_captures_wasm).apply(null, arguments);
            }, ___cxa_atexit = Module.___cxa_atexit = function() {
              return (___cxa_atexit = Module.___cxa_atexit = Module.asm.__cxa_atexit).apply(null, arguments);
            }, _iswdigit = Module._iswdigit = function() {
              return (_iswdigit = Module._iswdigit = Module.asm.iswdigit).apply(null, arguments);
            }, _iswalpha = Module._iswalpha = function() {
              return (_iswalpha = Module._iswalpha = Module.asm.iswalpha).apply(null, arguments);
            }, _iswlower = Module._iswlower = function() {
              return (_iswlower = Module._iswlower = Module.asm.iswlower).apply(null, arguments);
            }, _memchr = Module._memchr = function() {
              return (_memchr = Module._memchr = Module.asm.memchr).apply(null, arguments);
            }, _strlen = Module._strlen = function() {
              return (_strlen = Module._strlen = Module.asm.strlen).apply(null, arguments);
            }, _towupper = Module._towupper = function() {
              return (_towupper = Module._towupper = Module.asm.towupper).apply(null, arguments);
            }, _setThrew = Module._setThrew = function() {
              return (_setThrew = Module._setThrew = Module.asm.setThrew).apply(null, arguments);
            }, stackSave = Module.stackSave = function() {
              return (stackSave = Module.stackSave = Module.asm.stackSave).apply(null, arguments);
            }, stackRestore = Module.stackRestore = function() {
              return (stackRestore = Module.stackRestore = Module.asm.stackRestore).apply(null, arguments);
            }, stackAlloc = Module.stackAlloc = function() {
              return (stackAlloc = Module.stackAlloc = Module.asm.stackAlloc).apply(null, arguments);
            }, __Znwm = Module.__Znwm = function() {
              return (__Znwm = Module.__Znwm = Module.asm._Znwm).apply(null, arguments);
            }, __ZdlPv = Module.__ZdlPv = function() {
              return (__ZdlPv = Module.__ZdlPv = Module.asm._ZdlPv).apply(null, arguments);
            }, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev = function() {
              return (__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev = Module.asm._ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEED2Ev).apply(null, arguments);
            }, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm = function() {
              return (__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm = Module.asm._ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9__grow_byEmmmmmm).apply(null, arguments);
            }, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm = function() {
              return (__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm = Module.asm._ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6__initEPKcm).apply(null, arguments);
            }, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm = function() {
              return (__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm = Module.asm._ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE7reserveEm).apply(null, arguments);
            }, __ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm = Module.__ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm = function() {
              return (__ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm = Module.__ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm = Module.asm._ZNKSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE4copyEPcmm).apply(null, arguments);
            }, __ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc = function() {
              return (__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc = Module.__ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc = Module.asm._ZNSt3__212basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE9push_backEc).apply(null, arguments);
            }, __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev = Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev = function() {
              return (__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev = Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev = Module.asm._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEED2Ev).apply(null, arguments);
            }, __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw = Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw = function() {
              return (__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw = Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw = Module.asm._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE9push_backEw).apply(null, arguments);
            }, __ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw = Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw = function() {
              return (__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw = Module.__ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw = Module.asm._ZNSt3__212basic_stringIwNS_11char_traitsIwEENS_9allocatorIwEEE6resizeEmw).apply(null, arguments);
            }, dynCall_jiji = Module.dynCall_jiji = function() {
              return (dynCall_jiji = Module.dynCall_jiji = Module.asm.dynCall_jiji).apply(null, arguments);
            }, _orig$ts_parser_timeout_micros = Module._orig$ts_parser_timeout_micros = function() {
              return (_orig$ts_parser_timeout_micros = Module._orig$ts_parser_timeout_micros = Module.asm.orig$ts_parser_timeout_micros).apply(null, arguments);
            }, _orig$ts_parser_set_timeout_micros = Module._orig$ts_parser_set_timeout_micros = function() {
              return (_orig$ts_parser_set_timeout_micros = Module._orig$ts_parser_set_timeout_micros = Module.asm.orig$ts_parser_set_timeout_micros).apply(null, arguments);
            }, calledRun;
            function callMain(e) {
              var t = Module._main;
              if (t) {
                (e = e || []).unshift(thisProgram);
                var r = e.length, _ = stackAlloc(4 * (r + 1)), n = _ >> 2;
                e.forEach((e2) => {
                  HEAP32[n++] = allocateUTF8OnStack(e2);
                }), HEAP32[n] = 0;
                try {
                  var s = t(r, _);
                  return exitJS(s, true), s;
                } catch (e2) {
                  return handleException(e2);
                }
              }
            }
            Module.AsciiToString = AsciiToString, Module.stringToUTF16 = stringToUTF16, dependenciesFulfilled = function e() {
              calledRun || run(), calledRun || (dependenciesFulfilled = e);
            };
            var dylibsLoaded = false;
            function run(e) {
              function t() {
                calledRun || (calledRun = true, Module.calledRun = true, ABORT || (initRuntime(), preMain(), Module.onRuntimeInitialized && Module.onRuntimeInitialized(), shouldRunNow && callMain(e), postRun()));
              }
              e = e || arguments_, runDependencies > 0 || !dylibsLoaded && (preloadDylibs(), dylibsLoaded = true, runDependencies > 0) || (preRun(), runDependencies > 0 || (Module.setStatus ? (Module.setStatus("Running..."), setTimeout(function() {
                setTimeout(function() {
                  Module.setStatus("");
                }, 1), t();
              }, 1)) : t()));
            }
            if (Module.preInit)
              for ("function" == typeof Module.preInit && (Module.preInit = [Module.preInit]); Module.preInit.length > 0; )
                Module.preInit.pop()();
            var shouldRunNow = true;
            Module.noInitialRun && (shouldRunNow = false), run();
            const C = Module, INTERNAL = {}, SIZE_OF_INT = 4, SIZE_OF_NODE = 5 * SIZE_OF_INT, SIZE_OF_POINT = 2 * SIZE_OF_INT, SIZE_OF_RANGE = 2 * SIZE_OF_INT + 2 * SIZE_OF_POINT, ZERO_POINT = { row: 0, column: 0 }, QUERY_WORD_REGEX = /[\w-.]*/g, PREDICATE_STEP_TYPE_CAPTURE = 1, PREDICATE_STEP_TYPE_STRING = 2, LANGUAGE_FUNCTION_REGEX = /^_?tree_sitter_\w+/;
            var VERSION, MIN_COMPATIBLE_VERSION, TRANSFER_BUFFER, currentParseCallback, currentLogCallback;
            class ParserImpl {
              static init() {
                TRANSFER_BUFFER = C._ts_init(), VERSION = getValue(TRANSFER_BUFFER, "i32"), MIN_COMPATIBLE_VERSION = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
              }
              initialize() {
                C._ts_parser_new_wasm(), this[0] = getValue(TRANSFER_BUFFER, "i32"), this[1] = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
              }
              delete() {
                C._ts_parser_delete(this[0]), C._free(this[1]), this[0] = 0, this[1] = 0;
              }
              setLanguage(e) {
                let t;
                if (e) {
                  if (e.constructor !== Language)
                    throw new Error("Argument must be a Language");
                  {
                    t = e[0];
                    const r = C._ts_language_version(t);
                    if (r < MIN_COMPATIBLE_VERSION || VERSION < r)
                      throw new Error(`Incompatible language version ${r}. Compatibility range ${MIN_COMPATIBLE_VERSION} through ${VERSION}.`);
                  }
                } else
                  t = 0, e = null;
                return this.language = e, C._ts_parser_set_language(this[0], t), this;
              }
              getLanguage() {
                return this.language;
              }
              parse(e, t, r) {
                if ("string" == typeof e)
                  currentParseCallback = (t2, r2, _2) => e.slice(t2, _2);
                else {
                  if ("function" != typeof e)
                    throw new Error("Argument must be a string or a function");
                  currentParseCallback = e;
                }
                this.logCallback ? (currentLogCallback = this.logCallback, C._ts_parser_enable_logger_wasm(this[0], 1)) : (currentLogCallback = null, C._ts_parser_enable_logger_wasm(this[0], 0));
                let _ = 0, n = 0;
                if (r && r.includedRanges) {
                  _ = r.includedRanges.length, n = C._calloc(_, SIZE_OF_RANGE);
                  let e2 = n;
                  for (let t2 = 0; t2 < _; t2++)
                    marshalRange(e2, r.includedRanges[t2]), e2 += SIZE_OF_RANGE;
                }
                const s = C._ts_parser_parse_wasm(this[0], this[1], t ? t[0] : 0, n, _);
                if (!s)
                  throw currentParseCallback = null, currentLogCallback = null, new Error("Parsing failed");
                const a = new Tree(INTERNAL, s, this.language, currentParseCallback);
                return currentParseCallback = null, currentLogCallback = null, a;
              }
              reset() {
                C._ts_parser_reset(this[0]);
              }
              setTimeoutMicros(e) {
                C._ts_parser_set_timeout_micros(this[0], e);
              }
              getTimeoutMicros() {
                return C._ts_parser_timeout_micros(this[0]);
              }
              setLogger(e) {
                if (e) {
                  if ("function" != typeof e)
                    throw new Error("Logger callback must be a function");
                } else
                  e = null;
                return this.logCallback = e, this;
              }
              getLogger() {
                return this.logCallback;
              }
            }
            class Tree {
              constructor(e, t, r, _) {
                assertInternal(e), this[0] = t, this.language = r, this.textCallback = _;
              }
              copy() {
                const e = C._ts_tree_copy(this[0]);
                return new Tree(INTERNAL, e, this.language, this.textCallback);
              }
              delete() {
                C._ts_tree_delete(this[0]), this[0] = 0;
              }
              edit(e) {
                marshalEdit(e), C._ts_tree_edit_wasm(this[0]);
              }
              get rootNode() {
                return C._ts_tree_root_node_wasm(this[0]), unmarshalNode(this);
              }
              getLanguage() {
                return this.language;
              }
              walk() {
                return this.rootNode.walk();
              }
              getChangedRanges(e) {
                if (e.constructor !== Tree)
                  throw new TypeError("Argument must be a Tree");
                C._ts_tree_get_changed_ranges_wasm(this[0], e[0]);
                const t = getValue(TRANSFER_BUFFER, "i32"), r = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), _ = new Array(t);
                if (t > 0) {
                  let e2 = r;
                  for (let r2 = 0; r2 < t; r2++)
                    _[r2] = unmarshalRange(e2), e2 += SIZE_OF_RANGE;
                  C._free(r);
                }
                return _;
              }
            }
            class Node {
              constructor(e, t) {
                assertInternal(e), this.tree = t;
              }
              get typeId() {
                return marshalNode(this), C._ts_node_symbol_wasm(this.tree[0]);
              }
              get type() {
                return this.tree.language.types[this.typeId] || "ERROR";
              }
              get endPosition() {
                return marshalNode(this), C._ts_node_end_point_wasm(this.tree[0]), unmarshalPoint(TRANSFER_BUFFER);
              }
              get endIndex() {
                return marshalNode(this), C._ts_node_end_index_wasm(this.tree[0]);
              }
              get text() {
                return getText(this.tree, this.startIndex, this.endIndex);
              }
              isNamed() {
                return marshalNode(this), 1 === C._ts_node_is_named_wasm(this.tree[0]);
              }
              hasError() {
                return marshalNode(this), 1 === C._ts_node_has_error_wasm(this.tree[0]);
              }
              hasChanges() {
                return marshalNode(this), 1 === C._ts_node_has_changes_wasm(this.tree[0]);
              }
              isMissing() {
                return marshalNode(this), 1 === C._ts_node_is_missing_wasm(this.tree[0]);
              }
              equals(e) {
                return this.id === e.id;
              }
              child(e) {
                return marshalNode(this), C._ts_node_child_wasm(this.tree[0], e), unmarshalNode(this.tree);
              }
              namedChild(e) {
                return marshalNode(this), C._ts_node_named_child_wasm(this.tree[0], e), unmarshalNode(this.tree);
              }
              childForFieldId(e) {
                return marshalNode(this), C._ts_node_child_by_field_id_wasm(this.tree[0], e), unmarshalNode(this.tree);
              }
              childForFieldName(e) {
                const t = this.tree.language.fields.indexOf(e);
                if (-1 !== t)
                  return this.childForFieldId(t);
              }
              get childCount() {
                return marshalNode(this), C._ts_node_child_count_wasm(this.tree[0]);
              }
              get namedChildCount() {
                return marshalNode(this), C._ts_node_named_child_count_wasm(this.tree[0]);
              }
              get firstChild() {
                return this.child(0);
              }
              get firstNamedChild() {
                return this.namedChild(0);
              }
              get lastChild() {
                return this.child(this.childCount - 1);
              }
              get lastNamedChild() {
                return this.namedChild(this.namedChildCount - 1);
              }
              get children() {
                if (!this._children) {
                  marshalNode(this), C._ts_node_children_wasm(this.tree[0]);
                  const e = getValue(TRANSFER_BUFFER, "i32"), t = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
                  if (this._children = new Array(e), e > 0) {
                    let r = t;
                    for (let t2 = 0; t2 < e; t2++)
                      this._children[t2] = unmarshalNode(this.tree, r), r += SIZE_OF_NODE;
                    C._free(t);
                  }
                }
                return this._children;
              }
              get namedChildren() {
                if (!this._namedChildren) {
                  marshalNode(this), C._ts_node_named_children_wasm(this.tree[0]);
                  const e = getValue(TRANSFER_BUFFER, "i32"), t = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32");
                  if (this._namedChildren = new Array(e), e > 0) {
                    let r = t;
                    for (let t2 = 0; t2 < e; t2++)
                      this._namedChildren[t2] = unmarshalNode(this.tree, r), r += SIZE_OF_NODE;
                    C._free(t);
                  }
                }
                return this._namedChildren;
              }
              descendantsOfType(e, t, r) {
                Array.isArray(e) || (e = [e]), t || (t = ZERO_POINT), r || (r = ZERO_POINT);
                const _ = [], n = this.tree.language.types;
                for (let t2 = 0, r2 = n.length; t2 < r2; t2++)
                  e.includes(n[t2]) && _.push(t2);
                const s = C._malloc(SIZE_OF_INT * _.length);
                for (let e2 = 0, t2 = _.length; e2 < t2; e2++)
                  setValue(s + e2 * SIZE_OF_INT, _[e2], "i32");
                marshalNode(this), C._ts_node_descendants_of_type_wasm(this.tree[0], s, _.length, t.row, t.column, r.row, r.column);
                const a = getValue(TRANSFER_BUFFER, "i32"), o = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), i = new Array(a);
                if (a > 0) {
                  let e2 = o;
                  for (let t2 = 0; t2 < a; t2++)
                    i[t2] = unmarshalNode(this.tree, e2), e2 += SIZE_OF_NODE;
                }
                return C._free(o), C._free(s), i;
              }
              get nextSibling() {
                return marshalNode(this), C._ts_node_next_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get previousSibling() {
                return marshalNode(this), C._ts_node_prev_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get nextNamedSibling() {
                return marshalNode(this), C._ts_node_next_named_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get previousNamedSibling() {
                return marshalNode(this), C._ts_node_prev_named_sibling_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              get parent() {
                return marshalNode(this), C._ts_node_parent_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              descendantForIndex(e, t = e) {
                if ("number" != typeof e || "number" != typeof t)
                  throw new Error("Arguments must be numbers");
                marshalNode(this);
                let r = TRANSFER_BUFFER + SIZE_OF_NODE;
                return setValue(r, e, "i32"), setValue(r + SIZE_OF_INT, t, "i32"), C._ts_node_descendant_for_index_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              namedDescendantForIndex(e, t = e) {
                if ("number" != typeof e || "number" != typeof t)
                  throw new Error("Arguments must be numbers");
                marshalNode(this);
                let r = TRANSFER_BUFFER + SIZE_OF_NODE;
                return setValue(r, e, "i32"), setValue(r + SIZE_OF_INT, t, "i32"), C._ts_node_named_descendant_for_index_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              descendantForPosition(e, t = e) {
                if (!isPoint(e) || !isPoint(t))
                  throw new Error("Arguments must be {row, column} objects");
                marshalNode(this);
                let r = TRANSFER_BUFFER + SIZE_OF_NODE;
                return marshalPoint(r, e), marshalPoint(r + SIZE_OF_POINT, t), C._ts_node_descendant_for_position_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              namedDescendantForPosition(e, t = e) {
                if (!isPoint(e) || !isPoint(t))
                  throw new Error("Arguments must be {row, column} objects");
                marshalNode(this);
                let r = TRANSFER_BUFFER + SIZE_OF_NODE;
                return marshalPoint(r, e), marshalPoint(r + SIZE_OF_POINT, t), C._ts_node_named_descendant_for_position_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              walk() {
                return marshalNode(this), C._ts_tree_cursor_new_wasm(this.tree[0]), new TreeCursor(INTERNAL, this.tree);
              }
              toString() {
                marshalNode(this);
                const e = C._ts_node_to_string_wasm(this.tree[0]), t = AsciiToString(e);
                return C._free(e), t;
              }
            }
            class TreeCursor {
              constructor(e, t) {
                assertInternal(e), this.tree = t, unmarshalTreeCursor(this);
              }
              delete() {
                marshalTreeCursor(this), C._ts_tree_cursor_delete_wasm(this.tree[0]), this[0] = this[1] = this[2] = 0;
              }
              reset(e) {
                marshalNode(e), marshalTreeCursor(this, TRANSFER_BUFFER + SIZE_OF_NODE), C._ts_tree_cursor_reset_wasm(this.tree[0]), unmarshalTreeCursor(this);
              }
              get nodeType() {
                return this.tree.language.types[this.nodeTypeId] || "ERROR";
              }
              get nodeTypeId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_type_id_wasm(this.tree[0]);
              }
              get nodeId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_id_wasm(this.tree[0]);
              }
              get nodeIsNamed() {
                return marshalTreeCursor(this), 1 === C._ts_tree_cursor_current_node_is_named_wasm(this.tree[0]);
              }
              get nodeIsMissing() {
                return marshalTreeCursor(this), 1 === C._ts_tree_cursor_current_node_is_missing_wasm(this.tree[0]);
              }
              get nodeText() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_start_index_wasm(this.tree[0]), t = C._ts_tree_cursor_end_index_wasm(this.tree[0]);
                return getText(this.tree, e, t);
              }
              get startPosition() {
                return marshalTreeCursor(this), C._ts_tree_cursor_start_position_wasm(this.tree[0]), unmarshalPoint(TRANSFER_BUFFER);
              }
              get endPosition() {
                return marshalTreeCursor(this), C._ts_tree_cursor_end_position_wasm(this.tree[0]), unmarshalPoint(TRANSFER_BUFFER);
              }
              get startIndex() {
                return marshalTreeCursor(this), C._ts_tree_cursor_start_index_wasm(this.tree[0]);
              }
              get endIndex() {
                return marshalTreeCursor(this), C._ts_tree_cursor_end_index_wasm(this.tree[0]);
              }
              currentNode() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_node_wasm(this.tree[0]), unmarshalNode(this.tree);
              }
              currentFieldId() {
                return marshalTreeCursor(this), C._ts_tree_cursor_current_field_id_wasm(this.tree[0]);
              }
              currentFieldName() {
                return this.tree.language.fields[this.currentFieldId()];
              }
              gotoFirstChild() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_first_child_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
              gotoNextSibling() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_next_sibling_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
              gotoParent() {
                marshalTreeCursor(this);
                const e = C._ts_tree_cursor_goto_parent_wasm(this.tree[0]);
                return unmarshalTreeCursor(this), 1 === e;
              }
            }
            class Language {
              constructor(e, t) {
                assertInternal(e), this[0] = t, this.types = new Array(C._ts_language_symbol_count(this[0]));
                for (let e2 = 0, t2 = this.types.length; e2 < t2; e2++)
                  C._ts_language_symbol_type(this[0], e2) < 2 && (this.types[e2] = UTF8ToString(C._ts_language_symbol_name(this[0], e2)));
                this.fields = new Array(C._ts_language_field_count(this[0]) + 1);
                for (let e2 = 0, t2 = this.fields.length; e2 < t2; e2++) {
                  const t3 = C._ts_language_field_name_for_id(this[0], e2);
                  this.fields[e2] = 0 !== t3 ? UTF8ToString(t3) : null;
                }
              }
              get version() {
                return C._ts_language_version(this[0]);
              }
              get fieldCount() {
                return this.fields.length - 1;
              }
              fieldIdForName(e) {
                const t = this.fields.indexOf(e);
                return -1 !== t ? t : null;
              }
              fieldNameForId(e) {
                return this.fields[e] || null;
              }
              idForNodeType(e, t) {
                const r = lengthBytesUTF8(e), _ = C._malloc(r + 1);
                stringToUTF8(e, _, r + 1);
                const n = C._ts_language_symbol_for_name(this[0], _, r, t);
                return C._free(_), n || null;
              }
              get nodeTypeCount() {
                return C._ts_language_symbol_count(this[0]);
              }
              nodeTypeForId(e) {
                const t = C._ts_language_symbol_name(this[0], e);
                return t ? UTF8ToString(t) : null;
              }
              nodeTypeIsNamed(e) {
                return !!C._ts_language_type_is_named_wasm(this[0], e);
              }
              nodeTypeIsVisible(e) {
                return !!C._ts_language_type_is_visible_wasm(this[0], e);
              }
              query(e) {
                const t = lengthBytesUTF8(e), r = C._malloc(t + 1);
                stringToUTF8(e, r, t + 1);
                const _ = C._ts_query_new(this[0], r, t, TRANSFER_BUFFER, TRANSFER_BUFFER + SIZE_OF_INT);
                if (!_) {
                  const t2 = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), _2 = UTF8ToString(r, getValue(TRANSFER_BUFFER, "i32")).length, n2 = e.substr(_2, 100).split("\n")[0];
                  let s2, a2 = n2.match(QUERY_WORD_REGEX)[0];
                  switch (t2) {
                    case 2:
                      s2 = new RangeError(`Bad node name '${a2}'`);
                      break;
                    case 3:
                      s2 = new RangeError(`Bad field name '${a2}'`);
                      break;
                    case 4:
                      s2 = new RangeError(`Bad capture name @${a2}`);
                      break;
                    case 5:
                      s2 = new TypeError(`Bad pattern structure at offset ${_2}: '${n2}'...`), a2 = "";
                      break;
                    default:
                      s2 = new SyntaxError(`Bad syntax at offset ${_2}: '${n2}'...`), a2 = "";
                  }
                  throw s2.index = _2, s2.length = a2.length, C._free(r), s2;
                }
                const n = C._ts_query_string_count(_), s = C._ts_query_capture_count(_), a = C._ts_query_pattern_count(_), o = new Array(s), i = new Array(n);
                for (let e2 = 0; e2 < s; e2++) {
                  const t2 = C._ts_query_capture_name_for_id(_, e2, TRANSFER_BUFFER), r2 = getValue(TRANSFER_BUFFER, "i32");
                  o[e2] = UTF8ToString(t2, r2);
                }
                for (let e2 = 0; e2 < n; e2++) {
                  const t2 = C._ts_query_string_value_for_id(_, e2, TRANSFER_BUFFER), r2 = getValue(TRANSFER_BUFFER, "i32");
                  i[e2] = UTF8ToString(t2, r2);
                }
                const l = new Array(a), u = new Array(a), d = new Array(a), c = new Array(a), m = new Array(a);
                for (let e2 = 0; e2 < a; e2++) {
                  const t2 = C._ts_query_predicates_for_pattern(_, e2, TRANSFER_BUFFER), r2 = getValue(TRANSFER_BUFFER, "i32");
                  c[e2] = [], m[e2] = [];
                  const n2 = [];
                  let s2 = t2;
                  for (let t3 = 0; t3 < r2; t3++) {
                    const t4 = getValue(s2, "i32");
                    s2 += SIZE_OF_INT;
                    const r3 = getValue(s2, "i32");
                    if (s2 += SIZE_OF_INT, t4 === PREDICATE_STEP_TYPE_CAPTURE)
                      n2.push({ type: "capture", name: o[r3] });
                    else if (t4 === PREDICATE_STEP_TYPE_STRING)
                      n2.push({ type: "string", value: i[r3] });
                    else if (n2.length > 0) {
                      if ("string" !== n2[0].type)
                        throw new Error("Predicates must begin with a literal value");
                      const t5 = n2[0].value;
                      let r4 = true;
                      switch (t5) {
                        case "not-eq?":
                          r4 = false;
                        case "eq?":
                          if (3 !== n2.length)
                            throw new Error("Wrong number of arguments to `#eq?` predicate. Expected 2, got " + (n2.length - 1));
                          if ("capture" !== n2[1].type)
                            throw new Error(`First argument of \`#eq?\` predicate must be a capture. Got "${n2[1].value}"`);
                          if ("capture" === n2[2].type) {
                            const t6 = n2[1].name, _3 = n2[2].name;
                            m[e2].push(function(e3) {
                              let n3, s4;
                              for (const r5 of e3)
                                r5.name === t6 && (n3 = r5.node), r5.name === _3 && (s4 = r5.node);
                              return void 0 === n3 || void 0 === s4 || n3.text === s4.text === r4;
                            });
                          } else {
                            const t6 = n2[1].name, _3 = n2[2].value;
                            m[e2].push(function(e3) {
                              for (const n3 of e3)
                                if (n3.name === t6)
                                  return n3.node.text === _3 === r4;
                              return true;
                            });
                          }
                          break;
                        case "not-match?":
                          r4 = false;
                        case "match?":
                          if (3 !== n2.length)
                            throw new Error(`Wrong number of arguments to \`#match?\` predicate. Expected 2, got ${n2.length - 1}.`);
                          if ("capture" !== n2[1].type)
                            throw new Error(`First argument of \`#match?\` predicate must be a capture. Got "${n2[1].value}".`);
                          if ("string" !== n2[2].type)
                            throw new Error(`Second argument of \`#match?\` predicate must be a string. Got @${n2[2].value}.`);
                          const _2 = n2[1].name, s3 = new RegExp(n2[2].value);
                          m[e2].push(function(e3) {
                            for (const t6 of e3)
                              if (t6.name === _2)
                                return s3.test(t6.node.text) === r4;
                            return true;
                          });
                          break;
                        case "set!":
                          if (n2.length < 2 || n2.length > 3)
                            throw new Error(`Wrong number of arguments to \`#set!\` predicate. Expected 1 or 2. Got ${n2.length - 1}.`);
                          if (n2.some((e3) => "string" !== e3.type))
                            throw new Error('Arguments to `#set!` predicate must be a strings.".');
                          l[e2] || (l[e2] = {}), l[e2][n2[1].value] = n2[2] ? n2[2].value : null;
                          break;
                        case "is?":
                        case "is-not?":
                          if (n2.length < 2 || n2.length > 3)
                            throw new Error(`Wrong number of arguments to \`#${t5}\` predicate. Expected 1 or 2. Got ${n2.length - 1}.`);
                          if (n2.some((e3) => "string" !== e3.type))
                            throw new Error(`Arguments to \`#${t5}\` predicate must be a strings.".`);
                          const a2 = "is?" === t5 ? u : d;
                          a2[e2] || (a2[e2] = {}), a2[e2][n2[1].value] = n2[2] ? n2[2].value : null;
                          break;
                        default:
                          c[e2].push({ operator: t5, operands: n2.slice(1) });
                      }
                      n2.length = 0;
                    }
                  }
                  Object.freeze(l[e2]), Object.freeze(u[e2]), Object.freeze(d[e2]);
                }
                return C._free(r), new Query(INTERNAL, _, o, m, c, Object.freeze(l), Object.freeze(u), Object.freeze(d));
              }
              static load(e) {
                let t;
                if (e instanceof Uint8Array)
                  t = Promise.resolve(e);
                else {
                  const r2 = e;
                  if ("undefined" != typeof process && process.versions && process.versions.node) {
                    const e2 = require("fs");
                    t = Promise.resolve(e2.readFileSync(r2));
                  } else
                    t = fetch(r2).then((e2) => e2.arrayBuffer().then((t2) => {
                      if (e2.ok)
                        return new Uint8Array(t2);
                      {
                        const r3 = new TextDecoder("utf-8").decode(t2);
                        throw new Error(`Language.load failed with status ${e2.status}.

${r3}`);
                      }
                    }));
                }
                const r = "function" == typeof loadSideModule ? loadSideModule : loadWebAssemblyModule;
                return t.then((e2) => r(e2, { loadAsync: true })).then((e2) => {
                  const t2 = Object.keys(e2), r2 = t2.find((e3) => LANGUAGE_FUNCTION_REGEX.test(e3) && !e3.includes("external_scanner_"));
                  r2 || console.log(`Couldn't find language function in WASM file. Symbols:
${JSON.stringify(t2, null, 2)}`);
                  const _ = e2[r2]();
                  return new Language(INTERNAL, _);
                });
              }
            }
            class Query {
              constructor(e, t, r, _, n, s, a, o) {
                assertInternal(e), this[0] = t, this.captureNames = r, this.textPredicates = _, this.predicates = n, this.setProperties = s, this.assertedProperties = a, this.refutedProperties = o, this.exceededMatchLimit = false;
              }
              delete() {
                C._ts_query_delete(this[0]), this[0] = 0;
              }
              matches(e, t, r, _) {
                t || (t = ZERO_POINT), r || (r = ZERO_POINT), _ || (_ = {});
                let n = _.matchLimit;
                if (void 0 === n)
                  n = 0;
                else if ("number" != typeof n)
                  throw new Error("Arguments must be numbers");
                marshalNode(e), C._ts_query_matches_wasm(this[0], e.tree[0], t.row, t.column, r.row, r.column, n);
                const s = getValue(TRANSFER_BUFFER, "i32"), a = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), o = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32"), i = new Array(s);
                this.exceededMatchLimit = !!o;
                let l = 0, u = a;
                for (let t2 = 0; t2 < s; t2++) {
                  const r2 = getValue(u, "i32");
                  u += SIZE_OF_INT;
                  const _2 = getValue(u, "i32");
                  u += SIZE_OF_INT;
                  const n2 = new Array(_2);
                  if (u = unmarshalCaptures(this, e.tree, u, n2), this.textPredicates[r2].every((e2) => e2(n2))) {
                    i[l++] = { pattern: r2, captures: n2 };
                    const e2 = this.setProperties[r2];
                    e2 && (i[t2].setProperties = e2);
                    const _3 = this.assertedProperties[r2];
                    _3 && (i[t2].assertedProperties = _3);
                    const s2 = this.refutedProperties[r2];
                    s2 && (i[t2].refutedProperties = s2);
                  }
                }
                return i.length = l, C._free(a), i;
              }
              captures(e, t, r, _) {
                t || (t = ZERO_POINT), r || (r = ZERO_POINT), _ || (_ = {});
                let n = _.matchLimit;
                if (void 0 === n)
                  n = 0;
                else if ("number" != typeof n)
                  throw new Error("Arguments must be numbers");
                marshalNode(e), C._ts_query_captures_wasm(this[0], e.tree[0], t.row, t.column, r.row, r.column, n);
                const s = getValue(TRANSFER_BUFFER, "i32"), a = getValue(TRANSFER_BUFFER + SIZE_OF_INT, "i32"), o = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32"), i = [];
                this.exceededMatchLimit = !!o;
                const l = [];
                let u = a;
                for (let t2 = 0; t2 < s; t2++) {
                  const t3 = getValue(u, "i32");
                  u += SIZE_OF_INT;
                  const r2 = getValue(u, "i32");
                  u += SIZE_OF_INT;
                  const _2 = getValue(u, "i32");
                  if (u += SIZE_OF_INT, l.length = r2, u = unmarshalCaptures(this, e.tree, u, l), this.textPredicates[t3].every((e2) => e2(l))) {
                    const e2 = l[_2], r3 = this.setProperties[t3];
                    r3 && (e2.setProperties = r3);
                    const n2 = this.assertedProperties[t3];
                    n2 && (e2.assertedProperties = n2);
                    const s2 = this.refutedProperties[t3];
                    s2 && (e2.refutedProperties = s2), i.push(e2);
                  }
                }
                return C._free(a), i;
              }
              predicatesForPattern(e) {
                return this.predicates[e];
              }
              didExceedMatchLimit() {
                return this.exceededMatchLimit;
              }
            }
            function getText(e, t, r) {
              const _ = r - t;
              let n = e.textCallback(t, null, r);
              for (t += n.length; t < r; ) {
                const _2 = e.textCallback(t, null, r);
                if (!(_2 && _2.length > 0))
                  break;
                t += _2.length, n += _2;
              }
              return t > r && (n = n.slice(0, _)), n;
            }
            function unmarshalCaptures(e, t, r, _) {
              for (let n = 0, s = _.length; n < s; n++) {
                const s2 = getValue(r, "i32"), a = unmarshalNode(t, r += SIZE_OF_INT);
                r += SIZE_OF_NODE, _[n] = { name: e.captureNames[s2], node: a };
              }
              return r;
            }
            function assertInternal(e) {
              if (e !== INTERNAL)
                throw new Error("Illegal constructor");
            }
            function isPoint(e) {
              return e && "number" == typeof e.row && "number" == typeof e.column;
            }
            function marshalNode(e) {
              let t = TRANSFER_BUFFER;
              setValue(t, e.id, "i32"), t += SIZE_OF_INT, setValue(t, e.startIndex, "i32"), t += SIZE_OF_INT, setValue(t, e.startPosition.row, "i32"), t += SIZE_OF_INT, setValue(t, e.startPosition.column, "i32"), t += SIZE_OF_INT, setValue(t, e[0], "i32");
            }
            function unmarshalNode(e, t = TRANSFER_BUFFER) {
              const r = getValue(t, "i32");
              if (0 === r)
                return null;
              const _ = getValue(t += SIZE_OF_INT, "i32"), n = getValue(t += SIZE_OF_INT, "i32"), s = getValue(t += SIZE_OF_INT, "i32"), a = getValue(t += SIZE_OF_INT, "i32"), o = new Node(INTERNAL, e);
              return o.id = r, o.startIndex = _, o.startPosition = { row: n, column: s }, o[0] = a, o;
            }
            function marshalTreeCursor(e, t = TRANSFER_BUFFER) {
              setValue(t + 0 * SIZE_OF_INT, e[0], "i32"), setValue(t + 1 * SIZE_OF_INT, e[1], "i32"), setValue(t + 2 * SIZE_OF_INT, e[2], "i32");
            }
            function unmarshalTreeCursor(e) {
              e[0] = getValue(TRANSFER_BUFFER + 0 * SIZE_OF_INT, "i32"), e[1] = getValue(TRANSFER_BUFFER + 1 * SIZE_OF_INT, "i32"), e[2] = getValue(TRANSFER_BUFFER + 2 * SIZE_OF_INT, "i32");
            }
            function marshalPoint(e, t) {
              setValue(e, t.row, "i32"), setValue(e + SIZE_OF_INT, t.column, "i32");
            }
            function unmarshalPoint(e) {
              return { row: getValue(e, "i32"), column: getValue(e + SIZE_OF_INT, "i32") };
            }
            function marshalRange(e, t) {
              marshalPoint(e, t.startPosition), marshalPoint(e += SIZE_OF_POINT, t.endPosition), setValue(e += SIZE_OF_POINT, t.startIndex, "i32"), setValue(e += SIZE_OF_INT, t.endIndex, "i32"), e += SIZE_OF_INT;
            }
            function unmarshalRange(e) {
              const t = {};
              return t.startPosition = unmarshalPoint(e), e += SIZE_OF_POINT, t.endPosition = unmarshalPoint(e), e += SIZE_OF_POINT, t.startIndex = getValue(e, "i32"), e += SIZE_OF_INT, t.endIndex = getValue(e, "i32"), t;
            }
            function marshalEdit(e) {
              let t = TRANSFER_BUFFER;
              marshalPoint(t, e.startPosition), t += SIZE_OF_POINT, marshalPoint(t, e.oldEndPosition), t += SIZE_OF_POINT, marshalPoint(t, e.newEndPosition), t += SIZE_OF_POINT, setValue(t, e.startIndex, "i32"), t += SIZE_OF_INT, setValue(t, e.oldEndIndex, "i32"), t += SIZE_OF_INT, setValue(t, e.newEndIndex, "i32"), t += SIZE_OF_INT;
            }
            for (const e of Object.getOwnPropertyNames(ParserImpl.prototype))
              Object.defineProperty(Parser.prototype, e, { value: ParserImpl.prototype[e], enumerable: false, writable: false });
            Parser.Language = Language, Module.onRuntimeInitialized = () => {
              ParserImpl.init(), resolveInitPromise();
            };
          }));
        }
      }
      return Parser;
    }();
    "object" == typeof exports && (module.exports = TreeSitter);
  }
});

// src/history-worker.ts
var import_worker_threads = require("worker_threads");
var import_fs = require("fs");
var import_path2 = require("path");

// src/analyzer/git-history.ts
var import_child_process = require("child_process");
var import_util = require("util");
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
var MAX_BUFFER = 50 * 1024 * 1024;
async function isGitRepo(cwd) {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}
async function getCommitIndex(cwd) {
  const { stdout } = await execFileAsync("git", [
    "log",
    "--pretty=format:%H%n%aI%n%an%n%s",
    "--name-status",
    "-M",
    // rename detection, independent of the user's diff.renames config
    "--diff-filter=ADMR",
    "--no-merges"
  ], { cwd, maxBuffer: MAX_BUFFER });
  const commits = [];
  const blocks = stdout.split("\n\n");
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.length > 0);
    if (lines.length < 4)
      continue;
    const hash = lines[0];
    const date = lines[1];
    const author = lines[2];
    const message = lines[3];
    const files = [];
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^([ADMR])\d*\t(.+?)(?:\t(.+))?$/);
      if (!match)
        continue;
      const status = match[1];
      if (status === "R") {
        files.push({ status, path: match[3] || match[2], oldPath: match[2] });
      } else {
        files.push({ status, path: match[2] });
      }
    }
    if (files.length > 0) {
      commits.push({ hash, date, author, message, files });
    }
  }
  return commits;
}
async function getFileAtCommit(cwd, commitHash, filePath) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["show", `${commitHash}:${filePath}`],
      { cwd, maxBuffer: MAX_BUFFER }
    );
    return stdout;
  } catch {
    return null;
  }
}

// src/analyzer/complexity.ts
var C_JS_DECISION_RE = /\b(if|else\s+if|for|while|do|switch|case|catch)\b/g;
var LOGICAL_OPERATORS_RE = /(\|\||&&)/g;
var TERNARY_RE = /[^?]\?[^?:]/g;
var CSS_SELECTOR_RE = /[^{}]+(?=\s*\{)/g;
var CSS_MEDIA_RE = /@media\b/g;
function computeComplexity(fileInfo) {
  const { content, language } = fileInfo;
  switch (language) {
    case "c":
    case "cpp":
    case "javascript":
    case "typescript":
      return computeCJSComplexity(content);
    case "css":
      return computeCSSComplexity(content);
    case "html":
    case "vue":
      return computeHTMLComplexity(content);
    default: {
      const cfg = GENERIC_LANGUAGE_CONFIGS[language];
      if (cfg) {
        return computeDecisionComplexity(content, cfg.keywords, cfg.operators, cfg.ternary, cfg.strip);
      }
      return { complexity: 1, details: {} };
    }
  }
}
function computeCJSComplexity(content) {
  const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  let complexity = 1;
  const details = {};
  const keywords = {};
  const decisionRe = new RegExp(C_JS_DECISION_RE.source, "g");
  let match;
  while ((match = decisionRe.exec(stripped)) !== null) {
    const kw = match[1].replace(/\s+/g, " ");
    keywords[kw] = (keywords[kw] || 0) + 1;
    complexity++;
  }
  details.keywords = keywords;
  const logicalRe = new RegExp(LOGICAL_OPERATORS_RE.source, "g");
  let logicalCount = 0;
  while ((match = logicalRe.exec(stripped)) !== null) {
    logicalCount++;
    complexity++;
  }
  details.logicalOperators = logicalCount;
  const ternaryRe = new RegExp(TERNARY_RE.source, "g");
  let ternaryCount = 0;
  while ((match = ternaryRe.exec(stripped)) !== null) {
    ternaryCount++;
    complexity++;
  }
  details.ternaryOperators = ternaryCount;
  return { complexity, details };
}
function computeCSSComplexity(content) {
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  let selectorCount = 0;
  const selectorRe = new RegExp(CSS_SELECTOR_RE.source, "g");
  let match;
  while ((match = selectorRe.exec(stripped)) !== null) {
    const selectors = match[0].split(",").filter((s) => s.trim().length > 0);
    selectorCount += selectors.length;
  }
  let mediaCount = 0;
  const mediaRe = new RegExp(CSS_MEDIA_RE.source, "g");
  while ((match = mediaRe.exec(stripped)) !== null) {
    mediaCount++;
  }
  const complexity = Math.max(1, Math.round(1 + selectorCount / 10 + mediaCount));
  return {
    complexity,
    details: { selectors: selectorCount, mediaQueries: mediaCount }
  };
}
function computeHTMLComplexity(content) {
  const eventHandlerRe = /\bon\w+\s*=/gi;
  let eventCount = 0;
  let match;
  while ((match = eventHandlerRe.exec(content)) !== null) {
    eventCount++;
  }
  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let scriptCount = 0;
  let inlineJSComplexity = 0;
  while ((match = scriptRe.exec(content)) !== null) {
    scriptCount++;
    const jsResult = computeCJSComplexity(match[0]);
    inlineJSComplexity += jsResult.complexity - 1;
  }
  const complexity = Math.max(1, 1 + eventCount + inlineJSComplexity);
  return {
    complexity,
    details: { eventHandlers: eventCount, scriptBlocks: scriptCount, inlineJSComplexity }
  };
}
function stripCLikeComments(content) {
  return content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/`(?:[^`\\]|\\.)*`/g, "``");
}
function stripHashComments(content) {
  return content.replace(/"""[\s\S]*?"""/g, '""').replace(/'''[\s\S]*?'''/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/#.*$/gm, "");
}
function stripPhpComments(content) {
  return content.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/#.*$/gm, "").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
}
function stripLuaComments(content) {
  return content.replace(/--\[\[[\s\S]*?\]\]/g, "").replace(/--[^\[].*$/gm, "").replace(/--$/gm, "").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/\[\[[\s\S]*?\]\]/g, '""');
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function computeDecisionComplexity(content, keywords, operators, ternary, strip) {
  const stripped = strip(content);
  let complexity = 1;
  const details = {};
  const keywordCounts = {};
  for (const kw of keywords) {
    const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, "g");
    let count = 0;
    let m;
    while ((m = re.exec(stripped)) !== null) {
      count++;
    }
    if (count > 0) {
      keywordCounts[kw] = count;
      complexity += count;
    }
  }
  details.keywords = keywordCounts;
  let logicalCount = 0;
  for (const op of operators) {
    const isWord = /^[A-Za-z]+$/.test(op);
    const re = new RegExp(isWord ? `\\b${escapeRegex(op)}\\b` : escapeRegex(op), "g");
    let m;
    while ((m = re.exec(stripped)) !== null) {
      logicalCount++;
      complexity++;
    }
  }
  details.logicalOperators = logicalCount;
  let ternaryCount = 0;
  if (ternary) {
    const re = new RegExp(ternary.source, "g");
    let m;
    while ((m = re.exec(stripped)) !== null) {
      ternaryCount++;
      complexity++;
    }
  }
  details.ternaryOperators = ternaryCount;
  return { complexity, details };
}
var GENERIC_LANGUAGE_CONFIGS = {
  python: {
    keywords: ["if", "elif", "for", "while", "except", "finally", "with", "assert"],
    operators: ["and", "or"],
    ternary: null,
    // `x if c else y` — the `if` is already counted as a keyword
    strip: stripHashComments
  },
  java: {
    keywords: ["if", "for", "while", "do", "switch", "case", "catch"],
    operators: ["&&", "||"],
    ternary: TERNARY_RE,
    strip: stripCLikeComments
  },
  go: {
    keywords: ["if", "for", "switch", "case", "select"],
    operators: ["&&", "||"],
    ternary: null,
    // Go has no ternary operator
    strip: stripCLikeComments
  },
  rust: {
    keywords: ["if", "for", "while", "loop", "match"],
    operators: ["&&", "||"],
    ternary: null,
    // Rust has no ternary operator
    strip: stripCLikeComments
  },
  kotlin: {
    keywords: ["if", "for", "while", "do", "when", "catch"],
    operators: ["&&", "||", "?:"],
    // Elvis operator counts as a branch
    ternary: null,
    // Kotlin has no ternary; `if` is an expression (counted as keyword)
    strip: stripCLikeComments
  },
  ruby: {
    keywords: ["if", "elsif", "unless", "while", "until", "for", "case", "when", "rescue"],
    operators: ["&&", "||", "and", "or"],
    ternary: TERNARY_RE,
    strip: stripHashComments
  },
  swift: {
    keywords: ["if", "guard", "for", "while", "repeat", "switch", "case", "catch"],
    operators: ["&&", "||", "??"],
    // nil-coalescing counts as a branch
    ternary: TERNARY_RE,
    strip: stripCLikeComments
  },
  csharp: {
    keywords: ["if", "for", "foreach", "while", "do", "switch", "case", "catch", "when"],
    operators: ["&&", "||", "??"],
    // null-coalescing counts as a branch
    ternary: TERNARY_RE,
    strip: stripCLikeComments
  },
  php: {
    keywords: ["if", "elseif", "for", "foreach", "while", "do", "switch", "case", "catch"],
    operators: ["&&", "||", "and", "or"],
    ternary: TERNARY_RE,
    strip: stripPhpComments
  },
  bash: {
    keywords: ["if", "elif", "for", "while", "until", "case", "select"],
    operators: ["&&", "||"],
    ternary: null,
    // Shell has no ternary operator
    strip: stripHashComments
  },
  lua: {
    keywords: ["if", "elseif", "for", "while", "repeat", "until"],
    operators: ["and", "or"],
    ternary: null,
    // Lua has no ternary operator
    strip: stripLuaComments
  }
};

// src/analyzer/tree-sitter-loader.ts
var import_path = require("path");
var TSParser = require_tree_sitter();
var GRAMMAR_FILES = {
  "c": "tree-sitter-c.wasm",
  "cpp": "tree-sitter-cpp.wasm",
  "javascript": "tree-sitter-javascript.wasm",
  "typescript": "tree-sitter-typescript.wasm",
  "tsx": "tree-sitter-tsx.wasm",
  "python": "tree-sitter-python.wasm",
  "java": "tree-sitter-java.wasm",
  "go": "tree-sitter-go.wasm",
  "rust": "tree-sitter-rust.wasm",
  "csharp": "tree-sitter-c_sharp.wasm",
  "php": "tree-sitter-php.wasm",
  "bash": "tree-sitter-bash.wasm",
  "lua": "tree-sitter-lua.wasm",
  "css": "tree-sitter-css.wasm",
  "html": "tree-sitter-html.wasm",
  "kotlin": "tree-sitter-kotlin.wasm",
  "ruby": "tree-sitter-ruby.wasm",
  "swift": "tree-sitter-swift.wasm"
};
var initialized = false;
var loadedLanguages = /* @__PURE__ */ new Map();
var parserPool = /* @__PURE__ */ new Map();
function getWasmDir() {
  const fs2 = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path.join)(__dirname, "tree-sitter-wasms"),
    // bundled (.vsix)
    (0, import_path.join)(__dirname, "..", "node_modules", "tree-sitter-wasms", "out"),
    // dev from out/
    resolve("node_modules", "tree-sitter-wasms", "out")
    // dev from project root (vitest)
  ];
  return candidates.find((p) => fs2.existsSync(p)) || candidates[0];
}
async function initTreeSitter() {
  if (initialized) {
    return;
  }
  const fs2 = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path.join)(__dirname, "tree-sitter-wasms", "tree-sitter.wasm"),
    // bundled (.vsix)
    (0, import_path.join)(__dirname, "..", "node_modules", "web-tree-sitter", "tree-sitter.wasm"),
    // dev from out/
    resolve("node_modules", "web-tree-sitter", "tree-sitter.wasm")
    // dev from project root (vitest)
  ];
  const wasmFile = candidates.find((p) => fs2.existsSync(p));
  if (!wasmFile) {
    throw new Error("web-tree-sitter.wasm not found. Searched:\n" + candidates.join("\n"));
  }
  await TSParser.init({
    locateFile: () => wasmFile
  });
  initialized = true;
}
async function loadLanguage(languageId) {
  const cached = loadedLanguages.get(languageId);
  if (cached) {
    return cached;
  }
  const file = GRAMMAR_FILES[languageId];
  if (!file) {
    throw new Error(`No Tree-sitter grammar available for language: ${languageId}`);
  }
  const wasmDir = getWasmDir();
  const wasmPath = (0, import_path.join)(wasmDir, file);
  const language = await TSParser.Language.load(wasmPath);
  loadedLanguages.set(languageId, language);
  return language;
}
async function createParser(languageId) {
  await initTreeSitter();
  const language = await loadLanguage(languageId);
  const parser = new TSParser();
  parser.setLanguage(language);
  return parser;
}
async function getCachedParser(languageId) {
  let pool = parserPool.get(languageId);
  if (!pool) {
    pool = [];
    parserPool.set(languageId, pool);
  }
  let parser = pool.pop();
  if (!parser) {
    parser = await createParser(languageId);
  }
  return parser;
}
function releaseParser(languageId, parser) {
  let pool = parserPool.get(languageId);
  if (!pool) {
    pool = [];
    parserPool.set(languageId, pool);
  }
  pool.push(parser);
}
async function parseSource(languageId, source) {
  const parser = await getCachedParser(languageId);
  try {
    const tree = parser.parse(source);
    if (!tree) {
      throw new Error(`Tree-sitter failed to parse source for language: ${languageId}`);
    }
    return tree;
  } finally {
    releaseParser(languageId, parser);
  }
}
function hasGrammar(languageId) {
  return languageId in GRAMMAR_FILES;
}

// src/analyzer/parsers/base-parser.ts
var BaseParser = class {
  language;
  constructor(language) {
    this.language = language;
  }
  /** Whether this parser uses Tree-sitter AST (override in subclass). */
  get usesTreeSitter() {
    return false;
  }
  parse(_fileInfo, _options) {
    return [];
  }
  /** Parse using a Tree-sitter syntax tree (override in TS-based parsers). */
  parseAST(_tree, _fileInfo, _options) {
    return this.parse(_fileInfo, _options);
  }
  /** Extract symbols using a Tree-sitter syntax tree (override in TS-based parsers). */
  extractSymbolsAST(_tree, _fileInfo) {
    return { functions: [], externs: [], structs: [], enums: [], macros: [], classes: [], exports: [], interfaces: [], traits: [], typeAliases: [], methods: [] };
  }
  /** Extract cross-file function calls using AST (override in TS-based parsers). */
  extractCallsAST(_tree, _fileInfo, _globalFunctions) {
    return [];
  }
  /** Extract function-level call sites from AST (override in TS-based parsers). */
  extractCallSitesAST(_tree, _fileInfo) {
    return [];
  }
  /** Extract heritage relations (extends/implements) from AST. */
  extractHeritageRelations(_tree, _fileInfo) {
    return [];
  }
  extractMatches(content, regex, type, sourceId, labelFn) {
    const relations = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const target = match[1];
      if (target) {
        relations.push({
          source: sourceId,
          target,
          type,
          label: labelFn ? labelFn(match) : `${type}: ${target}`
        });
      }
    }
    return relations;
  }
};

// src/analyzer/parsers/ts-c-parser.ts
var C_BUILTINS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "goto",
  "sizeof",
  "typeof",
  "typedef",
  "struct",
  "union",
  "enum",
  "static",
  "extern",
  "inline",
  "const",
  "volatile",
  "register",
  "auto",
  "void",
  "int",
  "char",
  "float",
  "double",
  "long",
  "short",
  "unsigned",
  "signed",
  "bool",
  "BOOL",
  "printf",
  "fprintf",
  "sprintf",
  "snprintf",
  "scanf",
  "sscanf",
  "malloc",
  "calloc",
  "realloc",
  "free",
  "memcpy",
  "memset",
  "memmove",
  "strlen",
  "strcpy",
  "strncpy",
  "strcmp",
  "strncmp",
  "strcat",
  "fopen",
  "fclose",
  "fread",
  "fwrite",
  "fseek",
  "ftell",
  "exit",
  "abort",
  "assert",
  "NULL",
  "true",
  "false",
  "defined",
  "offsetof",
  "va_start",
  "va_end",
  "va_arg",
  "__attribute__",
  "__declspec",
  "visibility",
  "__extension__"
]);
var TreeSitterCParser = class extends BaseParser {
  constructor() {
    super("c");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract #include relations ────────────
  parseAST(tree, fileInfo, options = {}) {
    const relations = [];
    this.walkForIncludes(tree.rootNode, fileInfo.id, relations, !!options.includeSystemHeaders);
    return relations;
  }
  walkForIncludes(node, sourceId, relations, includeSystem) {
    if (node.type === "preproc_include") {
      const pathNode = node.childForFieldName("path");
      if (pathNode) {
        const raw = pathNode.text;
        if (pathNode.type === "string_literal") {
          const target = raw.slice(1, -1);
          relations.push({
            source: sourceId,
            target,
            type: "include",
            label: `#include "${target}"`
          });
        } else if (pathNode.type === "system_lib_string") {
          const target = raw.slice(1, -1);
          relations.push({
            source: sourceId,
            target,
            type: "system-include",
            label: `#include <${target}>`
          });
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForIncludes(node.child(i), sourceId, relations, includeSystem);
    }
    return relations;
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, symbols);
        return;
      case "declaration":
        this.extractDeclaration(node, symbols);
        return;
      case "type_definition":
        this.extractTypedef(node, symbols);
        return;
      case "preproc_def":
        this.extractMacro(node, symbols, false);
        return;
      case "preproc_function_def":
        this.extractMacro(node, symbols, true);
        return;
      case "struct_specifier":
        if (node.parent?.type !== "type_definition" && node.childForFieldName("body")) {
          this.extractStruct(node, symbols, "struct");
        }
        break;
      case "enum_specifier":
        if (node.parent?.type !== "type_definition" && node.childForFieldName("body")) {
          this.extractEnum(node, symbols);
        }
        break;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunction(node, symbols) {
    const declarator = this.findDescendant(node, "function_declarator");
    if (!declarator) {
      return;
    }
    const nameNode = declarator.childForFieldName("declarator");
    const name = nameNode?.text;
    if (!name || C_BUILTINS.has(name)) {
      return;
    }
    const returnType = this.getReturnType(node, declarator);
    const params = this.getParams(declarator);
    const line = node.startPosition.row + 1;
    symbols.functions.push({ name, returnType, params, line, type: "function" });
  }
  extractDeclaration(node, symbols) {
    const text = node.text;
    if (text.startsWith("extern")) {
      const declarator = this.findDescendant(node, "function_declarator");
      if (declarator) {
        const nameNode = declarator.childForFieldName("declarator");
        const name = nameNode?.text;
        if (name) {
          symbols.externs.push({ name, type: "extern" });
          return;
        }
      }
    }
  }
  extractTypedef(node, symbols) {
    const structSpec = this.findDescendant(node, "struct_specifier");
    if (structSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.structs.push({ name: typeId.text, type: "typedef-struct", line: typeId.startPosition.row + 1 });
      } else {
        this.extractStruct(structSpec, symbols, "struct");
      }
      return;
    }
    const enumSpec = this.findDescendant(node, "enum_specifier");
    if (enumSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.enums.push({ name: typeId.text, type: "enum", line: typeId.startPosition.row + 1 });
      } else {
        this.extractEnum(enumSpec, symbols);
      }
    }
  }
  extractStruct(node, symbols, kind) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.structs.push({ name: nameNode.text, type: kind, line: node.startPosition.row + 1 });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.enums.push({ name: nameNode.text, type: "enum", line: node.startPosition.row + 1 });
    }
  }
  extractMacro(node, symbols, isFunctionLike) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.macros.push({
        name: nameNode.text,
        type: isFunctionLike ? "function-macro" : "constant-macro",
        line: node.startPosition.row + 1
      });
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, _fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: _fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  /** Get raw list of external calls (for backward compat with extractCalls). */
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition") {
      const declarator = this.findDescendant(node, "function_declarator");
      const nameNode = declarator?.childForFieldName("declarator");
      if (nameNode) {
        defined.add(nameNode.text);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_definition") {
      const declarator = this.findDescendant(node, "function_declarator");
      const nameNode = declarator?.childForFieldName("declarator");
      const name = nameNode?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── AST utilities ──────────────────────────────────────────
  getReturnType(funcDef, declarator) {
    const typeNode = funcDef.childForFieldName("type");
    if (typeNode) {
      const directDecl = funcDef.childForFieldName("declarator");
      if (directDecl?.type === "pointer_declarator") {
        return typeNode.text + "*";
      }
      return typeNode.text;
    }
    const before = funcDef.text.substring(0, declarator.startIndex - funcDef.startIndex).trim();
    return before || "int";
  }
  getParams(declarator) {
    const paramList = declarator.childForFieldName("parameters");
    if (!paramList) {
      return "";
    }
    const text = paramList.text;
    return text.startsWith("(") ? text.slice(1, -1).trim() : text.trim();
  }
  findDescendant(node, type) {
    if (node.type === type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const result = this.findDescendant(node.child(i), type);
      if (result) {
        return result;
      }
    }
    return null;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-cpp-parser.ts
var TreeSitterCppParser = class extends TreeSitterCParser {
  constructor() {
    super();
    this.language = "cpp";
  }
};

// src/analyzer/parsers/ts-js-parser.ts
var JS_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "void",
  "in",
  "of",
  "this",
  "super",
  "with",
  "yield",
  "await",
  "debugger",
  "constructor",
  "get",
  "set",
  "static",
  "async",
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "console",
  "window",
  "document",
  "global",
  "process",
  "require",
  "module",
  "exports",
  "import",
  "export",
  "default",
  "from"
]);
var JS_BUILTINS = /* @__PURE__ */ new Set([
  ...JS_KEYWORDS,
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "encodeURI",
  "decodeURI",
  "encodeURIComponent",
  "decodeURIComponent",
  "eval",
  "JSON",
  "Math",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Proxy",
  "Reflect",
  "Symbol",
  "BigInt",
  "ArrayBuffer",
  "SharedArrayBuffer",
  "DataView",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint16Array",
  "Uint32Array",
  "URL",
  "URLSearchParams",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "fetch",
  "alert",
  "confirm",
  "prompt",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
  "createElement",
  "getElementById",
  "querySelector",
  "querySelectorAll",
  "log",
  "warn",
  "error",
  "info",
  "debug",
  "trace",
  "dir",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "slice",
  "concat",
  "map",
  "filter",
  "reduce",
  "forEach",
  "find",
  "findIndex",
  "some",
  "every",
  "includes",
  "indexOf",
  "join",
  "sort",
  "reverse",
  "flat",
  "flatMap",
  "keys",
  "values",
  "entries",
  "assign",
  "freeze",
  "seal",
  "defineProperty",
  "getOwnPropertyNames",
  "hasOwnProperty",
  "toString",
  "valueOf",
  "toJSON",
  "then",
  "catch",
  "resolve",
  "reject",
  "all",
  "allSettled",
  "race",
  "any",
  "stringify",
  "parse",
  "replace",
  "match",
  "search",
  "split",
  "trim",
  "startsWith",
  "endsWith",
  "charAt",
  "charCodeAt",
  "substring",
  "repeat",
  "padStart",
  "padEnd",
  "bind",
  "call",
  "apply",
  "next",
  "done",
  "emit",
  "on",
  "once",
  "off"
]);
var TreeSitterJSParser = class extends BaseParser {
  constructor() {
    super("javascript");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract import/require relations ──────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkForImports(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForImports(node, sourceId, relations) {
    switch (node.type) {
      case "import_statement":
        this.extractImport(node, sourceId, relations);
        return;
      case "call_expression": {
        const funcNode = node.childForFieldName("function");
        if (funcNode) {
          if (funcNode.type === "identifier" && funcNode.text === "require") {
            this.extractCallImport(node, sourceId, relations, "require");
          } else if (funcNode.type === "import") {
            this.extractCallImport(node, sourceId, relations, "dynamic-import");
          }
        }
        break;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForImports(node.child(i), sourceId, relations);
    }
  }
  extractImport(node, sourceId, relations) {
    const source = node.childForFieldName("source");
    if (!source) {
      return;
    }
    const target = this.stripQuotes(source.text);
    if (!target) {
      return;
    }
    const isTypeImport = this.hasDirectChild(node, "type");
    relations.push({
      source: sourceId,
      target,
      type: isTypeImport ? "import-type" : "import",
      label: isTypeImport ? `import type from '${target}'` : `import from '${target}'`
    });
  }
  extractCallImport(node, sourceId, relations, type) {
    const args2 = node.childForFieldName("arguments");
    if (!args2) {
      return;
    }
    const firstArg = args2.child(1);
    if (!firstArg) {
      return;
    }
    let target;
    if (firstArg.type === "string" || firstArg.type === "string_fragment") {
      target = this.stripQuotes(firstArg.text);
    } else if (firstArg.type === "template_string") {
      const raw = firstArg.text.slice(1, -1);
      target = raw.split("$")[0].split("?")[0];
    } else {
      return;
    }
    if (!target) {
      return;
    }
    relations.push({
      source: sourceId,
      target,
      type,
      label: type === "require" ? `require('${target}')` : `import('${target}')`
    });
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_declaration":
      case "generator_function_declaration":
        this.extractFunctionDecl(node, symbols);
        return;
      case "lexical_declaration":
      case "variable_declaration":
        this.extractVariableDecl(node, symbols);
        return;
      case "class_declaration":
        this.extractClass(node, symbols);
        return;
      case "export_statement":
        this.extractExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunctionDecl(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || JS_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isAsync = this.hasDirectChild(node, "async");
    const isGenerator = node.type === "generator_function_declaration";
    const sym = {
      name,
      type: isGenerator ? "generator" : "function",
      line
    };
    if (isAsync) {
      sym.isAsync = true;
    }
    symbols.functions.push(sym);
  }
  extractVariableDecl(node, symbols) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type !== "variable_declarator") {
        continue;
      }
      const nameNode = child.childForFieldName("name");
      const valueNode = child.childForFieldName("value");
      if (!nameNode || !valueNode) {
        continue;
      }
      const name = nameNode.text;
      if (JS_KEYWORDS.has(name)) {
        continue;
      }
      if (valueNode.type === "arrow_function") {
        const line = node.startPosition.row + 1;
        const isAsync = this.hasDirectChild(valueNode, "async");
        const sym = { name, type: "arrow", line };
        if (isAsync) {
          sym.isAsync = true;
        }
        if (!symbols.functions.some((f) => f.name === name)) {
          symbols.functions.push(sym);
        }
      }
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.classes.push({ name, type: "class", line });
    const body2 = node.childForFieldName("body");
    if (body2) {
      this.extractMethods(body2, symbols);
    }
  }
  extractMethods(classBody, symbols) {
    for (let i = 0; i < classBody.childCount; i++) {
      const member = classBody.child(i);
      if (member.type !== "method_definition") {
        continue;
      }
      const nameNode = member.childForFieldName("name");
      const name = nameNode?.text;
      if (!name || name === "constructor") {
        continue;
      }
      const isAsync = this.hasDirectChild(member, "async");
      const isStatic = this.hasDirectChild(member, "static");
      const isGetter = this.findChildByText(member, "get") !== null && member.childForFieldName("parameters")?.text === "()";
      const isSetter = this.findChildByText(member, "set") !== null && !isGetter;
      const sym = {
        name,
        type: isGetter ? "getter" : isSetter ? "setter" : "method"
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStatic) {
        sym.isStatic = true;
      }
      symbols.methods.push(sym);
    }
  }
  extractExport(node, symbols) {
    const isDefault = this.hasDirectChild(node, "default");
    const isTypeExport = this.hasDirectChild(node, "type");
    const exportClause = this.findChild(node, "export_clause");
    if (exportClause) {
      if (isTypeExport) {
        return;
      }
      for (let i = 0; i < exportClause.childCount; i++) {
        const spec = exportClause.child(i);
        if (spec.type === "export_specifier") {
          const nameNode = spec.childForFieldName("name");
          if (nameNode && !JS_KEYWORDS.has(nameNode.text)) {
            symbols.exports.push({ name: nameNode.text, type: "export-named", line: nameNode.startPosition.row + 1 });
          }
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      switch (child.type) {
        case "function_declaration":
        case "generator_function_declaration": {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            symbols.exports.push({
              name,
              line: child.startPosition.row + 1,
              type: isDefault ? "export-default" : "export-function"
            });
            this.extractFunctionDecl(child, symbols);
          }
          break;
        }
        case "class_declaration": {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            symbols.exports.push({
              name,
              line: child.startPosition.row + 1,
              type: isDefault ? "export-default" : "export-class"
            });
            this.extractClass(child, symbols);
          }
          break;
        }
        case "lexical_declaration":
        case "variable_declaration": {
          for (let j = 0; j < child.childCount; j++) {
            const decl = child.child(j);
            if (decl.type === "variable_declarator") {
              const name = decl.childForFieldName("name")?.text;
              if (name && !JS_KEYWORDS.has(name)) {
                symbols.exports.push({
                  name,
                  line: decl.startPosition.row + 1,
                  type: isDefault ? "export-default" : "export-variable"
                });
              }
            }
          }
          this.extractVariableDecl(child, symbols);
          break;
        }
      }
    }
    if (isDefault && symbols.exports.length === 0) {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "identifier" && !JS_KEYWORDS.has(child.text)) {
          symbols.exports.push({ name: child.text, type: "export-default", line: child.startPosition.row + 1 });
          break;
        }
      }
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration" || node.type === "generator_function_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "variable_declarator") {
      const value = node.childForFieldName("value");
      if (value?.type === "arrow_function") {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          defined.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!JS_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_declaration" || node.type === "generator_function_declaration") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "variable_declarator") {
      const value = node.childForFieldName("value");
      if (value?.type === "arrow_function") {
        const name = node.childForFieldName("name")?.text || currentFunc;
        for (let i = 0; i < node.childCount; i++) {
          this.collectCallSites(node.child(i), sites, definedHere, name);
        }
        return;
      }
    }
    if (node.type === "method_definition") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!JS_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── AST utilities ──────────────────────────────────────────
  stripQuotes(text) {
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
  findChildByText(node, text) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.text === text && child.type !== "statement_block" && child.type !== "formal_parameters") {
        return child;
      }
    }
    return null;
  }
  findDescendant(node, type) {
    if (node.type === type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const result = this.findDescendant(node.child(i), type);
      if (result) {
        return result;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-ts-parser.ts
var TreeSitterTSParser = class extends TreeSitterJSParser {
  constructor() {
    super();
    this.language = "typescript";
  }
  // ── Override symbol extraction to add TS-specific nodes ────
  extractSymbolsAST(tree, fileInfo) {
    const symbols = super.extractSymbolsAST(tree, fileInfo);
    this.walkForTSSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForTSSymbols(node, symbols) {
    switch (node.type) {
      case "interface_declaration":
        this.extractInterface(node, symbols);
        return;
      case "type_alias_declaration":
        this.extractTypeAlias(node, symbols);
        return;
      case "export_statement":
        this.extractTSExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForTSSymbols(node.child(i), symbols);
    }
  }
  extractInterface(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.interfaces.push({ name, type: "interface", line });
  }
  extractTypeAlias(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.typeAliases.push({ name, type: "type-alias", line });
  }
  extractTSExport(node, symbols) {
    const isTypeExport = this.hasDirectChild(node, "type");
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "interface_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-interface", line: child.startPosition.row + 1 });
          this.extractInterface(child, symbols);
        }
        return;
      }
      if (child.type === "type_alias_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-type-alias", line: child.startPosition.row + 1 });
          this.extractTypeAlias(child, symbols);
        }
        return;
      }
    }
    if (isTypeExport) {
      const exportClause = this.findChild(node, "export_clause");
      if (exportClause) {
        for (let i = 0; i < exportClause.childCount; i++) {
          const spec = exportClause.child(i);
          if (spec.type === "export_specifier") {
            const nameNode = spec.childForFieldName("name");
            if (nameNode) {
              symbols.exports.push({ name: nameNode.text, type: "export-type", line: nameNode.startPosition.row + 1 });
            }
          }
        }
      }
    }
  }
  // ── Class heritage: extends/implements ─────────────────────
  extractClass(node, symbols) {
    super.extractClass(node, symbols);
    const heritage = this.findChild(node, "class_heritage");
    if (!heritage) {
      return;
    }
    const nameNode = node.childForFieldName("name");
    const className = nameNode?.text;
    if (!className) {
      return;
    }
    const text = heritage.text;
    const extendsMatch = text.match(/extends\s+(\w+)/);
    if (extendsMatch) {
      const classSym = symbols.classes.find((c) => c.name === className);
      if (classSym) {
        classSym.extends = extendsMatch[1];
      }
    }
    const implementsMatch = text.match(/implements\s+(.+)/);
    if (implementsMatch) {
      const interfaces = implementsMatch[1].split(",").map((s) => s.trim().split(/\s/)[0]);
      const classSym = symbols.classes.find((c) => c.name === className);
      if (classSym) {
        classSym.implements = interfaces;
      }
    }
  }
  // ── Override methods to capture visibility/static/async ────
  extractMethods(classBody, symbols) {
    for (let i = 0; i < classBody.childCount; i++) {
      const member = classBody.child(i);
      if (member.type !== "method_definition") {
        continue;
      }
      const nameNode = member.childForFieldName("name");
      const name = nameNode?.text;
      if (!name || name === "constructor") {
        continue;
      }
      const isAsync = this.hasDirectChild(member, "async");
      const isStatic = this.hasDirectChild(member, "static");
      const visibility = this.getVisibility(member);
      const isOverride = this.hasDirectChild(member, "override");
      const sym = { name, type: "method" };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStatic) {
        sym.isStatic = true;
      }
      if (visibility) {
        sym.visibility = visibility;
      }
      if (isOverride) {
        sym.isOverride = true;
      }
      symbols.methods.push(sym);
    }
  }
  /** Extract heritage relations (extends/implements) as Relation edges. */
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name");
      const className = nameNode?.text;
      const heritage = this.findChild(node, "class_heritage");
      if (className && heritage) {
        const text = heritage.text;
        const extendsMatch = text.match(/extends\s+(\w+)/);
        if (extendsMatch) {
          relations.push({
            source: sourceId,
            target: extendsMatch[1],
            type: "extends",
            label: `${className} extends ${extendsMatch[1]}`
          });
        }
        const implementsMatch = text.match(/implements\s+(.+)/);
        if (implementsMatch) {
          const raw = implementsMatch[1].replace(/\{[\s\S]*$/, "");
          const interfaces = raw.split(",").map((s) => s.trim().split(/\s/)[0]).filter(Boolean);
          for (const iface of interfaces) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${className} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  getVisibility(node) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "accessibility_modifier") {
        const text = child.text;
        return text;
      }
    }
    return void 0;
  }
};

// src/analyzer/parsers/ts-py-parser.ts
var PY_BUILTINS = /* @__PURE__ */ new Set([
  "print",
  "len",
  "range",
  "int",
  "str",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "isinstance",
  "issubclass",
  "hasattr",
  "getattr",
  "setattr",
  "delattr",
  "callable",
  "super",
  "property",
  "staticmethod",
  "classmethod",
  "abs",
  "all",
  "any",
  "bin",
  "chr",
  "dir",
  "divmod",
  "enumerate",
  "eval",
  "exec",
  "filter",
  "format",
  "frozenset",
  "globals",
  "hash",
  "hex",
  "id",
  "input",
  "iter",
  "locals",
  "map",
  "max",
  "min",
  "next",
  "object",
  "oct",
  "open",
  "ord",
  "pow",
  "repr",
  "reversed",
  "round",
  "slice",
  "sorted",
  "sum",
  "vars",
  "zip",
  "breakpoint",
  "compile",
  "complex",
  "memoryview",
  "bytearray",
  "bytes",
  "__import__",
  "__name__",
  "__file__",
  "__doc__"
]);
var PY_KEYWORDS = /* @__PURE__ */ new Set([
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "return",
  "yield",
  "lambda",
  "not",
  "and",
  "or",
  "assert",
  "raise",
  "pass",
  "break",
  "continue",
  "try",
  "except",
  "finally",
  "with",
  "as",
  "import",
  "from",
  "global",
  "nonlocal",
  "del",
  "in",
  "is",
  "async",
  "await"
]);
var TreeSitterPyParser = class extends BaseParser {
  constructor() {
    super("python");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract import relations ──────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_statement") {
        this.extractImport(node, fileInfo.id, relations);
      } else if (node.type === "import_from_statement") {
        this.extractFromImport(node, fileInfo.id, relations);
      }
    }
    return relations;
  }
  extractImport(node, sourceId, relations) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "dotted_name" || child.type === "aliased_import") {
        const name = child.type === "aliased_import" ? child.childForFieldName("name")?.text ?? child.text : child.text;
        if (name) {
          relations.push({
            source: sourceId,
            target: name,
            type: "import",
            label: `import ${name}`
          });
        }
      }
    }
  }
  extractFromImport(node, sourceId, relations) {
    const moduleNode = node.childForFieldName("module_name");
    let moduleName;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "dotted_name" || child.type === "relative_import") {
        moduleName = child.text;
        break;
      }
    }
    if (!moduleName) {
      return;
    }
    relations.push({
      source: sourceId,
      target: moduleName,
      type: "from-import",
      label: `from ${moduleName} import`
    });
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, symbols, insideClass, []);
        return;
      case "decorated_definition":
        this.extractDecorated(node, symbols, insideClass);
        return;
      case "class_definition":
        this.extractClass(node, symbols);
        return;
      case "expression_statement":
        this.extractAllExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideClass);
    }
  }
  extractFunction(node, symbols, insideClass, decorators) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isAsync = this.hasDirectChild(node, "async");
    const isDunder = name.startsWith("__") && name.endsWith("__");
    const isStaticMethod = decorators.includes("staticmethod");
    const isClassMethod = decorators.includes("classmethod");
    if (insideClass) {
      const sym = {
        name,
        type: isDunder ? "dunder" : "method",
        line
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStaticMethod) {
        sym.isStatic = true;
      }
      if (isClassMethod) {
        sym.isClassMethod = true;
      }
      symbols.methods.push(sym);
    } else {
      const sym = {
        name,
        type: isDunder ? "dunder" : "function",
        line
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      symbols.functions.push(sym);
    }
  }
  extractDecorated(node, symbols, insideClass) {
    const decorators = [];
    let funcDef = null;
    let classDef = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "decorator") {
        const decoName = this.getDecoratorName(child);
        if (decoName) {
          decorators.push(decoName);
          if (!PY_BUILTINS.has(decoName) && !PY_KEYWORDS.has(decoName)) {
            if (!symbols.macros.some((m) => m.name === decoName)) {
              symbols.macros.push({
                name: decoName,
                type: "decorator",
                line: child.startPosition.row + 1
              });
            }
          }
        }
      } else if (child.type === "function_definition") {
        funcDef = child;
      } else if (child.type === "class_definition") {
        classDef = child;
      }
    }
    if (funcDef) {
      this.extractFunction(funcDef, symbols, insideClass, decorators);
    }
    if (classDef) {
      this.extractClass(classDef, symbols);
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const classSym = {
      name,
      type: "class",
      line
    };
    const superclasses = this.extractSuperclasses(node);
    if (superclasses.length > 0) {
      classSym.extends = superclasses[0];
      if (superclasses.length > 1) {
        classSym.implements = superclasses.slice(1);
      }
    }
    symbols.classes.push(classSym);
    const body2 = node.childForFieldName("body");
    if (body2) {
      this.walkForSymbols(body2, symbols, true);
    }
  }
  extractSuperclasses(classNode) {
    const superclasses = [];
    const argList = this.findChild(classNode, "argument_list");
    if (!argList) {
      return superclasses;
    }
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i);
      if (child.type === "identifier" || child.type === "dotted_name") {
        superclasses.push(child.text);
      }
    }
    return superclasses;
  }
  extractAllExport(node, symbols) {
    const assign = this.findChild(node, "assignment");
    if (!assign) {
      return;
    }
    const left = assign.childForFieldName("left");
    if (!left || left.text !== "__all__") {
      return;
    }
    const right = assign.childForFieldName("right");
    if (!right || right.type !== "list") {
      return;
    }
    for (let i = 0; i < right.childCount; i++) {
      const child = right.child(i);
      if (child.type === "string") {
        const name = this.stripPyString(child.text);
        if (name) {
          symbols.exports.push({ name, type: "export-all", line: child.startPosition.row + 1 });
        }
      }
    }
  }
  // ── Heritage relations as edges ────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_definition") {
      const nameNode = node.childForFieldName("name");
      const className = nameNode?.text;
      if (className) {
        const superclasses = this.extractSuperclasses(node);
        for (const base of superclasses) {
          relations.push({
            source: sourceId,
            target: base,
            type: "extends",
            label: `${className} extends ${base}`
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "class_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "decorated_definition") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "function_definition" || child.type === "class_definition") {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            defined.add(name);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!PY_BUILTINS.has(name) && !PY_KEYWORDS.has(name) && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_definition") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "decorated_definition") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "function_definition") {
          const name = child.childForFieldName("name")?.text || currentFunc;
          this.collectCallSites(child, sites, definedHere, name);
        } else {
          this.collectCallSites(child, sites, definedHere, currentFunc);
        }
      }
      return;
    }
    if (node.type === "call") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!PY_BUILTINS.has(name) && !PY_KEYWORDS.has(name) && !/^[A-Z_]+$/.test(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getDecoratorName(decorator) {
    for (let i = 0; i < decorator.childCount; i++) {
      const child = decorator.child(i);
      if (child.type === "identifier") {
        return child.text;
      }
      if (child.type === "dotted_name") {
        return child.text;
      }
      if (child.type === "call") {
        const func2 = child.childForFieldName("function");
        return func2?.text ?? null;
      }
    }
    return null;
  }
  stripPyString(text) {
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-java-parser.ts
var JAVA_BUILTINS = /* @__PURE__ */ new Set([
  "System",
  "String",
  "Integer",
  "Long",
  "Double",
  "Float",
  "Boolean",
  "Object",
  "Class",
  "Math",
  "Arrays",
  "Collections",
  "List",
  "Map",
  "Set",
  "HashMap",
  "ArrayList",
  "HashSet",
  "LinkedList",
  "TreeMap",
  "TreeSet",
  "Optional",
  "Stream",
  "Collectors",
  "Iterator",
  "Iterable",
  "Exception",
  "RuntimeException",
  "IOException",
  "NullPointerException",
  "Thread",
  "Runnable",
  "Comparable",
  "Serializable",
  "Cloneable",
  "StringBuilder",
  "StringBuffer",
  "Throwable",
  "Error",
  "println",
  "printf",
  "print",
  "format",
  "toString",
  "equals",
  "hashCode",
  "clone",
  "getClass",
  "notify",
  "wait",
  "valueOf",
  "parseInt",
  "parseDouble",
  "parseLong",
  "parseFloat",
  "length",
  "size",
  "get",
  "put",
  "add",
  "remove",
  "contains",
  "isEmpty",
  "toArray",
  "iterator",
  "stream",
  "forEach",
  "map",
  "filter",
  "reduce",
  "collect",
  "of",
  "asList",
  "sort",
  "reverse",
  "min",
  "max",
  "close",
  "read",
  "write",
  "flush",
  "append"
]);
var JAVA_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "instanceof",
  "this",
  "super",
  "void",
  "null",
  "true",
  "false",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "abstract",
  "synchronized",
  "volatile",
  "transient",
  "native",
  "strictfp",
  "class",
  "interface",
  "enum",
  "extends",
  "implements",
  "import",
  "package",
  "default",
  "assert",
  "var"
]);
var TreeSitterJavaParser = class extends BaseParser {
  constructor() {
    super("java");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type !== "import_declaration") {
        continue;
      }
      const pathNode = this.findChild(node, "scoped_identifier");
      if (!pathNode) {
        continue;
      }
      const target = pathNode.text;
      const isStatic = this.hasDirectChild(node, "static");
      relations.push({
        source: fileInfo.id,
        target,
        type: isStatic ? "static-import" : "import",
        label: isStatic ? `import static ${target}` : `import ${target}`
      });
    }
    return relations;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "class_declaration":
        this.extractClass(node, symbols);
        return;
      case "interface_declaration":
        this.extractInterface(node, symbols);
        return;
      case "enum_declaration":
        this.extractEnum(node, symbols);
        return;
      case "method_declaration":
        if (insideClass) {
          this.extractMethod(node, symbols);
        }
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideClass);
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const mods = this.getModifiers(node);
    const classSym = {
      name,
      type: "class",
      line
    };
    if (mods.visibility) {
      classSym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      classSym.isStatic = true;
    }
    const superclass = this.findChild(node, "superclass");
    if (superclass) {
      const superName = this.findChild(superclass, "type_identifier");
      if (superName) {
        classSym.extends = superName.text;
      }
    }
    const superInterfaces = this.findChild(node, "super_interfaces");
    if (superInterfaces) {
      classSym.implements = this.extractTypeList(superInterfaces);
    }
    symbols.classes.push(classSym);
    const body2 = node.childForFieldName("body");
    if (body2) {
      for (let i = 0; i < body2.childCount; i++) {
        this.walkForSymbols(body2.child(i), symbols, true);
      }
    }
  }
  extractInterface(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.interfaces.push({ name, type: "interface", line });
    const body2 = this.findChild(node, "interface_body");
    if (body2) {
      for (let i = 0; i < body2.childCount; i++) {
        const child = body2.child(i);
        if (child.type === "method_declaration") {
          this.extractMethod(child, symbols);
        }
      }
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.enums.push({ name, type: "enum", line });
  }
  extractMethod(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const mods = this.getModifiers(node);
    const sym = { name, type: "method" };
    if (mods.visibility) {
      sym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      sym.isStatic = true;
    }
    if (mods.isAsync) {
      sym.isAsync = true;
    }
    symbols.methods.push(sym);
  }
  // ── Heritage relations ─────────────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration") {
      const className = node.childForFieldName("name")?.text;
      if (className) {
        const superclass = this.findChild(node, "superclass");
        if (superclass) {
          const name = this.findChild(superclass, "type_identifier")?.text;
          if (name) {
            relations.push({
              source: sourceId,
              target: name,
              type: "extends",
              label: `${className} extends ${name}`
            });
          }
        }
        const superIfaces = this.findChild(node, "super_interfaces");
        if (superIfaces) {
          for (const iface of this.extractTypeList(superIfaces)) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${className} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "method_invocation") {
      const obj = node.childForFieldName("object");
      if (!obj) {
        const name = node.childForFieldName("name")?.text;
        if (name && !JAVA_BUILTINS.has(name) && !JAVA_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "method_invocation") {
      const obj = node.childForFieldName("object");
      if (!obj) {
        const name = node.childForFieldName("name")?.text;
        if (name && !JAVA_BUILTINS.has(name) && !JAVA_KEYWORDS.has(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getModifiers(node) {
    const mods = this.findChild(node, "modifiers");
    if (!mods) {
      return {};
    }
    const text = mods.text;
    const result = {};
    if (text.includes("public")) {
      result.visibility = "public";
    } else if (text.includes("private")) {
      result.visibility = "private";
    } else if (text.includes("protected")) {
      result.visibility = "protected";
    }
    if (text.includes("static")) {
      result.isStatic = true;
    }
    if (text.includes("synchronized")) {
      result.isAsync = false;
    }
    return result;
  }
  extractTypeList(node) {
    const types = [];
    const typeList = this.findChild(node, "type_list");
    const target = typeList || node;
    for (let i = 0; i < target.childCount; i++) {
      const child = target.child(i);
      if (child.type === "type_identifier") {
        types.push(child.text);
      }
    }
    return types;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-go-parser.ts
var GO_BUILTINS = /* @__PURE__ */ new Set([
  "append",
  "cap",
  "close",
  "complex",
  "copy",
  "delete",
  "imag",
  "len",
  "make",
  "new",
  "panic",
  "print",
  "println",
  "real",
  "recover",
  "error",
  "string",
  "bool",
  "byte",
  "rune",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr",
  "float32",
  "float64",
  "complex64",
  "complex128",
  "nil",
  "true",
  "false",
  "iota"
]);
var GO_KEYWORDS = /* @__PURE__ */ new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var"
]);
var TreeSitterGoParser = class extends BaseParser {
  constructor() {
    super("go");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type !== "import_declaration") {
        continue;
      }
      const singleSpec = this.findChild(node, "import_spec");
      if (singleSpec) {
        const target = this.extractImportPath(singleSpec);
        if (target) {
          relations.push({
            source: fileInfo.id,
            target,
            type: "import",
            label: `import "${target}"`
          });
        }
      }
      const specList = this.findChild(node, "import_spec_list");
      if (specList) {
        for (let j = 0; j < specList.childCount; j++) {
          const spec = specList.child(j);
          if (spec.type === "import_spec") {
            const target = this.extractImportPath(spec);
            if (target) {
              relations.push({
                source: fileInfo.id,
                target,
                type: "import",
                label: `import "${target}"`
              });
            }
          }
        }
      }
    }
    return relations;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      switch (node.type) {
        case "function_declaration":
          this.extractFunction(node, symbols);
          break;
        case "method_declaration":
          this.extractMethod(node, symbols);
          break;
        case "type_declaration":
          this.extractTypeDecl(node, symbols);
          break;
      }
    }
    return symbols;
  }
  extractFunction(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || GO_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isExported = /^[A-Z]/.test(name);
    const sym = { name, type: "function", line };
    symbols.functions.push(sym);
    if (isExported) {
      symbols.exports.push({ name, type: "export-function", line });
    }
  }
  extractMethod(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const receiverList = node.child(1);
    let receiverType;
    if (receiverList?.type === "parameter_list") {
      const text = receiverList.text;
      const match = text.match(/\*?(\w+)\s*\)/);
      if (match) {
        receiverType = match[1];
      }
    }
    const isExported = /^[A-Z]/.test(name);
    const sym = { name, type: "method" };
    if (receiverType) {
      sym.receiver = receiverType;
    }
    symbols.methods.push(sym);
    if (isExported) {
      symbols.exports.push({ name, type: "export-method", line: node.startPosition.row + 1 });
    }
  }
  extractTypeDecl(node, symbols) {
    const typeSpec = this.findChild(node, "type_spec");
    if (!typeSpec) {
      return;
    }
    const nameNode = typeSpec.child(0);
    const defNode = typeSpec.child(1);
    if (!nameNode || !defNode) {
      return;
    }
    const name = nameNode.text;
    const line = node.startPosition.row + 1;
    const isExported = /^[A-Z]/.test(name);
    if (defNode.type === "struct_type") {
      symbols.structs.push({ name, type: "struct", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-struct", line });
      }
    } else if (defNode.type === "interface_type") {
      symbols.interfaces.push({ name, type: "interface", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-interface", line });
      }
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!GO_BUILTINS.has(name) && !GO_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_declaration") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!GO_BUILTINS.has(name) && !GO_KEYWORDS.has(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  extractImportPath(spec) {
    for (let i = 0; i < spec.childCount; i++) {
      const child = spec.child(i);
      if (child.type === "interpreted_string_literal") {
        return child.text.slice(1, -1);
      }
    }
    return null;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-rust-parser.ts
var RUST_BUILTINS = /* @__PURE__ */ new Set([
  "println",
  "print",
  "eprintln",
  "eprint",
  "format",
  "write",
  "writeln",
  "panic",
  "todo",
  "unimplemented",
  "unreachable",
  "assert",
  "assert_eq",
  "assert_ne",
  "debug_assert",
  "debug_assert_eq",
  "debug_assert_ne",
  "vec",
  "cfg",
  "include",
  "include_str",
  "include_bytes",
  "env",
  "option_env",
  "concat",
  "stringify",
  "line",
  "column",
  "file",
  "Box",
  "Vec",
  "String",
  "Option",
  "Result",
  "Some",
  "None",
  "Ok",
  "Err",
  "HashMap",
  "HashSet",
  "BTreeMap",
  "BTreeSet",
  "VecDeque",
  "LinkedList",
  "Rc",
  "Arc",
  "Mutex",
  "RwLock",
  "Cell",
  "RefCell",
  "Into",
  "From",
  "TryInto",
  "TryFrom",
  "AsRef",
  "AsMut",
  "Default",
  "Clone",
  "Copy",
  "Debug",
  "Display",
  "PartialEq",
  "Eq",
  "PartialOrd",
  "Ord",
  "Hash",
  "Iterator",
  "IntoIterator",
  "Send",
  "Sync",
  "Sized",
  "Unpin",
  "Drop",
  "drop",
  "swap",
  "replace",
  "take",
  "unwrap",
  "expect",
  "map",
  "and_then",
  "or_else",
  "unwrap_or",
  "is_some",
  "is_none",
  "is_ok",
  "is_err",
  "iter",
  "into_iter",
  "collect",
  "filter",
  "fold",
  "for_each",
  "push",
  "pop",
  "len",
  "is_empty",
  "contains",
  "get",
  "insert",
  "remove",
  "clone",
  "to_string",
  "to_owned",
  "as_str",
  "as_ref",
  "as_mut"
]);
var RUST_KEYWORDS = /* @__PURE__ */ new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "yield",
  "true",
  "false"
]);
var TreeSitterRustParser = class extends BaseParser {
  constructor() {
    super("rust");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (use/mod) ──────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "use_declaration") {
        this.extractUse(node, fileInfo.id, relations);
      } else if (node.type === "mod_item") {
        this.extractMod(node, fileInfo.id, relations);
      }
    }
    return relations;
  }
  extractUse(node, sourceId, relations) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "scoped_identifier" || child.type === "identifier" || child.type === "scoped_use_list" || child.type === "use_wildcard") {
        const target = child.text;
        relations.push({
          source: sourceId,
          target,
          type: "use",
          label: `use ${target}`
        });
        return;
      }
    }
  }
  extractMod(node, sourceId, relations) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
      return;
    }
    if (this.findChild(node, "declaration_list")) {
      return;
    }
    const target = nameNode.text;
    relations.push({
      source: sourceId,
      target,
      type: "mod",
      label: `mod ${target}`
    });
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_item":
        this.extractFunction(node, symbols);
        return;
      case "struct_item":
        this.extractStruct(node, symbols);
        return;
      case "enum_item":
        this.extractEnum(node, symbols);
        return;
      case "trait_item":
        this.extractTrait(node, symbols);
        return;
      case "impl_item":
        this.extractImpl(node, symbols);
        return;
      case "type_item":
        this.extractTypeAlias(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunction(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || RUST_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    const isAsync = this.hasChildType(node, "function_modifiers");
    const sym = { name, type: "function", line };
    if (isAsync) {
      sym.isAsync = true;
    }
    if (isPub) {
      sym.visibility = "public";
    }
    symbols.functions.push(sym);
    if (isPub) {
      symbols.exports.push({ name, type: "export-function", line });
    }
  }
  extractStruct(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.structs.push({ name, type: "struct", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-struct", line });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.enums.push({ name, type: "enum", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-enum", line });
    }
  }
  extractTrait(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.traits.push({ name, type: "trait", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-trait", line });
    }
  }
  extractImpl(node, symbols) {
    const body2 = this.findChild(node, "declaration_list");
    if (!body2) {
      return;
    }
    const typeIds = this.findAllChildren(node, "type_identifier");
    const hasTrait = this.hasDirectChild(node, "for");
    let structName;
    let traitName;
    if (hasTrait && typeIds.length >= 2) {
      traitName = typeIds[0].text;
      structName = typeIds[1].text;
    } else if (typeIds.length >= 1) {
      structName = typeIds[0].text;
    }
    for (let i = 0; i < body2.childCount; i++) {
      const child = body2.child(i);
      if (child.type === "function_item") {
        const nameNode = child.childForFieldName("name");
        const name = nameNode?.text;
        if (!name) {
          continue;
        }
        const isPub = this.hasDirectChild(child, "visibility_modifier");
        const isAsync = this.hasChildType(child, "function_modifiers");
        const sym = { name, type: "method" };
        if (isPub) {
          sym.visibility = "public";
        }
        if (isAsync) {
          sym.isAsync = true;
        }
        if (structName) {
          sym.receiver = structName;
        }
        symbols.methods.push(sym);
      }
    }
  }
  extractTypeAlias(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.typeAliases.push({ name, type: "type-alias", line });
  }
  // ── Heritage (impl Trait for Struct) ───────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "impl_item") {
      const hasTrait = this.hasDirectChild(node, "for");
      if (hasTrait) {
        const typeIds = this.findAllChildren(node, "type_identifier");
        if (typeIds.length >= 2) {
          const traitName = typeIds[0].text;
          const structName = typeIds[1].text;
          relations.push({
            source: sourceId,
            target: traitName,
            type: "implements",
            label: `${structName} implements ${traitName}`
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_item") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name) && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
          calls.add(name);
        }
      }
    }
    if (node.type === "macro_invocation") {
      const macroNode = node.child(0);
      if (macroNode?.type === "identifier") {
        const name = macroNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name)) {
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_item") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name) && !/^[A-Z_]+$/.test(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  hasDirectChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return true;
      }
    }
    return false;
  }
  hasChildType(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
  findAllChildren(node, type) {
    const results = [];
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        results.push(node.child(i));
      }
    }
    return results;
  }
};

// src/analyzer/parsers/ts-kotlin-parser.ts
var KOTLIN_BUILTINS = /* @__PURE__ */ new Set([
  "println",
  "print",
  "readLine",
  "require",
  "requireNotNull",
  "check",
  "checkNotNull",
  "error",
  "TODO",
  "run",
  "let",
  "apply",
  "also",
  "with",
  "use",
  "lazy",
  "arrayOf",
  "listOf",
  "mutableListOf",
  "setOf",
  "mutableSetOf",
  "mapOf",
  "mutableMapOf",
  "emptyList",
  "emptySet",
  "emptyMap",
  "arrayOfNulls",
  "intArrayOf",
  "longArrayOf",
  "doubleArrayOf",
  "floatArrayOf",
  "booleanArrayOf",
  "byteArrayOf",
  "shortArrayOf",
  "charArrayOf",
  "String",
  "Int",
  "Long",
  "Double",
  "Float",
  "Boolean",
  "Char",
  "Byte",
  "Short",
  "Any",
  "Unit",
  "Nothing",
  "List",
  "Set",
  "Map",
  "Array",
  "IntArray",
  "LongArray",
  "maxOf",
  "minOf",
  "compareValues",
  "hashCode",
  "toString"
]);
var KOTLIN_KEYWORDS = /* @__PURE__ */ new Set([
  "as",
  "break",
  "class",
  "continue",
  "do",
  "else",
  "false",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "package",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "val",
  "var",
  "when",
  "while",
  "by",
  "catch",
  "constructor",
  "delegate",
  "dynamic",
  "field",
  "file",
  "finally",
  "get",
  "import",
  "init",
  "param",
  "property",
  "receiver",
  "set",
  "setparam",
  "where",
  "private",
  "public",
  "protected",
  "internal",
  "open",
  "final",
  "abstract",
  "sealed",
  "data",
  "enum",
  "inner",
  "override",
  "lateinit",
  "companion",
  "inline",
  "noinline",
  "crossinline",
  "reified",
  "tailrec",
  "operator",
  "infix",
  "external",
  "suspend"
]);
var TreeSitterKotlinParser = class extends BaseParser {
  constructor() {
    super("kotlin");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkImports(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkImports(node, sourceId, relations) {
    if (node.type === "import_header" || node.type === "import_directive") {
      const id = this.findFirstByType(node, "identifier");
      if (id) {
        const target = id.text;
        if (target) {
          relations.push({
            source: sourceId,
            target,
            type: "import",
            label: `import ${target}`
          });
        }
      }
      return;
    }
    if (node.type === "source_file" || node.type === "file_annotation" || node.type === "package_header") {
      for (let i = 0; i < node.childCount; i++) {
        this.walkImports(node.child(i), sourceId, relations);
      }
      return;
    }
    for (let i = 0; i < Math.min(node.childCount, 50); i++) {
      const c = node.child(i);
      if (c.type === "import_list" || c.type === "import_header" || c.type === "import_directive") {
        this.walkImports(c, sourceId, relations);
      }
    }
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "function_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          const sym = {
            name,
            type: insideClass ? "method" : "function",
            line: node.startPosition.row + 1
          };
          if (insideClass)
            symbols.methods.push(sym);
          else
            symbols.functions.push(sym);
        }
        return;
      }
      case "class_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.classes.push({ name, type: "class", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "object_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.classes.push({ name, type: "object", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "interface_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.interfaces.push({ name, type: "interface", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "type_alias": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.typeAliases.push({ name, type: "type-alias", line: node.startPosition.row + 1 });
        }
        return;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkSymbols(node.child(i), symbols, insideClass);
    }
  }
  getDeclName(node) {
    const named = node.childForFieldName("name");
    if (named && named.text)
      return named.text;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c.type === "simple_identifier" || c.type === "type_identifier" || c.type === "identifier") {
        return c.text;
      }
    }
    return null;
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration") {
      const name = this.getDeclName(node);
      if (name)
        defined.add(name);
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const first = node.child(0);
      if (first && (first.type === "simple_identifier" || first.type === "identifier")) {
        const name = first.text;
        if (name && !KOTLIN_BUILTINS.has(name) && !KOTLIN_KEYWORDS.has(name) && !definedHere.has(name) && /^[a-zA-Z_]/.test(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Call sites (function-level) ────────────────────────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_declaration") {
      const name = this.getDeclName(node) || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call_expression") {
      const first = node.child(0);
      if (first && (first.type === "simple_identifier" || first.type === "identifier")) {
        const name = first.text;
        if (name && !KOTLIN_BUILTINS.has(name) && !KOTLIN_KEYWORDS.has(name) && /^[a-zA-Z_]/.test(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  findFirstByType(node, type) {
    if (node.type === type)
      return node;
    for (let i = 0; i < node.childCount; i++) {
      const found = this.findFirstByType(node.child(i), type);
      if (found)
        return found;
    }
    return null;
  }
};

// src/analyzer/parsers/ts-ruby-parser.ts
var RUBY_BUILTINS = /* @__PURE__ */ new Set([
  "puts",
  "print",
  "p",
  "pp",
  "gets",
  "readline",
  "sprintf",
  "format",
  "require",
  "require_relative",
  "load",
  "autoload",
  "include",
  "extend",
  "attr_accessor",
  "attr_reader",
  "attr_writer",
  "private",
  "public",
  "protected",
  "module_function",
  "lambda",
  "proc",
  "raise",
  "fail",
  "catch",
  "throw",
  "loop",
  "sleep",
  "exit",
  "abort",
  "caller",
  "block_given?",
  "yield",
  "binding",
  "String",
  "Integer",
  "Float",
  "Array",
  "Hash",
  "Symbol",
  "Range",
  "Object",
  "Class",
  "Module",
  "NilClass",
  "TrueClass",
  "FalseClass",
  "Numeric",
  "Comparable",
  "Enumerable",
  "Kernel",
  "BasicObject",
  "new",
  "inspect",
  "to_s",
  "to_a",
  "to_h",
  "to_i",
  "to_f",
  "to_sym",
  "is_a?",
  "kind_of?",
  "instance_of?",
  "respond_to?",
  "send",
  "__send__",
  "dup",
  "clone",
  "freeze",
  "frozen?",
  "tap",
  "then",
  "yield_self",
  "each",
  "map",
  "collect",
  "select",
  "filter",
  "reject",
  "reduce",
  "inject",
  "find",
  "detect",
  "any?",
  "all?",
  "none?",
  "one?",
  "count",
  "size",
  "length",
  "empty?",
  "first",
  "last",
  "min",
  "max",
  "sort",
  "sort_by",
  "group_by",
  "zip",
  "flatten",
  "compact",
  "uniq",
  "reverse",
  "include?",
  "push",
  "pop",
  "shift",
  "unshift",
  "concat",
  "join",
  "split",
  "gsub",
  "sub",
  "match",
  "scan",
  "strip",
  "chomp",
  "chop",
  "upcase",
  "downcase",
  "capitalize",
  "reverse",
  "replace",
  "slice"
]);
var RUBY_KEYWORDS = /* @__PURE__ */ new Set([
  "BEGIN",
  "END",
  "alias",
  "and",
  "begin",
  "break",
  "case",
  "class",
  "def",
  "defined?",
  "do",
  "else",
  "elsif",
  "end",
  "ensure",
  "false",
  "for",
  "if",
  "in",
  "module",
  "next",
  "nil",
  "not",
  "or",
  "redo",
  "rescue",
  "retry",
  "return",
  "self",
  "super",
  "then",
  "true",
  "undef",
  "unless",
  "until",
  "when",
  "while",
  "yield",
  "__FILE__",
  "__LINE__",
  "__ENCODING__"
]);
var TreeSitterRubyParser = class extends BaseParser {
  constructor() {
    super("ruby");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (require / require_relative / load) ────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkRequires(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkRequires(node, sourceId, relations) {
    if (node.type === "call" || node.type === "method_call") {
      const method = node.childForFieldName("method") || node.child(0);
      const methodText = method?.text;
      if (methodText === "require" || methodText === "require_relative" || methodText === "load" || methodText === "autoload") {
        const args2 = node.childForFieldName("arguments") || this.findChild(node, "argument_list");
        if (args2) {
          const str = this.findStringInArgs(args2);
          if (str) {
            relations.push({
              source: sourceId,
              target: str,
              type: "import",
              label: `${methodText} '${str}'`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkRequires(node.child(i), sourceId, relations);
    }
  }
  findStringInArgs(args2) {
    for (let i = 0; i < args2.childCount; i++) {
      const c = args2.child(i);
      if (c.type === "string") {
        const content = this.findChild(c, "string_content");
        if (content)
          return content.text;
        const t = c.text;
        if (t.length >= 2)
          return t.slice(1, -1);
      } else if (c.type === "string_array" || c.type === "simple_symbol") {
      }
    }
    return null;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "method": {
        const name = this.getMethodName(node);
        if (name) {
          const sym = {
            name,
            type: insideClass ? "method" : "function",
            line: node.startPosition.row + 1
          };
          if (insideClass)
            symbols.methods.push(sym);
          else
            symbols.functions.push(sym);
        }
        return;
      }
      case "singleton_method": {
        const name = this.getMethodName(node);
        if (name) {
          symbols.methods.push({
            name,
            type: "singleton-method",
            line: node.startPosition.row + 1
          });
        }
        return;
      }
      case "class": {
        const name = this.getClassName(node);
        if (name) {
          symbols.classes.push({
            name,
            type: "class",
            line: node.startPosition.row + 1
          });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "module": {
        const name = this.getClassName(node);
        if (name) {
          symbols.classes.push({
            name,
            type: "module",
            line: node.startPosition.row + 1
          });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkSymbols(node.child(i), symbols, insideClass);
    }
  }
  getMethodName(node) {
    const named = node.childForFieldName("name");
    if (named && named.text)
      return named.text;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c.type === "identifier" || c.type === "constant" || c.type === "operator") {
        return c.text;
      }
    }
    return null;
  }
  getClassName(node) {
    const named = node.childForFieldName("name");
    if (named && named.text)
      return named.text;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c.type === "constant" || c.type === "scope_resolution") {
        return c.text;
      }
    }
    return null;
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedMethods(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}`
        });
      }
    }
    return relations;
  }
  collectDefinedMethods(node, defined) {
    if (node.type === "method" || node.type === "singleton_method") {
      const name = this.getMethodName(node);
      if (name)
        defined.add(name);
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedMethods(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call" || node.type === "method_call") {
      const method = node.childForFieldName("method");
      if (method && (method.type === "identifier" || method.type === "constant")) {
        const name = method.text;
        if (name && !RUBY_BUILTINS.has(name) && !RUBY_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Call sites (function-level) ────────────────────────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedMethods(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "method" || node.type === "singleton_method") {
      const name = this.getMethodName(node) || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call" || node.type === "method_call") {
      const method = node.childForFieldName("method");
      if (method && (method.type === "identifier" || method.type === "constant")) {
        const name = method.text;
        if (name && !RUBY_BUILTINS.has(name) && !RUBY_KEYWORDS.has(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type)
        return node.child(i);
    }
    return null;
  }
};

// src/analyzer/parsers/ts-swift-parser.ts
var SWIFT_BUILTINS = /* @__PURE__ */ new Set([
  "print",
  "debugPrint",
  "dump",
  "precondition",
  "preconditionFailure",
  "assert",
  "assertionFailure",
  "fatalError",
  "abort",
  "exit",
  "String",
  "Int",
  "Int8",
  "Int16",
  "Int32",
  "Int64",
  "UInt",
  "UInt8",
  "UInt16",
  "UInt32",
  "UInt64",
  "Double",
  "Float",
  "Bool",
  "Character",
  "Array",
  "Dictionary",
  "Set",
  "Optional",
  "Result",
  "Range",
  "ClosedRange",
  "Any",
  "AnyObject",
  "Self",
  "Void",
  "Never",
  "min",
  "max",
  "abs",
  "sqrt",
  "pow",
  "sin",
  "cos",
  "tan",
  "map",
  "filter",
  "reduce",
  "compactMap",
  "flatMap",
  "sorted",
  "forEach",
  "first",
  "last",
  "count",
  "isEmpty",
  "contains",
  "append",
  "insert",
  "remove",
  "removeAll",
  "removeFirst",
  "removeLast",
  "description",
  "debugDescription",
  "hashValue",
  "lazy",
  "mutating",
  "nonmutating",
  "unowned",
  "weak"
]);
var SWIFT_KEYWORDS = /* @__PURE__ */ new Set([
  "associatedtype",
  "class",
  "deinit",
  "enum",
  "extension",
  "fileprivate",
  "func",
  "import",
  "init",
  "inout",
  "internal",
  "let",
  "open",
  "operator",
  "private",
  "protocol",
  "public",
  "rethrows",
  "static",
  "struct",
  "subscript",
  "typealias",
  "var",
  "break",
  "case",
  "continue",
  "default",
  "defer",
  "do",
  "else",
  "fallthrough",
  "for",
  "guard",
  "if",
  "in",
  "repeat",
  "return",
  "switch",
  "where",
  "while",
  "as",
  "Any",
  "catch",
  "false",
  "is",
  "nil",
  "super",
  "self",
  "Self",
  "throw",
  "throws",
  "true",
  "try",
  "async",
  "await",
  "final",
  "override",
  "required",
  "convenience",
  "lazy",
  "optional",
  "weak",
  "unowned"
]);
var TreeSitterSwiftParser = class extends BaseParser {
  constructor() {
    super("swift");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_declaration") {
        const target = this.extractImportTarget(node);
        if (target) {
          relations.push({
            source: fileInfo.id,
            target,
            type: "import",
            label: `import ${target}`
          });
        }
      }
    }
    return relations;
  }
  extractImportTarget(node) {
    const parts = [];
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c.type === "identifier" || c.type === "simple_identifier" || c.type === "type_identifier") {
        parts.push(c.text);
      } else if (c.type === ".") {
        parts.push(".");
      }
    }
    if (parts.length === 0) {
      const t = node.text.replace(/^import\s+/, "").trim();
      return t || null;
    }
    return parts.join("");
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkSymbols(node, symbols, insideType) {
    switch (node.type) {
      case "function_declaration":
      case "init_declaration":
      case "deinit_declaration": {
        const name = this.getDeclName(node) || (node.type === "init_declaration" ? "init" : node.type === "deinit_declaration" ? "deinit" : null);
        if (name) {
          const sym = {
            name,
            type: insideType ? "method" : "function",
            line: node.startPosition.row + 1
          };
          if (insideType)
            symbols.methods.push(sym);
          else
            symbols.functions.push(sym);
        }
        return;
      }
      case "class_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.classes.push({ name, type: "class", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "struct_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.structs.push({ name, type: "struct", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "protocol_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.interfaces.push({ name, type: "protocol", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "enum_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.enums.push({ name, type: "enum", line: node.startPosition.row + 1 });
        }
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "extension_declaration": {
        for (let i = 0; i < node.childCount; i++) {
          this.walkSymbols(node.child(i), symbols, true);
        }
        return;
      }
      case "typealias_declaration": {
        const name = this.getDeclName(node);
        if (name) {
          symbols.typeAliases.push({ name, type: "type-alias", line: node.startPosition.row + 1 });
        }
        return;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkSymbols(node.child(i), symbols, insideType);
    }
  }
  getDeclName(node) {
    const named = node.childForFieldName("name");
    if (named && named.text)
      return named.text;
    for (let i = 0; i < node.childCount; i++) {
      const c = node.child(i);
      if (c.type === "simple_identifier" || c.type === "type_identifier" || c.type === "identifier") {
        return c.text;
      }
    }
    return null;
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration") {
      const name = this.getDeclName(node);
      if (name)
        defined.add(name);
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const first = node.child(0);
      if (first && (first.type === "simple_identifier" || first.type === "identifier" || first.type === "type_identifier")) {
        const name = first.text;
        if (name && !SWIFT_BUILTINS.has(name) && !SWIFT_KEYWORDS.has(name) && !definedHere.has(name) && /^[a-zA-Z_]/.test(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Call sites (function-level) ────────────────────────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_declaration") {
      const name = this.getDeclName(node) || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call_expression") {
      const first = node.child(0);
      if (first && (first.type === "simple_identifier" || first.type === "identifier" || first.type === "type_identifier")) {
        const name = first.text;
        if (name && !SWIFT_BUILTINS.has(name) && !SWIFT_KEYWORDS.has(name) && /^[a-zA-Z_]/.test(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
};

// src/analyzer/parsers/ts-csharp-parser.ts
var CSHARP_BUILTINS = /* @__PURE__ */ new Set([
  "Console",
  "WriteLine",
  "Write",
  "ReadLine",
  "ReadAllText",
  "ReadAllLines",
  "WriteAllText",
  "String",
  "Int32",
  "Int64",
  "Double",
  "Boolean",
  "Object",
  "Math",
  "Array",
  "List",
  "Dictionary",
  "HashSet",
  "Enumerable",
  "Linq",
  "Exception",
  "ArgumentException",
  "InvalidOperationException",
  "NotImplementedException",
  "Task",
  "Thread",
  "StringBuilder",
  "Guid",
  "DateTime",
  "TimeSpan",
  "ToString",
  "Equals",
  "GetHashCode",
  "GetType",
  "Add",
  "Remove",
  "Contains",
  "Clear",
  "Count",
  "Length",
  "TryGetValue",
  "TryParse",
  "Parse",
  "Concat",
  "Join",
  "Format",
  "NameOf",
  "TypeOf"
]);
var CSHARP_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "foreach",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "is",
  "as",
  "this",
  "base",
  "null",
  "true",
  "false",
  "void",
  "var",
  "nameof",
  "typeof",
  "sizeof",
  "default",
  "checked",
  "unchecked",
  "when",
  "await",
  "yield",
  "public",
  "private",
  "protected",
  "internal",
  "static",
  "readonly",
  "sealed",
  "abstract",
  "virtual",
  "override",
  "partial",
  "async",
  "class",
  "interface",
  "struct",
  "enum",
  "record",
  "namespace",
  "using",
  "get",
  "set",
  "value",
  "in",
  "out",
  "ref",
  "params",
  "where",
  "select",
  "from",
  "let",
  "orderby"
]);
var TreeSitterCSharpParser = class extends BaseParser {
  constructor() {
    super("csharp");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (using directives) ─────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkUsings(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkUsings(node, sourceId, relations) {
    if (node.type === "using_directive" || node.type === "global_using_directive") {
      const qualified = this.findChild(node, "qualified_name");
      const simple = this.findChild(node, "identifier");
      const target = qualified?.text || simple?.text;
      if (target) {
        relations.push({
          source: sourceId,
          target,
          type: "import",
          label: `using ${target}`
        });
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkUsings(node.child(i), sourceId, relations);
    }
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideType) {
    switch (node.type) {
      case "class_declaration":
      case "record_declaration":
        this.extractClassLike(node, symbols, "class");
        return;
      case "interface_declaration":
        this.extractClassLike(node, symbols, "interface");
        return;
      case "struct_declaration":
        this.extractClassLike(node, symbols, "struct");
        return;
      case "enum_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          symbols.enums.push({ name, type: "enum", line: node.startPosition.row + 1 });
        }
        return;
      }
      case "method_declaration":
      case "constructor_declaration":
        if (insideType) {
          this.extractMethod(node, symbols);
        }
        return;
      case "local_function_statement":
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideType);
    }
  }
  extractClassLike(node, symbols, kind) {
    const name = node.childForFieldName("name")?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const mods = this.getModifiers(node);
    const sym = { name, type: kind, line };
    if (mods.visibility) {
      sym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      sym.isStatic = true;
    }
    if (kind === "interface") {
      symbols.interfaces.push(sym);
    } else if (kind === "struct") {
      symbols.structs.push(sym);
    } else {
      symbols.classes.push(sym);
    }
    const body2 = node.childForFieldName("body");
    if (body2) {
      for (let i = 0; i < body2.childCount; i++) {
        this.walkForSymbols(body2.child(i), symbols, true);
      }
    }
  }
  extractMethod(node, symbols) {
    const name = node.childForFieldName("name")?.text;
    if (!name) {
      return;
    }
    const mods = this.getModifiers(node);
    const sym = { name, type: "method", line: node.startPosition.row + 1 };
    if (mods.visibility) {
      sym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      sym.isStatic = true;
    }
    if (mods.isAsync) {
      sym.isAsync = true;
    }
    symbols.methods.push(sym);
  }
  // ── Heritage relations ─────────────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    const typed = node.type === "class_declaration" || node.type === "record_declaration" || node.type === "struct_declaration" || node.type === "interface_declaration";
    if (typed) {
      const typeName = node.childForFieldName("name")?.text;
      const bases = node.childForFieldName("bases");
      if (typeName && bases) {
        const baseNames = this.extractBaseNames(bases);
        if (node.type === "interface_declaration" || node.type === "struct_declaration") {
          for (const base of baseNames) {
            relations.push({
              source: sourceId,
              target: base,
              type: "extends",
              label: `${typeName} : ${base}`
            });
          }
        } else {
          baseNames.forEach((base, idx) => {
            relations.push({
              source: sourceId,
              target: base,
              type: idx === 0 ? "extends" : "implements",
              label: `${typeName} : ${base}`
            });
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  extractBaseNames(baseList) {
    const names = [];
    for (let i = 0; i < baseList.childCount; i++) {
      const child = baseList.child(i);
      if (child.type === "identifier" || child.type === "generic_name" || child.type === "qualified_name") {
        const plain = child.text.replace(/<[^>]*>/g, "").split(".").pop();
        if (plain) {
          names.push(plain);
        }
      }
    }
    return names;
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "method_declaration" || node.type === "constructor_declaration" || node.type === "local_function_statement") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "invocation_expression") {
      const fn = node.childForFieldName("function");
      if (fn && (fn.type === "identifier" || fn.type === "generic_name")) {
        const name = fn.type === "identifier" ? fn.text : this.findChild(fn, "identifier")?.text;
        if (name && !CSHARP_BUILTINS.has(name) && !CSHARP_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "method_declaration" || node.type === "constructor_declaration" || node.type === "local_function_statement") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "invocation_expression") {
      const fn = node.childForFieldName("function");
      if (fn && (fn.type === "identifier" || fn.type === "generic_name")) {
        const name = fn.type === "identifier" ? fn.text : this.findChild(fn, "identifier")?.text;
        if (name && !CSHARP_BUILTINS.has(name) && !CSHARP_KEYWORDS.has(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getModifiers(node) {
    let text = "";
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "modifier") {
        text += " " + child.text;
      }
    }
    if (!text) {
      return {};
    }
    const result = {};
    if (text.includes("public")) {
      result.visibility = "public";
    } else if (text.includes("private")) {
      result.visibility = "private";
    } else if (text.includes("protected")) {
      result.visibility = "protected";
    }
    if (text.includes("static")) {
      result.isStatic = true;
    }
    if (text.includes("async")) {
      result.isAsync = true;
    }
    return result;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-php-parser.ts
var PHP_BUILTINS = /* @__PURE__ */ new Set([
  "trim",
  "ltrim",
  "rtrim",
  "strlen",
  "str_replace",
  "strpos",
  "strrpos",
  "substr",
  "strtolower",
  "strtoupper",
  "ucfirst",
  "sprintf",
  "printf",
  "print_r",
  "var_dump",
  "count",
  "array_map",
  "array_filter",
  "array_merge",
  "array_keys",
  "array_values",
  "array_push",
  "array_pop",
  "in_array",
  "array_key_exists",
  "implode",
  "explode",
  "json_encode",
  "json_decode",
  "isset",
  "empty",
  "is_array",
  "is_string",
  "is_null",
  "is_numeric",
  "is_object",
  "is_bool",
  "is_int",
  "htmlspecialchars",
  "urlencode",
  "preg_match",
  "preg_match_all",
  "preg_replace",
  "preg_split",
  "method_exists",
  "class_exists",
  "function_exists",
  "file_exists",
  "file_get_contents",
  "file_put_contents",
  "date",
  "time",
  "uniqid",
  "md5",
  "sha1",
  "base64_encode",
  "base64_decode",
  "round",
  "floor",
  "ceil",
  "abs",
  "min",
  "max",
  "intval",
  "floatval",
  "strval",
  "nl2br",
  "number_format",
  "ucwords",
  "str_pad",
  "str_repeat",
  "str_contains",
  "str_starts_with",
  "str_ends_with",
  "mb_strlen",
  "mb_substr"
]);
var PHP_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "elseif",
  "endif",
  "for",
  "foreach",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "return",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "instanceof",
  "clone",
  "echo",
  "print",
  "include",
  "include_once",
  "require",
  "require_once",
  "namespace",
  "use",
  "class",
  "interface",
  "trait",
  "enum",
  "extends",
  "implements",
  "public",
  "private",
  "protected",
  "static",
  "abstract",
  "final",
  "function",
  "fn",
  "match",
  "yield",
  "list",
  "array",
  "isset",
  "unset",
  "empty",
  "true",
  "false",
  "null",
  "this",
  "parent",
  "self",
  "as",
  "and",
  "or",
  "xor",
  "global",
  "insteadof"
]);
var TreeSitterPhpParser = class extends BaseParser {
  constructor() {
    super("php");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (use / require / include) ──────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkImports(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkImports(node, sourceId, relations) {
    if (node.type === "namespace_use_declaration") {
      this.collectUseClauses(node, sourceId, relations);
    }
    if (node.type === "require_expression" || node.type === "require_once_expression" || node.type === "include_expression" || node.type === "include_once_expression") {
      const target = this.extractStringTarget(node);
      if (target) {
        const isRequire = node.type.startsWith("require");
        relations.push({
          source: sourceId,
          target,
          type: isRequire ? "require" : "include",
          label: `${node.type.replace("_expression", "").replace("_", " ")} ${target}`
        });
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkImports(node.child(i), sourceId, relations);
    }
  }
  collectUseClauses(node, sourceId, relations) {
    const walk = (n) => {
      if (n.type === "namespace_use_clause") {
        const qualified = this.findChild(n, "qualified_name") || this.findChild(n, "name");
        if (qualified) {
          const target = qualified.text.replace(/^\\/, "");
          relations.push({
            source: sourceId,
            target,
            type: "import",
            label: `use ${target}`
          });
        }
        return;
      }
      for (let i = 0; i < n.childCount; i++) {
        walk(n.child(i));
      }
    };
    for (let i = 0; i < node.childCount; i++) {
      walk(node.child(i));
    }
  }
  extractStringTarget(node) {
    const str = this.findChild(node, "string");
    if (!str) {
      return null;
    }
    const content = this.findChild(str, "string_content");
    const raw = content ? content.text : str.text.replace(/^['"]|['"]$/g, "");
    return raw.length > 0 ? raw : null;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideType) {
    switch (node.type) {
      case "class_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          symbols.classes.push(this.buildTypeSymbol(node, name, "class"));
        }
        this.walkBody(node, symbols);
        return;
      }
      case "interface_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          symbols.interfaces.push(this.buildTypeSymbol(node, name, "interface"));
        }
        this.walkBody(node, symbols);
        return;
      }
      case "trait_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          symbols.traits.push(this.buildTypeSymbol(node, name, "trait"));
        }
        this.walkBody(node, symbols);
        return;
      }
      case "enum_declaration": {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          symbols.enums.push({ name, type: "enum", line: node.startPosition.row + 1 });
        }
        return;
      }
      case "function_definition": {
        if (!insideType) {
          const name = node.childForFieldName("name")?.text;
          if (name) {
            symbols.functions.push({ name, type: "function", line: node.startPosition.row + 1 });
          }
        }
        return;
      }
      case "method_declaration": {
        if (insideType) {
          const name = node.childForFieldName("name")?.text;
          if (name) {
            const sym = { name, type: "method", line: node.startPosition.row + 1 };
            const vis = this.findChild(node, "visibility_modifier")?.text;
            if (vis === "public" || vis === "private" || vis === "protected") {
              sym.visibility = vis;
            }
            symbols.methods.push(sym);
          }
        }
        return;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideType);
    }
  }
  buildTypeSymbol(node, name, type) {
    return { name, type, line: node.startPosition.row + 1 };
  }
  walkBody(node, symbols) {
    const body2 = node.childForFieldName("body");
    if (!body2) {
      return;
    }
    for (let i = 0; i < body2.childCount; i++) {
      this.walkForSymbols(body2.child(i), symbols, true);
    }
  }
  // ── Heritage relations ─────────────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration" || node.type === "interface_declaration") {
      const typeName = node.childForFieldName("name")?.text;
      if (typeName) {
        const baseClause = this.findChild(node, "base_clause");
        if (baseClause) {
          for (const base of this.extractClauseNames(baseClause)) {
            relations.push({
              source: sourceId,
              target: base,
              type: "extends",
              label: `${typeName} extends ${base}`
            });
          }
        }
        const ifaceClause = this.findChild(node, "class_interface_clause");
        if (ifaceClause) {
          for (const iface of this.extractClauseNames(ifaceClause)) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${typeName} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  extractClauseNames(clause) {
    const names = [];
    for (let i = 0; i < clause.childCount; i++) {
      const child = clause.child(i);
      if (child.type === "name" || child.type === "qualified_name") {
        const plain = child.text.replace(/^\\/, "").split("\\").pop();
        if (plain) {
          names.push(plain);
        }
      }
    }
    return names;
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition" || node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "function_call_expression") {
      const fn = node.childForFieldName("function");
      if (fn && (fn.type === "name" || fn.type === "qualified_name")) {
        const raw = fn.text.replace(/^\\/, "");
        const name = raw.split("\\").pop();
        if (!PHP_BUILTINS.has(name) && !PHP_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_definition" || node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "function_call_expression") {
      const fn = node.childForFieldName("function");
      if (fn && (fn.type === "name" || fn.type === "qualified_name")) {
        const raw = fn.text.replace(/^\\/, "");
        const name = raw.split("\\").pop();
        if (!PHP_BUILTINS.has(name) && !PHP_KEYWORDS.has(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-bash-parser.ts
var SOURCE_COMMANDS = /* @__PURE__ */ new Set(["source", "."]);
var SCRIPT_RUNNERS = /* @__PURE__ */ new Set(["bash", "sh", "zsh", "dash"]);
var SCRIPT_EXT_RE = /\.(sh|bash)$/i;
var TreeSitterBashParser = class extends BaseParser {
  constructor() {
    super("bash");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (source / script execution) ────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkCommands(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkCommands(node, sourceId, relations) {
    if (node.type === "command") {
      const nameNode = node.childForFieldName("name");
      const name = nameNode?.text ?? "";
      if (SOURCE_COMMANDS.has(name)) {
        const target = this.extractArgumentTarget(node);
        if (target) {
          relations.push({
            source: sourceId,
            target,
            type: "source",
            label: `source ${target}`
          });
        }
      } else if (SCRIPT_RUNNERS.has(name)) {
        const target = this.extractArgumentTarget(node);
        if (target && SCRIPT_EXT_RE.test(target)) {
          relations.push({
            source: sourceId,
            target,
            type: "script",
            label: `${name} ${target}`
          });
        }
      } else if (SCRIPT_EXT_RE.test(name) && (name.includes("/") || name.startsWith("."))) {
        relations.push({
          source: sourceId,
          target: name,
          type: "script",
          label: `run ${name}`
        });
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkCommands(node.child(i), sourceId, relations);
    }
  }
  extractArgumentTarget(command) {
    const arg = command.childForFieldName("argument");
    if (!arg) {
      return null;
    }
    if (arg.type === "string" || arg.type === "raw_string" || arg.type === "concatenation") {
      const text = arg.text.replace(/^['"]|['"]$/g, "");
      return text.length > 0 && !text.includes("$") ? text : null;
    }
    if (arg.type === "word" || arg.type === "number") {
      const text = arg.text;
      return text.length > 0 && !text.includes("$") ? text : null;
    }
    return null;
  }
  // ── Symbols (functions) ────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForFunctions(tree.rootNode, symbols);
    return symbols;
  }
  walkForFunctions(node, symbols) {
    if (node.type === "function_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        symbols.functions.push({ name, type: "function", line: node.startPosition.row + 1 });
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForFunctions(node.child(i), symbols);
    }
  }
  // Shell scripts have no cross-file function calls — sourcing is the only
  // cross-file dependency (see parseAST).
  extractCallsFromAST(_tree) {
    return [];
  }
};

// src/analyzer/parsers/ts-lua-parser.ts
var LUA_BUILTINS = /* @__PURE__ */ new Set([
  "print",
  "pairs",
  "ipairs",
  "tostring",
  "tonumber",
  "type",
  "next",
  "select",
  "setmetatable",
  "getmetatable",
  "rawget",
  "rawset",
  "rawequal",
  "rawlen",
  "pcall",
  "xpcall",
  "error",
  "assert",
  "collectgarbage",
  "unpack",
  "require",
  "dofile",
  "load",
  "loadfile"
]);
var LUA_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "then",
  "else",
  "elseif",
  "end",
  "for",
  "while",
  "repeat",
  "until",
  "do",
  "return",
  "break",
  "goto",
  "in",
  "local",
  "function",
  "and",
  "or",
  "not",
  "nil",
  "true",
  "false"
]);
var REQUIRE_RE = /\b(require|dofile)\s*\(?\s*['"]([^'"]+)['"]/g;
var TreeSitterLuaParser = class extends BaseParser {
  constructor() {
    super("lua");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (require / dofile) ─────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (target) => {
      if (seen.has(target)) {
        return;
      }
      seen.add(target);
      relations.push({
        source: fileInfo.id,
        target,
        type: "require",
        label: `require('${target}')`
      });
    };
    this.walkCalls(tree.rootNode, push);
    const content = fileInfo.content || "";
    let m;
    REQUIRE_RE.lastIndex = 0;
    while ((m = REQUIRE_RE.exec(content)) !== null) {
      push(m[2]);
    }
    return relations;
  }
  walkCalls(node, push) {
    if (node.type === "call") {
      const fn = node.childForFieldName("function");
      if (fn && fn.type === "variable") {
        const nameNode = fn.childForFieldName("name");
        const name = nameNode?.text;
        if (name === "require" || name === "dofile") {
          const args2 = node.childForFieldName("arguments");
          const str = args2 ? this.findStringArg(args2) : null;
          if (str) {
            push(str);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkCalls(node.child(i), push);
    }
  }
  findStringArg(node) {
    if (node.type === "string") {
      const content = this.findChild(node, "string_content");
      const raw = content ? content.text : node.text.replace(/^['"]|['"]$/g, "");
      return raw.length > 0 ? raw : null;
    }
    for (let i = 0; i < node.childCount; i++) {
      const found = this.findStringArg(node.child(i));
      if (found) {
        return found;
      }
    }
    return null;
  }
  // ── Symbols (functions) ────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForFunctions(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForFunctions(node, symbols, insideFunc) {
    if (node.type === "function_definition_statement" || node.type === "local_function_definition_statement") {
      if (!insideFunc) {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          symbols.functions.push({ name, type: "function", line: node.startPosition.row + 1 });
        }
      }
      for (let i = 0; i < node.childCount; i++) {
        this.walkForFunctions(node.child(i), symbols, true);
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForFunctions(node.child(i), symbols, insideFunc);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition_statement" || node.type === "local_function_definition_statement") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
        const short = name.split(".").pop();
        if (short) {
          defined.add(short);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call") {
      const fn = node.childForFieldName("function");
      if (fn && fn.type === "variable" && !fn.childForFieldName("table")) {
        const name = fn.childForFieldName("name")?.text;
        if (name && !LUA_BUILTINS.has(name) && !LUA_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST-based call site extraction (function-level) ────────
  extractCallSitesAST(tree, _fileInfo) {
    const definedHere = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    const sites = [];
    this.collectCallSites(tree.rootNode, sites, definedHere, "<module>");
    return sites;
  }
  collectCallSites(node, sites, definedHere, currentFunc) {
    if (node.type === "function_definition_statement" || node.type === "local_function_definition_statement") {
      const name = node.childForFieldName("name")?.text || currentFunc;
      for (let i = 0; i < node.childCount; i++) {
        this.collectCallSites(node.child(i), sites, definedHere, name);
      }
      return;
    }
    if (node.type === "call") {
      const fn = node.childForFieldName("function");
      if (fn && fn.type === "variable" && !fn.childForFieldName("table")) {
        const name = fn.childForFieldName("name")?.text;
        if (name && !LUA_BUILTINS.has(name) && !LUA_KEYWORDS.has(name)) {
          sites.push({
            callerName: currentFunc,
            calleeName: name,
            line: node.startPosition.row + 1,
            isLocal: definedHere.has(name)
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCallSites(node.child(i), sites, definedHere, currentFunc);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/vue-parser.ts
var SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var STYLE_SRC_RE = /<style[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var SCRIPT_BLOCK_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
var STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
var IMPORT_FROM_RE = /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g;
var IMPORT_BARE_RE = /\bimport\s*['"]([^'"]+)['"]/g;
var REQUIRE_RE2 = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
var CSS_IMPORT_RE = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g;
var VueParser = class extends BaseParser {
  constructor() {
    super("vue");
  }
  parse(fileInfo, _options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (target, type, label) => {
      const key = type + "|" + target;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      relations.push({ source: id, target, type, label });
    };
    for (const m of content.matchAll(new RegExp(SCRIPT_SRC_RE.source, "gi"))) {
      push(m[1], "script", `<script src="${m[1]}">`);
    }
    for (const m of content.matchAll(new RegExp(STYLE_SRC_RE.source, "gi"))) {
      push(m[1], "stylesheet", `<style src="${m[1]}">`);
    }
    for (const block of content.matchAll(new RegExp(SCRIPT_BLOCK_RE.source, "gi"))) {
      const script = block[1];
      for (const m of script.matchAll(new RegExp(IMPORT_FROM_RE.source, "g"))) {
        push(m[1], "import", `import ${m[1]}`);
      }
      for (const m of script.matchAll(new RegExp(IMPORT_BARE_RE.source, "g"))) {
        push(m[1], "import", `import ${m[1]}`);
      }
      for (const m of script.matchAll(new RegExp(REQUIRE_RE2.source, "g"))) {
        push(m[1], "require", `require('${m[1]}')`);
      }
    }
    for (const block of content.matchAll(new RegExp(STYLE_BLOCK_RE.source, "gi"))) {
      for (const m of block[1].matchAll(new RegExp(CSS_IMPORT_RE.source, "g"))) {
        push(m[1], "css-import", `@import '${m[1]}'`);
      }
    }
    return relations;
  }
};

// src/analyzer/parsers/html-parser.ts
var SCRIPT_SRC_RE2 = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var LINK_HREF_RE = /<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi;
var IMG_SRC_RE = /<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var HTMLParser = class extends BaseParser {
  constructor() {
    super("html");
  }
  parse(fileInfo, options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    relations.push(...this.extractMatches(
      content,
      new RegExp(SCRIPT_SRC_RE2.source, "gi"),
      "script",
      id,
      (m) => `<script src="${m[1]}">`
    ));
    relations.push(...this.extractMatches(
      content,
      new RegExp(LINK_HREF_RE.source, "gi"),
      "stylesheet",
      id,
      (m) => `<link href="${m[1]}">`
    ));
    if (options.includeAssets) {
      relations.push(...this.extractMatches(
        content,
        new RegExp(IMG_SRC_RE.source, "gi"),
        "asset",
        id,
        (m) => `<img src="${m[1]}">`
      ));
    }
    return relations;
  }
};

// src/analyzer/parsers/css-parser.ts
var CSS_IMPORT_RE2 = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g;
var CSS_URL_RE = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g;
var CSSParser = class extends BaseParser {
  constructor() {
    super("css");
  }
  parse(fileInfo, options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    relations.push(...this.extractMatches(
      content,
      new RegExp(CSS_IMPORT_RE2.source, "g"),
      "css-import",
      id,
      (m) => `@import "${m[1]}"`
    ));
    if (options.includeUrls) {
      const urlMatches = this.extractMatches(
        content,
        new RegExp(CSS_URL_RE.source, "g"),
        "css-url",
        id,
        (m) => `url("${m[1]}")`
      );
      relations.push(...urlMatches.filter(
        (r) => !r.target.startsWith("data:") && !r.target.startsWith("http:") && !r.target.startsWith("https:") && !r.target.startsWith("#")
      ));
    }
    return relations;
  }
};

// src/history-worker.ts
var LANGUAGE_MAP = {
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
  ".hh": "cpp",
  ".js": "javascript",
  ".ts": "typescript",
  ".py": "python",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".rb": "ruby",
  ".swift": "swift",
  ".cs": "csharp",
  ".php": "php",
  ".vue": "vue",
  ".sh": "bash",
  ".bash": "bash",
  ".lua": "lua",
  ".md": "documentation",
  ".markdown": "documentation",
  ".txt": "documentation",
  ".rst": "documentation"
};
var SUPPORTED_EXTENSIONS = new Set(Object.keys(LANGUAGE_MAP));
var PARSER_REGISTRY = {
  "c": new TreeSitterCParser(),
  "cpp": new TreeSitterCppParser(),
  "javascript": new TreeSitterJSParser(),
  "typescript": new TreeSitterTSParser(),
  "python": new TreeSitterPyParser(),
  "java": new TreeSitterJavaParser(),
  "go": new TreeSitterGoParser(),
  "rust": new TreeSitterRustParser(),
  "kotlin": new TreeSitterKotlinParser(),
  "ruby": new TreeSitterRubyParser(),
  "swift": new TreeSitterSwiftParser(),
  "csharp": new TreeSitterCSharpParser(),
  "php": new TreeSitterPhpParser(),
  "vue": new VueParser(),
  "bash": new TreeSitterBashParser(),
  "lua": new TreeSitterLuaParser(),
  "html": new HTMLParser(),
  "css": new CSSParser()
};
var SYMBOL_LANGUAGES = /* @__PURE__ */ new Set(["c", "cpp", "javascript", "typescript", "python", "java", "go", "rust", "kotlin", "ruby", "swift", "csharp", "php", "bash", "lua"]);
function post(msg) {
  import_worker_threads.parentPort?.postMessage(msg);
}
function buildFileInfoFromContent(relativePath, content) {
  const ext = (0, import_path2.extname)(relativePath).toLowerCase();
  const parts = relativePath.split("/");
  return {
    id: relativePath,
    name: parts[parts.length - 1],
    path: relativePath,
    fullPath: "",
    // not on disk
    language: LANGUAGE_MAP[ext] || "unknown",
    extension: ext,
    size: Buffer.byteLength(content, "utf-8"),
    linesOfCode: content.split("\n").filter((l) => l.trim().length > 0).length,
    lastModified: 0,
    group: parts.length > 1 ? parts[0] : "/",
    content
  };
}
async function analyzeFileForDelta(fileInfo, existingFiles, fileMap) {
  const parser = PARSER_REGISTRY[fileInfo.language];
  let tree;
  if (parser?.usesTreeSitter && hasGrammar(fileInfo.language)) {
    try {
      tree = await parseSource(fileInfo.language, fileInfo.content);
    } catch {
    }
  }
  const linksOut = [];
  if (parser) {
    const relations = tree ? parser.parseAST(tree, fileInfo, {}) : parser.parse(fileInfo, {});
    for (const rel of relations) {
      const resolved = resolveTarget(rel.target, fileInfo.id, existingFiles, fileMap);
      if (resolved && resolved !== fileInfo.id) {
        linksOut.push({ target: resolved, type: rel.type });
      }
    }
  }
  let symbols = void 0;
  if (SYMBOL_LANGUAGES.has(fileInfo.language) && parser) {
    const raw = tree ? parser.extractSymbolsAST(tree, fileInfo) : parser.extractSymbols?.(fileInfo);
    if (raw) {
      symbols = {
        functions: raw.functions.map((f) => ({
          name: f.name,
          returnType: f.returnType || "",
          params: f.params || "",
          line: f.line || 0,
          type: f.type
        })),
        structs: raw.structs.map((s) => ({ name: s.name, type: s.type, line: s.line || 0 })),
        enums: raw.enums.map((e) => ({ name: e.name, type: e.type, line: e.line || 0 })),
        macros: raw.macros.map((m) => ({ name: m.name, type: m.type, line: m.line || 0 })),
        classes: raw.classes.map((c) => ({ name: c.name, type: c.type, line: c.line || 0 })),
        exports: raw.exports.map((e) => ({ name: e.name, type: e.type, line: e.line || 0 })),
        interfaces: (raw.interfaces || []).map((i) => ({ name: i.name, type: i.type })),
        traits: (raw.traits || []).map((t) => ({ name: t.name, type: t.type })),
        typeAliases: (raw.typeAliases || []).map((ta) => ({ name: ta.name, type: ta.type })),
        methods: (raw.methods || []).map((m) => ({
          name: m.name,
          returnType: m.returnType || "",
          params: m.params || "",
          line: m.line || 0,
          type: m.type,
          visibility: m.visibility,
          isStatic: m.isStatic,
          isAsync: m.isAsync
        })),
        totalSymbols: raw.functions.length + raw.structs.length + raw.enums.length + raw.macros.length + raw.classes.length + raw.exports.length + (raw.interfaces || []).length + (raw.traits || []).length + (raw.typeAliases || []).length + (raw.methods || []).length
      };
    }
  }
  const complexity = computeComplexity(fileInfo).complexity;
  return {
    id: fileInfo.id,
    linesOfCode: fileInfo.linesOfCode,
    complexity,
    language: fileInfo.language,
    symbols,
    linksOut
  };
}
function resolveTarget(target, sourceId, existingFiles, fileMap) {
  if (existingFiles.has(target))
    return target;
  const sourceDir = (0, import_path2.dirname)(sourceId);
  const relativePath = (0, import_path2.normalize)((0, import_path2.join)(sourceDir, target));
  if (existingFiles.has(relativePath))
    return relativePath;
  const tryExts = [".js", ".ts", ".py", ".c", ".h", ".cpp", ".hpp", ".css", ".html", ".java", ".go", ".rs", ".kt", ".rb", ".swift", ".md"];
  for (const ext of tryExts) {
    if (existingFiles.has(relativePath + ext))
      return relativePath + ext;
  }
  const indexFiles = ["index.js", "index.ts", "__init__.py"];
  for (const idx of indexFiles) {
    const indexPath = (0, import_path2.join)(relativePath, idx);
    if (existingFiles.has(indexPath))
      return indexPath;
  }
  const targetBase = target.split("/").pop() || target;
  for (const filePath of existingFiles) {
    const fileBase = filePath.split("/").pop() || filePath;
    if (fileBase === targetBase)
      return filePath;
    for (const ext of tryExts) {
      if (fileBase === targetBase + ext)
        return filePath;
    }
  }
  return null;
}
async function run2() {
  const { rootPath, skipDirs, historyDir } = import_worker_threads.workerData;
  await initTreeSitter();
  const gitAvailable = await isGitRepo(rootPath);
  if (!gitAvailable) {
    post({ type: "error", message: "Not a git repository" });
    return;
  }
  (0, import_fs.mkdirSync)(historyDir, { recursive: true });
  const commits = await getCommitIndex(rootPath);
  if (commits.length === 0) {
    post({ type: "error", message: "No commits found" });
    return;
  }
  const cachedHashes = /* @__PURE__ */ new Set();
  for (const commit of commits) {
    const deltaPath = (0, import_path2.join)(historyDir, `${commit.hash}.json`);
    if ((0, import_fs.existsSync)(deltaPath)) {
      cachedHashes.add(commit.hash);
    }
  }
  const index = {
    repoRoot: rootPath,
    totalCommits: commits.length,
    scannedCommits: cachedHashes.size,
    commits
  };
  (0, import_fs.writeFileSync)((0, import_path2.join)(historyDir, "index.json"), JSON.stringify(index), "utf-8");
  post({ type: "index", payload: index });
  for (const commit of commits) {
    if (!cachedHashes.has(commit.hash))
      continue;
    try {
      const deltaPath = (0, import_path2.join)(historyDir, `${commit.hash}.json`);
      const cached = JSON.parse((0, import_fs.readFileSync)(deltaPath, "utf-8"));
      post({ type: "delta", payload: cached });
    } catch {
      cachedHashes.delete(commit.hash);
    }
  }
  const skipDirsLower = new Set(skipDirs.map((d) => d.toLowerCase()));
  let scanned = cachedHashes.size;
  for (const commit of commits) {
    if (cachedHashes.has(commit.hash))
      continue;
    try {
      const delta = await scanCommit(commit, rootPath, skipDirsLower);
      const deltaPath = (0, import_path2.join)(historyDir, `${commit.hash}.json`);
      (0, import_fs.writeFileSync)(deltaPath, JSON.stringify(delta), "utf-8");
      scanned++;
      post({ type: "delta", payload: delta });
      post({ type: "progress", payload: { scanned, total: commits.length } });
      index.scannedCommits = scanned;
      (0, import_fs.writeFileSync)((0, import_path2.join)(historyDir, "index.json"), JSON.stringify(index), "utf-8");
    } catch {
      scanned++;
      post({ type: "progress", payload: { scanned, total: commits.length } });
    }
  }
  post({ type: "done" });
}
async function scanCommit(commit, rootPath, skipDirsLower) {
  const delta = {
    hash: commit.hash,
    date: commit.date,
    message: commit.message,
    author: commit.author,
    added: [],
    removed: [],
    modified: {}
  };
  const relevantFiles = commit.files.filter((f) => {
    const ext = (0, import_path2.extname)(f.path).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext))
      return false;
    const firstDir = f.path.split("/")[0]?.toLowerCase();
    if (firstDir && skipDirsLower.has(firstDir))
      return false;
    return true;
  });
  if (relevantFiles.length === 0)
    return delta;
  const existingFiles = /* @__PURE__ */ new Set();
  const fileMap = /* @__PURE__ */ new Map();
  for (const f of relevantFiles) {
    const status = f.status;
    if (status === "D") {
      delta.removed.push(f.path);
      continue;
    }
    if (status === "A") {
      delta.added.push(f.path);
    }
    const content = await getFileAtCommit(rootPath, commit.hash, f.path);
    if (content === null)
      continue;
    const fileInfo = buildFileInfoFromContent(f.path, content);
    existingFiles.add(f.path);
    fileMap.set(f.path, fileInfo);
  }
  for (const [filePath, fileInfo] of fileMap) {
    const state = await analyzeFileForDelta(fileInfo, existingFiles, fileMap);
    delta.modified[filePath] = state;
  }
  return delta;
}
run2().catch((err2) => {
  post({ type: "error", message: err2 instanceof Error ? err2.message : String(err2) });
});
//# sourceMappingURL=history-worker.js.map
