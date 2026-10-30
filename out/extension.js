"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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

// node_modules/sql.js/dist/sql-wasm.js
var require_sql_wasm = __commonJS({
  "node_modules/sql.js/dist/sql-wasm.js"(exports2, module2) {
    "use strict";
    var initSqlJsPromise = void 0;
    var initSqlJs2 = function(moduleConfig) {
      if (initSqlJsPromise) {
        return initSqlJsPromise;
      }
      initSqlJsPromise = new Promise(function(resolveModule, reject) {
        var Module2 = typeof moduleConfig !== "undefined" ? moduleConfig : {};
        var originalOnAbortFunction = Module2["onAbort"];
        Module2["onAbort"] = function(errorThatCausedAbort) {
          reject(new Error(errorThatCausedAbort));
          if (originalOnAbortFunction) {
            originalOnAbortFunction(errorThatCausedAbort);
          }
        };
        Module2["postRun"] = Module2["postRun"] || [];
        Module2["postRun"].push(function() {
          resolveModule(Module2);
        });
        module2 = void 0;
        var k;
        k ||= typeof Module2 != "undefined" ? Module2 : {};
        var aa = !!globalThis.window, ba = !!globalThis.WorkerGlobalScope, ca = globalThis.process?.versions?.node && "renderer" != globalThis.process?.type;
        k.onRuntimeInitialized = function() {
          function a(f, l) {
            switch (typeof l) {
              case "boolean":
                bc(f, l ? 1 : 0);
                break;
              case "number":
                cc(f, l);
                break;
              case "string":
                dc(f, l, -1, -1);
                break;
              case "object":
                if (null === l)
                  lb(f);
                else if (null != l.length) {
                  var n = da(l.length);
                  m.set(l, n);
                  ec(f, n, l.length, -1);
                  ea(n);
                } else
                  sa(f, "Wrong API use : tried to return a value of an unknown type (" + l + ").", -1);
                break;
              default:
                lb(f);
            }
          }
          function b(f, l) {
            for (var n = [], p = 0; p < f; p += 1) {
              var u = r(l + 4 * p, "i32"), v = fc(u);
              if (1 === v || 2 === v)
                u = gc(u);
              else if (3 === v)
                u = hc(u);
              else if (4 === v) {
                v = u;
                u = ic(v);
                v = jc(v);
                for (var K = new Uint8Array(u), I = 0; I < u; I += 1)
                  K[I] = m[v + I];
                u = K;
              } else
                u = null;
              n.push(u);
            }
            return n;
          }
          function c(f, l) {
            this.Qa = f;
            this.db = l;
            this.Oa = 1;
            this.mb = [];
          }
          function d(f, l) {
            this.db = l;
            this.fb = fa(f);
            if (null === this.fb)
              throw Error("Unable to allocate memory for the SQL string");
            this.lb = this.fb;
            this.$a = this.sb = null;
          }
          function e(f) {
            this.filename = "dbfile_" + (4294967295 * Math.random() >>> 0);
            if (null != f) {
              var l = this.filename, n = "/", p = l;
              n && (n = "string" == typeof n ? n : ha(n), p = l ? ia(n + "/" + l) : n);
              l = ja(true, true);
              p = ka(
                p,
                l
              );
              if (f) {
                if ("string" == typeof f) {
                  n = Array(f.length);
                  for (var u = 0, v = f.length; u < v; ++u)
                    n[u] = f.charCodeAt(u);
                  f = n;
                }
                la(p, l | 146);
                n = ma(p, 577);
                na(n, f, 0, f.length, 0);
                oa(n);
                la(p, l);
              }
            }
            this.handleError(q(this.filename, g));
            this.db = r(g, "i32");
            ob(this.db);
            this.gb = {};
            this.Sa = {};
          }
          var g = y(4), h = k.cwrap, q = h("sqlite3_open", "number", ["string", "number"]), w = h("sqlite3_close_v2", "number", ["number"]), t = h("sqlite3_exec", "number", ["number", "string", "number", "number", "number"]), x = h("sqlite3_changes", "number", ["number"]), D = h(
            "sqlite3_prepare_v2",
            "number",
            ["number", "string", "number", "number", "number"]
          ), pb = h("sqlite3_sql", "string", ["number"]), lc = h("sqlite3_normalized_sql", "string", ["number"]), qb = h("sqlite3_prepare_v2", "number", ["number", "number", "number", "number", "number"]), mc = h("sqlite3_bind_text", "number", ["number", "number", "number", "number", "number"]), rb = h("sqlite3_bind_blob", "number", ["number", "number", "number", "number", "number"]), nc = h("sqlite3_bind_double", "number", ["number", "number", "number"]), oc = h("sqlite3_bind_int", "number", [
            "number",
            "number",
            "number"
          ]), pc = h("sqlite3_bind_parameter_index", "number", ["number", "string"]), qc = h("sqlite3_step", "number", ["number"]), rc = h("sqlite3_errmsg", "string", ["number"]), sc = h("sqlite3_column_count", "number", ["number"]), tc = h("sqlite3_data_count", "number", ["number"]), uc = h("sqlite3_column_double", "number", ["number", "number"]), sb = h("sqlite3_column_text", "string", ["number", "number"]), vc = h("sqlite3_column_blob", "number", ["number", "number"]), wc = h("sqlite3_column_bytes", "number", ["number", "number"]), xc = h(
            "sqlite3_column_type",
            "number",
            ["number", "number"]
          ), yc = h("sqlite3_column_name", "string", ["number", "number"]), zc = h("sqlite3_reset", "number", ["number"]), Ac = h("sqlite3_clear_bindings", "number", ["number"]), Bc = h("sqlite3_finalize", "number", ["number"]), tb = h("sqlite3_create_function_v2", "number", "number string number number number number number number number".split(" ")), fc = h("sqlite3_value_type", "number", ["number"]), ic = h("sqlite3_value_bytes", "number", ["number"]), hc = h("sqlite3_value_text", "string", ["number"]), jc = h(
            "sqlite3_value_blob",
            "number",
            ["number"]
          ), gc = h("sqlite3_value_double", "number", ["number"]), cc = h("sqlite3_result_double", "", ["number", "number"]), lb = h("sqlite3_result_null", "", ["number"]), dc = h("sqlite3_result_text", "", ["number", "string", "number", "number"]), ec = h("sqlite3_result_blob", "", ["number", "number", "number", "number"]), bc = h("sqlite3_result_int", "", ["number", "number"]), sa = h("sqlite3_result_error", "", ["number", "string", "number"]), ub = h("sqlite3_aggregate_context", "number", ["number", "number"]), ob = h(
            "RegisterExtensionFunctions",
            "number",
            ["number"]
          ), vb = h("sqlite3_update_hook", "number", ["number", "number", "number"]);
          c.prototype.bind = function(f) {
            if (!this.Qa)
              throw "Statement closed";
            this.reset();
            return Array.isArray(f) ? this.Gb(f) : null != f && "object" === typeof f ? this.Hb(f) : true;
          };
          c.prototype.step = function() {
            if (!this.Qa)
              throw "Statement closed";
            this.Oa = 1;
            var f = qc(this.Qa);
            switch (f) {
              case 100:
                return true;
              case 101:
                return false;
              default:
                throw this.db.handleError(f);
            }
          };
          c.prototype.Ab = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            return uc(this.Qa, f);
          };
          c.prototype.Ob = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            f = sb(this.Qa, f);
            if ("function" !== typeof BigInt)
              throw Error("BigInt is not supported");
            return BigInt(f);
          };
          c.prototype.Tb = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            return sb(this.Qa, f);
          };
          c.prototype.getBlob = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            var l = wc(this.Qa, f);
            f = vc(this.Qa, f);
            for (var n = new Uint8Array(l), p = 0; p < l; p += 1)
              n[p] = m[f + p];
            return n;
          };
          c.prototype.get = function(f, l) {
            l = l || {};
            null != f && this.bind(f) && this.step();
            f = [];
            for (var n = tc(this.Qa), p = 0; p < n; p += 1)
              switch (xc(this.Qa, p)) {
                case 1:
                  var u = l.useBigInt ? this.Ob(p) : this.Ab(p);
                  f.push(u);
                  break;
                case 2:
                  f.push(this.Ab(p));
                  break;
                case 3:
                  f.push(this.Tb(p));
                  break;
                case 4:
                  f.push(this.getBlob(p));
                  break;
                default:
                  f.push(null);
              }
            return f;
          };
          c.prototype.qb = function() {
            for (var f = [], l = sc(this.Qa), n = 0; n < l; n += 1)
              f.push(yc(this.Qa, n));
            return f;
          };
          c.prototype.zb = function(f, l) {
            f = this.get(f, l);
            l = this.qb();
            for (var n = {}, p = 0; p < l.length; p += 1)
              n[l[p]] = f[p];
            return n;
          };
          c.prototype.Sb = function() {
            return pb(this.Qa);
          };
          c.prototype.Pb = function() {
            return lc(this.Qa);
          };
          c.prototype.run = function(f) {
            null != f && this.bind(f);
            this.step();
            return this.reset();
          };
          c.prototype.wb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            f = fa(f);
            this.mb.push(f);
            this.db.handleError(mc(this.Qa, l, f, -1, 0));
          };
          c.prototype.Fb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            var n = da(f.length);
            m.set(f, n);
            this.mb.push(n);
            this.db.handleError(rb(this.Qa, l, n, f.length, 0));
          };
          c.prototype.vb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            this.db.handleError((f === (f | 0) ? oc : nc)(
              this.Qa,
              l,
              f
            ));
          };
          c.prototype.Ib = function(f) {
            null == f && (f = this.Oa, this.Oa += 1);
            rb(this.Qa, f, 0, 0, 0);
          };
          c.prototype.xb = function(f, l) {
            null == l && (l = this.Oa, this.Oa += 1);
            switch (typeof f) {
              case "string":
                this.wb(f, l);
                return;
              case "number":
                this.vb(f, l);
                return;
              case "bigint":
                this.wb(f.toString(), l);
                return;
              case "boolean":
                this.vb(f + 0, l);
                return;
              case "object":
                if (null === f) {
                  this.Ib(l);
                  return;
                }
                if (null != f.length) {
                  this.Fb(f, l);
                  return;
                }
            }
            throw "Wrong API use : tried to bind a value of an unknown type (" + f + ").";
          };
          c.prototype.Hb = function(f) {
            var l = this;
            Object.keys(f).forEach(function(n) {
              var p = pc(l.Qa, n);
              0 !== p && l.xb(f[n], p);
            });
            return true;
          };
          c.prototype.Gb = function(f) {
            for (var l = 0; l < f.length; l += 1)
              this.xb(f[l], l + 1);
            return true;
          };
          c.prototype.reset = function() {
            this.freemem();
            return 0 === Ac(this.Qa) && 0 === zc(this.Qa);
          };
          c.prototype.freemem = function() {
            for (var f; void 0 !== (f = this.mb.pop()); )
              ea(f);
          };
          c.prototype.Ya = function() {
            this.freemem();
            var f = 0 === Bc(this.Qa);
            delete this.db.gb[this.Qa];
            this.Qa = 0;
            return f;
          };
          d.prototype.next = function() {
            if (null === this.fb)
              return { done: true };
            null !== this.$a && (this.$a.Ya(), this.$a = null);
            if (!this.db.db)
              throw this.ob(), Error("Database closed");
            var f = pa(), l = y(4);
            qa(g);
            qa(l);
            try {
              this.db.handleError(qb(this.db.db, this.lb, -1, g, l));
              this.lb = r(l, "i32");
              var n = r(g, "i32");
              if (0 === n)
                return this.ob(), { done: true };
              this.$a = new c(n, this.db);
              this.db.gb[n] = this.$a;
              return { value: this.$a, done: false };
            } catch (p) {
              throw this.sb = z(this.lb), this.ob(), p;
            } finally {
              ra(f);
            }
          };
          d.prototype.ob = function() {
            ea(this.fb);
            this.fb = null;
          };
          d.prototype.Qb = function() {
            return null !== this.sb ? this.sb : z(this.lb);
          };
          "function" === typeof Symbol && "symbol" === typeof Symbol.iterator && (d.prototype[Symbol.iterator] = function() {
            return this;
          });
          e.prototype.run = function(f, l) {
            if (!this.db)
              throw "Database closed";
            if (l) {
              f = this.tb(f, l);
              try {
                f.step();
              } finally {
                f.Ya();
              }
            } else
              this.handleError(t(this.db, f, 0, 0, g));
            return this;
          };
          e.prototype.exec = function(f, l, n) {
            if (!this.db)
              throw "Database closed";
            var p = null, u = null, v = null;
            try {
              v = u = fa(f);
              var K = y(4);
              for (f = []; 0 !== r(v, "i8"); ) {
                qa(g);
                qa(K);
                this.handleError(qb(this.db, v, -1, g, K));
                var I = r(
                  g,
                  "i32"
                );
                v = r(K, "i32");
                if (0 !== I) {
                  var H = null;
                  p = new c(I, this);
                  for (null != l && p.bind(l); p.step(); )
                    null === H && (H = { columns: p.qb(), values: [] }, f.push(H)), H.values.push(p.get(null, n));
                  p.Ya();
                }
              }
              return f;
            } catch (L) {
              throw p && p.Ya(), L;
            } finally {
              u && ea(u);
            }
          };
          e.prototype.Mb = function(f, l, n, p, u) {
            "function" === typeof l && (p = n, n = l, l = void 0);
            f = this.tb(f, l);
            try {
              for (; f.step(); )
                n(f.zb(null, u));
            } finally {
              f.Ya();
            }
            if ("function" === typeof p)
              return p();
          };
          e.prototype.tb = function(f, l) {
            qa(g);
            this.handleError(D(this.db, f, -1, g, 0));
            f = r(g, "i32");
            if (0 === f)
              throw "Nothing to prepare";
            var n = new c(f, this);
            null != l && n.bind(l);
            return this.gb[f] = n;
          };
          e.prototype.Ub = function(f) {
            return new d(f, this);
          };
          e.prototype.Nb = function() {
            Object.values(this.gb).forEach(function(l) {
              l.Ya();
            });
            Object.values(this.Sa).forEach(A);
            this.Sa = {};
            this.handleError(w(this.db));
            var f = ta(this.filename);
            this.handleError(q(this.filename, g));
            this.db = r(g, "i32");
            ob(this.db);
            return f;
          };
          e.prototype.close = function() {
            null !== this.db && (Object.values(this.gb).forEach(function(f) {
              f.Ya();
            }), Object.values(this.Sa).forEach(A), this.Sa = {}, this.Za && (A(this.Za), this.Za = void 0), this.handleError(w(this.db)), ua("/" + this.filename), this.db = null);
          };
          e.prototype.handleError = function(f) {
            if (0 === f)
              return null;
            f = rc(this.db);
            throw Error(f);
          };
          e.prototype.Rb = function() {
            return x(this.db);
          };
          e.prototype.Kb = function(f, l) {
            Object.prototype.hasOwnProperty.call(this.Sa, f) && (A(this.Sa[f]), delete this.Sa[f]);
            var n = va(function(p, u, v) {
              u = b(u, v);
              try {
                var K = l.apply(null, u);
              } catch (I) {
                sa(p, I, -1);
                return;
              }
              a(p, K);
            }, "viii");
            this.Sa[f] = n;
            this.handleError(tb(
              this.db,
              f,
              l.length,
              1,
              0,
              n,
              0,
              0,
              0
            ));
            return this;
          };
          e.prototype.Jb = function(f, l) {
            var n = l.init || function() {
              return null;
            }, p = l.finalize || function(H) {
              return H;
            }, u = l.step;
            if (!u)
              throw "An aggregate function must have a step function in " + f;
            var v = {};
            Object.hasOwnProperty.call(this.Sa, f) && (A(this.Sa[f]), delete this.Sa[f]);
            l = f + "__finalize";
            Object.hasOwnProperty.call(this.Sa, l) && (A(this.Sa[l]), delete this.Sa[l]);
            var K = va(function(H, L, Pa) {
              var V = ub(H, 1);
              Object.hasOwnProperty.call(v, V) || (v[V] = n());
              L = b(L, Pa);
              L = [v[V]].concat(L);
              try {
                v[V] = u.apply(null, L);
              } catch (Dc) {
                delete v[V], sa(H, Dc, -1);
              }
            }, "viii"), I = va(function(H) {
              var L = ub(H, 1);
              try {
                var Pa = p(v[L]);
              } catch (V) {
                delete v[L];
                sa(H, V, -1);
                return;
              }
              a(H, Pa);
              delete v[L];
            }, "vi");
            this.Sa[f] = K;
            this.Sa[l] = I;
            this.handleError(tb(this.db, f, u.length - 1, 1, 0, 0, K, I, 0));
            return this;
          };
          e.prototype.Zb = function(f) {
            this.Za && (vb(this.db, 0, 0), A(this.Za), this.Za = void 0);
            if (!f)
              return this;
            this.Za = va(function(l, n, p, u, v) {
              switch (n) {
                case 18:
                  l = "insert";
                  break;
                case 23:
                  l = "update";
                  break;
                case 9:
                  l = "delete";
                  break;
                default:
                  throw "unknown operationCode in updateHook callback: " + n;
              }
              p = z(p);
              u = z(u);
              if (v > Number.MAX_SAFE_INTEGER)
                throw "rowId too big to fit inside a Number";
              f(l, p, u, Number(v));
            }, "viiiij");
            vb(this.db, this.Za, 0);
            return this;
          };
          c.prototype.bind = c.prototype.bind;
          c.prototype.step = c.prototype.step;
          c.prototype.get = c.prototype.get;
          c.prototype.getColumnNames = c.prototype.qb;
          c.prototype.getAsObject = c.prototype.zb;
          c.prototype.getSQL = c.prototype.Sb;
          c.prototype.getNormalizedSQL = c.prototype.Pb;
          c.prototype.run = c.prototype.run;
          c.prototype.reset = c.prototype.reset;
          c.prototype.freemem = c.prototype.freemem;
          c.prototype.free = c.prototype.Ya;
          d.prototype.next = d.prototype.next;
          d.prototype.getRemainingSQL = d.prototype.Qb;
          e.prototype.run = e.prototype.run;
          e.prototype.exec = e.prototype.exec;
          e.prototype.each = e.prototype.Mb;
          e.prototype.prepare = e.prototype.tb;
          e.prototype.iterateStatements = e.prototype.Ub;
          e.prototype["export"] = e.prototype.Nb;
          e.prototype.close = e.prototype.close;
          e.prototype.handleError = e.prototype.handleError;
          e.prototype.getRowsModified = e.prototype.Rb;
          e.prototype.create_function = e.prototype.Kb;
          e.prototype.create_aggregate = e.prototype.Jb;
          e.prototype.updateHook = e.prototype.Zb;
          k.Database = e;
        };
        var wa = "./this.program", xa = (a, b) => {
          throw b;
        }, ya = globalThis.document?.currentScript?.src;
        "undefined" != typeof __filename ? ya = __filename : ba && (ya = self.location.href);
        var za = "", Aa, Ba;
        if (ca) {
          var fs3 = require("node:fs");
          za = __dirname + "/";
          Ba = (a) => {
            a = Ca(a) ? new URL(a) : a;
            return fs3.readFileSync(a);
          };
          Aa = async (a) => {
            a = Ca(a) ? new URL(a) : a;
            return fs3.readFileSync(a, void 0);
          };
          1 < process.argv.length && (wa = process.argv[1].replace(/\\/g, "/"));
          process.argv.slice(2);
          "undefined" != typeof module2 && (module2.exports = k);
          xa = (a, b) => {
            process.exitCode = a;
            throw b;
          };
        } else if (aa || ba) {
          try {
            za = new URL(".", ya).href;
          } catch {
          }
          ba && (Ba = (a) => {
            var b = new XMLHttpRequest();
            b.open("GET", a, false);
            b.responseType = "arraybuffer";
            b.send(null);
            return new Uint8Array(b.response);
          });
          Aa = async (a) => {
            if (Ca(a))
              return new Promise((c, d) => {
                var e = new XMLHttpRequest();
                e.open("GET", a, true);
                e.responseType = "arraybuffer";
                e.onload = () => {
                  200 == e.status || 0 == e.status && e.response ? c(e.response) : d(e.status);
                };
                e.onerror = d;
                e.send(null);
              });
            var b = await fetch(a, { credentials: "same-origin" });
            if (b.ok)
              return b.arrayBuffer();
            throw Error(b.status + " : " + b.url);
          };
        }
        var Da = console.log.bind(console), B = console.error.bind(console), Ea, Fa = false, Ga, Ca = (a) => a.startsWith("file://"), m, C2, Ha, E, F, Ia, Ja, G;
        function Ka() {
          var a = La.buffer;
          m = new Int8Array(a);
          Ha = new Int16Array(a);
          C2 = new Uint8Array(a);
          new Uint16Array(a);
          E = new Int32Array(a);
          F = new Uint32Array(a);
          Ia = new Float32Array(a);
          Ja = new Float64Array(a);
          G = new BigInt64Array(a);
          new BigUint64Array(a);
        }
        function Ma(a) {
          k.onAbort?.(a);
          a = "Aborted(" + a + ")";
          B(a);
          Fa = true;
          throw new WebAssembly.RuntimeError(a + ". Build with -sASSERTIONS for more info.");
        }
        var Na;
        async function Oa(a) {
          if (!Ea)
            try {
              var b = await Aa(a);
              return new Uint8Array(b);
            } catch {
            }
          if (a == Na && Ea)
            a = new Uint8Array(Ea);
          else if (Ba)
            a = Ba(a);
          else
            throw "both async and sync fetching of the wasm failed";
          return a;
        }
        async function Qa(a, b) {
          try {
            var c = await Oa(a);
            return await WebAssembly.instantiate(c, b);
          } catch (d) {
            B(`failed to asynchronously prepare wasm: ${d}`), Ma(d);
          }
        }
        async function Ra(a) {
          var b = Na;
          if (!Ea && !Ca(b) && !ca)
            try {
              var c = fetch(b, { credentials: "same-origin" });
              return await WebAssembly.instantiateStreaming(c, a);
            } catch (d) {
              B(`wasm streaming compile failed: ${d}`), B("falling back to ArrayBuffer instantiation");
            }
          return Qa(b, a);
        }
        class Sa {
          name = "ExitStatus";
          constructor(a) {
            this.message = `Program terminated with exit(${a})`;
            this.status = a;
          }
        }
        var Ta = (a) => {
          for (; 0 < a.length; )
            a.shift()(k);
        }, Ua = [], Va = [], Wa = () => {
          var a = k.preRun.shift();
          Va.push(a);
        }, J = 0, Xa = null;
        function r(a, b = "i8") {
          b.endsWith("*") && (b = "*");
          switch (b) {
            case "i1":
              return m[a];
            case "i8":
              return m[a];
            case "i16":
              return Ha[a >> 1];
            case "i32":
              return E[a >> 2];
            case "i64":
              return G[a >> 3];
            case "float":
              return Ia[a >> 2];
            case "double":
              return Ja[a >> 3];
            case "*":
              return F[a >> 2];
            default:
              Ma(`invalid type for getValue: ${b}`);
          }
        }
        var Ya = true;
        function qa(a) {
          var b = "i32";
          b.endsWith("*") && (b = "*");
          switch (b) {
            case "i1":
              m[a] = 0;
              break;
            case "i8":
              m[a] = 0;
              break;
            case "i16":
              Ha[a >> 1] = 0;
              break;
            case "i32":
              E[a >> 2] = 0;
              break;
            case "i64":
              G[a >> 3] = BigInt(0);
              break;
            case "float":
              Ia[a >> 2] = 0;
              break;
            case "double":
              Ja[a >> 3] = 0;
              break;
            case "*":
              F[a >> 2] = 0;
              break;
            default:
              Ma(`invalid type for setValue: ${b}`);
          }
        }
        var Za = new TextDecoder(), $a = (a, b, c, d) => {
          c = b + c;
          if (d)
            return c;
          for (; a[b] && !(b >= c); )
            ++b;
          return b;
        }, z = (a, b, c) => a ? Za.decode(C2.subarray(a, $a(C2, a, b, c))) : "", ab = (a, b) => {
          for (var c = 0, d = a.length - 1; 0 <= d; d--) {
            var e = a[d];
            "." === e ? a.splice(d, 1) : ".." === e ? (a.splice(d, 1), c++) : c && (a.splice(d, 1), c--);
          }
          if (b)
            for (; c; c--)
              a.unshift("..");
          return a;
        }, ia = (a) => {
          var b = "/" === a.charAt(0), c = "/" === a.slice(-1);
          (a = ab(a.split("/").filter((d) => !!d), !b).join("/")) || b || (a = ".");
          a && c && (a += "/");
          return (b ? "/" : "") + a;
        }, bb = (a) => {
          var b = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/.exec(a).slice(1);
          a = b[0];
          b = b[1];
          if (!a && !b)
            return ".";
          b &&= b.slice(0, -1);
          return a + b;
        }, cb = (a) => a && a.match(/([^\/]+|\/)\/*$/)[1], db = () => {
          if (ca) {
            var a = require("node:crypto");
            return (b) => a.randomFillSync(b);
          }
          return (b) => crypto.getRandomValues(b);
        }, eb = (a) => {
          (eb = db())(a);
        }, fb = (...a) => {
          for (var b = "", c = false, d = a.length - 1; -1 <= d && !c; d--) {
            c = 0 <= d ? a[d] : "/";
            if ("string" != typeof c)
              throw new TypeError("Arguments to path.resolve must be strings");
            if (!c)
              return "";
            b = c + "/" + b;
            c = "/" === c.charAt(0);
          }
          b = ab(b.split("/").filter((e) => !!e), !c).join("/");
          return (c ? "/" : "") + b || ".";
        }, gb = (a) => {
          var b = $a(a, 0);
          return Za.decode(a.buffer ? a.subarray(0, b) : new Uint8Array(a.slice(0, b)));
        }, hb = [], ib = (a) => {
          for (var b = 0, c = 0; c < a.length; ++c) {
            var d = a.charCodeAt(c);
            127 >= d ? b++ : 2047 >= d ? b += 2 : 55296 <= d && 57343 >= d ? (b += 4, ++c) : b += 3;
          }
          return b;
        }, M = (a, b, c, d) => {
          if (!(0 < d))
            return 0;
          var e = c;
          d = c + d - 1;
          for (var g = 0; g < a.length; ++g) {
            var h = a.codePointAt(g);
            if (127 >= h) {
              if (c >= d)
                break;
              b[c++] = h;
            } else if (2047 >= h) {
              if (c + 1 >= d)
                break;
              b[c++] = 192 | h >> 6;
              b[c++] = 128 | h & 63;
            } else if (65535 >= h) {
              if (c + 2 >= d)
                break;
              b[c++] = 224 | h >> 12;
              b[c++] = 128 | h >> 6 & 63;
              b[c++] = 128 | h & 63;
            } else {
              if (c + 3 >= d)
                break;
              b[c++] = 240 | h >> 18;
              b[c++] = 128 | h >> 12 & 63;
              b[c++] = 128 | h >> 6 & 63;
              b[c++] = 128 | h & 63;
              g++;
            }
          }
          b[c] = 0;
          return c - e;
        }, jb = [];
        function kb(a, b) {
          jb[a] = { input: [], output: [], eb: b };
          mb(a, nb);
        }
        var nb = { open(a) {
          var b = jb[a.node.rdev];
          if (!b)
            throw new N(43);
          a.tty = b;
          a.seekable = false;
        }, close(a) {
          a.tty.eb.fsync(a.tty);
        }, fsync(a) {
          a.tty.eb.fsync(a.tty);
        }, read(a, b, c, d) {
          if (!a.tty || !a.tty.eb.Bb)
            throw new N(60);
          for (var e = 0, g = 0; g < d; g++) {
            try {
              var h = a.tty.eb.Bb(a.tty);
            } catch (q) {
              throw new N(29);
            }
            if (void 0 === h && 0 === e)
              throw new N(6);
            if (null === h || void 0 === h)
              break;
            e++;
            b[c + g] = h;
          }
          e && (a.node.atime = Date.now());
          return e;
        }, write(a, b, c, d) {
          if (!a.tty || !a.tty.eb.ub)
            throw new N(60);
          try {
            for (var e = 0; e < d; e++)
              a.tty.eb.ub(a.tty, b[c + e]);
          } catch (g) {
            throw new N(29);
          }
          d && (a.node.mtime = a.node.ctime = Date.now());
          return e;
        } }, wb = { Bb() {
          a: {
            if (!hb.length) {
              var a = null;
              if (ca) {
                var b = Buffer.alloc(256), c = 0, d = process.stdin.fd;
                try {
                  c = fs3.readSync(d, b, 0, 256);
                } catch (e) {
                  if (e.toString().includes("EOF"))
                    c = 0;
                  else
                    throw e;
                }
                0 < c && (a = b.slice(0, c).toString("utf-8"));
              } else
                globalThis.window?.prompt && (a = window.prompt("Input: "), null !== a && (a += "\n"));
              if (!a) {
                a = null;
                break a;
              }
              b = Array(ib(a) + 1);
              a = M(a, b, 0, b.length);
              b.length = a;
              hb = b;
            }
            a = hb.shift();
          }
          return a;
        }, ub(a, b) {
          null === b || 10 === b ? (Da(gb(a.output)), a.output = []) : 0 != b && a.output.push(b);
        }, fsync(a) {
          0 < a.output?.length && (Da(gb(a.output)), a.output = []);
        }, hc() {
          return { bc: 25856, dc: 5, ac: 191, cc: 35387, $b: [3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
        }, ic() {
          return 0;
        }, jc() {
          return [24, 80];
        } }, xb = { ub(a, b) {
          null === b || 10 === b ? (B(gb(a.output)), a.output = []) : 0 != b && a.output.push(b);
        }, fsync(a) {
          0 < a.output?.length && (B(gb(a.output)), a.output = []);
        } }, O = { Wa: null, Xa() {
          return O.createNode(null, "/", 16895, 0);
        }, createNode(a, b, c, d) {
          if (24576 === (c & 61440) || 4096 === (c & 61440))
            throw new N(63);
          O.Wa || (O.Wa = { dir: { node: { Ta: O.La.Ta, Ua: O.La.Ua, lookup: O.La.lookup, ib: O.La.ib, rename: O.La.rename, unlink: O.La.unlink, rmdir: O.La.rmdir, readdir: O.La.readdir, symlink: O.La.symlink }, stream: { Va: O.Ma.Va } }, file: { node: { Ta: O.La.Ta, Ua: O.La.Ua }, stream: { Va: O.Ma.Va, read: O.Ma.read, write: O.Ma.write, jb: O.Ma.jb, kb: O.Ma.kb } }, link: { node: { Ta: O.La.Ta, Ua: O.La.Ua, readlink: O.La.readlink }, stream: {} }, yb: { node: { Ta: O.La.Ta, Ua: O.La.Ua }, stream: yb } });
          c = zb(a, b, c, d);
          P(c.mode) ? (c.La = O.Wa.dir.node, c.Ma = O.Wa.dir.stream, c.Na = {}) : 32768 === (c.mode & 61440) ? (c.La = O.Wa.file.node, c.Ma = O.Wa.file.stream, c.Ra = 0, c.Na = null) : 40960 === (c.mode & 61440) ? (c.La = O.Wa.link.node, c.Ma = O.Wa.link.stream) : 8192 === (c.mode & 61440) && (c.La = O.Wa.yb.node, c.Ma = O.Wa.yb.stream);
          c.atime = c.mtime = c.ctime = Date.now();
          a && (a.Na[b] = c, a.atime = a.mtime = a.ctime = c.atime);
          return c;
        }, fc(a) {
          return a.Na ? a.Na.subarray ? a.Na.subarray(0, a.Ra) : new Uint8Array(a.Na) : new Uint8Array(0);
        }, La: {
          Ta(a) {
            var b = {};
            b.dev = 8192 === (a.mode & 61440) ? a.id : 1;
            b.ino = a.id;
            b.mode = a.mode;
            b.nlink = 1;
            b.uid = 0;
            b.gid = 0;
            b.rdev = a.rdev;
            P(a.mode) ? b.size = 4096 : 32768 === (a.mode & 61440) ? b.size = a.Ra : 40960 === (a.mode & 61440) ? b.size = a.link.length : b.size = 0;
            b.atime = new Date(a.atime);
            b.mtime = new Date(a.mtime);
            b.ctime = new Date(a.ctime);
            b.blksize = 4096;
            b.blocks = Math.ceil(b.size / b.blksize);
            return b;
          },
          Ua(a, b) {
            for (var c of ["mode", "atime", "mtime", "ctime"])
              null != b[c] && (a[c] = b[c]);
            void 0 !== b.size && (b = b.size, a.Ra != b && (0 == b ? (a.Na = null, a.Ra = 0) : (c = a.Na, a.Na = new Uint8Array(b), c && a.Na.set(c.subarray(0, Math.min(b, a.Ra))), a.Ra = b)));
          },
          lookup() {
            O.nb || (O.nb = new N(44), O.nb.stack = "<generic error, no stack>");
            throw O.nb;
          },
          ib(a, b, c, d) {
            return O.createNode(a, b, c, d);
          },
          rename(a, b, c) {
            try {
              var d = Q(b, c);
            } catch (g) {
            }
            if (d) {
              if (P(a.mode))
                for (var e in d.Na)
                  throw new N(55);
              Ab(d);
            }
            delete a.parent.Na[a.name];
            b.Na[c] = a;
            a.name = c;
            b.ctime = b.mtime = a.parent.ctime = a.parent.mtime = Date.now();
          },
          unlink(a, b) {
            delete a.Na[b];
            a.ctime = a.mtime = Date.now();
          },
          rmdir(a, b) {
            var c = Q(a, b), d;
            for (d in c.Na)
              throw new N(55);
            delete a.Na[b];
            a.ctime = a.mtime = Date.now();
          },
          readdir(a) {
            return [".", "..", ...Object.keys(a.Na)];
          },
          symlink(a, b, c) {
            a = O.createNode(a, b, 41471, 0);
            a.link = c;
            return a;
          },
          readlink(a) {
            if (40960 !== (a.mode & 61440))
              throw new N(28);
            return a.link;
          }
        }, Ma: { read(a, b, c, d, e) {
          var g = a.node.Na;
          if (e >= a.node.Ra)
            return 0;
          a = Math.min(a.node.Ra - e, d);
          if (8 < a && g.subarray)
            b.set(g.subarray(e, e + a), c);
          else
            for (d = 0; d < a; d++)
              b[c + d] = g[e + d];
          return a;
        }, write(a, b, c, d, e, g) {
          b.buffer === m.buffer && (g = false);
          if (!d)
            return 0;
          a = a.node;
          a.mtime = a.ctime = Date.now();
          if (b.subarray && (!a.Na || a.Na.subarray)) {
            if (g)
              return a.Na = b.subarray(c, c + d), a.Ra = d;
            if (0 === a.Ra && 0 === e)
              return a.Na = b.slice(c, c + d), a.Ra = d;
            if (e + d <= a.Ra)
              return a.Na.set(b.subarray(c, c + d), e), d;
          }
          g = e + d;
          var h = a.Na ? a.Na.length : 0;
          h >= g || (g = Math.max(g, h * (1048576 > h ? 2 : 1.125) >>> 0), 0 != h && (g = Math.max(g, 256)), h = a.Na, a.Na = new Uint8Array(g), 0 < a.Ra && a.Na.set(h.subarray(0, a.Ra), 0));
          if (a.Na.subarray && b.subarray)
            a.Na.set(b.subarray(c, c + d), e);
          else
            for (g = 0; g < d; g++)
              a.Na[e + g] = b[c + g];
          a.Ra = Math.max(a.Ra, e + d);
          return d;
        }, Va(a, b, c) {
          1 === c ? b += a.position : 2 === c && 32768 === (a.node.mode & 61440) && (b += a.node.Ra);
          if (0 > b)
            throw new N(28);
          return b;
        }, jb(a, b, c, d, e) {
          if (32768 !== (a.node.mode & 61440))
            throw new N(43);
          a = a.node.Na;
          if (e & 2 || !a || a.buffer !== m.buffer) {
            e = true;
            d = 65536 * Math.ceil(b / 65536);
            var g = Bb(65536, d);
            g && C2.fill(0, g, g + d);
            d = g;
            if (!d)
              throw new N(48);
            if (a) {
              if (0 < c || c + b < a.length)
                a.subarray ? a = a.subarray(c, c + b) : a = Array.prototype.slice.call(a, c, c + b);
              m.set(a, d);
            }
          } else
            e = false, d = a.byteOffset;
          return { Xb: d, Eb: e };
        }, kb(a, b, c, d) {
          O.Ma.write(a, b, 0, d, c, false);
          return 0;
        } } }, ja = (a, b) => {
          var c = 0;
          a && (c |= 365);
          b && (c |= 146);
          return c;
        }, Cb = null, Db = {}, Eb = [], Fb = 1, R = null, Gb = false, Hb = true, N = class {
          name = "ErrnoError";
          constructor(a) {
            this.Pa = a;
          }
        }, Ib = class {
          hb = {};
          node = null;
          get flags() {
            return this.hb.flags;
          }
          set flags(a) {
            this.hb.flags = a;
          }
          get position() {
            return this.hb.position;
          }
          set position(a) {
            this.hb.position = a;
          }
        }, Jb = class {
          La = {};
          Ma = {};
          bb = null;
          constructor(a, b, c, d) {
            a ||= this;
            this.parent = a;
            this.Xa = a.Xa;
            this.id = Fb++;
            this.name = b;
            this.mode = c;
            this.rdev = d;
            this.atime = this.mtime = this.ctime = Date.now();
          }
          get read() {
            return 365 === (this.mode & 365);
          }
          set read(a) {
            a ? this.mode |= 365 : this.mode &= -366;
          }
          get write() {
            return 146 === (this.mode & 146);
          }
          set write(a) {
            a ? this.mode |= 146 : this.mode &= -147;
          }
        };
        function S(a, b = {}) {
          if (!a)
            throw new N(44);
          b.pb ?? (b.pb = true);
          "/" === a.charAt(0) || (a = "//" + a);
          var c = 0;
          a:
            for (; 40 > c; c++) {
              a = a.split("/").filter((q) => !!q);
              for (var d = Cb, e = "/", g = 0; g < a.length; g++) {
                var h = g === a.length - 1;
                if (h && b.parent)
                  break;
                if ("." !== a[g])
                  if (".." === a[g])
                    if (e = bb(e), d === d.parent) {
                      a = e + "/" + a.slice(g + 1).join("/");
                      c--;
                      continue a;
                    } else
                      d = d.parent;
                  else {
                    e = ia(e + "/" + a[g]);
                    try {
                      d = Q(d, a[g]);
                    } catch (q) {
                      if (44 === q?.Pa && h && b.Wb)
                        return { path: e };
                      throw q;
                    }
                    !d.bb || h && !b.pb || (d = d.bb.root);
                    if (40960 === (d.mode & 61440) && (!h || b.ab)) {
                      if (!d.La.readlink)
                        throw new N(52);
                      d = d.La.readlink(d);
                      "/" === d.charAt(0) || (d = bb(e) + "/" + d);
                      a = d + "/" + a.slice(g + 1).join("/");
                      continue a;
                    }
                  }
              }
              return { path: e, node: d };
            }
          throw new N(32);
        }
        function ha(a) {
          for (var b; ; ) {
            if (a === a.parent)
              return a = a.Xa.Db, b ? "/" !== a[a.length - 1] ? `${a}/${b}` : a + b : a;
            b = b ? `${a.name}/${b}` : a.name;
            a = a.parent;
          }
        }
        function Kb(a, b) {
          for (var c = 0, d = 0; d < b.length; d++)
            c = (c << 5) - c + b.charCodeAt(d) | 0;
          return (a + c >>> 0) % R.length;
        }
        function Ab(a) {
          var b = Kb(a.parent.id, a.name);
          if (R[b] === a)
            R[b] = a.cb;
          else
            for (b = R[b]; b; ) {
              if (b.cb === a) {
                b.cb = a.cb;
                break;
              }
              b = b.cb;
            }
        }
        function Q(a, b) {
          var c = P(a.mode) ? (c = Lb(a, "x")) ? c : a.La.lookup ? 0 : 2 : 54;
          if (c)
            throw new N(c);
          for (c = R[Kb(a.id, b)]; c; c = c.cb) {
            var d = c.name;
            if (c.parent.id === a.id && d === b)
              return c;
          }
          return a.La.lookup(a, b);
        }
        function zb(a, b, c, d) {
          a = new Jb(a, b, c, d);
          b = Kb(a.parent.id, a.name);
          a.cb = R[b];
          return R[b] = a;
        }
        function P(a) {
          return 16384 === (a & 61440);
        }
        function Lb(a, b) {
          return Hb ? 0 : b.includes("r") && !(a.mode & 292) || b.includes("w") && !(a.mode & 146) || b.includes("x") && !(a.mode & 73) ? 2 : 0;
        }
        function Mb(a, b) {
          if (!P(a.mode))
            return 54;
          try {
            return Q(a, b), 20;
          } catch (c) {
          }
          return Lb(a, "wx");
        }
        function Nb(a, b, c) {
          try {
            var d = Q(a, b);
          } catch (e) {
            return e.Pa;
          }
          if (a = Lb(a, "wx"))
            return a;
          if (c) {
            if (!P(d.mode))
              return 54;
            if (d === d.parent || "/" === ha(d))
              return 10;
          } else if (P(d.mode))
            return 31;
          return 0;
        }
        function Ob(a) {
          if (!a)
            throw new N(63);
          return a;
        }
        function T(a) {
          a = Eb[a];
          if (!a)
            throw new N(8);
          return a;
        }
        function Pb(a, b = -1) {
          a = Object.assign(new Ib(), a);
          if (-1 == b)
            a: {
              for (b = 0; 4096 >= b; b++)
                if (!Eb[b])
                  break a;
              throw new N(33);
            }
          a.fd = b;
          return Eb[b] = a;
        }
        function Qb(a, b = -1) {
          a = Pb(a, b);
          a.Ma?.ec?.(a);
          return a;
        }
        function Rb(a, b, c) {
          var d = a?.Ma.Ua;
          a = d ? a : b;
          d ??= b.La.Ua;
          Ob(d);
          d(a, c);
        }
        var yb = { open(a) {
          a.Ma = Db[a.node.rdev].Ma;
          a.Ma.open?.(a);
        }, Va() {
          throw new N(70);
        } };
        function mb(a, b) {
          Db[a] = { Ma: b };
        }
        function Sb(a, b) {
          var c = "/" === b;
          if (c && Cb)
            throw new N(10);
          if (!c && b) {
            var d = S(b, { pb: false });
            b = d.path;
            d = d.node;
            if (d.bb)
              throw new N(10);
            if (!P(d.mode))
              throw new N(54);
          }
          b = { type: a, kc: {}, Db: b, Vb: [] };
          a = a.Xa(b);
          a.Xa = b;
          b.root = a;
          c ? Cb = a : d && (d.bb = b, d.Xa && d.Xa.Vb.push(b));
        }
        function Tb(a, b, c) {
          var d = S(a, { parent: true }).node;
          a = cb(a);
          if (!a)
            throw new N(28);
          if ("." === a || ".." === a)
            throw new N(20);
          var e = Mb(d, a);
          if (e)
            throw new N(e);
          if (!d.La.ib)
            throw new N(63);
          return d.La.ib(d, a, b, c);
        }
        function ka(a, b = 438) {
          return Tb(a, b & 4095 | 32768, 0);
        }
        function U(a, b = 511) {
          return Tb(a, b & 1023 | 16384, 0);
        }
        function Ub(a, b, c) {
          "undefined" == typeof c && (c = b, b = 438);
          Tb(a, b | 8192, c);
        }
        function Vb(a, b) {
          if (!fb(a))
            throw new N(44);
          var c = S(b, { parent: true }).node;
          if (!c)
            throw new N(44);
          b = cb(b);
          var d = Mb(c, b);
          if (d)
            throw new N(d);
          if (!c.La.symlink)
            throw new N(63);
          c.La.symlink(c, b, a);
        }
        function Wb(a) {
          var b = S(a, { parent: true }).node;
          a = cb(a);
          var c = Q(b, a), d = Nb(b, a, true);
          if (d)
            throw new N(d);
          if (!b.La.rmdir)
            throw new N(63);
          if (c.bb)
            throw new N(10);
          b.La.rmdir(b, a);
          Ab(c);
        }
        function ua(a) {
          var b = S(a, { parent: true }).node;
          if (!b)
            throw new N(44);
          a = cb(a);
          var c = Q(b, a), d = Nb(b, a, false);
          if (d)
            throw new N(d);
          if (!b.La.unlink)
            throw new N(63);
          if (c.bb)
            throw new N(10);
          b.La.unlink(b, a);
          Ab(c);
        }
        function Xb(a, b) {
          a = S(a, { ab: !b }).node;
          return Ob(a.La.Ta)(a);
        }
        function Yb(a, b, c, d) {
          Rb(a, b, { mode: c & 4095 | b.mode & -4096, ctime: Date.now(), Lb: d });
        }
        function la(a, b) {
          a = "string" == typeof a ? S(a, { ab: true }).node : a;
          Yb(null, a, b);
        }
        function Zb(a, b, c) {
          if (P(b.mode))
            throw new N(31);
          if (32768 !== (b.mode & 61440))
            throw new N(28);
          var d = Lb(b, "w");
          if (d)
            throw new N(d);
          Rb(a, b, { size: c, timestamp: Date.now() });
        }
        function ma(a, b, c = 438) {
          if ("" === a)
            throw new N(44);
          if ("string" == typeof b) {
            var d = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }[b];
            if ("undefined" == typeof d)
              throw Error(`Unknown file open mode: ${b}`);
            b = d;
          }
          c = b & 64 ? c & 4095 | 32768 : 0;
          if ("object" == typeof a)
            d = a;
          else {
            var e = a.endsWith("/");
            var g = S(a, { ab: !(b & 131072), Wb: true });
            d = g.node;
            a = g.path;
          }
          g = false;
          if (b & 64)
            if (d) {
              if (b & 128)
                throw new N(20);
            } else {
              if (e)
                throw new N(31);
              d = Tb(a, c | 511, 0);
              g = true;
            }
          if (!d)
            throw new N(44);
          8192 === (d.mode & 61440) && (b &= -513);
          if (b & 65536 && !P(d.mode))
            throw new N(54);
          if (!g && (d ? 40960 === (d.mode & 61440) ? e = 32 : (e = ["r", "w", "rw"][b & 3], b & 512 && (e += "w"), e = P(d.mode) && ("r" !== e || b & 576) ? 31 : Lb(d, e)) : e = 44, e))
            throw new N(e);
          b & 512 && !g && (e = d, e = "string" == typeof e ? S(e, { ab: true }).node : e, Zb(null, e, 0));
          b = Pb({ node: d, path: ha(d), flags: b & -131713, seekable: true, position: 0, Ma: d.Ma, Yb: [], error: false });
          b.Ma.open && b.Ma.open(b);
          g && la(d, c & 511);
          return b;
        }
        function oa(a) {
          if (null === a.fd)
            throw new N(8);
          a.rb && (a.rb = null);
          try {
            a.Ma.close && a.Ma.close(a);
          } catch (b) {
            throw b;
          } finally {
            Eb[a.fd] = null;
          }
          a.fd = null;
        }
        function $b(a, b, c) {
          if (null === a.fd)
            throw new N(8);
          if (!a.seekable || !a.Ma.Va)
            throw new N(70);
          if (0 != c && 1 != c && 2 != c)
            throw new N(28);
          a.position = a.Ma.Va(a, b, c);
          a.Yb = [];
        }
        function ac(a, b, c, d, e) {
          if (0 > d || 0 > e)
            throw new N(28);
          if (null === a.fd)
            throw new N(8);
          if (1 === (a.flags & 2097155))
            throw new N(8);
          if (P(a.node.mode))
            throw new N(31);
          if (!a.Ma.read)
            throw new N(28);
          var g = "undefined" != typeof e;
          if (!g)
            e = a.position;
          else if (!a.seekable)
            throw new N(70);
          b = a.Ma.read(a, b, c, d, e);
          g || (a.position += b);
          return b;
        }
        function na(a, b, c, d, e) {
          if (0 > d || 0 > e)
            throw new N(28);
          if (null === a.fd)
            throw new N(8);
          if (0 === (a.flags & 2097155))
            throw new N(8);
          if (P(a.node.mode))
            throw new N(31);
          if (!a.Ma.write)
            throw new N(28);
          a.seekable && a.flags & 1024 && $b(a, 0, 2);
          var g = "undefined" != typeof e;
          if (!g)
            e = a.position;
          else if (!a.seekable)
            throw new N(70);
          b = a.Ma.write(a, b, c, d, e, void 0);
          g || (a.position += b);
          return b;
        }
        function ta(a) {
          var b = b || 0;
          var c = "binary";
          "utf8" !== c && "binary" !== c && Ma(`Invalid encoding type "${c}"`);
          b = ma(a, b);
          a = Xb(a).size;
          var d = new Uint8Array(a);
          ac(b, d, 0, a, 0);
          "utf8" === c && (d = gb(d));
          oa(b);
          return d;
        }
        function W(a, b, c) {
          a = ia("/dev/" + a);
          var d = ja(!!b, !!c);
          W.Cb ?? (W.Cb = 64);
          var e = W.Cb++ << 8 | 0;
          mb(e, { open(g) {
            g.seekable = false;
          }, close() {
            c?.buffer?.length && c(10);
          }, read(g, h, q, w) {
            for (var t = 0, x = 0; x < w; x++) {
              try {
                var D = b();
              } catch (pb) {
                throw new N(29);
              }
              if (void 0 === D && 0 === t)
                throw new N(6);
              if (null === D || void 0 === D)
                break;
              t++;
              h[q + x] = D;
            }
            t && (g.node.atime = Date.now());
            return t;
          }, write(g, h, q, w) {
            for (var t = 0; t < w; t++)
              try {
                c(h[q + t]);
              } catch (x) {
                throw new N(29);
              }
            w && (g.node.mtime = g.node.ctime = Date.now());
            return t;
          } });
          Ub(a, d, e);
        }
        var X = {};
        function Y(a, b, c) {
          if ("/" === b.charAt(0))
            return b;
          a = -100 === a ? "/" : T(a).path;
          if (0 == b.length) {
            if (!c)
              throw new N(44);
            return a;
          }
          return a + "/" + b;
        }
        function kc(a, b) {
          F[a >> 2] = b.dev;
          F[a + 4 >> 2] = b.mode;
          F[a + 8 >> 2] = b.nlink;
          F[a + 12 >> 2] = b.uid;
          F[a + 16 >> 2] = b.gid;
          F[a + 20 >> 2] = b.rdev;
          G[a + 24 >> 3] = BigInt(b.size);
          E[a + 32 >> 2] = 4096;
          E[a + 36 >> 2] = b.blocks;
          var c = b.atime.getTime(), d = b.mtime.getTime(), e = b.ctime.getTime();
          G[a + 40 >> 3] = BigInt(Math.floor(c / 1e3));
          F[a + 48 >> 2] = c % 1e3 * 1e6;
          G[a + 56 >> 3] = BigInt(Math.floor(d / 1e3));
          F[a + 64 >> 2] = d % 1e3 * 1e6;
          G[a + 72 >> 3] = BigInt(Math.floor(e / 1e3));
          F[a + 80 >> 2] = e % 1e3 * 1e6;
          G[a + 88 >> 3] = BigInt(b.ino);
          return 0;
        }
        var Cc = void 0, Ec = () => {
          var a = E[+Cc >> 2];
          Cc += 4;
          return a;
        }, Fc = 0, Gc = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], Hc = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334], Ic = {}, Jc = (a) => {
          Ga = a;
          Ya || 0 < Fc || (k.onExit?.(a), Fa = true);
          xa(a, new Sa(a));
        }, Kc = (a) => {
          if (!Fa)
            try {
              a();
            } catch (b) {
              b instanceof Sa || "unwind" == b || xa(1, b);
            } finally {
              if (!(Ya || 0 < Fc))
                try {
                  Ga = a = Ga, Jc(a);
                } catch (b) {
                  b instanceof Sa || "unwind" == b || xa(1, b);
                }
            }
        }, Lc = {}, Nc = () => {
          if (!Mc) {
            var a = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: (globalThis.navigator?.language ?? "C").replace("-", "_") + ".UTF-8", _: wa || "./this.program" }, b;
            for (b in Lc)
              void 0 === Lc[b] ? delete a[b] : a[b] = Lc[b];
            var c = [];
            for (b in a)
              c.push(`${b}=${a[b]}`);
            Mc = c;
          }
          return Mc;
        }, Mc, Oc = (a, b, c, d) => {
          var e = { string: (t) => {
            var x = 0;
            if (null !== t && void 0 !== t && 0 !== t) {
              x = ib(t) + 1;
              var D = y(x);
              M(t, C2, D, x);
              x = D;
            }
            return x;
          }, array: (t) => {
            var x = y(t.length);
            m.set(t, x);
            return x;
          } };
          a = k["_" + a];
          var g = [], h = 0;
          if (d)
            for (var q = 0; q < d.length; q++) {
              var w = e[c[q]];
              w ? (0 === h && (h = pa()), g[q] = w(d[q])) : g[q] = d[q];
            }
          c = a(...g);
          return c = function(t) {
            0 !== h && ra(h);
            return "string" === b ? z(t) : "boolean" === b ? !!t : t;
          }(c);
        }, fa = (a) => {
          var b = ib(a) + 1, c = da(b);
          c && M(a, C2, c, b);
          return c;
        }, Pc, Qc = [], A = (a) => {
          Pc.delete(Z.get(a));
          Z.set(a, null);
          Qc.push(a);
        }, Rc = (a) => {
          const b = a.length;
          return [b % 128 | 128, b >> 7, ...a];
        }, Sc = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 }, Tc = (a) => Rc(Array.from(a, (b) => Sc[b])), va = (a, b) => {
          if (!Pc) {
            Pc = /* @__PURE__ */ new WeakMap();
            var c = Z.length;
            if (Pc)
              for (var d = 0; d < 0 + c; d++) {
                var e = Z.get(d);
                e && Pc.set(e, d);
              }
          }
          if (c = Pc.get(a) || 0)
            return c;
          c = Qc.length ? Qc.pop() : Z.grow(1);
          try {
            Z.set(c, a);
          } catch (g) {
            if (!(g instanceof TypeError))
              throw g;
            b = Uint8Array.of(0, 97, 115, 109, 1, 0, 0, 0, 1, ...Rc([1, 96, ...Tc(b.slice(1)), ...Tc("v" === b[0] ? "" : b[0])]), 2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
            b = new WebAssembly.Module(b);
            b = new WebAssembly.Instance(b, { e: { f: a } }).exports.f;
            Z.set(c, b);
          }
          Pc.set(a, c);
          return c;
        };
        R = Array(4096);
        Sb(O, "/");
        U("/tmp");
        U("/home");
        U("/home/web_user");
        (function() {
          U("/dev");
          mb(259, { read: () => 0, write: (d, e, g, h) => h, Va: () => 0 });
          Ub("/dev/null", 259);
          kb(1280, wb);
          kb(1536, xb);
          Ub("/dev/tty", 1280);
          Ub("/dev/tty1", 1536);
          var a = new Uint8Array(1024), b = 0, c = () => {
            0 === b && (eb(a), b = a.byteLength);
            return a[--b];
          };
          W("random", c);
          W("urandom", c);
          U("/dev/shm");
          U("/dev/shm/tmp");
        })();
        (function() {
          U("/proc");
          var a = U("/proc/self");
          U("/proc/self/fd");
          Sb({ Xa() {
            var b = zb(a, "fd", 16895, 73);
            b.Ma = { Va: O.Ma.Va };
            b.La = { lookup(c, d) {
              c = +d;
              var e = T(c);
              c = { parent: null, Xa: { Db: "fake" }, La: { readlink: () => e.path }, id: c + 1 };
              return c.parent = c;
            }, readdir() {
              return Array.from(Eb.entries()).filter(([, c]) => c).map(([c]) => c.toString());
            } };
            return b;
          } }, "/proc/self/fd");
        })();
        k.noExitRuntime && (Ya = k.noExitRuntime);
        k.print && (Da = k.print);
        k.printErr && (B = k.printErr);
        k.wasmBinary && (Ea = k.wasmBinary);
        k.thisProgram && (wa = k.thisProgram);
        if (k.preInit)
          for ("function" == typeof k.preInit && (k.preInit = [k.preInit]); 0 < k.preInit.length; )
            k.preInit.shift()();
        k.stackSave = () => pa();
        k.stackRestore = (a) => ra(a);
        k.stackAlloc = (a) => y(a);
        k.cwrap = (a, b, c, d) => {
          var e = !c || c.every((g) => "number" === g || "boolean" === g);
          return "string" !== b && e && !d ? k["_" + a] : (...g) => Oc(a, b, c, g);
        };
        k.addFunction = va;
        k.removeFunction = A;
        k.UTF8ToString = z;
        k.stringToNewUTF8 = fa;
        k.writeArrayToMemory = (a, b) => {
          m.set(a, b);
        };
        var da, ea, Bb, Uc, ra, y, pa, La, Z, Vc = {
          a: (a, b, c, d) => Ma(`Assertion failed: ${z(a)}, at: ` + [b ? z(b) : "unknown filename", c, d ? z(d) : "unknown function"]),
          i: function(a, b) {
            try {
              return a = z(a), la(a, b), 0;
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name)
                throw c;
              return -c.Pa;
            }
          },
          L: function(a, b, c) {
            try {
              b = z(b);
              b = Y(a, b);
              if (c & -8)
                return -28;
              var d = S(b, { ab: true }).node;
              if (!d)
                return -44;
              a = "";
              c & 4 && (a += "r");
              c & 2 && (a += "w");
              c & 1 && (a += "x");
              return a && Lb(d, a) ? -2 : 0;
            } catch (e) {
              if ("undefined" == typeof X || "ErrnoError" !== e.name)
                throw e;
              return -e.Pa;
            }
          },
          j: function(a, b) {
            try {
              var c = T(a);
              Yb(c, c.node, b, false);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name)
                throw d;
              return -d.Pa;
            }
          },
          h: function(a) {
            try {
              var b = T(a);
              Rb(b, b.node, { timestamp: Date.now(), Lb: false });
              return 0;
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name)
                throw c;
              return -c.Pa;
            }
          },
          b: function(a, b, c) {
            Cc = c;
            try {
              var d = T(a);
              switch (b) {
                case 0:
                  var e = Ec();
                  if (0 > e)
                    break;
                  for (; Eb[e]; )
                    e++;
                  return Qb(d, e).fd;
                case 1:
                case 2:
                  return 0;
                case 3:
                  return d.flags;
                case 4:
                  return e = Ec(), d.flags |= e, 0;
                case 12:
                  return e = Ec(), Ha[e + 0 >> 1] = 2, 0;
                case 13:
                case 14:
                  return 0;
              }
              return -28;
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name)
                throw g;
              return -g.Pa;
            }
          },
          g: function(a, b) {
            try {
              var c = T(a), d = c.node, e = c.Ma.Ta;
              a = e ? c : d;
              e ??= d.La.Ta;
              Ob(e);
              var g = e(a);
              return kc(b, g);
            } catch (h) {
              if ("undefined" == typeof X || "ErrnoError" !== h.name)
                throw h;
              return -h.Pa;
            }
          },
          H: function(a, b) {
            b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
            try {
              if (isNaN(b))
                return -61;
              var c = T(a);
              if (0 > b || 0 === (c.flags & 2097155))
                throw new N(28);
              Zb(c, c.node, b);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name)
                throw d;
              return -d.Pa;
            }
          },
          G: function(a, b) {
            try {
              if (0 === b)
                return -28;
              var c = ib("/") + 1;
              if (b < c)
                return -68;
              M("/", C2, a, b);
              return c;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name)
                throw d;
              return -d.Pa;
            }
          },
          K: function(a, b) {
            try {
              return a = z(a), kc(b, Xb(a, true));
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name)
                throw c;
              return -c.Pa;
            }
          },
          C: function(a, b, c) {
            try {
              return b = z(b), b = Y(a, b), U(b, c), 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name)
                throw d;
              return -d.Pa;
            }
          },
          J: function(a, b, c, d) {
            try {
              b = z(b);
              var e = d & 256;
              b = Y(a, b, d & 4096);
              return kc(c, e ? Xb(b, true) : Xb(b));
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name)
                throw g;
              return -g.Pa;
            }
          },
          x: function(a, b, c, d) {
            Cc = d;
            try {
              b = z(b);
              b = Y(a, b);
              var e = d ? Ec() : 0;
              return ma(b, c, e).fd;
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name)
                throw g;
              return -g.Pa;
            }
          },
          v: function(a, b, c, d) {
            try {
              b = z(b);
              b = Y(a, b);
              if (0 >= d)
                return -28;
              var e = S(b).node;
              if (!e)
                throw new N(44);
              if (!e.La.readlink)
                throw new N(28);
              var g = e.La.readlink(e);
              var h = Math.min(d, ib(g)), q = m[c + h];
              M(
                g,
                C2,
                c,
                d + 1
              );
              m[c + h] = q;
              return h;
            } catch (w) {
              if ("undefined" == typeof X || "ErrnoError" !== w.name)
                throw w;
              return -w.Pa;
            }
          },
          u: function(a) {
            try {
              return a = z(a), Wb(a), 0;
            } catch (b) {
              if ("undefined" == typeof X || "ErrnoError" !== b.name)
                throw b;
              return -b.Pa;
            }
          },
          f: function(a, b) {
            try {
              return a = z(a), kc(b, Xb(a));
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name)
                throw c;
              return -c.Pa;
            }
          },
          r: function(a, b, c) {
            try {
              b = z(b);
              b = Y(a, b);
              if (c)
                if (512 === c)
                  Wb(b);
                else
                  return -28;
              else
                ua(b);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name)
                throw d;
              return -d.Pa;
            }
          },
          q: function(a, b, c) {
            try {
              b = z(b);
              b = Y(a, b, true);
              var d = Date.now(), e, g;
              if (c) {
                var h = F[c >> 2] + 4294967296 * E[c + 4 >> 2], q = E[c + 8 >> 2];
                1073741823 == q ? e = d : 1073741822 == q ? e = null : e = 1e3 * h + q / 1e6;
                c += 16;
                h = F[c >> 2] + 4294967296 * E[c + 4 >> 2];
                q = E[c + 8 >> 2];
                1073741823 == q ? g = d : 1073741822 == q ? g = null : g = 1e3 * h + q / 1e6;
              } else
                g = e = d;
              if (null !== (g ?? e)) {
                a = e;
                var w = S(b, { ab: true }).node;
                Ob(w.La.Ua)(w, { atime: a, mtime: g });
              }
              return 0;
            } catch (t) {
              if ("undefined" == typeof X || "ErrnoError" !== t.name)
                throw t;
              return -t.Pa;
            }
          },
          m: () => Ma(""),
          l: () => {
            Ya = false;
            Fc = 0;
          },
          A: function(a, b) {
            a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a);
            a = new Date(1e3 * a);
            E[b >> 2] = a.getSeconds();
            E[b + 4 >> 2] = a.getMinutes();
            E[b + 8 >> 2] = a.getHours();
            E[b + 12 >> 2] = a.getDate();
            E[b + 16 >> 2] = a.getMonth();
            E[b + 20 >> 2] = a.getFullYear() - 1900;
            E[b + 24 >> 2] = a.getDay();
            var c = a.getFullYear();
            E[b + 28 >> 2] = (0 !== c % 4 || 0 === c % 100 && 0 !== c % 400 ? Hc : Gc)[a.getMonth()] + a.getDate() - 1 | 0;
            E[b + 36 >> 2] = -(60 * a.getTimezoneOffset());
            c = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
            var d = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
            E[b + 32 >> 2] = (c != d && a.getTimezoneOffset() == Math.min(d, c)) | 0;
          },
          y: function(a, b, c, d, e, g, h) {
            e = -9007199254740992 > e || 9007199254740992 < e ? NaN : Number(e);
            try {
              var q = T(d);
              if (0 !== (b & 2) && 0 === (c & 2) && 2 !== (q.flags & 2097155))
                throw new N(2);
              if (1 === (q.flags & 2097155))
                throw new N(2);
              if (!q.Ma.jb)
                throw new N(43);
              if (!a)
                throw new N(28);
              var w = q.Ma.jb(q, a, e, b, c);
              var t = w.Xb;
              E[g >> 2] = w.Eb;
              F[h >> 2] = t;
              return 0;
            } catch (x) {
              if ("undefined" == typeof X || "ErrnoError" !== x.name)
                throw x;
              return -x.Pa;
            }
          },
          z: function(a, b, c, d, e, g) {
            g = -9007199254740992 > g || 9007199254740992 < g ? NaN : Number(g);
            try {
              var h = T(e);
              if (c & 2) {
                c = g;
                if (32768 !== (h.node.mode & 61440))
                  throw new N(43);
                if (!(d & 2)) {
                  var q = C2.slice(a, a + b);
                  h.Ma.kb && h.Ma.kb(h, q, c, b, d);
                }
              }
            } catch (w) {
              if ("undefined" == typeof X || "ErrnoError" !== w.name)
                throw w;
              return -w.Pa;
            }
          },
          n: (a, b) => {
            Ic[a] && (clearTimeout(Ic[a].id), delete Ic[a]);
            if (!b)
              return 0;
            var c = setTimeout(() => {
              delete Ic[a];
              Kc(() => Uc(a, performance.now()));
            }, b);
            Ic[a] = { id: c, lc: b };
            return 0;
          },
          B: (a, b, c, d) => {
            var e = (/* @__PURE__ */ new Date()).getFullYear(), g = new Date(e, 0, 1).getTimezoneOffset();
            e = new Date(e, 6, 1).getTimezoneOffset();
            F[a >> 2] = 60 * Math.max(g, e);
            E[b >> 2] = Number(g != e);
            b = (h) => {
              var q = Math.abs(h);
              return `UTC${0 <= h ? "-" : "+"}${String(Math.floor(q / 60)).padStart(2, "0")}${String(q % 60).padStart(2, "0")}`;
            };
            a = b(g);
            b = b(e);
            e < g ? (M(a, C2, c, 17), M(b, C2, d, 17)) : (M(a, C2, d, 17), M(b, C2, c, 17));
          },
          d: () => Date.now(),
          s: () => 2147483648,
          c: () => performance.now(),
          o: (a) => {
            var b = C2.length;
            a >>>= 0;
            if (2147483648 < a)
              return false;
            for (var c = 1; 4 >= c; c *= 2) {
              var d = b * (1 + 0.2 / c);
              d = Math.min(d, a + 100663296);
              a: {
                d = (Math.min(2147483648, 65536 * Math.ceil(Math.max(
                  a,
                  d
                ) / 65536)) - La.buffer.byteLength + 65535) / 65536 | 0;
                try {
                  La.grow(d);
                  Ka();
                  var e = 1;
                  break a;
                } catch (g) {
                }
                e = void 0;
              }
              if (e)
                return true;
            }
            return false;
          },
          E: (a, b) => {
            var c = 0, d = 0, e;
            for (e of Nc()) {
              var g = b + c;
              F[a + d >> 2] = g;
              c += M(e, C2, g, Infinity) + 1;
              d += 4;
            }
            return 0;
          },
          F: (a, b) => {
            var c = Nc();
            F[a >> 2] = c.length;
            a = 0;
            for (var d of c)
              a += ib(d) + 1;
            F[b >> 2] = a;
            return 0;
          },
          e: function(a) {
            try {
              var b = T(a);
              oa(b);
              return 0;
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name)
                throw c;
              return c.Pa;
            }
          },
          p: function(a, b) {
            try {
              var c = T(a);
              m[b] = c.tty ? 2 : P(c.mode) ? 3 : 40960 === (c.mode & 61440) ? 7 : 4;
              Ha[b + 2 >> 1] = 0;
              G[b + 8 >> 3] = BigInt(0);
              G[b + 16 >> 3] = BigInt(0);
              return 0;
            } catch (d) {
              if ("undefined" == typeof X || "ErrnoError" !== d.name)
                throw d;
              return d.Pa;
            }
          },
          w: function(a, b, c, d) {
            try {
              a: {
                var e = T(a);
                a = b;
                for (var g, h = b = 0; h < c; h++) {
                  var q = F[a >> 2], w = F[a + 4 >> 2];
                  a += 8;
                  var t = ac(e, m, q, w, g);
                  if (0 > t) {
                    var x = -1;
                    break a;
                  }
                  b += t;
                  if (t < w)
                    break;
                  "undefined" != typeof g && (g += t);
                }
                x = b;
              }
              F[d >> 2] = x;
              return 0;
            } catch (D) {
              if ("undefined" == typeof X || "ErrnoError" !== D.name)
                throw D;
              return D.Pa;
            }
          },
          D: function(a, b, c, d) {
            b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
            try {
              if (isNaN(b))
                return 61;
              var e = T(a);
              $b(e, b, c);
              G[d >> 3] = BigInt(e.position);
              e.rb && 0 === b && 0 === c && (e.rb = null);
              return 0;
            } catch (g) {
              if ("undefined" == typeof X || "ErrnoError" !== g.name)
                throw g;
              return g.Pa;
            }
          },
          I: function(a) {
            try {
              var b = T(a);
              return b.Ma?.fsync?.(b);
            } catch (c) {
              if ("undefined" == typeof X || "ErrnoError" !== c.name)
                throw c;
              return c.Pa;
            }
          },
          t: function(a, b, c, d) {
            try {
              a: {
                var e = T(a);
                a = b;
                for (var g, h = b = 0; h < c; h++) {
                  var q = F[a >> 2], w = F[a + 4 >> 2];
                  a += 8;
                  var t = na(e, m, q, w, g);
                  if (0 > t) {
                    var x = -1;
                    break a;
                  }
                  b += t;
                  if (t < w)
                    break;
                  "undefined" != typeof g && (g += t);
                }
                x = b;
              }
              F[d >> 2] = x;
              return 0;
            } catch (D) {
              if ("undefined" == typeof X || "ErrnoError" !== D.name)
                throw D;
              return D.Pa;
            }
          },
          k: Jc
        };
        function Wc() {
          function a() {
            k.calledRun = true;
            if (!Fa) {
              if (!k.noFSInit && !Gb) {
                var b, c;
                Gb = true;
                b ??= k.stdin;
                c ??= k.stdout;
                d ??= k.stderr;
                b ? W("stdin", b) : Vb("/dev/tty", "/dev/stdin");
                c ? W("stdout", null, c) : Vb("/dev/tty", "/dev/stdout");
                d ? W("stderr", null, d) : Vb("/dev/tty1", "/dev/stderr");
                ma("/dev/stdin", 0);
                ma("/dev/stdout", 1);
                ma("/dev/stderr", 1);
              }
              Xc.N();
              Hb = false;
              k.onRuntimeInitialized?.();
              if (k.postRun)
                for ("function" == typeof k.postRun && (k.postRun = [k.postRun]); k.postRun.length; ) {
                  var d = k.postRun.shift();
                  Ua.push(d);
                }
              Ta(Ua);
            }
          }
          if (0 < J)
            Xa = Wc;
          else {
            if (k.preRun)
              for ("function" == typeof k.preRun && (k.preRun = [k.preRun]); k.preRun.length; )
                Wa();
            Ta(Va);
            0 < J ? Xa = Wc : k.setStatus ? (k.setStatus("Running..."), setTimeout(() => {
              setTimeout(() => k.setStatus(""), 1);
              a();
            }, 1)) : a();
          }
        }
        var Xc;
        (async function() {
          function a(c) {
            c = Xc = c.exports;
            k._sqlite3_free = c.P;
            k._sqlite3_value_text = c.Q;
            k._sqlite3_prepare_v2 = c.R;
            k._sqlite3_step = c.S;
            k._sqlite3_reset = c.T;
            k._sqlite3_exec = c.U;
            k._sqlite3_finalize = c.V;
            k._sqlite3_column_name = c.W;
            k._sqlite3_column_text = c.X;
            k._sqlite3_column_type = c.Y;
            k._sqlite3_errmsg = c.Z;
            k._sqlite3_clear_bindings = c._;
            k._sqlite3_value_blob = c.$;
            k._sqlite3_value_bytes = c.aa;
            k._sqlite3_value_double = c.ba;
            k._sqlite3_value_int = c.ca;
            k._sqlite3_value_type = c.da;
            k._sqlite3_result_blob = c.ea;
            k._sqlite3_result_double = c.fa;
            k._sqlite3_result_error = c.ga;
            k._sqlite3_result_int = c.ha;
            k._sqlite3_result_int64 = c.ia;
            k._sqlite3_result_null = c.ja;
            k._sqlite3_result_text = c.ka;
            k._sqlite3_aggregate_context = c.la;
            k._sqlite3_column_count = c.ma;
            k._sqlite3_data_count = c.na;
            k._sqlite3_column_blob = c.oa;
            k._sqlite3_column_bytes = c.pa;
            k._sqlite3_column_double = c.qa;
            k._sqlite3_bind_blob = c.ra;
            k._sqlite3_bind_double = c.sa;
            k._sqlite3_bind_int = c.ta;
            k._sqlite3_bind_text = c.ua;
            k._sqlite3_bind_parameter_index = c.va;
            k._sqlite3_sql = c.wa;
            k._sqlite3_normalized_sql = c.xa;
            k._sqlite3_changes = c.ya;
            k._sqlite3_close_v2 = c.za;
            k._sqlite3_create_function_v2 = c.Aa;
            k._sqlite3_update_hook = c.Ba;
            k._sqlite3_open = c.Ca;
            da = k._malloc = c.Da;
            ea = k._free = c.Ea;
            k._RegisterExtensionFunctions = c.Fa;
            Bb = c.Ga;
            Uc = c.Ha;
            ra = c.Ia;
            y = c.Ja;
            pa = c.Ka;
            La = c.M;
            Z = c.O;
            Ka();
            J--;
            k.monitorRunDependencies?.(J);
            0 == J && Xa && (c = Xa, Xa = null, c());
            return Xc;
          }
          J++;
          k.monitorRunDependencies?.(J);
          var b = { a: Vc };
          if (k.instantiateWasm)
            return new Promise((c) => {
              k.instantiateWasm(b, (d, e) => {
                c(a(d, e));
              });
            });
          Na ??= k.locateFile ? k.locateFile("sql-wasm.wasm", za) : za + "sql-wasm.wasm";
          return a((await Ra(b)).instance);
        })();
        Wc();
        return Module2;
      });
      return initSqlJsPromise;
    };
    if (typeof exports2 === "object" && typeof module2 === "object") {
      module2.exports = initSqlJs2;
      module2.exports.default = initSqlJs2;
    } else if (typeof define === "function" && define["amd"]) {
      define([], function() {
        return initSqlJs2;
      });
    } else if (typeof exports2 === "object") {
      exports2["Module"] = initSqlJs2;
    }
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode10 = __toESM(require("vscode"));
var path4 = __toESM(require("path"));
var fs2 = __toESM(require("fs/promises"));
var import_fs5 = require("fs");
var import_worker_threads2 = require("worker_threads");

// src/webview/WebviewProvider.ts
var vscode2 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var import_worker_threads = require("worker_threads");

// src/risk/risk-core.ts
var RISK_WINDOWS = [30, 90, 365];
var DEFAULT_RISK_WINDOW = 90;
var CHURN_CAP = 20;
function normalizeRiskWindow(value) {
  return typeof value === "number" && RISK_WINDOWS.indexOf(value) !== -1 ? value : DEFAULT_RISK_WINDOW;
}
function percentileLookup(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return (v) => {
    const n = sorted.length;
    if (n === 0)
      return 0;
    let lo = 0, hi = n;
    while (lo < hi) {
      const mid = lo + hi >> 1;
      if (sorted[mid] < v)
        lo = mid + 1;
      else
        hi = mid;
    }
    const less = lo;
    let lo2 = less, hi2 = n;
    while (lo2 < hi2) {
      const mid2 = lo2 + hi2 >> 1;
      if (sorted[mid2] <= v)
        lo2 = mid2 + 1;
      else
        hi2 = mid2;
    }
    const equal = lo2 - less;
    const denom = n - equal;
    if (denom <= 0)
      return 0;
    return Math.min(1, less / denom);
  };
}
function buildRiskPercentiles(nodes, churnOf) {
  const complexity = [], fanIn = [], fanOut = [], churn = [];
  const pagerank = [];
  for (const n of nodes) {
    complexity.push(n.complexity || 0);
    fanIn.push(n.fanIn || 0);
    fanOut.push(n.fanOut || 0);
    churn.push(churnOf(n) || 0);
    pagerank.push(typeof n.pagerank === "number" ? n.pagerank : 0);
  }
  return {
    complexity: percentileLookup(complexity),
    fanIn: percentileLookup(fanIn),
    fanOut: percentileLookup(fanOut),
    churn: percentileLookup(churn),
    centrality: percentileLookup(pagerank)
  };
}
function topPercentLabel(p) {
  const pc = Math.round((1 - p) * 100);
  if (pc <= 0)
    return "the highest";
  if (pc >= 100)
    return null;
  return "top " + pc + "%";
}
var RISK_HIGH_THRESHOLD = 66;
var RISK_MEDIUM_THRESHOLD = 33;
function riskBucket(score) {
  return score >= RISK_HIGH_THRESHOLD ? "high" : score >= RISK_MEDIUM_THRESHOLD ? "medium" : "low";
}
function computeRiskScore(node, pct, churn, options = {}) {
  const complexity = node.complexity || 0;
  const fanIn = node.fanIn || 0;
  const fanOut = node.fanOut || 0;
  const complexityP = pct ? pct.complexity(complexity) : Math.min(complexity / 50, 1);
  const fanInP = pct ? pct.fanIn(fanIn) : Math.min(fanIn / 20, 1);
  const fanOutP = pct ? pct.fanOut(fanOut) : Math.min(fanOut / 30, 1);
  const churnP = pct ? pct.churn(churn) : Math.min(churn / CHURN_CAP, 1);
  const centralityEnabled = options.centrality === true && !!pct?.centrality;
  const centralityP = centralityEnabled && pct?.centrality ? pct.centrality(node.pagerank || 0) : 0;
  const inCycle = node.cycleIds && node.cycleIds.length > 0 ? 1 : 0;
  const totalSymbols = node.symbols && node.symbols.totalSymbols || 0;
  const deadCount = node.deadExports && node.deadExports.length || 0;
  const deadRatio = totalSymbols > 0 ? Math.min(deadCount / totalSymbols, 1) : 0;
  return 100 * (0.3 * complexityP + 0.2 * (centralityEnabled ? centralityP : fanInP) + 0.1 * fanOutP + 0.15 * inCycle + 0.15 * deadRatio + 0.1 * churnP);
}
function riskReasons(node, pct, ctx) {
  const reasons = [];
  const complexity = node.complexity || 0;
  const fanIn = node.fanIn || 0;
  const fanOut = node.fanOut || 0;
  const churn = ctx.churn || 0;
  const totalSymbols = node.symbols && node.symbols.totalSymbols || 0;
  const deadCount = node.deadExports && node.deadExports.length || 0;
  const authorCount = ctx.authorCount || 0;
  let lbl;
  if (complexity > 0) {
    const pC = pct ? pct.complexity(complexity) : 0;
    lbl = topPercentLabel(pC);
    reasons.push({ weight: 0.3 * pC, text: "complexity " + complexity + (lbl ? " (" + lbl + " of the repo)" : "") });
  }
  if (fanIn > 0 || ctx.centrality && node.pagerank && pct?.centrality) {
    if (ctx.centrality && pct?.centrality && node.pagerank) {
      const pCentrality = pct.centrality(node.pagerank);
      const centralityLabel = topPercentLabel(pCentrality);
      reasons.push({
        weight: 0.2 * pCentrality,
        text: "centrality" + (centralityLabel ? " " + centralityLabel : "") + " (PageRank " + node.pagerank.toFixed(4) + ")"
      });
    } else {
      const pI = pct ? pct.fanIn(fanIn) : 0;
      lbl = topPercentLabel(pI);
      reasons.push({ weight: 0.2 * pI, text: fanIn + (fanIn === 1 ? " file depends on it" : " files depend on it") + (lbl ? " (" + lbl + ")" : "") });
    }
  }
  if (churn > 0) {
    const pCh = pct ? pct.churn(churn) : 0;
    lbl = topPercentLabel(pCh);
    reasons.push({ weight: 0.1 * pCh, text: "changed " + churn + " time" + (churn === 1 ? "" : "s") + " in " + ctx.windowDays + " days" + (lbl ? " (" + lbl + ")" : "") });
  }
  if (fanOut > 0) {
    const pO = pct ? pct.fanOut(fanOut) : 0;
    reasons.push({ weight: 0.1 * pO, text: "depends on " + fanOut + " file" + (fanOut === 1 ? "" : "s") });
  }
  if (node.cycleIds && node.cycleIds.length > 0) {
    reasons.push({ weight: 0.15, text: "in a dependency cycle" });
  }
  if (deadCount > 0) {
    const ratio = totalSymbols > 0 ? deadCount / totalSymbols : 0;
    reasons.push({ weight: 0.15 * ratio, text: deadCount + " unused symbol" + (deadCount === 1 ? "" : "s") + " of " + totalSymbols });
  }
  if (authorCount === 1) {
    reasons.push({ weight: 0, text: "single author" });
  } else if (authorCount > 1) {
    reasons.push({ weight: 0, text: authorCount + " authors" });
  }
  reasons.sort((a, b) => b.weight - a.weight);
  return reasons;
}
function buildRenameResolver(commits) {
  const map = /* @__PURE__ */ new Map();
  for (const commit of commits) {
    for (const f of commit.files || []) {
      if (f.status === "R" && f.oldPath && f.path && f.oldPath !== f.path && !map.has(f.oldPath)) {
        map.set(f.oldPath, f.path);
      }
    }
  }
  const cache = /* @__PURE__ */ new Map();
  return (path5) => {
    const hit = cache.get(path5);
    if (hit !== void 0)
      return hit;
    let cur = path5;
    const seen = /* @__PURE__ */ new Set([cur]);
    while (map.has(cur)) {
      const next = map.get(cur);
      if (seen.has(next))
        break;
      seen.add(next);
      cur = next;
    }
    cache.set(path5, cur);
    return cur;
  };
}

// src/analysis/dead-code.ts
var DEFAULT_DEAD_CODE_RULES = [
  { name: "main", reason: "program entry point" },
  { namePattern: "^__.*__$", reason: "Python special method" },
  {
    name: ["activate", "deactivate"],
    path: ["**/extension.ts", "**/extension.js"],
    reason: "VS Code extension lifecycle"
  },
  {
    namePattern: "^[A-Z][A-Za-z0-9_]*$",
    path: ["**/*.tsx", "**/*.jsx"],
    kind: ["function", "class", "export"],
    reason: "React component exported for JSX"
  },
  {
    name: [
      "setup",
      "created",
      "beforeCreate",
      "mounted",
      "beforeMount",
      "updated",
      "beforeUpdate",
      "unmounted",
      "beforeDestroy",
      "activated",
      "deactivated",
      "onMounted",
      "onUpdated",
      "onUnmounted"
    ],
    language: "vue",
    reason: "Vue lifecycle hook"
  },
  {
    name: ["body"],
    language: "swift",
    reason: "SwiftUI view body"
  },
  {
    name: [
      "doGet",
      "doPost",
      "doPut",
      "doDelete",
      "doHead",
      "doOptions",
      "doTrace",
      "init",
      "destroy",
      "service"
    ],
    language: "java",
    reason: "Java servlet lifecycle"
  },
  {
    name: [
      "Awake",
      "Start",
      "Update",
      "FixedUpdate",
      "LateUpdate",
      "OnEnable",
      "OnDisable",
      "OnDestroy",
      "OnCollisionEnter",
      "OnCollisionExit",
      "OnCollisionStay",
      "OnTriggerEnter",
      "OnTriggerExit",
      "OnTriggerStay"
    ],
    language: "csharp",
    reason: "Unity lifecycle callback"
  },
  {
    name: ["setup", "loop"],
    path: ["**/*.ino"],
    reason: "Arduino entry point"
  },
  {
    path: [
      "**/*.test.*",
      "**/*.spec.*",
      "**/*_test.*",
      "**/test_*.py",
      "**/__tests__/**",
      "**/tests/**",
      "**/test/**"
    ],
    reason: "test file"
  }
];
function asArray(value) {
  if (value === void 0)
    return void 0;
  return Array.isArray(value) ? value : [value];
}
function normalizeSelector(value) {
  if (typeof value === "string" && value.trim())
    return [value.trim()];
  if (Array.isArray(value)) {
    const list = value.filter((v) => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
    return list.length > 0 ? list : void 0;
  }
  return void 0;
}
function globToRegExp(glob) {
  let out2 = "^";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/")
          i++;
        out2 += ".*";
      } else {
        out2 += "[^/]*";
      }
    } else if (ch === "?") {
      out2 += "[^/]";
    } else {
      out2 += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(out2 + "$");
}
function matchesAnyPath(filePath, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(filePath));
}
function matchesString(value, expected) {
  const list = asArray(expected);
  return !list || list.length === 0 || list.indexOf(value) !== -1;
}
function matchesPath(filePath, expected) {
  const list = asArray(expected);
  return !list || list.length === 0 || matchesAnyPath(filePath, list);
}
function parseDeadCodeRules(raw) {
  let value = raw;
  if (typeof value === "string") {
    if (!value.trim())
      return [];
    try {
      value = JSON.parse(value);
    } catch (err2) {
      throw new Error("Dead-code rules are not valid JSON: " + (err2 instanceof Error ? err2.message : String(err2)));
    }
  }
  if (value === null || value === void 0)
    return [];
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error('Dead-code rules must be an object with a "rules" array.');
  }
  const candidate = value;
  if (candidate.rules === void 0)
    return [];
  if (!Array.isArray(candidate.rules)) {
    throw new Error('Dead-code "rules" must be an array.');
  }
  if (candidate.rules.length > 200) {
    throw new Error("Dead-code rules are limited to 200 entries.");
  }
  return candidate.rules.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Dead-code rule #${index + 1} must be an object.`);
    }
    const rule = entry;
    const reason = typeof rule.reason === "string" ? rule.reason.trim() : "";
    if (!reason)
      throw new Error(`Dead-code rule #${index + 1} needs a non-empty "reason".`);
    const name = normalizeSelector(rule.name);
    const namePattern = typeof rule.namePattern === "string" ? rule.namePattern : void 0;
    const path5 = normalizeSelector(rule.path);
    const language = normalizeSelector(rule.language);
    const kind = normalizeSelector(rule.kind);
    if (!name && !namePattern && !path5) {
      throw new Error(`Dead-code rule #${index + 1} needs at least one selector: name, namePattern or path.`);
    }
    if (namePattern) {
      try {
        new RegExp(namePattern);
      } catch {
        throw new Error(`Dead-code rule #${index + 1} has an invalid namePattern.`);
      }
    }
    const normalized = { reason };
    if (name)
      normalized.name = name;
    if (namePattern)
      normalized.namePattern = namePattern;
    if (path5)
      normalized.path = path5;
    if (language)
      normalized.language = language;
    if (kind)
      normalized.kind = kind;
    return normalized;
  });
}
function findExemption(file, candidate, rules) {
  const filePath = file.id || file.path;
  for (const rule of rules) {
    if (rule.name !== void 0 && !matchesString(candidate.name, rule.name))
      continue;
    if (rule.namePattern !== void 0 && !new RegExp(rule.namePattern).test(candidate.name))
      continue;
    if (rule.path !== void 0 && !matchesPath(filePath, rule.path))
      continue;
    if (rule.language !== void 0 && !matchesString(file.language, rule.language))
      continue;
    if (rule.kind !== void 0 && !matchesString(candidate.kind, rule.kind))
      continue;
    return rule.reason;
  }
  return void 0;
}
function collectCalledNames(files) {
  const allCalledNames = /* @__PURE__ */ new Set();
  const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
  for (const file of files) {
    const re = new RegExp(CALL_SCAN_RE.source, "gm");
    let match;
    while ((match = re.exec(file.content)) !== null)
      allCalledNames.add(match[1]);
  }
  return allCalledNames;
}
function classifyDeadCode(file, symbols, calledNames, rules) {
  if (!symbols)
    return { dead: [], exempted: [] };
  const candidates = [];
  const add = (name, kind) => {
    if (name)
      candidates.push({ name, kind });
  };
  for (const fn of symbols.functions)
    add(fn.name, fn.type || "function");
  for (const cls of symbols.classes)
    add(cls.name, cls.type || "class");
  for (const exp of symbols.exports)
    add(exp.name, exp.type || "export");
  for (const method of symbols.methods || [])
    add(method.name, method.type || "method");
  const dead = [];
  const exempted = [];
  const seenDead = /* @__PURE__ */ new Set();
  const seenExempted = /* @__PURE__ */ new Set();
  for (const candidate of candidates) {
    if (calledNames.has(candidate.name))
      continue;
    const reason = findExemption(file, candidate, rules);
    if (reason) {
      const key = candidate.name + "|" + candidate.kind;
      if (!seenExempted.has(key)) {
        exempted.push({ name: candidate.name, kind: candidate.kind, reason });
        seenExempted.add(key);
      }
    } else if (candidate.kind !== "method" && !seenDead.has(candidate.name)) {
      dead.push(candidate.name);
      seenDead.add(candidate.name);
    }
  }
  return { dead, exempted };
}

// src/arch/arch-core.ts
var ARCH_RULES_VERSION = 1;
var ARCH_RULES_FILE = ".aura/arch-rules.json";
var ARCH_BASELINE_FILE = ".aura/arch-baseline.json";
var UNLAYERED = "unlayered";
var DEFAULT_ARCH_EDGE_TYPES = [
  "import",
  "import-type",
  "require",
  "dynamic-import",
  "include",
  "system-include",
  "script",
  "stylesheet",
  "css-import",
  "css-url",
  "asset",
  "extends",
  "implements",
  "function-call",
  "source"
];
var EMPTY_ARCH_RULES = {
  version: ARCH_RULES_VERSION,
  edgeTypes: DEFAULT_ARCH_EDGE_TYPES.slice(),
  layers: [],
  rules: [],
  exceptions: [],
  strict: false
};
var EMPTY_ARCH_BASELINE = { version: ARCH_RULES_VERSION, entries: [] };
function normalizeArchPath(input) {
  let value = String(input == null ? "" : input).replace(/\\/g, "/").trim();
  while (value.startsWith("./"))
    value = value.slice(2);
  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1 && value.endsWith("/"))
    value = value.slice(0, -1);
  return value;
}
function escapeRegExpChar(char) {
  return /[.*+?^${}()|[\]\\]/.test(char) ? "\\" + char : char;
}
function globSource(pattern) {
  let normalized = String(pattern == null ? "" : pattern).replace(/\\/g, "/").trim();
  while (normalized.startsWith("./"))
    normalized = normalized.slice(2);
  normalized = normalized.replace(/\/{2,}/g, "/");
  let out2 = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === "*") {
      if (normalized[i + 1] === "*") {
        while (normalized[i + 1] === "*")
          i++;
        if (normalized[i + 1] === "/") {
          i++;
          out2 += "(?:.*/)?";
        } else {
          out2 += ".*";
        }
      } else {
        out2 += "[^/]*";
      }
    } else if (char === "?") {
      out2 += "[^/]";
    } else {
      out2 += escapeRegExpChar(char);
    }
  }
  return out2;
}
function globToRegExp2(pattern) {
  return new RegExp("^" + globSource(pattern) + "$");
}
function compileGlobs(patterns) {
  return patterns.map(globToRegExp2);
}
function matchesAny(path5, regexps) {
  for (const re of regexps)
    if (re.test(path5))
      return true;
  return false;
}
function slicesPatternToRegExp(pattern) {
  const normalized = normalizeArchPath(pattern);
  const runs = [];
  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] !== "*")
      continue;
    let length = 1;
    while (normalized[i + length] === "*")
      length++;
    runs.push({ start: i, length });
    i += length - 1;
  }
  const singles = runs.filter((run2) => run2.length === 1);
  if (singles.length !== 1) {
    throw new Error(`Slices pattern "${pattern}" must contain exactly one "*" for the slice name`);
  }
  const star = singles[0].start;
  const prefix = normalized.slice(0, star);
  const suffix = normalized.slice(star + 1);
  const tail = suffix ? globSource(suffix) : "(?:/.*)?";
  return new RegExp("^" + globSource(prefix) + "([^/]+)" + tail + "$");
}
function asStringArray(value, field, where) {
  if (typeof value === "string" && value.trim())
    return [value.trim()];
  if (!Array.isArray(value))
    throw new Error(`${where}: "${field}" must be an array of strings`);
  const out2 = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`${where}: "${field}" must contain non-empty strings`);
    }
    out2.push(item.trim());
  }
  return out2;
}
function normalizeSeverity(value, where) {
  if (value === void 0)
    return "warn";
  if (value === "error" || value === "warn")
    return value;
  throw new Error(`${where}: "severity" must be "error" or "warn"`);
}
function parseArchRules(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err2) {
    throw new Error(`Invalid JSON: ${err2 instanceof Error ? err2.message : String(err2)}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The rules file must contain a JSON object");
  }
  const obj = data;
  if (obj.version !== void 0 && obj.version !== ARCH_RULES_VERSION) {
    throw new Error(`Unsupported rules version ${String(obj.version)} (expected ${ARCH_RULES_VERSION})`);
  }
  const edgeTypes = obj.edgeTypes === void 0 ? DEFAULT_ARCH_EDGE_TYPES.slice() : asStringArray(obj.edgeTypes, "edgeTypes", "rules").map((t) => t.toLowerCase());
  if (edgeTypes.indexOf("doc-reference") !== -1) {
    const idx = edgeTypes.indexOf("doc-reference");
    edgeTypes.splice(idx, 1);
  }
  const rawLayers = obj.layers === void 0 ? [] : obj.layers;
  if (!Array.isArray(rawLayers))
    throw new Error('"layers" must be an array');
  const layers = [];
  const layerNames = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawLayers.length; i++) {
    const entry = rawLayers[i];
    if (!entry || typeof entry !== "object")
      throw new Error(`Layer #${i} must be an object`);
    if (typeof entry.name !== "string" || !entry.name.trim()) {
      throw new Error(`Layer #${i} needs a non-empty "name"`);
    }
    const name = entry.name.trim();
    if (name === UNLAYERED)
      throw new Error(`Layer name "${UNLAYERED}" is reserved`);
    if (layerNames.has(name))
      throw new Error(`Duplicate layer name "${name}"`);
    layerNames.add(name);
    const paths = asStringArray(entry.paths, "paths", `Layer "${name}"`);
    if (paths.length === 0)
      throw new Error(`Layer "${name}" needs at least one glob in "paths"`);
    layers.push({ name, paths });
  }
  const rawRules = obj.rules === void 0 ? [] : obj.rules;
  if (!Array.isArray(rawRules))
    throw new Error('"rules" must be an array');
  const rules = [];
  const ruleIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < rawRules.length; i++) {
    const entry = rawRules[i];
    if (!entry || typeof entry !== "object")
      throw new Error(`Rule #${i} must be an object`);
    if (typeof entry.id !== "string" || !entry.id.trim()) {
      throw new Error(`Rule #${i} needs a non-empty "id"`);
    }
    const id = entry.id.trim();
    if (ruleIds.has(id))
      throw new Error(`Duplicate rule id "${id}"`);
    ruleIds.add(id);
    const where = `Rule "${id}"`;
    const kind = entry.type === void 0 ? "deny" : entry.type;
    if (kind === "deny") {
      if (typeof entry.from !== "string" || !entry.from.trim()) {
        throw new Error(`${where}: "from" is required`);
      }
      const from = entry.from.trim();
      if (from !== UNLAYERED && !layerNames.has(from)) {
        throw new Error(`${where}: unknown source layer "${from}"`);
      }
      const deny = asStringArray(entry.deny, "deny", where);
      if (deny.length === 0)
        throw new Error(`${where}: "deny" must not be empty`);
      for (const target of deny) {
        if (target !== "*" && target !== UNLAYERED && !layerNames.has(target)) {
          throw new Error(`${where}: unknown denied layer "${target}"`);
        }
        if (target === from)
          throw new Error(`${where}: a layer cannot deny itself`);
      }
      rules.push({ id, kind: "deny", from, deny, severity: normalizeSeverity(entry.severity, where) });
    } else if (kind === "slices") {
      if (typeof entry.pattern !== "string" || !entry.pattern.trim()) {
        throw new Error(`${where}: "pattern" is required for a slices rule`);
      }
      const pattern = entry.pattern.trim();
      slicesPatternToRegExp(pattern);
      const shared = entry.shared === void 0 ? [] : asStringArray(entry.shared, "shared", where);
      rules.push({ id, kind: "slices", pattern, shared, severity: normalizeSeverity(entry.severity, where) });
    } else if (kind === "no-cycles") {
      if (entry.scope !== void 0 && entry.scope !== "layers") {
        throw new Error(`${where}: only "scope": "layers" is supported`);
      }
      rules.push({ id, kind: "no-cycles", severity: normalizeSeverity(entry.severity, where) });
    } else {
      throw new Error(`${where}: unknown rule type "${String(kind)}"`);
    }
  }
  const exceptions = obj.exceptions === void 0 ? [] : asStringArray(obj.exceptions, "exceptions", "rules");
  const strict = obj.strict === void 0 ? false : obj.strict;
  if (typeof strict !== "boolean")
    throw new Error('"strict" must be a boolean');
  return {
    version: ARCH_RULES_VERSION,
    edgeTypes,
    layers,
    rules,
    exceptions,
    strict
  };
}
function serializeArchRules(rules) {
  const out2 = {
    version: ARCH_RULES_VERSION,
    edgeTypes: rules.edgeTypes.slice(),
    layers: rules.layers.map((layer) => ({ name: layer.name, paths: layer.paths.slice() })),
    rules: rules.rules.map((rule) => {
      if (rule.kind === "deny") {
        return { id: rule.id, from: rule.from, deny: rule.deny.slice(), severity: rule.severity };
      }
      if (rule.kind === "slices") {
        return {
          id: rule.id,
          type: "slices",
          pattern: rule.pattern,
          shared: rule.shared.slice(),
          severity: rule.severity
        };
      }
      return { id: rule.id, type: "no-cycles", severity: rule.severity };
    }),
    exceptions: rules.exceptions.slice(),
    strict: rules.strict
  };
  return JSON.stringify(out2, null, 2) + "\n";
}
function buildArchRulesTemplate(topFolders) {
  const seen = /* @__PURE__ */ new Set();
  const layers = [];
  for (const raw of topFolders) {
    const folder = normalizeArchPath(raw);
    if (!folder || folder.indexOf("/") !== -1 || seen.has(folder))
      continue;
    seen.add(folder);
    layers.push({ name: folder, paths: [`src/${folder}/**`] });
    if (layers.length >= 8)
      break;
  }
  return serializeArchRules({
    version: ARCH_RULES_VERSION,
    edgeTypes: DEFAULT_ARCH_EDGE_TYPES.slice(),
    layers,
    rules: [],
    exceptions: [],
    strict: false
  });
}
function baselineKey(ruleId, source, target) {
  return ruleId + "\0" + source + "\0" + target;
}
function parseArchBaseline(raw) {
  if (!raw)
    return { version: ARCH_RULES_VERSION, entries: [] };
  try {
    const data = JSON.parse(raw);
    const entriesRaw = Array.isArray(data?.entries) ? data.entries : [];
    const entries = [];
    const seen = /* @__PURE__ */ new Set();
    for (const item of entriesRaw) {
      const rec = item;
      if (typeof rec.ruleId !== "string" || typeof rec.source !== "string" || typeof rec.target !== "string")
        continue;
      const key = baselineKey(rec.ruleId, rec.source, rec.target);
      if (seen.has(key))
        continue;
      seen.add(key);
      entries.push({ ruleId: rec.ruleId, source: rec.source, target: rec.target });
    }
    entries.sort((a, b) => baselineKey(a.ruleId, a.source, a.target).localeCompare(baselineKey(b.ruleId, b.source, b.target)));
    return { version: ARCH_RULES_VERSION, entries };
  } catch {
    return { version: ARCH_RULES_VERSION, entries: [] };
  }
}
function buildArchBaseline(evaluation) {
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const violation of evaluation.violations) {
    const key = baselineKey(violation.ruleId, violation.source, violation.target);
    if (seen.has(key))
      continue;
    seen.add(key);
    entries.push({ ruleId: violation.ruleId, source: violation.source, target: violation.target });
  }
  entries.sort((a, b) => baselineKey(a.ruleId, a.source, a.target).localeCompare(baselineKey(b.ruleId, b.source, b.target)));
  return { version: ARCH_RULES_VERSION, entries };
}
function serializeArchBaseline(baseline) {
  return JSON.stringify({ version: ARCH_RULES_VERSION, entries: baseline.entries }, null, 2) + "\n";
}
function linkEnds(link) {
  return {
    source: typeof link.source === "string" ? link.source : link.source.id,
    target: typeof link.target === "string" ? link.target : link.target.id
  };
}
function layerCycleComponents(adjacency) {
  let index = 0;
  const indices = /* @__PURE__ */ new Map();
  const low = /* @__PURE__ */ new Map();
  const onStack = /* @__PURE__ */ new Set();
  const stack = [];
  const components = [];
  const strongConnect = (node) => {
    indices.set(node, index);
    low.set(node, index);
    index++;
    stack.push(node);
    onStack.add(node);
    for (const next of adjacency.get(node) || []) {
      if (!indices.has(next)) {
        strongConnect(next);
        low.set(node, Math.min(low.get(node), low.get(next)));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node), indices.get(next)));
      }
    }
    if (low.get(node) === indices.get(node)) {
      const component = [];
      let current2;
      do {
        current2 = stack.pop();
        onStack.delete(current2);
        component.push(current2);
      } while (current2 !== node);
      if (component.length > 1)
        components.push(component.sort());
    }
  };
  for (const node of Array.from(adjacency.keys()).sort()) {
    if (!indices.has(node))
      strongConnect(node);
  }
  return components.sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
}
function evaluateArchitecture(graph, rules, options = {}) {
  const baseline = options.baseline || EMPTY_ARCH_BASELINE;
  const baselineKeys = new Set(
    baseline.entries.map((e) => baselineKey(e.ruleId, e.source, e.target))
  );
  const layerMatchers = rules.layers.map((layer) => ({
    layer,
    regexps: compileGlobs(layer.paths)
  }));
  const exceptionMatchers = compileGlobs(rules.exceptions);
  const slicesMatchers = [];
  for (const rule of rules.rules) {
    if (rule.kind !== "slices")
      continue;
    slicesMatchers.push({
      rule,
      regexp: slicesPatternToRegExp(rule.pattern),
      shared: compileGlobs(rule.shared)
    });
  }
  const nodeById = /* @__PURE__ */ new Map();
  const codePaths = [];
  for (const node of graph.nodes) {
    nodeById.set(node.id, node);
    if (node.language !== "documentation")
      codePaths.push(normalizeArchPath(node.path || node.id));
  }
  const codePathSet = new Set(codePaths);
  const pathOfNode = (id) => {
    const node = nodeById.get(id);
    if (!node || node.language === "documentation")
      return void 0;
    return normalizeArchPath(node.path || node.id);
  };
  const fileLayer = /* @__PURE__ */ new Map();
  const exempt = /* @__PURE__ */ new Set();
  for (const path5 of codePaths) {
    if (matchesAny(path5, exceptionMatchers)) {
      exempt.add(path5);
      continue;
    }
    for (const matcher of layerMatchers) {
      if (matchesAny(path5, matcher.regexps)) {
        fileLayer.set(path5, matcher.layer.name);
        break;
      }
    }
  }
  const allUnlayeredFiles = codePaths.filter((path5) => !exempt.has(path5) && !fileLayer.has(path5)).sort();
  const denyRules = rules.rules.filter((rule) => rule.kind === "deny");
  const edgeTypeSet = new Set(rules.edgeTypes.map((t) => t.toLowerCase()));
  edgeTypeSet.delete("doc-reference");
  const violationMap = /* @__PURE__ */ new Map();
  const addViolation = (ruleId, kind, severity, source, target, linkType, sourceGroup, targetGroup, sourceLayer, targetLayer) => {
    const key = ruleId + "\0" + source + "\0" + target;
    const existing = violationMap.get(key);
    if (existing) {
      if (existing.linkTypes.indexOf(linkType) === -1)
        existing.linkTypes.push(linkType);
      return;
    }
    violationMap.set(key, {
      ruleId,
      kind,
      severity,
      source,
      target,
      linkType,
      linkTypes: [linkType],
      sourceGroup,
      targetGroup,
      sourceLayer,
      targetLayer
    });
  };
  const caFiles = /* @__PURE__ */ new Map();
  const ceFiles = /* @__PURE__ */ new Map();
  for (const layer of rules.layers) {
    caFiles.set(layer.name, /* @__PURE__ */ new Set());
    ceFiles.set(layer.name, /* @__PURE__ */ new Set());
  }
  const adjacency = /* @__PURE__ */ new Map();
  for (const name of rules.layers.map((l) => l.name))
    adjacency.set(name, /* @__PURE__ */ new Set());
  for (const link of graph.links) {
    const type = (link.type || "").toLowerCase();
    if (!edgeTypeSet.has(type))
      continue;
    const { source, target } = linkEnds(link);
    if (source === target)
      continue;
    const sourcePath = pathOfNode(source);
    const targetPath = pathOfNode(target);
    if (!sourcePath || !targetPath || !codePathSet.has(sourcePath))
      continue;
    if (exempt.has(sourcePath))
      continue;
    const sourceLayer = fileLayer.get(sourcePath);
    const targetLayer = fileLayer.get(targetPath);
    const sourceGroupForRule = sourceLayer || UNLAYERED;
    if (sourceLayer && targetLayer && sourceLayer !== targetLayer) {
      const ca = caFiles.get(targetLayer);
      if (ca) {
        if (sourceLayer !== targetLayer)
          ca.add(sourcePath);
      }
      const ce = ceFiles.get(sourceLayer);
      if (ce)
        ce.add(targetPath);
      const out2 = adjacency.get(sourceLayer);
      if (out2)
        out2.add(targetLayer);
    }
    for (const rule of denyRules) {
      if (rule.from !== sourceGroupForRule)
        continue;
      const targetGroup = targetLayer || UNLAYERED;
      const denied = rule.deny.some((entry) => entry === targetGroup || entry === "*" && !!targetLayer);
      if (!denied)
        continue;
      if (targetLayer === sourceLayer)
        continue;
      addViolation(
        rule.id,
        "deny",
        rule.severity,
        sourcePath,
        targetPath,
        type,
        sourceLayer || UNLAYERED,
        targetGroup,
        sourceLayer,
        targetLayer
      );
    }
    for (const matcher of slicesMatchers) {
      const sourceMatch = matcher.regexp.exec(sourcePath);
      const targetMatch = matcher.regexp.exec(targetPath);
      if (!sourceMatch || !targetMatch)
        continue;
      const sourceSlice = sourceMatch[1];
      const targetSlice = targetMatch[1];
      if (sourceSlice === targetSlice)
        continue;
      if (matchesAny(targetPath, matcher.shared))
        continue;
      addViolation(
        matcher.rule.id,
        "slices",
        matcher.rule.severity,
        sourcePath,
        targetPath,
        type,
        sourceSlice,
        targetSlice
      );
    }
  }
  const violations = Array.from(violationMap.values()).map((v) => ({
    ...v,
    linkTypes: v.linkTypes.slice().sort(),
    baselined: baselineKeys.has(baselineKey(v.ruleId, v.source, v.target))
  })).sort((a, b) => {
    const keyA = a.ruleId + "\0" + a.source + "\0" + a.target;
    const keyB = b.ruleId + "\0" + b.source + "\0" + b.target;
    return keyA.localeCompare(keyB);
  });
  const newViolations = violations.filter((v) => !v.baselined);
  const filesByLayer = /* @__PURE__ */ new Map();
  for (const layer of fileLayer.values()) {
    filesByLayer.set(layer, (filesByLayer.get(layer) || 0) + 1);
  }
  const layerStats = rules.layers.map((layer) => {
    const violationsForLayer = violations.filter((v) => v.sourceLayer === layer.name);
    const newForLayer = violationsForLayer.filter((v) => !v.baselined);
    const ca = caFiles.get(layer.name)?.size || 0;
    const ce = ceFiles.get(layer.name)?.size || 0;
    const total = ca + ce;
    return {
      name: layer.name,
      paths: layer.paths.slice(),
      files: filesByLayer.get(layer.name) || 0,
      ca,
      ce,
      instability: total > 0 ? ce / total : null,
      violations: violationsForLayer.length,
      newViolations: newForLayer.length,
      baselined: violationsForLayer.length - newForLayer.length,
      errors: newForLayer.filter((v) => v.severity === "error").length,
      warnings: newForLayer.filter((v) => v.severity === "warn").length
    };
  });
  const layerCycles = [];
  for (const rule of rules.rules) {
    if (rule.kind !== "no-cycles")
      continue;
    for (const component of layerCycleComponents(adjacency)) {
      layerCycles.push({ ruleId: rule.id, severity: rule.severity, layers: component });
    }
  }
  const baselinedCount = violations.length - newViolations.length;
  const evaluation = {
    rules: {
      layerNames: rules.layers.map((l) => l.name),
      ruleCount: rules.rules.length,
      denyCount: denyRules.length,
      slicesCount: rules.rules.filter((r) => r.kind === "slices").length,
      noCyclesCount: rules.rules.filter((r) => r.kind === "no-cycles").length,
      exceptionCount: rules.exceptions.length,
      strict: rules.strict,
      edgeTypes: rules.edgeTypes.slice()
    },
    layers: layerStats,
    violations,
    newViolations,
    counts: {
      errors: newViolations.filter((v) => v.severity === "error").length,
      warnings: newViolations.filter((v) => v.severity === "warn").length,
      total: violations.length,
      baselined: baselinedCount,
      newTotal: newViolations.length,
      newErrors: newViolations.filter((v) => v.severity === "error").length,
      newWarnings: newViolations.filter((v) => v.severity === "warn").length
    },
    layerCycles,
    unlayeredFiles: allUnlayeredFiles.slice(0, 500),
    unlayeredTotal: allUnlayeredFiles.length,
    configured: rules.layers.length > 0 && rules.rules.length > 0
  };
  return evaluation;
}
function applyArchitecture(nodes, links, evaluation, rules) {
  if (rules)
    applyLayerAssignments(nodes, rules);
  const newCountByPath = /* @__PURE__ */ new Map();
  for (const violation of evaluation.newViolations) {
    newCountByPath.set(violation.source, (newCountByPath.get(violation.source) || 0) + 1);
  }
  for (const node of nodes) {
    if (node.language === "documentation") {
      delete node.layer;
      delete node.archViolations;
      continue;
    }
    const path5 = normalizeArchPath(node.path || node.id);
    const count = newCountByPath.get(path5);
    if (count)
      node.archViolations = count;
    else
      delete node.archViolations;
  }
  const bestByPair = /* @__PURE__ */ new Map();
  const severityRank = { warn: 1, error: 2 };
  for (const violation of evaluation.violations) {
    const key = violation.source + "\0" + violation.target;
    const candidate = {
      ruleId: violation.ruleId,
      severity: violation.severity,
      baselined: violation.baselined,
      linkTypes: violation.linkTypes
    };
    const previous = bestByPair.get(key);
    if (!previous) {
      bestByPair.set(key, candidate);
      continue;
    }
    if (previous.baselined && !candidate.baselined) {
      bestByPair.set(key, candidate);
    } else if (previous.baselined === candidate.baselined && severityRank[candidate.severity] > severityRank[previous.severity]) {
      bestByPair.set(key, candidate);
    }
  }
  for (const link of links) {
    const { source, target } = linkEnds(link);
    const best = bestByPair.get(source + "\0" + target);
    const type = (link.type || "").toLowerCase();
    const applies = !!best && (!type || !best.linkTypes || best.linkTypes.indexOf(type) !== -1);
    if (applies && best)
      link.archViolation = { ...best };
    else
      delete link.archViolation;
  }
}
function applyLayerAssignments(nodes, rules) {
  const exceptionMatchers = compileGlobs(rules.exceptions);
  const layerMatchers = rules.layers.map((layer) => ({
    layer,
    regexps: compileGlobs(layer.paths)
  }));
  for (const node of nodes) {
    if (node.language === "documentation") {
      delete node.layer;
      continue;
    }
    const path5 = normalizeArchPath(node.path || node.id);
    if (matchesAny(path5, exceptionMatchers)) {
      delete node.layer;
      continue;
    }
    let assigned;
    for (const matcher of layerMatchers) {
      if (matchesAny(path5, matcher.regexps)) {
        assigned = matcher.layer.name;
        break;
      }
    }
    if (assigned)
      node.layer = assigned;
    else
      delete node.layer;
  }
}

// src/annotations.ts
var NOTE_COLORS = {
  yellow: "#fdd835",
  red: "#ef5350",
  blue: "#42a5f5",
  green: "#66bb6a",
  purple: "#ab47bc"
};
var DEFAULT_NOTE_COLOR = "yellow";
var MAX_NOTE_LENGTH = 2e3;
function normalizeNoteColor(value) {
  return typeof value === "string" && value in NOTE_COLORS ? value : DEFAULT_NOTE_COLOR;
}
function cleanText(text) {
  return typeof text === "string" ? text.trim().slice(0, MAX_NOTE_LENGTH) : "";
}
function parseAnnotations(raw) {
  if (!raw)
    return {};
  try {
    const data = JSON.parse(raw);
    const notes = data && typeof data === "object" ? data.notes : void 0;
    if (!notes || typeof notes !== "object")
      return {};
    const out2 = {};
    for (const [key, value] of Object.entries(notes)) {
      const rec = value;
      const text = cleanText(rec.text);
      if (!text)
        continue;
      out2[key] = {
        text,
        color: normalizeNoteColor(rec.color),
        updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : ""
      };
    }
    return out2;
  } catch {
    return {};
  }
}
function serializeAnnotations(map) {
  return JSON.stringify({ version: 1, notes: map }, null, 2) + "\n";
}
function withNote(map, path5, text, color, now = /* @__PURE__ */ new Date()) {
  const cleaned = cleanText(text);
  if (!cleaned)
    return withoutNote(map, path5);
  return {
    ...map,
    [path5]: { text: cleaned, color: normalizeNoteColor(color), updatedAt: now.toISOString() }
  };
}
function withoutNote(map, path5) {
  if (!(path5 in map))
    return map;
  const next = { ...map };
  delete next[path5];
  return next;
}

// src/export/save.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
function workspaceFolder() {
  return vscode.workspace.workspaceFolders?.[0];
}
async function writeFile(target, content) {
  const parent = vscode.Uri.file(path.dirname(target.fsPath));
  await vscode.workspace.fs.createDirectory(parent);
  await vscode.workspace.fs.writeFile(target, typeof content === "string" ? Buffer.from(content, "utf-8") : content);
}
async function notifySaved(kind, target) {
  const relative7 = vscode.workspace.asRelativePath(target, false);
  const choice = await vscode.window.showInformationMessage(`Aura: ${kind} saved to ${relative7}`, "Open");
  if (choice === "Open") {
    await vscode.commands.executeCommand("vscode.open", target);
  }
}
async function saveTo(target, kind, content, notify) {
  await writeFile(target, content);
  if (notify)
    await notifySaved(kind, target);
  return target;
}
async function saveText(kind, content, options) {
  const ws = workspaceFolder();
  if (!ws) {
    void vscode.window.showWarningMessage("Aura: No workspace folder open.");
    return void 0;
  }
  const defaultUri = options.askLocation ? vscode.Uri.joinPath(ws.uri, options.fileName) : vscode.Uri.joinPath(ws.uri, ".aura", options.fileName);
  let target = defaultUri;
  if (options.askLocation) {
    const selected = await vscode.window.showSaveDialog({
      defaultUri,
      filters: options.filters,
      saveLabel: "Save"
    });
    if (!selected)
      return void 0;
    target = selected;
  }
  return saveTo(target, kind, content, options.notify !== false);
}
async function copyText(kind, content) {
  await vscode.env.clipboard.writeText(content);
  void vscode.window.showInformationMessage(`Aura: ${kind} copied to clipboard`);
}
async function saveOrCopyText(kind, content, fileName, filters) {
  const choice = await vscode.window.showQuickPick(
    [
      { label: "$(save) Save\u2026", description: "Choose a file name and location", action: "save" },
      { label: "$(clippy) Copy to clipboard", description: "Paste into a document or chat", action: "copy" }
    ],
    { placeHolder: `Aura: export ${kind}` }
  );
  if (!choice)
    return void 0;
  if (choice.action === "copy") {
    await copyText(kind, content);
    return void 0;
  }
  return saveText(kind, content, { fileName, filters, askLocation: true });
}
async function saveBinary(kind, data, fileName, filters) {
  const ws = workspaceFolder();
  if (!ws) {
    void vscode.window.showWarningMessage("Aura: No workspace folder open.");
    return void 0;
  }
  const target = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.joinPath(ws.uri, ".aura", fileName),
    filters,
    saveLabel: "Save"
  });
  if (!target)
    return void 0;
  return saveTo(target, kind, data, true);
}

// src/warps.ts
var MAX_WARP_NAME = 60;
var MAX_WARPS = 100;
var QUICK_SLOT_COUNT = 9;
var MIN_FOV = 15;
var MAX_FOV = 120;
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function normalizeVec3(value) {
  if (!value || typeof value !== "object")
    return null;
  const rec = value;
  if (!isFiniteNumber(rec.x) || !isFiniteNumber(rec.y) || !isFiniteNumber(rec.z))
    return null;
  return { x: rec.x, y: rec.y, z: rec.z };
}
function normalizeQuat(value) {
  if (!value || typeof value !== "object")
    return void 0;
  const rec = value;
  if (!isFiniteNumber(rec.x) || !isFiniteNumber(rec.y) || !isFiniteNumber(rec.z) || !isFiniteNumber(rec.w)) {
    return void 0;
  }
  const len = Math.hypot(rec.x, rec.y, rec.z, rec.w);
  if (!(len > 1e-6))
    return void 0;
  return { x: rec.x / len, y: rec.y / len, z: rec.z / len, w: rec.w / len };
}
function normalizeUnitVec3(value) {
  const v = normalizeVec3(value);
  if (!v)
    return void 0;
  const len = Math.hypot(v.x, v.y, v.z);
  if (!(len > 1e-6))
    return void 0;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
function normalizeWarpName(value, fallback = "Warp") {
  if (typeof value !== "string")
    return fallback;
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, MAX_WARP_NAME);
  return cleaned || fallback;
}
function normalizeQuickSlot(value) {
  if (!isFiniteNumber(value))
    return void 0;
  const slot = Math.round(value);
  return slot >= 1 && slot <= QUICK_SLOT_COUNT ? slot : void 0;
}
function normalizeFov(value) {
  if (!isFiniteNumber(value) || value <= 0)
    return void 0;
  return Math.min(MAX_FOV, Math.max(MIN_FOV, value));
}
function normalizeAnchor(value) {
  if (!value || typeof value !== "object")
    return void 0;
  const rec = value;
  const id = typeof rec.id === "string" ? rec.id.trim() : "";
  if (!id)
    return void 0;
  const pos = normalizeVec3(rec.pos);
  const posOffset = normalizeVec3(rec.posOffset);
  const targetOffset = normalizeVec3(rec.targetOffset);
  if (!pos || !posOffset || !targetOffset)
    return void 0;
  const anchor = { id, pos, posOffset, targetOffset };
  if (isFiniteNumber(rec.scaleRef) && rec.scaleRef > 0)
    anchor.scaleRef = rec.scaleRef;
  return anchor;
}
function generateWarpId(now = Date.now()) {
  return "w_" + now.toString(36) + Math.random().toString(36).slice(2, 6);
}
function makeWarp(value, now = Date.now(), fallbackName = "Warp") {
  if (!value || typeof value !== "object")
    return null;
  const rec = value;
  const pos = normalizeVec3(rec.pos);
  const target = normalizeVec3(rec.target);
  if (!pos || !target)
    return null;
  const createdAt = isFiniteNumber(rec.createdAt) ? rec.createdAt : now;
  return {
    id: typeof rec.id === "string" && rec.id ? rec.id : generateWarpId(now),
    name: normalizeWarpName(rec.name, fallbackName),
    pos,
    target,
    quat: normalizeQuat(rec.quat),
    up: normalizeUnitVec3(rec.up),
    fov: normalizeFov(rec.fov),
    anchor: normalizeAnchor(rec.anchor),
    quickSlot: normalizeQuickSlot(rec.quickSlot),
    createdAt,
    updatedAt: isFiniteNumber(rec.updatedAt) ? rec.updatedAt : now
  };
}
function normalizeWarp(value, index = 0, now = Date.now()) {
  return makeWarp(value, now, "Warp " + (index + 1));
}
function parseWarps(raw) {
  if (!raw)
    return [];
  try {
    const data = JSON.parse(raw);
    const entries = Array.isArray(data) ? data : data && typeof data === "object" ? data.warps : void 0;
    if (!Array.isArray(entries))
      return [];
    const out2 = [];
    const seen = /* @__PURE__ */ new Set();
    for (let i = 0; i < entries.length && out2.length < MAX_WARPS; i++) {
      const warp = normalizeWarp(entries[i], i);
      if (!warp || seen.has(warp.id))
        continue;
      seen.add(warp.id);
      out2.push(warp);
    }
    return out2;
  } catch {
    return [];
  }
}
function serializeWarps(list) {
  return JSON.stringify({ version: 1, warps: list }, null, 2) + "\n";
}
function releaseQuickSlot(list, slot, keepId) {
  if (slot === void 0)
    return list;
  let changed = false;
  const next = list.map((warp) => {
    if (warp.quickSlot === slot && warp.id !== keepId) {
      changed = true;
      return { ...warp, quickSlot: void 0 };
    }
    return warp;
  });
  return changed ? next : list;
}
function upsertWarp(list, warp) {
  let next = releaseQuickSlot(list, warp.quickSlot, warp.id);
  const index = next.findIndex((w) => w.id === warp.id);
  if (index >= 0) {
    next = next.slice();
    next[index] = warp;
    return next;
  }
  if (next.length >= MAX_WARPS) {
    let oldest = 0;
    for (let i = 1; i < next.length; i++) {
      if (next[i].createdAt < next[oldest].createdAt)
        oldest = i;
    }
    next = next.slice();
    next.splice(oldest, 1);
  }
  return next.concat([warp]);
}
function removeWarp(list, id) {
  const index = list.findIndex((w) => w.id === id);
  if (index < 0)
    return list;
  const next = list.slice();
  next.splice(index, 1);
  return next;
}

// src/webview/WebviewProvider.ts
var SETTING_NORMALIZERS = {
  linkStyle: (v) => v === "curved" ? "curved" : "straight",
  linkCurvature: (v) => clampNumber(v, 0, 1, 0.25),
  selectedNodeEffect: (v) => v === "bloom" ? "bloom" : "glow",
  bloomStrength: (v) => clampNumber(v, 0, 5, 1.2),
  bloomRadius: (v) => clampNumber(v, 0, 2, 0.6),
  bloomThreshold: (v) => clampNumber(v, 0, 1, 0),
  riskWindow: (v) => normalizeRiskWindow(v),
  riskCentrality: (v) => v === true,
  complexityTrendThreshold: (v) => clampNumber(v, 0, 20, 0.5),
  rotateSpeed: (v) => clampNumber(v, 1, 5, 1),
  flightSpeed: (v) => clampNumber(v, 0.25, 4, 1),
  flightSmoothing: (v) => clampNumber(v, 0.02, 0.5, 0.12),
  mouseSensitivity: (v) => clampNumber(v, 5e-4, 0.01, 22e-4),
  invertY: (v) => v === true,
  gamepadEnabled: (v) => v !== false,
  codeLens: (v) => v !== false,
  autoRefresh: (v) => v === true,
  followEditor: (v) => v === true
};
function clampNumber(value, min, max, fallback) {
  return typeof value === "number" && isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
function normalizeRotateSpeed(value) {
  return typeof value === "number" && isFinite(value) ? Math.min(5, Math.max(1, value)) : 1;
}
var WebviewProvider = class _WebviewProvider {
  static viewType = "auraVisualizer.graphView";
  panel;
  extensionUri;
  workspaceState;
  disposables = [];
  onOpenFileEmitter = new vscode2.EventEmitter();
  onOpenFile = this.onOpenFileEmitter.event;
  onDisposeEmitter = new vscode2.EventEmitter();
  onDidDispose = this.onDisposeEmitter.event;
  pendingData;
  pendingHistoryIndex;
  pendingDeltas = [];
  pendingFocus;
  pendingNodeFocus;
  pendingFollowEditor;
  pendingShowRiskTab = false;
  pendingShowArchTab = false;
  pendingArchFocus;
  pendingQuery;
  pendingBlastRadius;
  pendingFlow;
  webviewReady = false;
  /**
   * True once the webview reported that a graph was actually rendered.
   * Focus / blast / flowchart messages need the ForceGraph3D instance, so they
   * are queued until then (cold start: the panel opens before the analysis
   * finishes, and the action used to be dropped).
   */
  graphReady = false;
  static VIEW_STATE_KEY = "aura.viewState";
  getGraphDB;
  getHostData;
  constructor(extensionUri, workspaceState, getGraphDB = () => void 0, getHostData = {}) {
    this.extensionUri = extensionUri;
    this.workspaceState = workspaceState;
    this.getGraphDB = getGraphDB;
    this.getHostData = getHostData;
  }
  show() {
    if (this.panel) {
      this.panel.reveal(vscode2.ViewColumn.One);
      return this.panel;
    }
    this.panel = vscode2.window.createWebviewPanel(
      _WebviewProvider.viewType,
      "Aura \u2014 3D Visualizer",
      vscode2.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode2.Uri.joinPath(this.extensionUri, "out", "webview")
        ]
      }
    );
    this.initPanel();
    return this.panel;
  }
  restore(panel) {
    this.panel = panel;
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode2.Uri.joinPath(this.extensionUri, "out", "webview")
      ]
    };
    this.initPanel();
  }
  initPanel() {
    if (!this.panel)
      return;
    this.webviewReady = false;
    this.graphReady = false;
    this.panel.iconPath = vscode2.Uri.joinPath(this.extensionUri, "resources", "aura-star-icon.png");
    this.panel.webview.html = this.getHtmlContent(this.panel.webview);
    this.setupMessageHandler();
    this.panel.onDidDispose(() => {
      this.panel = void 0;
      this.webviewReady = false;
      this.graphReady = false;
      this.pendingDeltas = [];
      this.pendingNodeFocus = void 0;
      this.pendingFollowEditor = void 0;
      this.pendingShowRiskTab = false;
      this.pendingShowArchTab = false;
      this.pendingArchFocus = void 0;
      this.pendingQuery = void 0;
      this.pendingBlastRadius = void 0;
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
      this.onDisposeEmitter.fire();
    });
  }
  setupMessageHandler() {
    if (!this.panel)
      return;
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "ready":
            this.webviewReady = true;
            this.sendSettings();
            if (this.pendingData) {
              this.panel?.webview.postMessage({ type: "graphData", payload: this.pendingData });
            }
            if (this.pendingHistoryIndex) {
              this.panel?.webview.postMessage({ type: "historyIndex", payload: this.pendingHistoryIndex });
            }
            for (const delta of this.pendingDeltas) {
              this.panel?.webview.postMessage({ type: "historyDelta", payload: delta });
            }
            if (this.pendingFocus) {
              this.panel?.webview.postMessage({ type: "riskFocusFile", payload: { nodeId: this.pendingFocus } });
              this.pendingFocus = void 0;
            }
            if (this.pendingShowRiskTab) {
              this.panel?.webview.postMessage({ type: "showRiskTab" });
              this.pendingShowRiskTab = false;
            }
            if (this.pendingShowArchTab) {
              this.panel?.webview.postMessage({ type: "showArchTab" });
              this.pendingShowArchTab = false;
            }
            if (this.pendingArchFocus) {
              this.panel?.webview.postMessage({ type: "archFocusFile", payload: { nodeId: this.pendingArchFocus } });
              this.pendingArchFocus = void 0;
            }
            if (this.pendingQuery) {
              this.panel?.webview.postMessage({ type: "applyQuery", payload: this.pendingQuery });
              this.pendingQuery = void 0;
            }
            const workingTree = this.getHostData.workingTree?.();
            if (workingTree) {
              this.panel?.webview.postMessage({ type: "workingTree", payload: { files: workingTree } });
            }
            void this.sendAnnotations();
            void this.sendWarps();
            this.flushPendingFlow();
            break;
          case "graphRendered":
            this.graphReady = true;
            this.flushGraphActions();
            break;
          case "openFile":
            if (message.payload) {
              this.onOpenFileEmitter.fire({
                path: message.payload.path,
                line: message.payload.line
              });
            }
            break;
          case "askAura":
            if (message.payload) {
              void vscode2.commands.executeCommand("auraVisualizer.askAura", message.payload);
            }
            break;
          case "requestRefresh":
            vscode2.commands.executeCommand("auraVisualizer.refresh");
            break;
          case "requestExport":
            vscode2.commands.executeCommand("auraVisualizer.exportGraph");
            break;
          case "requestExportImage":
            void vscode2.commands.executeCommand("auraVisualizer.exportImage");
            break;
          case "exportImageData":
            if (message.payload && typeof message.payload.dataUrl === "string") {
              void this.handleExportImageData(message.payload.dataUrl);
            }
            break;
          case "exportImageError":
            if (message.payload && typeof message.payload.message === "string") {
              void vscode2.window.showWarningMessage("Aura: PNG export failed \u2014 " + message.payload.message);
            }
            break;
          case "saveViewState":
            if (message.payload) {
              this.workspaceState.update(_WebviewProvider.VIEW_STATE_KEY, message.payload);
            }
            break;
          case "renameCommunity": {
            const p = message.payload || {};
            const db = this.getGraphDB();
            if (db && p.key) {
              db.setCommunityLabel(p.key, typeof p.label === "string" ? p.label : "");
              const communities = db.getCommunitySnapshot();
              if (this.pendingData)
                this.pendingData.meta.communities = communities;
              this.panel?.webview.postMessage({ type: "communities", payload: { communities } });
            }
            break;
          }
          case "requestViewState":
            this.sendSavedViewState();
            break;
          case "requestArchRules":
            void this.sendArchRules();
            break;
          case "openDeadCodeRulesFile":
            void vscode2.commands.executeCommand("auraVisualizer.deadCodeRules");
            break;
          case "saveArchRules": {
            const p = message.payload || {};
            void this.handleSaveArchRules(typeof p.text === "string" ? p.text : "");
            break;
          }
          case "openArchRulesFile":
            void vscode2.commands.executeCommand("auraVisualizer.archRules");
            break;
          case "createArchBaseline":
            void vscode2.commands.executeCommand("auraVisualizer.baselineArch");
            break;
          case "resetArchBaseline":
            void vscode2.commands.executeCommand("auraVisualizer.resetArchBaseline");
            break;
          case "exportArchViolations": {
            const p = message.payload || {};
            if (p.markdown)
              void this.handleExportArchViolations(p.markdown);
            break;
          }
          case "exportParseFailures": {
            const p = message.payload || {};
            if (p.markdown)
              void this.handleExportParseFailures(p.markdown);
            break;
          }
          case "requestDeadCodeRules":
            void this.sendDeadCodeRules();
            break;
          case "saveDeadCodeRules": {
            const p = message.payload || {};
            void this.handleSaveDeadCodeRules(typeof p.text === "string" ? p.text : "");
            break;
          }
          case "requestSavedQueries": {
            const db = this.getGraphDB();
            let queries = [];
            if (db) {
              try {
                queries = db.listSavedQueries().map((q) => ({ id: q.id, name: q.name, expr: q.expr, mode: q.mode, createdAt: q.createdAt }));
              } catch (err2) {
                console.error("[aura] listSavedQueries failed:", err2);
              }
            }
            this.panel?.webview.postMessage({ type: "savedQueries", payload: { queries } });
            break;
          }
          case "addSavedQuery": {
            const db = this.getGraphDB();
            const p = message.payload || {};
            if (db && p.expr) {
              const name = p.name || (p.expr.length > 50 ? p.expr.slice(0, 47) + "..." : p.expr);
              const id = p.id || "q_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
              db.addSavedQuery({ id, name, expr: p.expr, mode: p.mode || "highlight" });
              const queries = db.listSavedQueries().map((q) => ({ id: q.id, name: q.name, expr: q.expr, mode: q.mode, createdAt: q.createdAt }));
              this.panel?.webview.postMessage({ type: "savedQueries", payload: { queries } });
            }
            break;
          }
          case "deleteSavedQuery": {
            const db = this.getGraphDB();
            const p = message.payload || {};
            if (db && p.id) {
              db.deleteSavedQuery(p.id);
              const queries = db.listSavedQueries().map((q) => ({ id: q.id, name: q.name, expr: q.expr, mode: q.mode, createdAt: q.createdAt }));
              this.panel?.webview.postMessage({ type: "savedQueries", payload: { queries } });
            }
            break;
          }
          case "exportRiskReport": {
            const p = message.payload || {};
            if (p.markdown) {
              void this.handleExportRiskReport(p.markdown);
            }
            break;
          }
          case "updateSetting": {
            const p = message.payload || {};
            const normalize3 = p.key ? SETTING_NORMALIZERS[p.key] : void 0;
            if (p.key && normalize3) {
              const config = vscode2.workspace.getConfiguration("auraVisualizer");
              void config.update(p.key, normalize3(p.value), vscode2.ConfigurationTarget.Workspace).then(
                void 0,
                () => {
                }
              );
            }
            break;
          }
          case "openSettings":
            void vscode2.commands.executeCommand("workbench.action.openSettings", "@ext:monticma-aura.aura-visualizer-3D");
            break;
          case "saveNote": {
            const p = message.payload || {};
            if (p.path) {
              void this.handleSaveNote(p.path, p.text || "", p.color);
            }
            break;
          }
          case "deleteNote": {
            const p = message.payload || {};
            if (p.path) {
              void this.handleDeleteNote(p.path);
            }
            break;
          }
          case "saveWarp": {
            const p = message.payload || {};
            if (p.warp) {
              void this.handleSaveWarp(p.warp);
            }
            break;
          }
          case "deleteWarp": {
            const p = message.payload || {};
            if (p.id) {
              void this.handleDeleteWarp(p.id);
            }
            break;
          }
          case "requestFlow": {
            const p = message.payload || {};
            if (p.fileId && typeof p.line === "number" && p.language) {
              void this.handleFlowRequest(p.fileId, p.line, p.language);
            }
            break;
          }
        }
      },
      null,
      this.disposables
    );
  }
  async handleExportRiskReport(markdown2) {
    try {
      await saveOrCopyText("Risk report", markdown2, "risk-report.md", { Markdown: ["md"] });
    } catch (err2) {
      vscode2.window.showErrorMessage(
        "Aura: Failed to export risk report: " + (err2 instanceof Error ? err2.message : String(err2))
      );
    }
  }
  async handleExportArchViolations(markdown2) {
    try {
      await saveOrCopyText("Architecture violations", markdown2, "arch-violations.md", { Markdown: ["md"] });
    } catch (err2) {
      vscode2.window.showErrorMessage(
        "Aura: Failed to export the architecture report: " + (err2 instanceof Error ? err2.message : String(err2))
      );
    }
  }
  async handleExportParseFailures(markdown2) {
    try {
      await saveOrCopyText("Parse failures report", markdown2, "parse-failures.md", { Markdown: ["md"] });
    } catch (err2) {
      vscode2.window.showErrorMessage(
        "Aura: Failed to export the parse failures report: " + (err2 instanceof Error ? err2.message : String(err2))
      );
    }
  }
  async handleExportImageData(dataUrl) {
    try {
      const comma = dataUrl.indexOf(",");
      if (comma < 0)
        throw new Error("Invalid PNG data URL");
      const data = Buffer.from(dataUrl.slice(comma + 1), "base64");
      const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
      await saveBinary("Graph image", data, `aura-graph-${stamp}.png`, { PNG: ["png"] });
    } catch (err2) {
      void vscode2.window.showErrorMessage(
        "Aura: Failed to save PNG: " + (err2 instanceof Error ? err2.message : String(err2))
      );
    }
  }
  // ============================================================
  // Node notes (annotations) — .aura/annotations.json
  // ============================================================
  /** Push the current note map to the webview (safe when not ready yet). */
  async sendAnnotations() {
    const notes = await this.loadAnnotations();
    this.panel?.webview.postMessage({ type: "annotations", payload: { notes } });
  }
  // ============================================================
  // Architecture rules — .aura/arch-rules.json
  // ============================================================
  archRulesFileUri() {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    return ws ? vscode2.Uri.joinPath(ws.uri, ...ARCH_RULES_FILE.split("/")) : void 0;
  }
  async sendArchRules() {
    const file = this.archRulesFileUri();
    if (!file) {
      this.panel?.webview.postMessage({ type: "archRules", payload: { text: "", exists: false } });
      return;
    }
    try {
      const buf = await vscode2.workspace.fs.readFile(file);
      this.panel?.webview.postMessage({
        type: "archRules",
        payload: { text: Buffer.from(buf).toString("utf-8"), exists: true }
      });
    } catch {
      this.panel?.webview.postMessage({ type: "archRules", payload: { text: "", exists: false } });
    }
  }
  async handleSaveArchRules(text) {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    const file = this.archRulesFileUri();
    if (!ws || !file) {
      this.panel?.webview.postMessage({
        type: "archRulesError",
        payload: { message: "Open a workspace folder before editing architecture rules." }
      });
      return;
    }
    const normalized = text.trim() ? text : "{}\n";
    try {
      parseArchRules(normalized);
      await vscode2.workspace.fs.createDirectory(vscode2.Uri.joinPath(ws.uri, ".aura"));
      await vscode2.workspace.fs.writeFile(file, Buffer.from(normalized, "utf-8"));
      this.panel?.webview.postMessage({ type: "archRulesSaved", payload: { text: normalized } });
      void vscode2.commands.executeCommand("auraVisualizer.reloadArchRules");
    } catch (err2) {
      this.panel?.webview.postMessage({
        type: "archRulesError",
        payload: { message: err2 instanceof Error ? err2.message : String(err2) }
      });
    }
  }
  // ============================================================
  // Dead-code exemption rules — .aura/dead-code.json
  // ============================================================
  deadCodeRulesFileUri() {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    return ws ? vscode2.Uri.joinPath(ws.uri, ".aura", "dead-code.json") : void 0;
  }
  async sendDeadCodeRules() {
    const file = this.deadCodeRulesFileUri();
    if (!file) {
      this.panel?.webview.postMessage({ type: "deadCodeRules", payload: { text: "", exists: false } });
      return;
    }
    try {
      const buf = await vscode2.workspace.fs.readFile(file);
      this.panel?.webview.postMessage({ type: "deadCodeRules", payload: { text: Buffer.from(buf).toString("utf-8"), exists: true } });
    } catch {
      this.panel?.webview.postMessage({ type: "deadCodeRules", payload: { text: "", exists: false } });
    }
  }
  async handleSaveDeadCodeRules(text) {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    const file = this.deadCodeRulesFileUri();
    if (!ws || !file) {
      this.panel?.webview.postMessage({ type: "deadCodeRulesError", payload: { message: "Open a workspace folder before editing dead-code rules." } });
      return;
    }
    const normalized = text.trim() ? text : '{\n  "rules": []\n}';
    try {
      parseDeadCodeRules(normalized);
      await vscode2.workspace.fs.createDirectory(vscode2.Uri.joinPath(ws.uri, ".aura"));
      await vscode2.workspace.fs.writeFile(file, Buffer.from(normalized, "utf-8"));
      this.panel?.webview.postMessage({ type: "deadCodeRulesSaved", payload: { text: normalized } });
      void vscode2.commands.executeCommand("auraVisualizer.refresh");
    } catch (err2) {
      this.panel?.webview.postMessage({
        type: "deadCodeRulesError",
        payload: { message: err2 instanceof Error ? err2.message : String(err2) }
      });
    }
  }
  annotationsFileUri() {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    if (!ws)
      return void 0;
    return vscode2.Uri.joinPath(ws.uri, ".aura", "annotations.json");
  }
  async loadAnnotations() {
    const file = this.annotationsFileUri();
    if (!file)
      return {};
    try {
      const buf = await vscode2.workspace.fs.readFile(file);
      return parseAnnotations(Buffer.from(buf).toString("utf-8"));
    } catch {
      return {};
    }
  }
  async persistAnnotations(map) {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    if (!ws)
      return;
    const dir = vscode2.Uri.joinPath(ws.uri, ".aura");
    await vscode2.workspace.fs.createDirectory(dir);
    await vscode2.workspace.fs.writeFile(
      vscode2.Uri.joinPath(dir, "annotations.json"),
      Buffer.from(serializeAnnotations(map), "utf-8")
    );
  }
  async handleSaveNote(path5, text, color) {
    try {
      const map = withNote(await this.loadAnnotations(), path5, text, color);
      await this.persistAnnotations(map);
      await this.sendAnnotations();
    } catch (err2) {
      console.error("[aura] saveNote failed:", err2);
    }
  }
  async handleDeleteNote(path5) {
    try {
      const map = withoutNote(await this.loadAnnotations(), path5);
      await this.persistAnnotations(map);
      await this.sendAnnotations();
    } catch (err2) {
      console.error("[aura] deleteNote failed:", err2);
    }
  }
  // ============================================================
  // Warp points (camera bookmarks) — .aura/warps.json
  // ============================================================
  /** Push the current warp list to the webview (safe when not ready yet). */
  async sendWarps() {
    const warps = await this.loadWarps();
    this.panel?.webview.postMessage({ type: "warps", payload: { warps } });
  }
  warpsFileUri() {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    if (!ws)
      return void 0;
    return vscode2.Uri.joinPath(ws.uri, ".aura", "warps.json");
  }
  async loadWarps() {
    const file = this.warpsFileUri();
    if (!file)
      return [];
    try {
      const buf = await vscode2.workspace.fs.readFile(file);
      return parseWarps(Buffer.from(buf).toString("utf-8"));
    } catch {
      return [];
    }
  }
  async persistWarps(list) {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    if (!ws)
      return;
    const dir = vscode2.Uri.joinPath(ws.uri, ".aura");
    await vscode2.workspace.fs.createDirectory(dir);
    await vscode2.workspace.fs.writeFile(
      vscode2.Uri.joinPath(dir, "warps.json"),
      Buffer.from(serializeWarps(list), "utf-8")
    );
  }
  async handleSaveWarp(payload) {
    try {
      const warp = makeWarp(payload);
      if (!warp)
        return;
      const list = upsertWarp(await this.loadWarps(), warp);
      await this.persistWarps(list);
      await this.sendWarps();
    } catch (err2) {
      console.error("[aura] saveWarp failed:", err2);
    }
  }
  async handleDeleteWarp(id) {
    try {
      const list = removeWarp(await this.loadWarps(), id);
      await this.persistWarps(list);
      await this.sendWarps();
    } catch (err2) {
      console.error("[aura] deleteWarp failed:", err2);
    }
  }
  // ============================================================
  // Function flowcharts — on-demand, computed in the analyzer worker
  // ============================================================
  /** mtime-aware cache — a flowchart is only recomputed when the file changed. */
  flowCache = /* @__PURE__ */ new Map();
  async handleFlowRequest(fileId, line, language) {
    let flow = null;
    let error;
    try {
      flow = await this.runFlowRequest(fileId, line, language);
    } catch (err2) {
      error = err2 instanceof Error ? err2.message : String(err2);
      console.error("[aura] requestFlow failed:", err2);
    }
    this.panel?.webview.postMessage({ type: "flowData", payload: { fileId, line, flow, error } });
  }
  async runFlowRequest(fileId, line, language) {
    const ws = vscode2.workspace.workspaceFolders?.[0];
    if (!ws || fileId.includes(".."))
      return null;
    const filePath = path2.join(ws.uri.fsPath, fileId);
    let mtimeMs = 0;
    try {
      mtimeMs = (await vscode2.workspace.fs.stat(vscode2.Uri.file(filePath))).mtime;
    } catch {
      return null;
    }
    const key = filePath + "\0" + line;
    const cached = this.flowCache.get(key);
    if (cached && cached.mtimeMs === mtimeMs)
      return cached.flow;
    const flow = await this.runFlowInWorker(filePath, language, line);
    if (this.flowCache.size >= 200) {
      const oldest = this.flowCache.keys().next().value;
      if (oldest !== void 0)
        this.flowCache.delete(oldest);
    }
    this.flowCache.set(key, { mtimeMs, flow });
    return flow;
  }
  runFlowInWorker(filePath, language, line) {
    return new Promise((resolve2, reject) => {
      const workerPath = path2.join(this.extensionUri.fsPath, "out", "analyzer-worker.js");
      const worker = new import_worker_threads.Worker(workerPath, {
        // Don't inherit the debugger's --inspect flag: worker_threads copy
        // process.execArgv, so under the extension debugger they try to
        // attach to the inspector and hang the extension host.
        execArgv: [],
        workerData: { flowRequest: { filePath, language, line } }
      });
      worker.on("message", (msg) => {
        if (msg.error)
          reject(new Error(msg.error));
        else
          resolve2(msg.flow ?? null);
        worker.terminate();
      });
      worker.on("error", (err2) => {
        reject(err2);
        worker.terminate();
      });
      worker.on("exit", (code) => {
        if (code !== 0)
          reject(new Error(`Flow worker exited with code ${code}`));
      });
    });
  }
  sendGraphData(data) {
    this.attachCommunities(data);
    this.pendingData = data;
    this.graphReady = false;
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "graphData", payload: data });
    }
  }
  /** Deliver the graph-dependent messages that were queued before a render. */
  flushGraphActions() {
    if (!this.panel || !this.webviewReady)
      return;
    if (this.pendingFollowEditor) {
      this.panel.webview.postMessage({ type: "followEditor", payload: { nodeId: this.pendingFollowEditor } });
      this.pendingFollowEditor = void 0;
    }
    if (this.pendingNodeFocus) {
      this.panel.webview.postMessage({ type: "focusNode", payload: this.pendingNodeFocus });
      this.pendingNodeFocus = void 0;
    }
    if (this.pendingBlastRadius) {
      this.panel.webview.postMessage({ type: "blastRadius", payload: { nodeId: this.pendingBlastRadius } });
      this.pendingBlastRadius = void 0;
    }
    this.flushPendingFlow();
  }
  /** A flowchart request only needs the webview scripts — no 3D graph. */
  flushPendingFlow() {
    if (!this.panel || !this.webviewReady || !this.pendingFlow)
      return;
    this.panel.webview.postMessage({ type: "openFlow", payload: this.pendingFlow });
    this.pendingFlow = void 0;
  }
  /**
   * Push only the architecture annotations after a rules/baseline edit.
   *
   * A full `graphData` message destroys and rebuilds the ForceGraph3D instance:
   * the force layout restarts and the camera snaps back to its default framing.
   * Evaluation only changes `layer` / `archViolations` / `archViolation`, so the
   * webview can patch those in place and keep camera + node positions intact.
   */
  sendArchUpdate(data) {
    if (!this.webviewReady)
      return;
    const nodes = [];
    for (const node of data.nodes) {
      if (node.layer === void 0 && !node.archViolations)
        continue;
      const entry = { id: node.id };
      if (node.layer !== void 0)
        entry.layer = node.layer;
      if (node.archViolations)
        entry.archViolations = node.archViolations;
      nodes.push(entry);
    }
    const links = [];
    for (const link of data.links) {
      if (!link.archViolation)
        continue;
      links.push({
        source: link.source,
        target: link.target,
        type: link.type,
        archViolation: link.archViolation
      });
    }
    this.panel?.webview.postMessage({
      type: "archUpdate",
      payload: {
        arch: data.meta.arch ?? null,
        archError: data.meta.archError ?? null,
        nodes,
        links
      }
    });
  }
  /** Every graph snapshot sent to the webview carries the DB's community snapshot. */
  attachCommunities(data) {
    const db = this.getGraphDB();
    if (!db)
      return;
    try {
      data.meta.communities = db.getCommunitySnapshot();
    } catch (err2) {
      console.warn("[aura] community snapshot failed:", err2);
    }
  }
  attachDeltaCommunities(delta) {
    const meta = delta.meta;
    if (!meta)
      return;
    const db = this.getGraphDB();
    if (!db)
      return;
    try {
      meta.communities = db.getCommunitySnapshot();
    } catch (err2) {
      console.warn("[aura] community snapshot failed:", err2);
    }
  }
  sendSavedViewState() {
    const state = this.workspaceState.get(_WebviewProvider.VIEW_STATE_KEY);
    if (state) {
      this.panel?.webview.postMessage({ type: "restoreViewState", payload: state });
    }
  }
  sendGraphDelta(delta) {
    this.attachDeltaCommunities(delta);
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "updateGraph", payload: delta });
    }
  }
  sendProgress(phase, message) {
    this.panel?.webview.postMessage({ type: "progress", payload: { phase, message } });
  }
  focusNode(nodeId, reveal = false) {
    if (this.webviewReady && this.graphReady) {
      this.panel?.webview.postMessage({ type: "focusNode", payload: { nodeId, reveal } });
    } else {
      this.pendingNodeFocus = { nodeId, reveal };
    }
  }
  /** Fly the camera to the active editor file (does not open the detail panel). */
  followEditorFile(nodeId) {
    if (this.webviewReady && this.graphReady) {
      this.panel?.webview.postMessage({ type: "followEditor", payload: { nodeId } });
    } else {
      this.pendingFollowEditor = nodeId;
    }
  }
  /**
   * Open the flowchart of a function (used by the symbol CodeLens). The
   * webview answers with a `requestFlow` message, served by
   * {@link handleFlowRequest}.
   */
  openFlow(nodeId, line, language, name) {
    const payload = { nodeId, line, language, name };
    if (this.webviewReady && this.graphReady) {
      this.panel?.webview.postMessage({ type: "openFlow", payload });
    } else {
      this.pendingFlow = payload;
    }
  }
  /** Switch the webview to the Risk tab without changing the graph. */
  showRiskTab() {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "showRiskTab" });
    } else {
      this.pendingShowRiskTab = true;
    }
  }
  /** Switch the webview to the Architecture tab without changing the graph. */
  showArchTab() {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "showArchTab" });
    } else {
      this.pendingShowArchTab = true;
    }
  }
  /** Reveal a file in the Architecture tab (expand its rule, scroll, flash). */
  focusArchFile(nodeId) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "archFocusFile", payload: { nodeId } });
    } else {
      this.pendingArchFocus = nodeId;
    }
  }
  /** Apply an AQL expression coming from @aura or a command. */
  applyQueryFromHost(expr, mode = "filter") {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "applyQuery", payload: { expr, mode } });
    } else {
      this.pendingQuery = { expr, mode };
    }
  }
  /** Reveal a file in the Risk tab (expand its bucket, scroll to the row, flash it). */
  focusRiskFile(nodeId) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "riskFocusFile", payload: { nodeId } });
    } else {
      this.pendingFocus = nodeId;
    }
  }
  /**
   * Push fresh working-tree state. No-op when the webview is not ready yet —
   * the ready handler pulls the current state through the host accessors.
   */
  sendWorkingTree(files) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "workingTree", payload: { files } });
    }
  }
  sendBlastRadius(nodeId) {
    if (this.webviewReady && this.graphReady) {
      this.panel?.webview.postMessage({ type: "blastRadius", payload: { nodeId } });
    } else {
      this.pendingBlastRadius = nodeId;
    }
  }
  /** Ask the webview to capture the current graph as a PNG. */
  captureGraphImage(options) {
    if (!this.webviewReady) {
      void vscode2.window.showWarningMessage("Aura: Open the graph before exporting a PNG.");
      return;
    }
    this.panel?.webview.postMessage({ type: "captureGraphImage", payload: options });
  }
  sendFilterDirs(dirs) {
    this.panel?.webview.postMessage({ type: "filterDirs", payload: { dirs } });
  }
  sendRefreshComplete() {
    this.panel?.webview.postMessage({ type: "refreshComplete" });
  }
  sendSettings(_settings) {
    try {
      const config = vscode2.workspace.getConfiguration("auraVisualizer");
      this.panel?.webview.postMessage({
        type: "graphConfig",
        payload: {
          linkStyle: config.get("linkStyle", "straight"),
          linkCurvature: config.get("linkCurvature", 0.25),
          selectedNodeEffect: config.get("selectedNodeEffect", "glow"),
          bloomStrength: config.get("bloomStrength", 1.2),
          bloomRadius: config.get("bloomRadius", 0.6),
          bloomThreshold: config.get("bloomThreshold", 0),
          riskWindow: normalizeRiskWindow(config.get("riskWindow", 90)),
          riskCentrality: config.get("riskCentrality", false) === true,
          complexityTrendThreshold: clampNumber(config.get("complexityTrendThreshold", 0.5), 0, 20, 0.5),
          rotateSpeed: normalizeRotateSpeed(config.get("rotateSpeed", 1)),
          flightSpeed: clampNumber(config.get("flightSpeed", 1), 0.25, 4, 1),
          flightSmoothing: clampNumber(config.get("flightSmoothing", 0.12), 0.02, 0.5, 0.12),
          mouseSensitivity: clampNumber(config.get("mouseSensitivity", 22e-4), 5e-4, 0.01, 22e-4),
          invertY: config.get("invertY", false) === true,
          gamepadEnabled: config.get("gamepadEnabled", true) !== false,
          codeLens: config.get("codeLens", true) !== false,
          autoRefresh: config.get("autoRefresh", true),
          followEditor: config.get("followEditor", true)
        }
      });
    } catch {
    }
  }
  sendTheme(kind) {
    this.panel?.webview.postMessage({
      type: "themeChanged",
      payload: { kind }
    });
  }
  sendHistoryIndex(index) {
    this.pendingHistoryIndex = index;
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "historyIndex", payload: index });
    }
  }
  sendHistoryProgress(scanned, total) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "historyProgress", payload: { scanned, total } });
    }
  }
  sendHistoryDelta(delta) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "historyDelta", payload: delta });
    } else {
      this.pendingDeltas.push(delta);
    }
  }
  get isVisible() {
    return this.panel?.visible ?? false;
  }
  /** True as soon as the panel exists, even when another editor tab is active. */
  get isOpen() {
    return this.panel !== void 0;
  }
  dispose() {
    this.panel?.dispose();
  }
  buildAuraConfig() {
    try {
      const config = vscode2.workspace.getConfiguration("auraVisualizer");
      return JSON.stringify({
        linkStyle: config.get("linkStyle", "straight"),
        linkCurvature: config.get("linkCurvature", 0.25),
        selectedNodeEffect: config.get("selectedNodeEffect", "glow"),
        bloomStrength: config.get("bloomStrength", 1.2),
        bloomRadius: config.get("bloomRadius", 0.6),
        bloomThreshold: config.get("bloomThreshold", 0),
        riskWindow: normalizeRiskWindow(config.get("riskWindow", 90)),
        riskCentrality: config.get("riskCentrality", false) === true,
        complexityTrendThreshold: clampNumber(config.get("complexityTrendThreshold", 0.5), 0, 20, 0.5),
        rotateSpeed: normalizeRotateSpeed(config.get("rotateSpeed", 1)),
        flightSpeed: clampNumber(config.get("flightSpeed", 1), 0.25, 4, 1),
        flightSmoothing: clampNumber(config.get("flightSmoothing", 0.12), 0.02, 0.5, 0.12),
        mouseSensitivity: clampNumber(config.get("mouseSensitivity", 22e-4), 5e-4, 0.01, 22e-4),
        invertY: config.get("invertY", false) === true,
        gamepadEnabled: config.get("gamepadEnabled", true) !== false,
        codeLens: config.get("codeLens", true) !== false,
        autoRefresh: config.get("autoRefresh", true),
        followEditor: config.get("followEditor", true)
      });
    } catch {
      return "{}";
    }
  }
  getHtmlContent(webview) {
    const webviewPath = path2.join("out", "webview");
    const pkgPath = path2.join(this.extensionUri.fsPath, "package.json");
    let version = "1.0.0";
    try {
      const pkg = require(pkgPath);
      version = pkg.version || version;
    } catch {
    }
    const styleUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "css", "style.css")
    );
    const appUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "app.js")
    );
    const configUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "graph-config.js")
    );
    const queryUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "query.js")
    );
    const structureUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "structure.js")
    );
    const riskUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "risk-core.js")
    );
    const archCoreUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "arch-core.js")
    );
    const archPanelUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "arch.js")
    );
    const deadCodeCoreUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "dead-code-core.js")
    );
    const deadCodeEditorUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "dead-code.js")
    );
    const flightCoreUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "flight-core.js")
    );
    const cochangeCoreUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "cochange-core.js")
    );
    const trendCoreUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "trend-core.js")
    );
    const trendUiUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "trend-ui.js")
    );
    const flightUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "flight.js")
    );
    const flowUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "flow.js")
    );
    const viewsUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "views.js")
    );
    const warpsUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "warps.js")
    );
    const timelineUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "timeline.js")
    );
    const riskMapUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "risk.js")
    );
    const detailUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "detail.js")
    );
    const queryUiUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "query-ui.js")
    );
    const exportUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "export.js")
    );
    const spritesUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "sprites.js")
    );
    const panelsUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "js", "panels.js")
    );
    const forceGraphUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "lib", "3d-force-graph.min.js")
    );
    const threeUri = webview.asWebviewUri(
      vscode2.Uri.joinPath(this.extensionUri, webviewPath, "lib", "three.global.js")
    );
    const nonce = getNonce();
    const auraConfig = this.buildAuraConfig();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <title>Aura \u2014 3D Visualizer</title>
</head>
<body>
    <div id="app-layout">
        <!-- Top Bar -->
        <header id="top-bar">
            <div class="top-bar-left">
                <button id="btn-toggle-explorer" class="top-btn icon-btn" title="Toggle explorer (\u2630)">\u2630</button>
                <div id="logo">
                    <span class="logo-icon">\u2726</span>
                    <span class="logo-text">AURA</span>
                    <span class="logo-version">v${version}</span>
                </div>
            </div>
            <div class="top-bar-center">
                <div id="search-container">
                    <span class="search-icon">\u2315</span>
                    <input type="text" id="search-input" placeholder="Search file..." autocomplete="off">
                    <div id="search-results" class="hidden"></div>
                </div>
            </div>
            <div class="top-bar-right">
                <div id="stats-bar">
                    <span class="stat" id="stat-files">0 files</span>
                    <span class="stat-separator">\xB7</span>
                    <span class="stat" id="stat-links">0 links</span>
                    <span class="stat-separator">\xB7</span>
                    <span class="stat" id="stat-time">\u2014</span>
                    <span class="stat-separator hidden" id="stat-parse-separator">\xB7</span>
                    <span class="stat stat-warn hidden" id="stat-parse-failures" role="button" tabindex="0" title="Files that could not be parsed cleanly \u2014 click for details">\u26A0 0 parse failures</span>
                </div>
                <button id="btn-export" class="top-btn" title="Export AI context (Markdown/JSON) \u2014 selectable sections and token budget">\u{1F4E4} Export</button>
                <button id="btn-export-image" class="top-btn" title="Export a high-resolution PNG of the 3D graph">\u{1F4F7}</button>
                <button id="btn-follow-editor" class="top-btn icon-btn" aria-pressed="true" title="Follow editor (on) \u2014 camera flies to the active file">\u{1F441}</button>
                <button id="btn-minimap" class="top-btn" title="Toggle minimap">\u{1F5FA}\uFE0F Map</button>
                <button id="btn-refresh" class="top-btn" title="Refresh analysis">\u{1F504} Refresh</button>
                <button id="btn-help" class="top-btn" title="Help & shortcuts">\u2753 Help</button>
            </div>
        </header>

        <!-- Tab Bar -->
        <nav id="tab-bar">
            <button class="tab-btn active" data-tab="graph">\u2726 3D Graph</button>
            <button class="tab-btn" data-tab="treemap">\u{1F5FA}\uFE0F Treemap</button>
            <button class="tab-btn" data-tab="dsm">\u{1F5D1}\uFE0F Matrix</button>
            <button class="tab-btn" data-tab="chord">\u{1F3B5} Chord</button>
            <button class="tab-btn" data-tab="metrics">\u{1F4CA} Metrics</button>
            <button class="tab-btn" data-tab="timeline">\u{1F4C8} Timeline</button>
            <button class="tab-btn" data-tab="table">\u{1F4CB} Table</button>
            <button class="tab-btn" data-tab="risk">\u{1F6E1}\uFE0F Risk</button>
            <button class="tab-btn" data-tab="arch">\u{1F3DB}\uFE0F Architecture</button>
            <button class="tab-btn" data-tab="coupling">\u{1F517} Co-change</button>
            <button id="qb-toggle" class="qb-toggle" title="Toggle query bar (Ctrl+K)">\u{1F50D}</button>
            <button id="settings-toggle" type="button" class="qb-toggle" title="Aura settings">\u2699\uFE0F</button>
        </nav>

        <!-- Query Bar (collapsible) -->
        <section id="query-bar" class="collapsed" aria-label="Query filter">
            <div class="qb-row qb-main">
                <div class="qb-input-wrap">
                    <input type="text" id="qb-input" class="qb-input"
                        placeholder='complexity > 20 AND fanIn > 5'
                        spellcheck="false" autocomplete="off" />
                    <div id="qb-suggest" class="qb-suggest hidden"></div>
                </div>
                <select id="qb-mode" class="qb-mode" title="How matches are applied">
                    <option value="highlight" selected>Highlight</option>
                    <option value="filter">Filter</option>
                    <option value="select">Select</option>
                </select>
                <span id="qb-status" class="qb-status">\u2014</span>
                <button id="qb-clear" class="qb-btn" title="Clear query (Esc)">\u2715</button>
                <button id="qb-save" class="qb-btn" title="Save current query as favorite">\u2B50</button>
                <button id="qb-open-list" class="qb-btn" title="Open saved queries">\u{1F4DA}</button>
            </div>
            <div class="qb-row qb-error-row">
                <span id="qb-error" class="qb-error hidden"></span>
            </div>
        </section>

        <!-- Middle Row: Explorer + Graph + Detail -->
        <div id="middle-row" class="tab-content active" data-tab="graph">
            <!-- Explorer Panel -->
            <aside id="explorer-panel" class="collapsed">
                <div class="explorer-header"><h3>Files</h3><span class="explorer-btns"><button id="explorer-all" title="Check all">All</button><button id="explorer-none" title="Uncheck all">None</button></span></div>
                <div id="explorer-tree" class="explorer-tree"></div>
            </aside>

            <!-- 3D Graph Container -->
            <div id="graph-container"></div>

            <!-- Loading Overlay (outside graph-container so it survives graph init) -->
            <div id="loading-overlay">
                <div class="loading-content">
                    <div class="loading-logo">
                        <span class="loading-logo-icon">\u2726</span>
                        <span class="loading-logo-text">AURA</span>
                    </div>
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill" id="loading-progress-fill"></div>
                    </div>
                    <p class="loading-status" id="loading-status">Analyzing codebase...</p>
                </div>
            </div>

            <!-- Detail Panel -->
            <aside id="detail-panel" class="collapsed">
        <div class="panel-header">
            <div class="panel-file-icon" id="panel-icon">\u{1F4C4}</div>
            <div class="panel-file-info">
                <h2 id="panel-filename">\u2014</h2>
                <span id="panel-path" class="panel-path">\u2014</span>
            </div>
            <button id="panel-close" class="panel-close">\u2715</button>
        </div>
        <details class="panel-section panel-collapsible" id="overview-section" open>
            <summary class="panel-section-header">
                <span class="panel-section-heading">\u{1F4CB} File details</span>
            </summary>
            <div class="panel-section-body">
                <div class="panel-grid">
                    <div class="panel-metric">
                        <span class="metric-label">Language</span>
                        <span class="metric-value" id="panel-language">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Folder</span>
                        <span class="metric-value" id="panel-group">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Community</span>
                        <span class="metric-value" id="panel-community">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Layer</span>
                        <span class="metric-value" id="panel-layer">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Lines</span>
                        <span class="metric-value" id="panel-loc">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Size</span>
                        <span class="metric-value" id="panel-size">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Modified</span>
                        <span class="metric-value" id="panel-mtime">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Git</span>
                        <span class="metric-value" id="panel-git">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Fan-out</span>
                        <span class="metric-value" id="panel-fanout">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Fan-in</span>
                        <span class="metric-value" id="panel-fanin">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Complexity</span>
                        <span class="metric-value" id="panel-complexity">\u2014</span>
                    </div>
                    <div class="panel-metric" title="PageRank centrality over the structural file graph">
                        <span class="metric-label">Centrality</span>
                        <span class="metric-value" id="panel-centrality">\u2014</span>
                    </div>
                    <div class="panel-metric">
                        <span class="metric-label">Symbols</span>
                        <span class="metric-value" id="panel-symbols-count">\u2014</span>
                    </div>
                </div>
                <div class="section-subblock" id="ai-actions-section">
                    <h4>\u2728 Ask Aura</h4>
                    <div class="ai-actions">
                        <button id="ai-explain" type="button" class="ai-action-btn">Explain file</button>
                        <button id="ai-impact" type="button" class="ai-action-btn">Impact</button>
                        <button id="ai-plan" type="button" class="ai-action-btn">Refactor plan</button>
                        <button id="ai-tests" type="button" class="ai-action-btn">Tests first</button>
                    </div>
                </div>
                <div class="section-subblock" id="note-section">
                    <h4>\u{1F4DD} Note <span id="note-stale-badge" class="note-stale-badge" style="display:none">\u26A0\uFE0F \xC0 revoir</span></h4>
                    <textarea id="note-input" rows="2" placeholder="Add a note for this file\u2026" maxlength="2000"></textarea>
                    <div class="note-actions">
                        <span id="note-colors" class="note-colors"></span>
                        <span class="note-buttons">
                            <button id="note-review" class="note-btn note-btn-review" style="display:none" title="Mark this note as reviewed (keeps its text)">\u2713 Mark reviewed</button>
                            <button id="note-save" class="note-btn">Save</button>
                            <button id="note-delete" class="note-btn note-btn-delete" style="display:none">\u{1F5D1} Delete</button>
                        </span>
                    </div>
                </div>
            </div>
        </details>
        <details class="panel-section panel-collapsible" id="arch-section" style="display:none" open>
            <summary class="panel-section-header">
                <span class="panel-section-heading">\u{1F3DB}\uFE0F Architecture</span>
                <span id="arch-count" class="count-badge">0</span>
            </summary>
            <div class="panel-section-body">
                <p id="panel-arch-layer" class="arch-detail-layer"></p>
                <ul id="panel-arch-list" class="panel-list arch-detail-list"></ul>
            </div>
        </details>
        <details class="panel-section panel-collapsible" id="symbols-section" style="display:none" open>
            <summary class="panel-section-header">
                <span class="panel-section-heading">Symbols</span>
                <span id="symbols-total" class="count-badge">0</span>
            </summary>
            <div class="panel-section-body">
                <div id="symbols-list" class="symbols-list"></div>
            </div>
        </details>
        <details class="panel-section panel-collapsible" id="symbol-cycles-section" style="display:none" open>
            <summary class="panel-section-header">
                <span class="panel-section-heading">\u{1F504} Symbol cycles</span>
                <span id="symbol-cycles-count" class="count-badge">0</span>
            </summary>
            <div class="panel-section-body">
                <ul id="symbol-cycles-list" class="panel-list symbol-cycles-list"></ul>
            </div>
        </details>
        <details class="panel-section panel-collapsible" id="deps-section" open>
            <summary class="panel-section-header">
                <span class="panel-section-heading">Dependencies</span>
                <span id="deps-count" class="count-badge">0</span>
            </summary>
            <div class="panel-section-body">
                <ul id="panel-deps" class="panel-list"></ul>
            </div>
        </details>
        <details class="panel-section panel-collapsible" id="dependents-section" open>
            <summary class="panel-section-header">
                <span class="panel-section-heading">Dependents</span>
                <span id="dependents-count" class="count-badge">0</span>
            </summary>
            <div class="panel-section-body">
                <ul id="panel-dependents" class="panel-list"></ul>
            </div>
        </details>
    </aside>
    </div><!-- /middle-row -->

    <!-- Metrics View -->
    <div id="metrics-view" class="tab-content" data-tab="metrics"></div>

    <!-- Risk View -->
    <div id="risk-view" class="tab-content" data-tab="risk">
        <div class="risk-toolbar">
            <h2>\u{1F6E1}\uFE0F Codebase Risk Map</h2>
            <div class="risk-toolbar-actions">
                <label class="risk-window-label" for="risk-window" title="How much git history is used for churn and scoring">
                    History window
                    <select id="risk-window" class="risk-window-select">
                        <option value="30">30 days</option>
                        <option value="90" selected>90 days</option>
                        <option value="365">365 days</option>
                    </select>
                </label>
                <button id="risk-ask-aura" type="button" class="risk-export-btn" title="Ask @aura for the top 3 actions on this Risk dashboard">\u2728 Ask Aura</button>
                <button id="risk-export" type="button" class="risk-export-btn" title="Export a Markdown report to .aura/risk-report.md">\u{1F4E4} Export Report</button>
            </div>
        </div>
        <div id="risk-content">
            <div class="risk-section" id="risk-health">
                <h3>Codebase Health</h3>
                <div class="risk-health-grid">
                    <div class="risk-health-metric">
                        <div class="risk-health-score" id="risk-health-score">\u2014</div>
                        <div class="risk-health-label">Health score</div>
                    </div>
                    <div class="risk-health-metric">
                        <div class="risk-health-value" id="risk-total-files">\u2014</div>
                        <div class="risk-health-label">Total files</div>
                    </div>
                    <div class="risk-health-metric">
                        <div class="risk-health-value" id="risk-avg-risk">\u2014</div>
                        <div class="risk-health-label">Average risk / 100</div>
                    </div>
                </div>
                <div class="risk-highlights">
                    <div class="risk-highlight">
                        <span class="risk-highlight-label">\u{1F525} Most risky</span>
                        <span id="risk-most-risky" class="risk-highlight-value">\u2014</span>
                    </div>
                    <div class="risk-highlight">
                        <span class="risk-highlight-label">\u{1F517} Most connected</span>
                        <span id="risk-most-connected" class="risk-highlight-value">\u2014</span>
                    </div>
                </div>
            </div>

            <div class="risk-section" id="risk-distribution">
                <h3>Risk Distribution</h3>
                <div class="risk-bar">
                    <div class="risk-bar-high" id="risk-bar-high"></div>
                    <div class="risk-bar-medium" id="risk-bar-medium"></div>
                    <div class="risk-bar-low" id="risk-bar-low"></div>
                </div>
                <div class="risk-legend">
                    <span class="risk-legend-item"><span class="risk-dot high"></span> High: <span id="risk-high-count">0</span> files (<span id="risk-high-pct">0%</span>)</span>
                    <span class="risk-legend-item"><span class="risk-dot medium"></span> Medium: <span id="risk-medium-count">0</span> files (<span id="risk-medium-pct">0%</span>)</span>
                    <span class="risk-legend-item"><span class="risk-dot low"></span> Low: <span id="risk-low-count">0</span> files (<span id="risk-low-pct">0%</span>)</span>
                </div>
            </div>

            <div class="risk-section" id="risk-trend">
                <h3>\u{1F4C8} Risk Trend <span class="risk-trend-caption">avg complexity over time</span></h3>
                <div id="risk-trend-chart" class="risk-trend-chart"></div>
            </div>

            <div class="risk-section" id="risk-scatter">
                <h3>\u{1F4CA} Churn \xD7 Complexity <span class="risk-trend-caption">log scale \xB7 click a point to focus</span></h3>
                <div id="risk-scatter-chart" class="risk-scatter-chart"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-complexity-trends">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-complexity-trends">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F4C8} COMPLEXITY TREND</span>
                    <span class="risk-count-badge" id="risk-complexity-trends-badge">0</span>
                </button>
                <div id="risk-list-complexity-trends" class="risk-files-list risk-collapsed"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-symbol-cycles">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-symbol-cycles">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F501} SYMBOL CYCLES</span>
                    <span class="risk-count-badge" id="risk-symbol-cycles-badge">0</span>
                </button>
                <div id="risk-list-symbol-cycles" class="risk-files-list risk-collapsed"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-rising">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-rising">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F525} RECENTLY HOT</span>
                    <span class="risk-count-badge" id="risk-rising-badge">0</span>
                </button>
                <div id="risk-list-rising" class="risk-files-list risk-collapsed"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-bus">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-bus">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F464} BUS FACTOR RISK</span>
                    <span class="risk-count-badge" id="risk-bus-badge">0</span>
                </button>
                <div id="risk-list-bus" class="risk-files-list risk-collapsed"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-section-high">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-high">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F534} HIGH RISK FILES</span>
                    <span class="risk-count-badge" id="risk-high-badge">0</span>
                </button>
                <div class="risk-files-list risk-collapsed" id="risk-list-high"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-section-medium">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-medium">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F7E1} MEDIUM RISK FILES</span>
                    <span class="risk-count-badge" id="risk-medium-badge">0</span>
                </button>
                <div class="risk-files-list risk-collapsed" id="risk-list-medium"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-section-low">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-low">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">\u{1F7E2} LOW RISK FILES</span>
                    <span class="risk-count-badge" id="risk-low-badge">0</span>
                </button>
                <div class="risk-files-list risk-collapsed" id="risk-list-low"></div>
            </div>
        </div>
    </div>

    <!-- Architecture Rules View (V2-20) -->
    <div id="arch-view" class="tab-content" data-tab="arch">
        <div class="arch-toolbar">
            <h2>\u{1F3DB}\uFE0F Architecture Rules</h2>
            <div class="arch-toolbar-actions">
                <button id="arch-edit-rules" type="button" class="risk-export-btn" title="Create or open .aura/arch-rules.json">\u2699\uFE0F Edit rules</button>
                <button id="arch-baseline" type="button" class="risk-export-btn" title="Freeze current violations so only new ones alert">\u{1F4CC} Baseline violations</button>
                <button id="arch-reset-baseline" type="button" class="risk-export-btn" title="Clear the baseline: every violation alerts again">\u21BA Reset baseline</button>
                <button id="arch-export" type="button" class="risk-export-btn" title="Export a Markdown report">\u{1F4E4} Export report</button>
            </div>
        </div>
        <div id="arch-content"></div>
    </div>

    <!-- Treemap View -->
    <div id="treemap-view" class="tab-content" data-tab="treemap">
        <div class="treemap-toolbar">
            <div id="treemap-breadcrumb"><span class="treemap-crumb treemap-crumb-root" data-path="">root</span></div>
            <div class="treemap-controls">
                <label>Size: <select id="treemap-size-metric">
                    <option value="linesOfCode" selected>LOC</option>
                    <option value="complexity">Complexity</option>
                    <option value="size">File size</option>
                </select></label>
                <label>Color: <select id="treemap-color-metric">
                    <option value="complexity" selected>Complexity</option>
                    <option value="fanIn">Fan-in</option>
                    <option value="fanOut">Fan-out</option>
                    <option value="language">Language</option>
                </select></label>
            </div>
        </div>
        <div id="treemap-container"></div>
    </div>

    <!-- Chord Diagram View -->
    <div id="chord-view" class="tab-content" data-tab="chord">
        <div class="chord-toolbar">
            <div class="chord-controls">
                <label>Group by: <select id="chord-group-by">
                    <option value="directory" selected>Directory</option>
                    <option value="language">Language</option>
                    <option value="layer">Architecture layer</option>
                    <option value="community">Community</option>
                </select></label>
                <span class="chord-stats" id="chord-stats"></span>
            </div>
        </div>
        <div id="chord-container"></div>
    </div>

    <!-- Timeline Chart View -->
    <div id="timeline-view" class="tab-content" data-tab="timeline">
        <div class="tchart-toolbar">
            <div class="tchart-controls">
                <label>Metric: <select id="tchart-metric">
                    <option value="loc" selected>Lines of Code</option>
                    <option value="files">File Count</option>
                    <option value="complexity">Avg Complexity</option>
                    <option value="totalComplexity">Total Complexity</option>
                </select></label>
                <span class="tchart-stats" id="tchart-stats"></span>
            </div>
        </div>
        <div id="tchart-container"></div>
    </div>

    <!-- DSM View -->
    <div id="dsm-view" class="tab-content" data-tab="dsm">
        <div class="dsm-toolbar">
            <div class="dsm-controls">
                <label>Group by: <select id="dsm-group-by">
                    <option value="directory" selected>Directory</option>
                    <option value="language">Language</option>
                    <option value="layer">Architecture layer</option>
                    <option value="community">Community</option>
                </select></label>
                <label>Sort: <select id="dsm-sort">
                    <option value="group" selected>Group</option>
                    <option value="name">Name</option>
                    <option value="fanIn">Fan-in</option>
                    <option value="fanOut">Fan-out</option>
                </select></label>
                <span class="dsm-stats" id="dsm-stats"></span>
            </div>
        </div>
        <div id="dsm-container"></div>
    </div>

    <!-- Coupling View -->
    <div id="coupling-view" class="tab-content" data-tab="coupling">
        <div class="coupling-toolbar">
            <div class="coupling-title">\u{1F517} Temporal Co-change</div>
            <div class="coupling-actions">
                <label class="coupling-label">Window
                    <select id="coupling-window" class="filter-select">
                        <option value="90">90 days</option>
                        <option value="365" selected>365 days</option>
                        <option value="730">2 years</option>
                    </select>
                </label>
                <label class="coupling-label">Min score
                    <select id="coupling-min" class="filter-select">
                        <option value="0.2" selected>0.2</option>
                        <option value="0.4">0.4</option>
                        <option value="0.6">0.6</option>
                    </select>
                </label>
                <button id="coupling-show-graph" class="risk-export-btn" title="Show the top pairs as virtual links in the 3D graph">Show on graph</button>
            </div>
        </div>
        <p id="coupling-summary" class="coupling-summary"></p>
        <div class="table-scroll">
            <table class="aura-table">
                <thead>
                    <tr>
                        <th data-col="pair">Pair</th>
                        <th data-col="cochanges" class="num">Co-changes</th>
                        <th data-col="jaccard" class="num">Jaccard</th>
                        <th data-col="support" class="num">Support</th>
                        <th data-col="aCommits" class="num">A</th>
                        <th data-col="bCommits" class="num">B</th>
                    </tr>
                </thead>
                <tbody id="coupling-body"></tbody>
            </table>
        </div>
    </div>

    <!-- Table View -->
    <div id="table-view" class="tab-content" data-tab="table">        <div class="table-toolbar">
            <span class="search-icon">\u2315</span>
            <input type="text" id="table-search" placeholder="Filter files..." autocomplete="off">
        </div>
        <div class="table-scroll">
            <table class="aura-table">
                <thead>
                    <tr>
                        <th data-col="name">File</th>
                        <th data-col="language">Lang</th>
                        <th data-col="layer">Layer</th>
                        <th data-col="loc" class="num">LOC</th>
                        <th data-col="complexity" class="num">Complexity</th>
                        <th data-col="cognitive" class="num" title="Highest Sonar cognitive complexity among this file's functions">Cog. max</th>
                        <th data-col="fanIn" class="num">Fan-in</th>
                        <th data-col="fanOut" class="num">Fan-out</th>
                        <th data-col="symbols" class="num">Symbols</th>
                        <th data-col="group">Folder</th>
                        <th data-col="trend" class="num" title="Complexity slope per 30 days from git history">Trend</th>
                    </tr>
                </thead>
                <tbody id="table-body"></tbody>
            </table>
        </div>
    </div>

    <!-- Timeline Bar (Time Travel) -->
    <div id="timeline-bar" class="hidden">
        <div id="timeline-from-controls" class="hidden">
            <button id="timeline-from-prev" class="timeline-btn from-btn" title="From: previous commit">\u25C0</button>
            <button id="timeline-from-next" class="timeline-btn from-btn" title="From: next commit">\u25B6</button>
        </div>
        <div id="timeline-slider-wrap">
            <input type="range" id="timeline-from-slider" class="hidden" min="0" max="0" value="0" step="1">
            <input type="range" id="timeline-slider" min="0" max="0" value="0" step="1">
        </div>
        <div id="timeline-info">
            <span id="timeline-hash">\u2014</span>
            <span id="timeline-message">\u2014</span>
            <span id="timeline-date">\u2014</span>
        </div>
        <div id="timeline-progress" class="hidden">
            <span id="timeline-progress-text">\u23F3 0/0</span>
        </div>
        <div id="timeline-right-controls">
            <button id="timeline-prev" class="timeline-btn" title="Previous commit (\u2190)">\u25C0</button>
            <button id="timeline-next" class="timeline-btn" title="Next commit (\u2192)">\u25B6</button>
            <button id="timeline-impact" class="timeline-btn impact-btn" title="Show impact cascade (I)">\u{1F4A5}</button>
            <button id="timeline-compare" class="timeline-btn compare-btn" title="Compare two commits (V)">\u21C4</button>
        </div>
    </div>

    <!-- Bottom Filter Bar -->
    <footer id="filter-bar">
        <div class="filter-group graph-only" id="language-filters">
            <button class="filter-btn active" data-lang="c-source" data-color="#4fc3f7">
                <span class="filter-dot" style="background:#4fc3f7"></span> .c
            </button>
            <button class="filter-btn active" data-lang="c-header" data-color="#81d4fa">
                <span class="filter-dot" style="background:#81d4fa"></span> .h
            </button>
            <button class="filter-btn active" data-lang="cpp-source" data-color="#0288d1">
                <span class="filter-dot" style="background:#0288d1"></span> .cpp
            </button>
            <button class="filter-btn active" data-lang="cpp-header" data-color="#4fc3f7">
                <span class="filter-dot" style="background:#4fc3f7"></span> .hpp
            </button>
            <button class="filter-btn active" data-lang="javascript" data-color="#ffd54f">
                <span class="filter-dot" style="background:#ffd54f"></span> JS
            </button>
            <button class="filter-btn active" data-lang="typescript" data-color="#64b5f6">
                <span class="filter-dot" style="background:#64b5f6"></span> TS
            </button>
            <button class="filter-btn active" data-lang="python" data-color="#81c784">
                <span class="filter-dot" style="background:#81c784"></span> PY
            </button>
            <button class="filter-btn active" data-lang="css" data-color="#ce93d8">
                <span class="filter-dot" style="background:#ce93d8"></span> CSS
            </button>
            <button class="filter-btn active" data-lang="html" data-color="#ff8a65">
                <span class="filter-dot" style="background:#ff8a65"></span> HTML
            </button>
            <button class="filter-btn active" data-lang="java" data-color="#e57373">
                <span class="filter-dot" style="background:#e57373"></span> Java
            </button>
            <button class="filter-btn active" data-lang="go" data-color="#4dd0e1">
                <span class="filter-dot" style="background:#4dd0e1"></span> Go
            </button>
            <button class="filter-btn active" data-lang="rust" data-color="#ffb74d">
                <span class="filter-dot" style="background:#ffb74d"></span> Rust
            </button>
            <button class="filter-btn active" data-lang="csharp" data-color="#9c6ade">
                <span class="filter-dot" style="background:#9c6ade"></span> C#
            </button>
            <button class="filter-btn active" data-lang="php" data-color="#8892bf">
                <span class="filter-dot" style="background:#8892bf"></span> PHP
            </button>
            <button class="filter-btn active" data-lang="vue" data-color="#42b883">
                <span class="filter-dot" style="background:#42b883"></span> Vue
            </button>
            <button class="filter-btn active" data-lang="bash" data-color="#89e051">
                <span class="filter-dot" style="background:#89e051"></span> SH
            </button>
            <button class="filter-btn active" data-lang="lua" data-color="#536dfe">
                <span class="filter-dot" style="background:#536dfe"></span> Lua
            </button>
            <button class="filter-btn" data-lang="documentation" data-color="#b0bec5" style="display:none">
                <span class="filter-dot" style="background:#b0bec5"></span> \u{1F4C4} Docs
            </button>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <button class="filter-btn" id="btn-dag-mode" title="Hierarchical mode">\u229E DAG</button>
            <button class="filter-btn" id="btn-highlight-orphans" title="Orphan nodes">\u25CE Orphans</button>
            <button class="filter-btn" id="btn-dead-code" title="Dead code detection">\u2620\uFE0F Dead</button>
            <button class="filter-btn" id="btn-cycles" title="Circular dependencies">\u{1F504} Cycles</button>
            <button class="filter-btn" id="btn-dirty-only" title="Only files with uncommitted changes (git working tree)">\u270F\uFE0F Dirty</button>
            <button class="filter-btn active" id="btn-notes" title="Show note indicators on annotated files">\u{1F4DD} Notes<span id="notes-stale-count" class="filter-count" style="display:none">0</span></button>
            <button class="filter-btn" id="btn-centrality-halos" title="Show halos around the top 10% most central files (PageRank)">\u{1F4A0} Centrality</button>
            <button class="filter-btn" id="btn-stale-notes" title="No stale notes" disabled>\u26A0\uFE0F Stale</button>
            <button class="filter-btn" id="btn-cochange-links" title="Show virtual temporal-coupling links (co-change without a direct dependency)">\u{1F517} Co-change</button>
            <button class="filter-btn" id="btn-warps-panel" title="Warp points \u2014 named camera bookmarks">\u{1F300} Warps</button>
            <button class="filter-btn" id="btn-group-dirs" title="Group by directory">\u{1F4C1} Groups</button>
            <button class="filter-btn" id="btn-path-mode" title="Find path between 2 nodes">\u{1F517} Path</button>
            <button class="filter-btn" id="btn-labels" title="Show file names">\u{1F3F7}\uFE0F Names</button>
            <button class="filter-btn" id="btn-recenter" title="Recenter view">\u{1F3AF} Center</button>
            <button class="filter-btn" id="btn-pilot" title="Pilot mode \u2014 free flight (WASD, mouse look, Esc to exit)">\u{1F680} Pilot</button>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <select id="heatmap-select" class="filter-select" title="Coloring mode">
                <option value="off">\u{1F3A8} By language</option>
                <option value="complexity">\u{1F525} Complexity</option>
                <option value="cognitive">\u{1F9E0} Cognitive</option>
                <option value="fanIn">\u{1F4E5} Fan-in</option>
                <option value="fanOut">\u{1F4E4} Fan-out</option>
                <option value="loc">\u{1F4CF} Lines of code</option>
                <option value="churn">\u23F1 Churn (commits)</option>
                <option value="cochange">\u{1F517} Co-change</option>
                <option value="lastModified">\u{1F4C6} Last update</option>
                <option value="layers">\u{1F3DB}\uFE0F Architecture layers</option>
                <option value="community">\u{1F9E9} Communities</option>
            </select>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label" title="Hide edges whose resolution confidence is below this threshold">
                Edge confidence
                <select id="confidence-filter" class="filter-select">
                    <option value="0">All edges</option>
                    <option value="0.5">\u2265 0.5</option>
                    <option value="0.6">\u2265 0.6</option>
                    <option value="0.8">\u2265 0.8</option>
                    <option value="0.9">\u2265 0.9</option>
                    <option value="1">Exact only</option>
                </select>
            </label>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label">
                Node size
                <input type="range" id="node-size-slider" min="1" max="10" value="4" step="0.5">
            </label>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label">
                Spread
                <input type="range" id="spread-slider" min="1" max="5" value="1" step="0.5">
            </label>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label">
                Depth
                <input type="range" id="depth-slider" min="1" max="5" value="1" step="1">
                <span id="depth-value">1</span>
            </label>
        </div>


    </footer>
    </div><!-- /app-layout -->

    <!-- Heatmap Legend (overlay, outside grid) -->
    <div id="heatmap-legend" class="hidden">
        <span class="legend-label" id="legend-low">Low</span>
        <div class="legend-gradient" id="legend-gradient"></div>
        <span class="legend-label" id="legend-high">High</span>
        <span class="legend-mode" id="legend-mode">\u2014</span>
    </div>

    <!-- Group Palette (overlay) \u2014 Communities or Architecture layers -->
    <div id="community-palette" class="hidden">
        <div class="community-palette-header">
            <select id="palette-mode" class="palette-mode" title="Palette content \u2014 Communities groups the Louvain partition, Layers groups the architecture rules. Documentation is excluded from both.">
                <option value="community">\u{1F9E9} Communities</option>
                <option value="layers">\u{1F3DB}\uFE0F Layers</option>
            </select>
            <div class="community-palette-actions">
                <button id="community-select-all" title="Select all">All</button>
                <button id="community-select-none" title="Unselect all">None</button>
                <button id="community-palette-close" title="Close">\u2715</button>
            </div>
        </div>
        <div id="community-list"></div>
    </div>

    <!-- Warps Panel (overlay) -->
    <div id="warps-panel" class="hidden">
        <div class="warps-panel-header">
            <span>\u{1F300} Warps</span>
            <div class="warps-panel-actions">
                <button id="warps-capture" title="Capture the current view">\u{1F4CC}</button>
                <button id="warps-panel-close" title="Close">\u2715</button>
            </div>
        </div>
        <div id="warps-list"></div>
    </div>

    <!-- Warp Modal (name + quick slot) -->
    <div id="warp-modal" class="hidden">
        <div class="warp-modal-header">
            <span id="warp-modal-title">\u{1F4CC} New Warp</span>
            <button id="warp-modal-close" title="Close">\u2715</button>
        </div>
        <div class="warp-modal-body">
            <label class="warp-field">
                <span>Name</span>
                <input id="warp-name-input" type="text" maxlength="60" placeholder="Warp name\u2026" />
            </label>
            <label class="warp-field">
                <span>Quick slot</span>
                <select id="warp-slot-select">
                    <option value="">\u2014</option>
                    <option value="1">Alt+Shift+1</option>
                    <option value="2">Alt+Shift+2</option>
                    <option value="3">Alt+Shift+3</option>
                    <option value="4">Alt+Shift+4</option>
                    <option value="5">Alt+Shift+5</option>
                    <option value="6">Alt+Shift+6</option>
                    <option value="7">Alt+Shift+7</option>
                    <option value="8">Alt+Shift+8</option>
                    <option value="9">Alt+Shift+9</option>
                </select>
            </label>
            <p class="warp-hint">The current camera pose (position + view target) is captured \u2014 fly back with a click, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1\u20139</kbd> in orbit mode.</p>
        </div>
        <div class="warp-modal-footer">
            <button id="warp-save" class="qm-btn qm-primary">Save</button>
            <button id="warp-cancel" class="qm-btn">Cancel</button>
        </div>
    </div>

    <!-- Saved Queries Modal (overlay) -->
    <div id="queries-modal" class="hidden">
        <div class="queries-modal-header">
            <span>\u2B50 Saved Queries</span>
            <div class="queries-modal-actions">
                <button id="queries-modal-close" title="Close">\u2715</button>
            </div>
        </div>
        <div id="queries-modal-list"></div>
        <div class="queries-modal-footer">
            <button id="queries-modal-select" class="qm-btn qm-primary" title="Apply selected query">Select</button>
            <button id="queries-modal-delete" class="qm-btn qm-danger" title="Delete selected query">Delete</button>
        </div>
    </div>

    <!-- Tooltip (overlay, outside grid) -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">\u2014</div>
        <div class="tooltip-meta" id="tooltip-meta">\u2014</div>
    </div>

    <!-- Minimap (overlay) -->
    <div id="minimap" class="hidden">
        <div class="minimap-header">
            <span>\u{1F5FA}\uFE0F Minimap</span>
            <button id="minimap-close" title="Close">\u2715</button>
        </div>
        <canvas id="minimap-canvas" width="200" height="200"></canvas>
    </div>

    <!-- Pilot HUD (overlay) -->
    <div id="pilot-hud" class="hidden">
        <span class="pilot-title">\u{1F680} PILOT</span>
        <span class="pilot-speed">speed <span id="pilot-speed-mult">\xD71</span></span>
        <span id="pilot-pad" class="pilot-pad hidden"></span>
        <span class="pilot-keys"><kbd>W A S D</kbd> move \xB7 <kbd>Q</kbd>/<kbd>E</kbd> down/up \xB7 hold <kbd>LMB</kbd>/<kbd>RMB</kbd> fwd/back \xB7 wheel = speed \xB7 <kbd>Shift</kbd> boost \xB7 <kbd>Esc</kbd>/<kbd>Space</kbd> exit \xB7 \u{1F3AE} sticks = move/look, <kbd>L2</kbd> down, <kbd>R2</kbd> boost, <kbd>\u2715</kbd> reset, <kbd>\u25CB</kbd> exit</span>
    </div>

    <!-- Flowchart Modal (overlay) -->
    <div id="flow-modal" class="hidden">
        <div class="flow-modal-header">
            <span id="flow-crumbs">\u2442 Flow</span>
            <div class="flow-modal-actions">
                <span id="flow-badge" class="flow-badge">\u2014</span>
                <button id="flow-export" title="Export as SVG">\u2913 SVG</button>
                <button id="flow-modal-close" title="Close">\u2715</button>
            </div>
        </div>
        <div id="flow-body"></div>
    </div>

    <!-- Settings Modal (overlay) -->
    <div id="settings-modal" class="hidden">
        <div class="help-modal-content">
            <div class="help-modal-header">
                <span>\u2699\uFE0F Aura Settings</span>
                <button id="settings-modal-close" title="Close">\u2715</button>
            </div>
            <div class="help-modal-body">
                <div class="settings-row">
                    <label for="set-riskWindow">Risk history window<span class="settings-hint">Git history used for churn, scoring and explanations</span></label>
                    <select id="set-riskWindow" data-setting="riskWindow">
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="365">365 days</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label for="set-complexityTrendThreshold">Complexity trend threshold<span class="settings-hint">Complexity points per 30 days that flag a file as degrading</span></label>
                    <input id="set-complexityTrendThreshold" data-setting="complexityTrendThreshold" type="number" min="0" max="20" step="0.1" />
                </div>
                <div class="settings-row">
                    <label for="set-riskCentrality">Use PageRank centrality<span class="settings-hint">Replace fan-in with PageRank in the risk score</span></label>
                    <input id="set-riskCentrality" data-setting="riskCentrality" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label for="set-rotateSpeed">Mouse rotation speed<span class="settings-hint">Speed when dragging the 3D graph (1 = default)</span></label>
                    <span class="settings-slider-wrap">
                        <input type="range" id="set-rotateSpeed" data-setting="rotateSpeed" min="1" max="5" step="0.1" value="1">
                        <span id="set-rotateSpeed-value">1.0</span>
                    </span>
                </div>
                <div class="settings-row">
                    <label for="set-linkStyle">Link style<span class="settings-hint">Straight or curved dependency edges</span></label>
                    <select id="set-linkStyle" data-setting="linkStyle">
                        <option value="straight">Straight</option>
                        <option value="curved">Curved</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label for="set-linkCurvature">Link curvature<span class="settings-hint">0 = straight, 1 = highly curved (when style is curved)</span></label>
                    <input id="set-linkCurvature" data-setting="linkCurvature" type="number" min="0" max="1" step="0.05" />
                </div>
                <div class="settings-row">
                    <label for="set-selectedNodeEffect">Selected node effect<span class="settings-hint">Soft halo (Glow) or real bloom post-processing</span></label>
                    <select id="set-selectedNodeEffect" data-setting="selectedNodeEffect">
                        <option value="glow">Glow</option>
                        <option value="bloom">Bloom</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label for="set-bloomStrength">Bloom intensity<span class="settings-hint">Used when the effect is Bloom</span></label>
                    <input id="set-bloomStrength" data-setting="bloomStrength" type="number" min="0" max="5" step="0.1" />
                </div>
                <div class="settings-row">
                    <label for="set-bloomRadius">Bloom radius</label>
                    <input id="set-bloomRadius" data-setting="bloomRadius" type="number" min="0" max="2" step="0.1" />
                </div>
                <div class="settings-row">
                    <label for="set-bloomThreshold">Bloom threshold</label>
                    <input id="set-bloomThreshold" data-setting="bloomThreshold" type="number" min="0" max="1" step="0.05" />
                </div>
                <div class="settings-row">
                    <label for="set-autoRefresh">Auto-refresh on save<span class="settings-hint">Re-analyze changed files automatically</span></label>
                    <input id="set-autoRefresh" data-setting="autoRefresh" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label for="set-followEditor">Follow editor<span class="settings-hint">Fly to the active file; manual camera movement pauses it (\u{1F441})</span></label>
                    <input id="set-followEditor" data-setting="followEditor" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label for="set-flightSpeed">Flight speed<span class="settings-hint">Pilot mode base speed (\xD7, scene-scaled)</span></label>
                    <input id="set-flightSpeed" data-setting="flightSpeed" type="number" min="0.25" max="4" step="0.05" />
                </div>
                <div class="settings-row">
                    <label for="set-flightSmoothing">Flight smoothing<span class="settings-hint">Acceleration / damping time constant (s) \u2014 low = snappy</span></label>
                    <input id="set-flightSmoothing" data-setting="flightSmoothing" type="number" min="0.02" max="0.5" step="0.01" />
                </div>
                <div class="settings-row">
                    <label for="set-mouseSensitivity">Mouse look sensitivity<span class="settings-hint">Radians per pixel while flying</span></label>
                    <input id="set-mouseSensitivity" data-setting="mouseSensitivity" type="number" min="0.0005" max="0.01" step="0.0005" />
                </div>
                <div class="settings-row">
                    <label for="set-invertY">Invert mouse Y (flight)<span class="settings-hint">Flight look: moving up looks down</span></label>
                    <input id="set-invertY" data-setting="invertY" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label for="set-gamepadEnabled">Gamepad in pilot mode<span class="settings-hint">Left stick moves, right stick looks, L2/R2 descend/boost (DualSense, Xbox\u2026)</span></label>
                    <input id="set-gamepadEnabled" data-setting="gamepadEnabled" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label for="set-codeLens">Symbol CodeLens<span class="settings-hint">\u27E1 focus \xB7 flow \xB7 impact above the functions and classes of analyzed files</span></label>
                    <input id="set-codeLens" data-setting="codeLens" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label>Dead code exemptions<span class="settings-hint">Framework/test rules always visible in the detail panel \u2014 defaults stay active</span></label>
                    <button id="dead-code-rules-open" class="settings-action-btn" type="button">Edit rules\u2026</button>
                </div>
                <div class="settings-row">
                    <label>Architecture rules<span class="settings-hint">Layers, deny rules and baseline \u2014 stored in <code>.aura/arch-rules.json</code></span></label>
                    <button id="arch-rules-open" class="settings-action-btn" type="button">Edit rules\u2026</button>
                </div>
                <div class="settings-footer">
                    <span id="settings-open-vscode">Open VS Code Settings \u2192</span>
                    <span class="settings-hint">All settings: Extensions \u2192 Aura Visualizer</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Dead-code exemption rules editor -->
    <div id="dead-code-rules-modal" class="hidden">
        <div class="help-modal-content dead-code-rules-content dc-editor-content">
            <div class="help-modal-header">
                <span>\u{1F6E1}\uFE0F Dead-code exemptions</span>
                <button id="dead-code-rules-close" title="Close">\u2715</button>
            </div>
            <div class="help-modal-body dc-editor-body">
                <p class="dc-editor-intro">Built-in defaults (entry points, React/Vue/SwiftUI/servlet/Unity/Arduino, tests) are always active. Custom rules are evaluated after the defaults and stay visible with their reason in the detail panel \u2014 they are never silently hidden.</p>
                <div id="dead-code-rules-error" class="dead-code-rules-error"></div>
                <div id="dc-editor-status" class="dc-editor-status"></div>
                <div id="dc-editor-form"></div>
                <details id="dc-editor-raw-wrap" class="dc-editor-raw">
                    <summary>Raw JSON (advanced)</summary>
                    <p class="settings-hint">Valid JSON re-renders the form when you leave the field. The stored file uses <code>{ version, rules }</code>.</p>
                    <textarea id="dead-code-rules-text" spellcheck="false"></textarea>
                </details>
                <details id="dc-editor-defaults" class="dc-editor-defaults">
                    <summary>Built-in defaults (always active)</summary>
                    <div id="dc-editor-defaults-list"></div>
                </details>
                <div class="dead-code-rules-actions dc-editor-actions">
                    <button id="dead-code-rules-reload" type="button">Reload from file</button>
                    <button id="dead-code-rules-example" type="button">Load example</button>
                    <button id="dead-code-rules-open-file" type="button">Open file</button>
                    <button id="dead-code-rules-save" class="primary" type="button" disabled>Save rules</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Architecture rules editor (V2-20) -->
    <div id="arch-rules-modal" class="hidden">
        <div class="help-modal-content dead-code-rules-content arch-editor-content">
            <div class="help-modal-header">
                <span>\u{1F3DB}\uFE0F Architecture rules</span>
                <button id="arch-rules-close" title="Close">\u2715</button>
            </div>
            <div class="help-modal-body arch-editor-body">
                <p class="arch-editor-intro">Layers are matched in order (first match wins). Rules reference layers by name; renaming a layer updates every rule, and the same validation engine as the analysis checks the result before saving. Rule ids are referenced by the baseline \u2014 renaming an id makes its baselined violations new again.</p>
                <div id="arch-rules-error" class="dead-code-rules-error"></div>
                <div id="arch-editor-status" class="arch-editor-status"></div>
                <div id="arch-editor-form"></div>
                <details id="arch-editor-raw-wrap" class="arch-editor-raw">
                    <summary>Raw JSON (advanced)</summary>
                    <p class="settings-hint">Only for fields the form does not expose (<code>edgeTypes</code>, manual ordering). Valid JSON re-renders the form when you leave the field.</p>
                    <textarea id="arch-rules-text" spellcheck="false"></textarea>
                </details>
                <div class="dead-code-rules-actions arch-editor-actions">
                    <button id="arch-rules-reload" type="button">Reload from file</button>
                    <button id="arch-rules-example" type="button">Load example</button>
                    <button id="arch-rules-open-file" type="button">Open file</button>
                    <button id="arch-rules-save" class="primary" type="button" disabled>Save rules</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Parse failures report (V2-17) -->
    <div id="parse-failures-modal" class="hidden">
        <div class="help-modal-content parse-failures-content">
            <div class="help-modal-header">
                <span>\u26A0 Parse failures</span>
                <button id="parse-failures-close" title="Close">\u2715</button>
            </div>
            <div class="help-modal-body">
                <p class="parse-failures-intro">These files could not be parsed cleanly. They are kept in the graph so their imports and dependents stay visible \u2014 cross-file relations may be incomplete for them. Click a path to reveal the node.</p>
                <div id="parse-failures-list" class="parse-failures-list"></div>
                <div class="parse-failures-actions">
                    <span id="parse-failures-summary" class="parse-failures-summary"></span>
                    <button id="parse-failures-export" class="risk-export-btn" type="button">Export report</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Help Modal -->
    <div id="help-modal" class="hidden">
        <div class="help-modal-content">
            <div class="help-modal-header">
                <span>\u2726 Aura Help \u2014 v${version}</span>
                <button id="help-modal-close" title="Close">\u2715</button>
            </div>
            <div class="help-modal-body">

                <h3>\u2728 What's New in 1.5.0</h3>
                <p><strong>Architecture rules \u{1F3DB}\uFE0F</strong> turn layers into an executable fitness function: declare <code>layers</code>, <code>deny</code>, <code>slices</code>, <code>no-cycles</code> and <code>exceptions</code> in <code>.aura/arch-rules.json</code>. The <strong>\u{1F3DB}\uFE0F Architecture</strong> tab lists violations by rule with <strong>Ca/Ce/instability</strong> per layer; the <strong>Architecture layers</strong> heatmap turns forbidden edges red; the status bar shows the active file's violations. The floating palette switches between <strong>\u{1F9E9} Communities</strong> and <strong>\u{1F3DB}\uFE0F Layers</strong>: click a layer card to hide it (Unlayered included when files fall outside every layer), and both selections are saved with the view state. Freeze legacy debt with a baseline so only new violations alert.</p>
                <p><strong>\u26A0\uFE0F Parse failures</strong> are never fatal: a file Tree-sitter cannot parse cleanly keeps its node (imports stay visible), and a <strong>\u26A0 N parse failures</strong> badge in the stats bar opens the sampled paths and reasons. Click a path to reveal the node; <strong>Export report</strong> writes a Markdown summary.</p>
                <p><strong>\u2728 Ask Aura on a layer</strong> sends the layer globs, authoritative members, Ca/Ce/instability, new vs baselined violations and layer cycles to <code>@aura</code> \u2014 the answer distinguishes code fixes from rule changes. The same evaluation is available to AI agents through the <code>aura_get_architecture_violations</code> tool (optional <code>layer</code> filter, baselined included on demand). The Unlayered bucket has no ask action.</p>
                <p><strong>\u{1F3AE} Gamepad in pilot mode</strong> \u2014 fly with a DualSense, DualShock or Xbox pad (W3C standard mapping): left stick moves, right stick looks, the analog <strong>L2</strong>/<strong>R2</strong> descend and boost, <strong>\u2715</strong> resets the camera, the touchpad re-aims at the centre, <strong>d-pad \u2191/\u2193</strong> step the speed, <strong>Options</strong> resets it and <strong>\u25CB</strong> leaves the flight. Keyboard and pad add up, the pad name shows in the pilot HUD, and <code>auraVisualizer.gamepadEnabled</code> turns it off. See <strong>\u{1F680} Pilot Mode</strong> below for the full mapping.</p>
                <p><strong>\u27E1 Symbol CodeLens</strong> \u2014 analyzed files now show a <code>\u27E1 focus \xB7 flow \xB7 impact</code> lens above every function, method and class. One click opens a picker: <strong>Focus in Aura</strong> (centers the graph on the file), <strong>Show flowchart</strong> (that function's control flow) or <strong>Blast radius</strong>. Symbols and lines come from the graph database, so it works without a language server; files that were never analyzed show no lens. Turn it off with <code>auraVisualizer.codeLens</code>.</p>

                <h3>\u{1F916} Where to Ask Aura</h3>
                <p>AI lives in <strong>VS Code Chat</strong>, not inside the graph panel. Mention <code>@aura</code> for grounded answers (<code>/explain</code>, <code>/impact</code>, <code>/path</code>, <code>/hotspots</code>, <code>/query</code>), or click any <strong>\u2728 Ask Aura</strong> button \u2014 file detail, clusters, community cards, layer cards, Risk dashboard, explorer context menu \u2014 to pre-attach the current view context. The old in-panel assistant (\u2728 tab button) has been removed: there is a single conversational surface. External agents reach the same deterministic evaluation through the <strong>Language Model tools</strong> and the built-in <strong>MCP server</strong> (18 tools).</p>

                <h3>\u{1F5B1}\uFE0F Interactive Exploration</h3>
                <table class="help-table">
                    <tr><td><kbd>Click</kbd></td><td>Select node, show detail panel, focus camera</td></tr>
                    <tr><td><kbd>Double-click</kbd></td><td>Open file in VS Code editor</td></tr>
                    <tr><td><kbd>Right-click</kbd></td><td>Pin focus \u2014 isolate file + neighbors up to N depth</td></tr>
                    <tr><td><kbd>Shift+Right-click</kbd></td><td>Blast radius \u2014 show impact (all dependents) with depth coloring</td></tr>
                    <tr><td><kbd>Shift+Click</kbd></td><td>Multi-select \u2014 aggregate stats for multiple files</td></tr>
                    <tr><td><kbd>Scroll</kbd></td><td>Zoom in / out</td></tr>
                    <tr><td><kbd>Drag</kbd></td><td>Rotate the 3D view</td></tr>
                    <tr><td><kbd>Hold LMB / RMB</kbd></td><td>Pilot mode \u2014 fly forward / backward while looking around</td></tr>
                    <tr><td><kbd>Background click</kbd></td><td>Clear all selections</td></tr>
                </table>

                <h3>\u{1F5C2}\uFE0F Detail Panel</h3>
                <p>The detail panel is organized into collapsible sections: <strong>\u{1F4CB} File details</strong> groups metrics, <strong>Ask Aura</strong> actions and <strong>\u{1F4DD} Note</strong>; <strong>Symbols</strong>, <strong>Dependencies</strong> and <strong>Dependents</strong> use readable cards. Empty sections (no symbols, no dependency, no dependent) are hidden automatically, and every section can be folded from its header.</p>

                <h3>\u{1F3B9} Keyboard Shortcuts</h3>
                <table class="help-table">
                    <tr><td><kbd>Ctrl+K</kbd></td><td>Open the query filter bar</td></tr>
                    <tr><td><kbd>F</kbd></td><td>Fit to view / recenter</td></tr>
                    <tr><td><kbd>L</kbd></td><td>Toggle node labels</td></tr>
                    <tr><td><kbd>G</kbd></td><td>Toggle directory groups</td></tr>
                    <tr><td><kbd>H</kbd></td><td>Cycle heatmap modes</td></tr>
                    <tr><td><kbd>P</kbd></td><td>Toggle path-finding mode</td></tr>
                    <tr><td><kbd>D</kbd></td><td>Toggle DAG layout</td></tr>
                    <tr><td><kbd>O</kbd></td><td>Highlight orphan files</td></tr>
                    <tr><td><kbd>X</kbd></td><td>Toggle dead code visualization</td></tr>
                    <tr><td><kbd>C</kbd></td><td>Toggle circular dependencies</td></tr>
                    <tr><td><kbd>1</kbd>\u2013<kbd>5</kbd></td><td>Set pinned focus / blast depth</td></tr>
                    <tr><td><kbd>V</kbd></td><td>Toggle timeline compare mode (dual slider)</td></tr>
                    <tr><td><kbd>I</kbd></td><td>Toggle timeline impact cascade</td></tr>
                    <tr><td><kbd>\u2190</kbd> <kbd>\u2192</kbd></td><td>Timeline: previous / next commit</td></tr>
                    <tr><td><kbd>Space</kbd></td><td>Toggle pilot mode (free flight)</td></tr>
                    <tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd>\u2013<kbd>9</kbd></td><td>Fly to the warp point on that quick slot</td></tr>
                    <tr><td><kbd>Escape</kbd></td><td>Reset all selections and modes (in pilot: exit the flight)</td></tr>
                </table>

                <h3>\u{1F321}\uFE0F Heatmap Modes</h3>
                <table class="help-table">
                    <tr><td><strong>Off</strong></td><td>Color by programming language</td></tr>
                    <tr><td><strong>Complexity</strong></td><td>Cyclomatic complexity (branching, loops)</td></tr>
                    <tr><td><strong>Cognitive</strong></td><td>Highest per-function cognitive complexity in the file (JS/TS/TSX, Python, C/C++, Java, Go, Rust, Kotlin, Swift, C#, PHP, Lua, Bash)</td></tr>
                    <tr><td><strong>Fan-in</strong></td><td>How many files depend on this file</td></tr>
                    <tr><td><strong>Fan-out</strong></td><td>How many files this file depends on</td></tr>
                    <tr><td><strong>Lines of Code</strong></td><td>File size</td></tr>
                    <tr><td><strong>Churn (commits)</strong></td><td>Git commit count per file (needs Time Travel scan)</td></tr>
                    <tr><td><strong>Co-change</strong></td><td>Strongest temporal-coupling score per file (needs Time Travel scan)</td></tr>
                    <tr><td><strong>Last Modified</strong></td><td>File modification time</td></tr>
                    <tr><td><strong>Communities</strong></td><td>Architectural modules (Louvain algorithm)</td></tr>
                </table>

                <h3>\u{1F9E9} Community Detection</h3>
                <p>Communities are computed once from the <strong>code-only</strong> Louvain snapshot and shared by the palette, <code>@aura</code> and MCP. Documentation nodes and <code>doc-reference</code> edges stay visible in the graph but are excluded from communities, fan-in, PageRank and risk. Each card shows the full <strong>hub path</strong>, the code file count and the number of files currently visible after filters. Use <strong>\u270F\uFE0F</strong> to rename a community (persisted; empty restores the hub path) and <strong>\u2728</strong> to ask Aura with that exact membership. Use the floating palette to toggle communities on/off. Documentation nodes stay in the graph with <strong>yellow labels</strong> so they remain visually distinct from code.</p>

                <h3>\u2620\uFE0F Dead Code & Exemptions</h3>
                <p>The <strong>\u2620\uFE0F Dead</strong> filter and the detail panel show unused exports. Framework-owned entry points and callbacks are exempted by default: <code>main</code>, VS Code lifecycle, React components, Vue hooks, SwiftUI <code>body</code>, Java servlet methods, Unity callbacks, Arduino <code>setup</code>/<code>loop</code> and test files. Exempted symbols remain visible with their reason. Custom rules are edited from <strong>\u2699\uFE0F Settings \u2192 Dead code exemptions</strong> in a structured editor (reason, names, regex, globs, languages, kinds, ordering) validated before saving; they are stored in <code>.aura/dead-code.json</code> and defaults always stay active.</p>

                <h3>\u{1F4A5} Blast Radius</h3>
                <p><kbd>Shift+Right-click</kbd> on a file to see all files that transitively depend on it. Nodes are colored by depth of impact: White (source) \u2192 Red \u2192 Orange \u2192 Yellow \u2192 Green.</p>

                <h3>\u25B6 Flow Trace</h3>
                <p>In the detail panel, click the <strong>\u25B6</strong> button next to a function to trace its outgoing call chain across files. Files light up progressively by call depth.</p>

                <h3>\u{1F9E0} Function Metrics</h3>
                <p>For <strong>JavaScript/TypeScript/TSX, Python, C/C++, Java, Go, Rust, Kotlin, Swift, C#, PHP, Lua and Bash</strong>, Aura computes metrics per function from the AST. The detail panel shows a <code>cog N \xB7 MI N</code> chip next to each function; hover it for cyclomatic complexity, Halstead volume and function length. The <strong>\u{1F4CB} Table</strong> has a sortable <strong>Cog. max</strong> column (highest cognitive score among the file's functions), and the <strong>\u{1F9E0} Cognitive</strong> heatmap colors files by that maximum.</p>
                <ul>
                    <li><strong>Cognitive complexity</strong> follows the Sonar model: each flow break adds 1, nested structures add their nesting level, <code>else</code>/<code>else if</code> add 1 without an extra nesting penalty, and each change in a boolean sequence (<code>a &amp;&amp; b || c</code>) adds 1. Empty <code>else</code> blocks are ignored.</li>
                    <li><strong>Cyclomatic complexity</strong> is McCabe's count (branches, loops, cases, catch, logical operators).</li>
                    <li><strong>Halstead volume</strong> counts approximate operator/operand tokens in the function body; <strong>MI</strong> is the Maintainability Index (0\u2013100, higher is better) derived from volume, cyclomatic complexity and length.</li>
                </ul>

                <h3>\u2442 Function Flowcharts</h3>
                <p>Click the <strong>\u2442</strong> button next to a function to open its <strong>flowchart</strong> \u2014 built on demand from the source AST (JS/TS/TSX, Python, C, C++). Conditions fork into <strong>T</strong>/<strong>F</strong> branches that re-join, loops get a framed body with a <strong>back edge</strong>, <code>switch</code> cases line up as columns, and <code>try</code>/<code>catch</code>/<code>finally</code> stack as labelled frames. <strong>Red dashed</strong> boxes are <strong>dead code</strong> (unreachable after a return/throw); the badge shows the function's <strong>cognitive complexity</strong>, <strong>maintainability index</strong> and <strong>decision count</strong>.</p>
                <p><strong>Click a step</strong> to open the file at its line, and click an underlined <strong>call chip</strong> (<code>\u21B3 fn()</code>) to drill into the called function \u2014 the breadcrumb at the top walks back. <strong>\u2913 SVG</strong> exports a standalone vector file, the window drags by its header and resizes from any edge or corner, and <kbd>Esc</kbd> closes it.</p>

                <h3>\u{1F501} Symbol Cycles</h3>
                <p>Aura builds a function\u2192function call graph from every resolved call site. <strong>Direct recursion</strong> (<code>walk() \u2192 walk()</code>) and <strong>mutual recursion</strong> (<code>parse() \u2192 validate() \u2192 parse()</code>) are shown in the detail panel's <strong>\u{1F504} Symbol cycles</strong> section with the file and call line of every step, and the flowchart badge adds <strong>\u{1F501} recursive</strong> or <strong>\u{1F501} mutual recursion</strong>. Calls that resolve to several same-name candidates are marked <strong>ambiguous</strong> (confidence 0.5). Cycles are persisted in <code>.aura/graph.db</code> and exposed by the <code>find_cycles</code> MCP tool as <code>symbol_cycles</code>.</p>

                <h3>\u23F3 Time Travel</h3>
                <p>Navigate git history commit by commit. Changed files are color-coded: <span style="color:#00ff88">\u25CF green</span> = added, <span style="color:#ff2080">\u25CF pink</span> = removed, <span style="color:#ffff00">\u25CF yellow</span> = modified. Edges follow the same scheme. Press <kbd>V</kbd> or click <strong>\u21C4</strong> to enter <strong>Compare mode</strong> with a dual slider to diff any two commits.</p>

                <h3>\u270F\uFE0F Git Working Tree</h3>
                <p>Files with uncommitted changes wear a thin <span style="color:#ffb300">\u25CF amber ring</span> in the graph \u2014 read straight from <code>git status</code> (modified, staged, untracked, renamed, conflicts). The detail panel shows the exact state on its <strong>Git</strong> line.</p>
                <p>The <strong>\u270F\uFE0F Dirty</strong> toolbar button filters the graph down to those files (nodes and links); the <code>dirty</code> flag does the same in queries. The VS Code status bar shows the risk of the file you are editing and switches to <strong>\u26A0 N hotspots in your changes</strong> when your changes touch high-risk files \u2014 click it to reveal them in the Risk tab.</p>

                <h3>\u{1F4DD} Notes</h3>
                <p>Click a file node to annotate it: the detail panel's <strong>\u{1F4DD} Note</strong> section takes free text (up to 2 000 chars) plus one of five colors. Annotated files wear a <strong>pulsing note-colored ring + dot</strong> in the graph \u2014 animated, so they stay visible at any zoom.</p>
                <p>The <strong>\u{1F4DD} Notes</strong> toolbar button (next to \u270F\uFE0F Dirty) shows / hides the indicators; the <code>hasnote</code> query flag finds annotated files. When a file is modified after its note was written, the note header shows <strong>\u26A0\uFE0F \xC0 revoir</strong>, the badge counts stale notes and <strong>\u2713 Mark reviewed</strong> refreshes the note timestamp. The <strong>\u26A0\uFE0F Stale</strong> filter isolates those files; <code>stalenote</code> does the same in queries. Notes are stored in <code>.aura/annotations.json</code> \u2014 local to your workspace, never committed.</p>

                <h3>\u{1F4A0} PageRank Centrality</h3>
                <p>Aura computes a PageRank score over the structural <strong>code</strong> graph: a file is central when the files depending on it are themselves central. Documentation and <code>doc-reference</code> links are excluded. The detail panel shows the score, and the <strong>\u{1F4A0} Centrality</strong> toolbar button draws a soft violet halo around the <strong>top 10%</strong> most central code files. It is off by default to keep the graph readable and is saved with the view state.</p>
                <p>The optional <code>auraVisualizer.riskCentrality</code> setting replaces the fan-in percentile with the PageRank centrality percentile in the risk score (same 0.20 weight); the default is <code>false</code>, so existing scores are unchanged. <code>resolve_context</code> uses PageRank when the database provides it, falling back to fan-in otherwise.</p>

                <h3>\u{1F300} Warp Points</h3>
                <p>Save named camera bookmarks of the 3D view: the <strong>\u{1F300} Warps</strong> toolbar button opens the floating panel; its <strong>\u{1F4CC}</strong> button captures the current pose (camera position + view target + orientation). Click a warp to fly there (smooth 800 ms tween), re-capture or rename it, and assign quick slots \u2014 <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1\u20139</kbd> flies back from anywhere (plain <kbd>Alt</kbd>+<kbd>digit</kbd> is captured by VS Code). The <strong>\u{1F3E0} Home</strong> row returns to the default fit-to-view pose.</p>
                <p>Warps are stored in <code>.aura/warps.json</code> \u2014 local to your workspace, never committed.</p>

                <h3>\u{1F680} Pilot Mode (free flight)</h3>
                <p>The <strong>\u{1F680} Pilot</strong> toolbar button switches to free-flight navigation: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move (camera-relative \u2014 physical key layout, so AZERTY gets ZQSD), <kbd>Q</kbd>/<kbd>E</kbd> down/up, mouse look (click locks the pointer), mouse wheel adjusts the speed, <kbd>Shift</kbd> boosts. Hold the <strong>left mouse button</strong> to fly forward and the <strong>right button</strong> to fly backward \u2014 steer by looking; keys keep working in parallel. Press <kbd>Esc</kbd> to exit \u2014 or simply hit <kbd>Space</kbd> to toggle pilot mode on/off. The orbit controls take over seamlessly at the exact same view. Flight speed, smoothing, mouse sensitivity and Y-inversion live in <strong>\u2699\uFE0F Settings</strong>.</p>
                <p><strong>\u{1F3AE} Gamepad</strong> (DualSense, DualShock, Xbox \u2014 any pad reporting the W3C <em>standard</em> mapping, on by default): <strong>left stick</strong> translates, <strong>right stick</strong> looks (its rate follows the mouse-sensitivity setting), the analog <strong>L2</strong> descends and <strong>R2</strong> boosts proportionally to the trigger travel. <strong>\u2715</strong> resets the camera to a full-graph overview, a <strong>touchpad click</strong> re-aims at the graph centre without moving, <strong>d-pad \u2191/\u2193</strong> step the speed multiplier (like the wheel), <strong>Options</strong> resets it to \xD71 and <strong>\u25CB</strong> leaves the flight. Sticks pass a 15% deadzone and a response curve so fine nudges stay precise, and keyboard + pad inputs add up. Pads are only polled while flying \u2014 and a browser hides a pad until one of its buttons has been pressed once with the window focused. Turn it off with <code>auraVisualizer.gamepadEnabled</code> or the <strong>\u2699\uFE0F Settings</strong> checkbox.</p>

                <h3>\u{1F441} Follow Editor</h3>
                <p>When you switch editor tabs, the camera flies to the matching file and selects it exactly like a click \u2014 same glow, explorer selection and detail panel, at a fixed 120-unit close-up. This keeps the node readable even from a far overview and avoids creeping closer when alternating files. The <strong>\u{1F441}</strong> toolbar button toggles it; any manual orbit, pan or zoom pauses following so the camera never fights you \u2014 click \u{1F441} again to resume. The choice is saved in the view state and as the <code>auraVisualizer.followEditor</code> setting.</p>

                <h3>\u{1F4C2} Directory Filtering</h3>
                <p>In the <strong>File Explorer</strong> panel, each directory has a checkbox to show/hide its files in the graph. Use the <strong>All</strong> / <strong>None</strong> buttons for batch selection. Directories are checked by default.</p>

                <h3>\u{1F50D} Query Filter</h3>
                <p>Open the query bar with the <strong>\u{1F50D} button</strong> (far right of the tab bar) or <kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd> \u2014 it stays hidden until you need it. Type a boolean expression over node metrics, e.g. <code>complexity &gt; 20 AND fanIn &gt; 5</code>.</p>
                <p><strong>Fields:</strong> <code>complexity</code>, <code>cognitive</code>, <code>loc</code>, <code>fanin</code> / <code>fanout</code>, <code>size</code>, <code>mtime</code> / <code>lastmodified</code>, <code>symbols</code>, <code>deadexports</code>, <code>cochange</code>, <code>language</code>, <code>name</code>, <code>path</code>, <code>group</code>, <code>extension</code>, <code>community</code>, and flags <code>isorphan</code> / <code>isdead</code> / <code>incycle</code> / <code>ispinned</code> / <code>dirty</code> / <code>hasnote</code> / <code>stalenote</code>.</p>
                <p><strong>Operators:</strong> <code>==</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>~</code> (regex), <code>!~</code>, <code>in [ ... ]</code>, plus <code>AND</code> / <code>OR</code> / <code>NOT</code>.</p>
                <p><strong>Modes:</strong> <strong>Highlight</strong> (dim non-matching), <strong>Filter</strong> (hide non-matching), <strong>Select</strong> (multi-select). Press <strong>\u2B50</strong> to save a query and <strong>\u{1F4DA}</strong> to reopen saved ones.</p>

                <h3>\u2699\uFE0F In-App Settings</h3>
                <p>The <strong>\u2699\uFE0F button</strong> in the tab bar (next to \u{1F50D} Query) opens a settings modal \u2014 changes apply instantly and are saved to your workspace settings:</p>
                <table class="help-table">
                    <tr><td><strong>Risk history window</strong></td><td>30 / 90 / 365 days \u2014 drives the Risk Map, the status bar and hotspots</td></tr>
                    <tr><td><strong>PageRank centrality</strong></td><td>Use the PageRank percentile instead of fan-in in the risk score (off by default)</td></tr>
                    <tr><td><strong>Complexity trend threshold</strong></td><td>Complexity points per 30 days that flag a file as degrading</td></tr>
                    <tr><td><strong>Dead code exemptions</strong></td><td>Edit custom framework/test rules with the structured editor; stored in <code>.aura/dead-code.json</code>, defaults stay active</td></tr>
                    <tr><td><strong>Mouse rotation speed</strong></td><td>Slider 1\u20135 \u2014 speed when dragging the 3D graph</td></tr>
                    <tr><td><strong>Link style</strong></td><td>Straight or curved dependency edges (+ curvature)</td></tr>
                    <tr><td><strong>Selected node effect</strong></td><td>Glow halo or bloom post-processing (+ intensity / radius / threshold)</td></tr>
                    <tr><td><strong>Flight speed / smoothing</strong></td><td>Pilot mode base speed (scene-scaled) and acceleration damping</td></tr>
                    <tr><td><strong>Mouse look sensitivity / invert Y</strong></td><td>Pilot mode mouse-look feel</td></tr>
                    <tr><td><strong>Follow editor</strong></td><td>Fly to the active file; manual camera movement pauses it (\u{1F441})</td></tr>
                    <tr><td><strong>Auto-refresh on save</strong></td><td>Re-analyze changed files automatically</td></tr>
                </table>
                <p>The footer link opens the full <code>auraVisualizer.*</code> settings list in VS Code.</p>

                <h3>\u{1F517} Function Call Labels</h3>
                <p>In the detail panel, <code>function-call</code> links display the actual function name (e.g. <code>helper()</code>). For C/C++, function-call links are only created between files connected via <code>#include</code> \u2014 no false positives.</p>

                <h3>\u{1F9ED} Import Aliases</h3>
                <p>Aura resolves imports through your project configuration: <code>tsconfig.json</code>/<code>jsconfig.json</code> <strong>baseUrl + paths</strong> (including simple relative <code>extends</code>), static Vite/webpack <code>resolve.alias</code> entries, and Python <code>src/</code> layouts. Relative imports, extension/index probing, vendored suffix matches and basename fallbacks remain available. Aliased imports therefore create real edges instead of false orphan files, and the history worker uses the same resolver for consistent deltas.</p>

                <h3>\u{1F3AF} Edge Confidence</h3>
                <p>Each edge carries a resolution confidence: <strong>1.0</strong> exact/relative/alias, <strong>0.9</strong> extension/index, <strong>0.8</strong> suffix, <strong>0.6</strong> basename, <strong>0.5</strong> ambiguous (several candidates). Function calls score <strong>0.8</strong> for a unique target and <strong>0.5</strong> when ambiguous; inheritance is <strong>0.9</strong>. Use the <strong>Edge confidence</strong> toolbar selector to hide weaker links, and read the badge next to each dependency in the detail panel. Old databases default to <strong>1.0</strong>.</p>

                <h3>\u26A1 Instant Startup</h3>
                <p>The graph is cached in a local SQLite database (<code>.aura/graph.db</code>). On next launch, the cached graph loads instantly. A fingerprint (<code>git HEAD</code> + settings + parser version + file size/mtime list) skips analysis entirely when nothing changed; otherwise only added/modified/deleted files are re-parsed and sent as a delta. File saves still trigger incremental O(1) updates.</p>

                <h3>\u{1F4E4} Export for AI</h3>
                <p>The <strong>\u{1F4E4} Export</strong> button opens a guided export: choose <strong>Markdown</strong> or <strong>JSON</strong>, pick the sections (modules, contracts, hotspots, cycles, dead code) and a token budget (2k / 4k / 8k / 16k / no limit). The export estimates tokens at ~4 chars/token and reports any truncation explicitly. Save it or copy it straight into a prompt.</p>
                <p>Aura also includes a built-in MCP server and the <strong>@aura</strong> chat participant for direct AI integration.</p>
                <p>Use <strong>Aura: Export Architecture Report</strong> from the Command Palette to generate a Markdown document with a Mermaid module graph, top dependencies, hotspots, cycles and dead exports. Documentation files are excluded by default. <strong>Aura: Export Architecture Report with AI Narrative</strong> adds a written explanation generated from that deterministic report by the selected VS Code model.</p>
                <p><strong>Aura: Export Metrics (CSV/JSON)</strong> exports one row per file with LOC, complexity, cognitive max, fan-in/out, churn, authors and risk score, ready for a spreadsheet or a dashboard.</p>

                <h3>\u{1F5FA}\uFE0F Minimap</h3>
                <p>Toggle with the <strong>\u{1F5FA}\uFE0F Map</strong> button. Shows a top-down overview of all nodes. The white rectangle indicates the camera viewport. Click on the minimap to navigate. Drag the header to reposition.</p>

                <h3>\u{1F4D1} Tabbed Views</h3>
                <p>Switch between <strong>9 tabs</strong> in the tab bar for different perspectives:</p>
                <table class="help-table">
                    <tr><td><strong>\u2726 3D Graph</strong></td><td>Interactive 3D force-directed dependency graph</td></tr>
                    <tr><td><strong>\u{1F5FA}\uFE0F Treemap</strong></td><td>Files nested by directory, sized by LOC/complexity</td></tr>
                    <tr><td><strong>\u{1F5D1}\uFE0F Matrix</strong></td><td>N\xD7N Dependency Structure Matrix (DSM)</td></tr>
                    <tr><td><strong>\u{1F3B5} Chord</strong></td><td>Dependency flows between groups (directories/languages/communities)</td></tr>
                    <tr><td><strong>\u{1F4CA} Metrics</strong></td><td>Bar charts of LOC, complexity, fan-in/out</td></tr>
                    <tr><td><strong>\u{1F4C8} Timeline</strong></td><td>Metric evolution over git history</td></tr>
                    <tr><td><strong>\u{1F4CB} Table</strong></td><td>Sortable, filterable file spreadsheet (LOC, complexity, cognitive max, fan-in/out, symbols)</td></tr>
                    <tr><td><strong>\u{1F6E1}\uFE0F Risk</strong></td><td>Codebase risk dashboard (health score, churn, bus factor)</td></tr>
                    <tr><td><strong>\u{1F517} Co-change</strong></td><td>Temporal co-change pairs \u2014 files changing together without a direct dependency, with virtual graph links</td></tr>
                </table>

                <h3>\u{1F3DB}\uFE0F Architecture Rules</h3>
                <p>Create or edit <code>.aura/arch-rules.json</code> from the <strong>\u{1F3DB}\uFE0F Architecture</strong> tab or <strong>\u2699\uFE0F Settings \u2192 Architecture rules</strong>. The structured editor manages layers, deny targets, slices, cycles and exceptions with live validation; renaming a layer updates every rule. Layers are matched by glob (first match wins), deny rules follow the real dependency direction, <code>slices</code> isolate sibling feature folders, and <code>no-cycles</code> checks the aggregated file \u2192 layer graph.</p>
                <p>Only <strong>new</strong> violations alert once you baseline the current ones (<code>.aura/arch-baseline.json</code>). <strong>Ca</strong> = external files depending on a layer, <strong>Ce</strong> = external files it depends on, <strong>I = Ce / (Ca + Ce)</strong>. Documentation is outside the model: <code>.md</code> nodes and <code>doc-reference</code> edges are never evaluated.</p>
                <p>Query examples: <code>layer == domain AND archviolations > 0</code> and <code>isarchviolator</code>. The MCP tool <code>get_architecture_violations</code> exposes the same evaluation to AI agents.</p>

                <h3>\u{1F6E1}\uFE0F Risk Map</h3>
                <p>Open the <strong>\u{1F6E1}\uFE0F Risk</strong> tab for a codebase health dashboard. It uses a transparent risk score: <code>100 \xD7 (0.30\xB7complexity + 0.20\xB7fan-in + 0.10\xB7fan-out + 0.15\xB7cycle + 0.15\xB7dead-code + 0.10\xB7churn)</code>. Documentation is outside architectural risk: docs are not scored and <code>doc-reference</code> links do not inflate fan-in or PageRank. Exempted framework symbols are not counted as dead code.</p>
                <p>Complexity, fan-in, fan-out and churn are <strong>percentile ranks inside your repository</strong> (0 = lowest file, 1 = highest), so the score is a standing relative to this codebase. A <strong>History window</strong> selector (30 / 90 / 365 days) drives churn, scoring and explanations. Churn is <strong>rename-aware</strong>: files moved with <code>git mv</code> keep their history across the rename.</p>
                <p>High / Medium / Low file lists are collapsible, each row explains <em>why</em> a file scores that way, and clicking a file selects it in the 3D graph. Also included: <strong>\u{1F4C8} Risk Trend</strong>, <strong>\u{1F4C8} Complexity Trend</strong> (per-file sparklines + slope), <strong>\u{1F525} Recently Hot</strong> (last 30 days), <strong>\u{1F4CA} Churn \xD7 Complexity</strong> scatter (log scale), and <strong>\u{1F464} Bus Factor</strong> (files with a single author). Use <strong>\u{1F4E4} Export Report</strong> to write <code>.aura/risk-report.md</code>.</p>
                <p><strong>Complexity Trend</strong> is rebuilt from Time Travel commit deltas: a least-squares slope per 30 days plus R\xB2 flags files whose complexity keeps growing. The <strong>Trend</strong> column in the Table is sortable; adjust the threshold with <code>auraVisualizer.complexityTrendThreshold</code> (default 0.5 point / 30 days).</p>

                <h3>\u{1F517} Temporal Co-change</h3>
                <p>The <strong>\u{1F517} Co-change</strong> tab finds files that keep changing in the same commits <em>without</em> a direct import/dependency \u2014 an implicit contract (API + client, test + implementation, shared config\u2026). Run Time Travel (\u23F1\uFE0F) first so git history is available.</p>
                <p>Pairs are ranked by <strong>Jaccard</strong> = <code>cochanges / (A commits + B commits \u2212 cochanges)</code>; <strong>support</strong> is the share of analysed multi-file commits touching both files. Renames are followed, deletions and giant commits (&gt;50 files) are ignored. <strong>Show on graph</strong> adds virtual magenta links for the strongest pairs; the <strong>\u{1F517} Co-change</strong> filter toggles them and the heatmap mode colors files by their strongest coupling score. Queries can use <code>cochange &gt; 0.6</code>.</p>

                <h3>\u{1F517} Edge Colors</h3>
                <table class="help-table">
                    <tr><td><span style="color:#4fc3f7">\u2501\u2501</span> <strong>include</strong></td><td>C <code>#include "file.h"</code></td></tr>
                    <tr><td><span style="color:#4fc3f755">\u2501\u2501</span> <strong>system-include</strong></td><td>C <code>#include &lt;stdlib.h&gt;</code></td></tr>
                    <tr><td><span style="color:#ffd54f">\u2501\u2501</span> <strong>import</strong></td><td>JS/TS <code>import</code></td></tr>
                    <tr><td><span style="color:#ffd54f88">\u2501\u2501</span> <strong>require</strong></td><td>CommonJS <code>require()</code></td></tr>
                    <tr><td><span style="color:#ffd54f66">\u2501\u2501</span> <strong>dynamic-import</strong></td><td><code>import()</code> expressions</td></tr>
                    <tr><td><span style="color:#81c784">\u2501\u2501</span> <strong>function-call</strong></td><td>Cross-file function calls</td></tr>
                    <tr><td><span style="color:#f06292">\u2501\u2501</span> <strong>extends</strong></td><td>Class / struct inheritance</td></tr>
                    <tr><td><span style="color:#ba68c8">\u2501\u2501</span> <strong>implements</strong></td><td>Interface / trait implementation</td></tr>
                    <tr><td><span style="color:#ff8a65">\u2501\u2501</span> <strong>script</strong></td><td>HTML <code>&lt;script src&gt;</code> / script path built with <code>join()</code> or <code>joinPath()</code></td></tr>
                    <tr><td><span style="color:#ce93d8">\u2501\u2501</span> <strong>stylesheet</strong></td><td>HTML <code>&lt;link rel="stylesheet"&gt;</code> / CSS <code>@import</code> / stylesheet path built with <code>join()</code></td></tr>
                    <tr><td><span style="color:#b0bec5">\u2508\u2508</span> <strong>doc-reference</strong></td><td>Symbol / filename mention inside a <code>.md</code> / <code>.txt</code> / <code>.rst</code> file</td></tr>
                    <tr><td><span style="color:#e879f9">\u2501\u2501</span> <strong>co-change</strong></td><td>Virtual temporal-coupling link (not a code dependency)</td></tr>
                </table>

                <h3>\u{1F4C4} Documentation in the Graph</h3>
                <p>Markdown, plain-text and reStructuredText files (<code>.md</code>, <code>.markdown</code>, <code>.txt</code>, <code>.rst</code>) are first-class nodes. They are <strong>hidden by default</strong> \u2014 toggle the <strong>\u{1F4C4} Docs</strong> button in the toolbar to show them.</p>
                <p>Thin dotted <code>doc-reference</code> edges automatically link each doc file to the code files it mentions \u2014 detected from symbol names (functions, classes, methods, exports) and basenames like <code>extension.ts</code>. These edges do <em>not</em> count toward fan-in / fan-out, so hotspot metrics stay clean.</p>
                <p>Doc content is chunked by heading and indexed in a full-text search index. AI assistants can query it through the <code>search_docs</code> MCP tool.</p>
            </div>
        </div>
    </div>

    <!-- Libraries: THREE must load before 3d-force-graph (it checks window.THREE) -->
    <script nonce="${nonce}">window.AURA_CONFIG = ${auraConfig};</script>
    <script nonce="${nonce}" src="${threeUri}"></script>
    <script nonce="${nonce}" src="${forceGraphUri}"></script>
    <!-- App Logic -->
    <script nonce="${nonce}" src="${configUri}"></script>
    <script nonce="${nonce}" src="${cochangeCoreUri}"></script>
    <script nonce="${nonce}" src="${trendCoreUri}"></script>
    <script nonce="${nonce}" src="${trendUiUri}"></script>
    <script nonce="${nonce}" src="${queryUri}"></script>
    <script nonce="${nonce}" src="${structureUri}"></script>
    <script nonce="${nonce}" src="${riskUri}"></script>
    <script nonce="${nonce}" src="${archCoreUri}"></script>
    <script nonce="${nonce}" src="${deadCodeCoreUri}"></script>
    <script nonce="${nonce}" src="${flightCoreUri}"></script>
    <script nonce="${nonce}" src="${flightUri}"></script>
    <script nonce="${nonce}" src="${flowUri}"></script>
    <script nonce="${nonce}" src="${viewsUri}"></script>
    <script nonce="${nonce}" src="${warpsUri}"></script>
    <script nonce="${nonce}" src="${timelineUri}"></script>
    <script nonce="${nonce}" src="${riskMapUri}"></script>
    <script nonce="${nonce}" src="${archPanelUri}"></script>
    <script nonce="${nonce}" src="${deadCodeEditorUri}"></script>
    <script nonce="${nonce}" src="${detailUri}"></script>
    <script nonce="${nonce}" src="${queryUiUri}"></script>
    <script nonce="${nonce}" src="${exportUri}"></script>
    <script nonce="${nonce}" src="${spritesUri}"></script>
    <script nonce="${nonce}" src="${panelsUri}"></script>
    <script nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
  }
};
function getNonce() {
  const array = new Uint8Array(16);
  require("crypto").randomFillSync(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// src/AuraTreeProvider.ts
var vscode3 = __toESM(require("vscode"));
var AuraTreeItem = class extends vscode3.TreeItem {
  constructor(entry, collapsible) {
    const label = entry.kind === "file" ? entry.node.name : entry.kind === "stat" ? `${entry.label}: ${entry.value}` : entry.label;
    super(label, collapsible);
    this.entry = entry;
    if (entry.kind === "header") {
      this.iconPath = new vscode3.ThemeIcon(entry.icon);
    } else if (entry.kind === "stat") {
      this.iconPath = new vscode3.ThemeIcon(entry.icon);
    } else if (entry.kind === "file") {
      this.contextValue = "auraFile";
      this.description = entry.metric;
      this.iconPath = new vscode3.ThemeIcon("file");
      this.command = {
        command: "auraVisualizer.openFileFromTree",
        title: "Open File",
        arguments: [entry.node.path]
      };
      this.tooltip = `${entry.node.path}
Complexity: ${entry.node.complexity}
Lines: ${entry.node.linesOfCode}
Fan-in: ${entry.node.fanIn} / Fan-out: ${entry.node.fanOut}`;
    }
  }
};
var AuraTreeProvider = class {
  _onDidChangeTreeData = new vscode3.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data;
  update(data) {
    this.data = data;
    this._onDidChangeTreeData.fire(void 0);
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!this.data) {
      return [new AuraTreeItem(
        { kind: "stat", label: "No data", value: "Open a workspace and run Aura", icon: "info" },
        vscode3.TreeItemCollapsibleState.None
      )];
    }
    if (!element) {
      return [
        new AuraTreeItem({ kind: "header", label: "Stats", icon: "graph" }, vscode3.TreeItemCollapsibleState.Expanded),
        new AuraTreeItem({ kind: "header", label: "Most Complex", icon: "flame" }, vscode3.TreeItemCollapsibleState.Collapsed),
        new AuraTreeItem({ kind: "header", label: "Largest Files", icon: "file-binary" }, vscode3.TreeItemCollapsibleState.Collapsed),
        new AuraTreeItem({ kind: "header", label: "Orphan Files", icon: "warning" }, vscode3.TreeItemCollapsibleState.Collapsed)
      ];
    }
    if (element.entry.kind !== "header")
      return [];
    const d = this.data;
    switch (element.entry.label) {
      case "Stats": {
        const langs = Object.entries(d.meta.languageStats).map(([lang, s]) => `${lang}: ${s.count}`).join(", ");
        return [
          this.stat("Files", String(d.meta.totalFiles), "file"),
          this.stat("Links", String(d.meta.totalLinks), "link"),
          this.stat("Function Calls", String(d.meta.functionCallLinks), "symbol-method"),
          this.stat("Groups", String(d.meta.groups.length), "folder"),
          this.stat("Languages", langs, "symbol-color")
        ];
      }
      case "Most Complex": {
        return [...d.nodes].sort((a, b) => b.complexity - a.complexity).slice(0, 10).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: `complexity: ${n.complexity}` },
          vscode3.TreeItemCollapsibleState.None
        ));
      }
      case "Largest Files": {
        return [...d.nodes].sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 10).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: `${n.linesOfCode} lines` },
          vscode3.TreeItemCollapsibleState.None
        ));
      }
      case "Orphan Files": {
        return d.nodes.filter((n) => n.fanIn === 0 && n.fanOut === 0).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: n.language },
          vscode3.TreeItemCollapsibleState.None
        ));
      }
      default:
        return [];
    }
  }
  stat(label, value, icon) {
    return new AuraTreeItem(
      { kind: "stat", label, value, icon },
      vscode3.TreeItemCollapsibleState.None
    );
  }
};

// src/analyzer/scanner.ts
var import_promises = require("fs/promises");
var import_path = require("path");
var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".c", ".h", ".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".hh", ".js", ".jsx", ".ts", ".tsx", ".py", ".css", ".html", ".htm", ".java", ".go", ".rs", ".kt", ".kts", ".rb", ".swift", ".cs", ".php", ".vue", ".sh", ".bash", ".lua", ".md", ".markdown", ".txt", ".rst"]);
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
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "tsx",
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
var SKIP_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  "out",
  ".next",
  "__pycache__",
  ".vscode",
  ".idea",
  "Backup",
  "Tests"
]);
async function scanFileSignatures(rootDir, options = {}) {
  const extensions = options.extensions || SUPPORTED_EXTENSIONS;
  const skipDirs = /* @__PURE__ */ new Set([...SKIP_DIRS, ...options.skipDirs || []]);
  const skipDirsLower = new Set([...skipDirs].map((d) => d.toLowerCase()));
  const signatures = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await (0, import_promises.readdir)(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = (0, import_path.join)(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirsLower.has(entry.name.toLowerCase()))
          await walk(fullPath);
        continue;
      }
      if (!entry.isFile())
        continue;
      const ext = (0, import_path.extname)(entry.name).toLowerCase();
      if (!extensions.has(ext))
        continue;
      try {
        const fileStat = await (0, import_promises.stat)(fullPath);
        signatures.push({
          path: (0, import_path.relative)(rootDir, fullPath),
          size: fileStat.size,
          mtimeMs: Math.floor(fileStat.mtimeMs)
        });
      } catch {
      }
    }
  }
  await walk(rootDir);
  return signatures;
}
async function scanSingleFile(fullPath, rootDir) {
  const ext = (0, import_path.extname)(fullPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext))
    return null;
  try {
    const fileStat = await (0, import_promises.stat)(fullPath);
    const content = await (0, import_promises.readFile)(fullPath, "utf-8");
    const linesOfCode = content.split("\n").filter((l) => l.trim().length > 0).length;
    const relativePath = (0, import_path.relative)(rootDir, fullPath);
    const parts = relativePath.split("/");
    const group = parts.length > 1 ? parts[0] : "/";
    const name = parts[parts.length - 1];
    return {
      id: relativePath,
      name,
      path: relativePath,
      fullPath,
      language: LANGUAGE_MAP[ext] || "unknown",
      extension: ext,
      size: fileStat.size,
      linesOfCode,
      lastModified: Math.floor(fileStat.mtimeMs),
      group,
      content
    };
  } catch {
    return null;
  }
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
var ASSET_REF_RE = /^(?:\.{0,2}\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|cjs|css)$/i;
var PATH_JOIN_FN_RE = /(?:^|\.)(?:join|joinPath)$/;
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
    const seen = new Set(relations.map((r) => r.target));
    this.walkForAssetRefs(tree.rootNode, fileInfo.id, relations, seen);
    return relations;
  }
  /**
   * Emit `script` / `stylesheet` relations for asset paths built with
   * path.join() or vscode.Uri.joinPath(). Those files are loaded at runtime
   * (webview scripts, stylesheets) but never imported, so they would
   * otherwise appear isolated in the graph.
   */
  walkForAssetRefs(node, sourceId, relations, seen) {
    if (node.type === "string" || node.type === "template_string") {
      if (this.isJoinPathArgument(node)) {
        const target = this.stripQuotes(node.text);
        if (ASSET_REF_RE.test(target) && !seen.has(target)) {
          const type = /\.css$/i.test(target) ? "stylesheet" : "script";
          relations.push({ source: sourceId, target, type, label: `${type} '${target}'` });
          seen.add(target);
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForAssetRefs(node.child(i), sourceId, relations, seen);
    }
  }
  /** True when the string node is a direct argument of join()/joinPath(). */
  isJoinPathArgument(node) {
    const args2 = node.parent;
    if (!args2 || args2.type !== "arguments") {
      return false;
    }
    const call = args2.parent;
    if (!call || call.type !== "call_expression") {
      return false;
    }
    const fn = call.childForFieldName("function");
    return !!fn && PATH_JOIN_FN_RE.test(fn.text);
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
        type: isGetter ? "getter" : isSetter ? "setter" : "method",
        line: member.startPosition.row + 1
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
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"') || text.startsWith("`") && text.endsWith("`")) {
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

// src/analyzer/parsers/ts-tsx-parser.ts
var TreeSitterTsxParser = class extends TreeSitterTSParser {
  constructor() {
    super();
    this.language = "tsx";
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

// src/flow/flow-core.ts
var MAX_TEXT = 160;
var JS_FUNCTIONS = [
  "function_declaration",
  "function_expression",
  "generator_function",
  "generator_function_declaration",
  "arrow_function",
  "method_definition"
];
var JAVASCRIPT_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  elseWrapperTypes: ["else_clause"],
  // the JS grammar wraps else bodies
  loops: [
    { node: "for_statement", label: "for", headerFields: ["initializer", "condition", "increment"] },
    { node: "for_in_statement", label: "foreach" },
    { node: "while_statement", label: "while", headerFields: ["condition"] },
    { node: "do_statement", label: "do", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  switchNode: "switch_statement",
  switchValueField: "value",
  switchCaseTypes: ["switch_case", "switch_default"],
  switchCaseLabelField: "value",
  tryNode: "try_statement",
  tryBodyField: "body",
  catchTypes: ["catch_clause"],
  catchParamField: "parameter",
  finallyTypes: ["finally_clause"],
  finallyBodyField: "body",
  jumps: {
    return_statement: "return",
    throw_statement: "throw",
    break_statement: "break",
    continue_statement: "continue"
  },
  callNode: "call_expression",
  callFuncField: "function",
  ternaryNode: "ternary_expression",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||"],
  operatorField: "operator",
  functions: JS_FUNCTIONS,
  scopeOnly: ["class_declaration", "class"],
  commentTypes: ["comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["statement_block"]
};
var PYTHON_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  elseIfTypes: ["elif_clause"],
  elseWrapperTypes: ["else_clause"],
  loops: [
    { node: "for_statement", label: "for", headerFields: ["left", "right"], joinWith: " in " },
    { node: "while_statement", label: "while", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  tryNode: "try_statement",
  tryBodyField: "body",
  catchTypes: ["except_clause"],
  finallyTypes: ["finally_clause"],
  finallyBodyField: "body",
  jumps: {
    return_statement: "return",
    raise_statement: "throw",
    break_statement: "break",
    continue_statement: "continue"
  },
  callNode: "call",
  callFuncField: "function",
  ternaryNode: "conditional_expression",
  logicalNodeTypes: ["boolean_operator"],
  logicalOperators: ["and", "or"],
  operatorField: "operator",
  functions: ["function_definition"],
  scopeOnly: ["lambda", "class_definition"],
  commentTypes: ["comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["block"]
};
var C_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  loops: [
    { node: "for_statement", label: "for", headerFields: ["initializer", "condition", "update"] },
    { node: "while_statement", label: "while", headerFields: ["condition"] },
    { node: "do_statement", label: "do", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  switchNode: "switch_statement",
  switchValueField: "condition",
  switchCaseTypes: ["case_statement"],
  switchCaseLabelField: "value",
  elseWrapperTypes: ["else_clause"],
  jumps: {
    return_statement: "return",
    break_statement: "break",
    continue_statement: "continue",
    goto_statement: "goto"
  },
  callNode: "call_expression",
  callFuncField: "function",
  ternaryNode: "conditional_expression",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||"],
  operatorField: "operator",
  functions: ["function_definition"],
  commentTypes: ["comment"],
  bodyField: "body",
  blockTypes: ["compound_statement"]
};
var CPP_PROFILE = {
  ...C_PROFILE,
  loops: [
    ...C_PROFILE.loops,
    { node: "for_range_loop", label: "foreach", headerFields: ["declarator", "right"] }
  ],
  tryNode: "try_statement",
  tryBodyField: "body",
  catchTypes: ["catch_clause"],
  jumps: {
    ...C_PROFILE.jumps,
    throw_statement: "throw"
  },
  scopeOnly: ["class_specifier", "namespace_definition", "lambda_expression"]
};
var FLOW_PROFILES = {
  javascript: JAVASCRIPT_PROFILE,
  typescript: JAVASCRIPT_PROFILE,
  tsx: JAVASCRIPT_PROFILE,
  python: PYTHON_PROFILE,
  c: C_PROFILE,
  cpp: CPP_PROFILE
};
var JAVA_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  loops: [
    { node: "for_statement", label: "for", headerFields: ["init", "condition", "update"] },
    { node: "enhanced_for_statement", label: "foreach" },
    { node: "while_statement", label: "while", headerFields: ["condition"] },
    { node: "do_statement", label: "do", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  switchNode: "switch_expression",
  switchValueField: "condition",
  switchCaseTypes: ["switch_block_statement_group", "switch_rule"],
  tryNode: "try_statement",
  tryBodyField: "body",
  catchTypes: ["catch_clause"],
  finallyTypes: ["finally_clause"],
  finallyBodyField: "body",
  jumps: {
    return_statement: "return",
    throw_statement: "throw",
    break_statement: "break",
    continue_statement: "continue",
    yield_statement: "yield"
  },
  callNode: "method_invocation",
  callFuncField: "name",
  ternaryNode: "ternary_expression",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||"],
  operatorField: "operator",
  functions: ["method_declaration", "constructor_declaration"],
  scopeOnly: ["class_declaration", "interface_declaration", "enum_declaration", "record_declaration", "lambda_expression"],
  commentTypes: ["line_comment", "block_comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["block", "constructor_body", "switch_block"]
};
var GO_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  loops: [{ node: "for_statement", label: "for" }],
  loopBodyField: "body",
  switchNode: "expression_switch_statement",
  switchValueField: "value",
  switchCaseTypes: ["expression_case", "default_case"],
  jumps: {
    return_statement: "return",
    break_statement: "break",
    continue_statement: "continue",
    goto_statement: "goto"
  },
  callNode: "call_expression",
  callFuncField: "function",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||"],
  operatorField: "operator",
  functions: ["function_declaration", "method_declaration"],
  scopeOnly: ["func_literal"],
  commentTypes: ["comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["block"]
};
var RUST_COGNITIVE_PROFILE = {
  ifNode: "if_expression",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  elseWrapperTypes: ["else_clause"],
  loops: [
    { node: "for_expression", label: "for", headerFields: ["pattern", "value"] },
    { node: "while_expression", label: "while", headerFields: ["condition"] },
    { node: "loop_expression", label: "loop" }
  ],
  loopBodyField: "body",
  switchNode: "match_expression",
  switchValueField: "value",
  switchCaseTypes: ["match_arm"],
  jumps: {
    return_expression: "return",
    break_expression: "break",
    continue_expression: "continue"
  },
  callNode: "call_expression",
  callFuncField: "function",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||"],
  operatorField: "operator",
  functions: ["function_item"],
  scopeOnly: ["closure_expression", "impl_item"],
  commentTypes: ["line_comment", "block_comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["block", "match_block"]
};
var CSHARP_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  loops: [
    { node: "for_statement", label: "for", headerFields: ["initializer", "condition", "update"] },
    { node: "foreach_statement", label: "foreach" },
    { node: "while_statement", label: "while", headerFields: ["condition"] },
    { node: "do_statement", label: "do", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  switchNode: "switch_statement",
  switchValueField: "value",
  switchCaseTypes: ["switch_section"],
  tryNode: "try_statement",
  tryBodyField: "body",
  catchTypes: ["catch_clause"],
  finallyTypes: ["finally_clause"],
  finallyBodyField: "body",
  jumps: {
    return_statement: "return",
    throw_statement: "throw",
    break_statement: "break",
    continue_statement: "continue",
    goto_statement: "goto"
  },
  callNode: "invocation_expression",
  callFuncField: "function",
  ternaryNode: "conditional_expression",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||"],
  operatorField: "operator",
  functions: ["method_declaration", "local_function_statement", "constructor_declaration"],
  scopeOnly: ["class_declaration", "struct_declaration", "interface_declaration", "lambda_expression"],
  commentTypes: ["comment", "line_comment", "block_comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["block", "switch_body"]
};
var PHP_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "body",
  ifElseField: "alternative",
  elseIfTypes: ["else_if_clause"],
  elseWrapperTypes: ["else_clause"],
  loops: [
    { node: "for_statement", label: "for", headerFields: ["initialize", "condition", "update"] },
    { node: "foreach_statement", label: "foreach" },
    { node: "while_statement", label: "while", headerFields: ["condition"] },
    { node: "do_statement", label: "do", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  switchNode: "switch_statement",
  switchValueField: "condition",
  switchCaseTypes: ["case_statement", "default_statement"],
  tryNode: "try_statement",
  tryBodyField: "body",
  catchTypes: ["catch_clause"],
  finallyTypes: ["finally_clause"],
  finallyBodyField: "body",
  jumps: {
    return_statement: "return",
    throw_expression: "throw",
    break_statement: "break",
    continue_statement: "continue"
  },
  callNode: "function_call_expression",
  callFuncField: "function",
  ternaryNode: "conditional_expression",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["&&", "||", "and", "or"],
  operatorField: "operator",
  functions: ["function_definition", "method_declaration"],
  scopeOnly: ["class_declaration", "anonymous_function_creation_expression", "arrow_function"],
  commentTypes: ["comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["compound_statement", "switch_block"]
};
var KOTLIN_COGNITIVE_PROFILE = {
  ifNode: "if_expression",
  ifCondField: "",
  ifThenField: "",
  ifElseField: "",
  ifPositional: true,
  ifBodyTypes: ["control_structure_body"],
  loops: [
    { node: "for_statement", label: "for" },
    { node: "while_statement", label: "while" },
    { node: "do_while_statement", label: "do" }
  ],
  loopBodyField: "body",
  switchNode: "when_expression",
  switchCaseTypes: ["when_entry"],
  tryNode: "try_expression",
  catchTypes: ["catch_block"],
  finallyTypes: ["finally_block"],
  jumps: { jump_expression: "jump" },
  callNode: "call_expression",
  logicalNodeTypes: ["conjunction_expression", "disjunction_expression"],
  logicalOperators: ["&&", "||"],
  functions: ["function_declaration"],
  scopeOnly: ["class_declaration", "object_declaration", "lambda_literal", "anonymous_function"],
  commentTypes: ["line_comment", "multiline_comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["statements", "control_structure_body", "function_body", "block"]
};
var SWIFT_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "",
  ifElseField: "",
  ifPositional: true,
  ifBodyTypes: ["statements"],
  loops: [
    { node: "for_statement", label: "for", headerFields: ["item", "collection"] },
    { node: "while_statement", label: "while", headerFields: ["condition"] },
    { node: "repeat_while_statement", label: "repeat", headerFields: ["condition"] }
  ],
  loopBodyField: "body",
  switchNode: "switch_statement",
  switchValueField: "expr",
  switchCaseTypes: ["switch_entry"],
  tryNode: "do_statement",
  catchTypes: ["catch_block"],
  jumps: { control_transfer_statement: "jump" },
  callNode: "call_expression",
  ternaryNode: "ternary_expression",
  logicalNodeTypes: ["conjunction_expression", "disjunction_expression"],
  logicalOperators: ["&&", "||"],
  functions: ["function_declaration"],
  scopeOnly: ["class_declaration", "struct_declaration", "closure_expression", "lambda_literal"],
  commentTypes: ["line_comment", "block_comment", "multiline_comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["statements", "function_body"]
};
var LUA_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "consequence",
  ifElseField: "alternative",
  elseIfTypes: ["elseif_clause"],
  elseWrapperTypes: ["else_clause"],
  loops: [
    { node: "for_statement", label: "for" },
    { node: "while_statement", label: "while" },
    { node: "repeat_statement", label: "repeat" }
  ],
  loopBodyField: "body",
  jumps: {
    return_statement: "return",
    break_statement: "break",
    goto_statement: "goto"
  },
  callNode: "function_call",
  logicalNodeTypes: ["binary_expression"],
  logicalOperators: ["and", "or"],
  operatorField: "operator",
  functions: ["function_definition_statement", "local_function_definition_statement"],
  scopeOnly: ["function_definition"],
  commentTypes: ["comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["block"]
};
var BASH_COGNITIVE_PROFILE = {
  ifNode: "if_statement",
  ifCondField: "condition",
  ifThenField: "",
  ifElseField: "",
  ifPositional: true,
  ifBodyTypes: [],
  elseIfTypes: ["elif_clause"],
  elseWrapperTypes: ["else_clause"],
  loops: [
    { node: "for_statement", label: "for" },
    { node: "c_style_for_statement", label: "for" },
    { node: "while_statement", label: "while" }
  ],
  loopBodyField: "body",
  jumps: {},
  logicalNodeTypes: ["list"],
  logicalOperators: ["&&", "||"],
  functions: ["function_definition"],
  commentTypes: ["comment"],
  bodyField: "body",
  nameField: "name",
  blockTypes: ["compound_statement"]
};
var COGNITIVE_PROFILES = {
  ...FLOW_PROFILES,
  java: JAVA_COGNITIVE_PROFILE,
  go: GO_COGNITIVE_PROFILE,
  rust: RUST_COGNITIVE_PROFILE,
  csharp: CSHARP_COGNITIVE_PROFILE,
  php: PHP_COGNITIVE_PROFILE,
  kotlin: KOTLIN_COGNITIVE_PROFILE,
  swift: SWIFT_COGNITIVE_PROFILE,
  lua: LUA_COGNITIVE_PROFILE,
  bash: BASH_COGNITIVE_PROFILE
};
function cognitiveProfile(language) {
  return COGNITIVE_PROFILES[normalizeFlowLanguage(language)];
}
function normalizeFlowLanguage(language) {
  if (language.indexOf("cpp") === 0)
    return "cpp";
  if (language.indexOf("c-") === 0)
    return "c";
  return language;
}
var OPERAND_NODE_TYPES = /* @__PURE__ */ new Set([
  "identifier",
  "property_identifier",
  "field_identifier",
  "type_identifier",
  "simple_identifier",
  "scoped_identifier",
  "variable_name",
  "name",
  "word",
  "shorthand_property_identifier",
  "shorthand_property_identifier_pattern",
  "number",
  "integer",
  "float",
  "number_literal",
  "integer_literal",
  "float_literal",
  "int_literal",
  "decimal_integer_literal",
  "hex_integer_literal",
  "octal_integer_literal",
  "binary_integer_literal",
  "real_literal",
  "character_literal",
  "char_literal",
  "string",
  "string_literal",
  "template_string",
  "raw_string_literal",
  "interpreted_string_literal",
  "line_string_literal",
  "multi_line_string_literal",
  "string_content",
  "encapsed_string",
  "boolean_literal",
  "true",
  "false",
  "null",
  "null_literal",
  "none",
  "nil",
  "undefined",
  "unit",
  "this",
  "self",
  "super"
]);
function recordOperator(ctx, token) {
  const op = collapse(token, 24);
  if (!op)
    return;
  ctx.operators.add(op);
  ctx.totalOperators++;
}
function recordOperand(ctx, token) {
  const operand = collapse(token, 40);
  if (!operand)
    return;
  ctx.operands.add(operand);
  ctx.totalOperands++;
}
function isLogicalNode(node, profile) {
  if (!profile.logicalNodeTypes || !profile.logicalNodeTypes.includes(node.type))
    return false;
  const op = logicalOperator(node, profile);
  return !profile.logicalOperators || profile.logicalOperators.includes(op);
}
function directOperator(node, profile) {
  const field = profile.operatorField || "operator";
  const op = node.childForFieldName(field);
  if (op)
    return op.text.trim();
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (!child || child.isNamed())
      continue;
    const text = child.text.trim();
    if (!text || text.length > 4)
      continue;
    if (/^[(){}[\],;.]$/.test(text))
      continue;
    return text;
  }
  return "";
}
function logicalOperator(node, profile) {
  const direct = directOperator(node, profile);
  if (direct)
    return direct;
  const match = node.text.match(/&&|\|\||\b(?:and|or)\b/);
  return match ? match[0] : "";
}
function collectLogicalOperators(node, profile, out2) {
  if (!isLogicalNode(node, profile))
    return;
  const op = logicalOperator(node, profile);
  const children = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child)
      children.push(child);
  }
  if (children.length >= 2) {
    collectLogicalOperators(children[0], profile, out2);
    if (op)
      out2.push(op);
    for (let i = 1; i < children.length; i++) {
      collectLogicalOperators(children[i], profile, out2);
    }
  } else {
    if (op)
      out2.push(op);
    for (const child of children)
      collectLogicalOperators(child, profile, out2);
  }
}
function bodyIsMeaningful(node, profile) {
  const body2 = bodyNode(node, profile.bodyField, profile);
  if (body2) {
    return statementNodes(body2, profile).some((s) => !isSkippable(s, profile));
  }
  const wrapper = wrapperStatements(node, profile);
  if (wrapper.length > 0)
    return wrapper.some((s) => !isSkippable(s, profile));
  return !isSkippable(node, profile);
}
function walkMeasuredBody(body2, nesting, ctx) {
  if (!body2)
    return;
  const statements = statementNodes(body2, ctx.profile);
  for (const statement of statements)
    measureNode(statement, nesting, false, ctx);
}
function walkMeasuredStatements(statements, nesting, ctx) {
  for (const statement of statements)
    measureNode(statement, nesting, false, ctx);
}
function namedChildren(node) {
  const out2 = [];
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child)
      out2.push(child);
  }
  return out2;
}
function isIfLike(node, profile) {
  return node.type === profile.ifNode || !!(profile.elseIfTypes && profile.elseIfTypes.includes(node.type));
}
function findSingleIf(node, profile, depth = 0) {
  if (isIfLike(node, profile))
    return node;
  if (depth >= 4)
    return null;
  const children = namedChildren(node);
  if (children.length === 1)
    return findSingleIf(children[0], profile, depth + 1);
  return null;
}
var IF_KEYWORDS = /* @__PURE__ */ new Set(["else", "else_keyword", "elseif", "elif", "then", "do"]);
function positionalIfParts(node, profile) {
  const children = namedChildren(node).filter((c) => !IF_KEYWORDS.has(c.type));
  let condition = profile.ifCondField ? node.childForFieldName(profile.ifCondField) : null;
  if (!condition) {
    condition = children.find((c) => !isIfLike(c, profile) && !(profile.ifBodyTypes && profile.ifBodyTypes.includes(c.type)) && !profile.blockTypes.includes(c.type) && !(profile.elseWrapperTypes && profile.elseWrapperTypes.includes(c.type))) || null;
  }
  const start2 = condition ? children.indexOf(condition) + 1 : 0;
  let thenNode = null;
  if (profile.ifThenField)
    thenNode = node.childForFieldName(profile.ifThenField);
  if (!thenNode) {
    const bodyTypes = profile.ifBodyTypes && profile.ifBodyTypes.length > 0 ? profile.ifBodyTypes : profile.blockTypes;
    for (let i = start2; i < children.length; i++) {
      if (bodyTypes.includes(children[i].type)) {
        thenNode = children[i];
        break;
      }
    }
  }
  if (thenNode) {
    return {
      condition,
      thenNodes: statementNodes(thenNode, profile),
      alternatives: children.slice(children.indexOf(thenNode) + 1)
    };
  }
  let altStart = -1;
  for (let i = start2; i < children.length; i++) {
    if (isIfLike(children[i], profile) || profile.elseWrapperTypes && profile.elseWrapperTypes.includes(children[i].type)) {
      altStart = i;
      break;
    }
  }
  return {
    condition,
    thenNodes: children.slice(start2, altStart < 0 ? children.length : altStart),
    alternatives: altStart < 0 ? [] : children.slice(altStart)
  };
}
function measurePositionalIf(node, nesting, elseIf, ctx) {
  const p = ctx.profile;
  ctx.cognitive += elseIf ? 1 : 1 + nesting;
  ctx.cyclomatic += 1;
  recordOperator(ctx, elseIf ? "else if" : "if");
  const parts = positionalIfParts(node, p);
  if (parts.condition)
    measureNode(parts.condition, nesting, false, ctx);
  walkMeasuredStatements(parts.thenNodes, nesting + 1, ctx);
  for (const alt of parts.alternatives) {
    const innerIf = findSingleIf(alt, p);
    if (innerIf) {
      measurePositionalIf(innerIf, nesting, true, ctx);
      continue;
    }
    if (bodyIsMeaningful(alt, p)) {
      ctx.cognitive += 1;
      recordOperator(ctx, "else");
    }
    const body2 = bodyNode(alt, p.bodyField, p) || alt;
    walkMeasuredBody(body2, nesting + 1, ctx);
  }
}
function measureIf(node, nesting, elseIf, ctx) {
  const p = ctx.profile;
  if (p.ifPositional) {
    measurePositionalIf(node, nesting, elseIf, ctx);
    return;
  }
  ctx.cognitive += elseIf ? 1 : 1 + nesting;
  ctx.cyclomatic += 1;
  recordOperator(ctx, elseIf ? "else if" : "if");
  const condition = p.ifCondField ? node.childForFieldName(p.ifCondField) : null;
  if (condition)
    measureNode(condition, nesting, false, ctx);
  walkMeasuredBody(bodyNode(node, p.ifThenField, p), nesting + 1, ctx);
  for (const alt of alternativeNodes(node, p)) {
    if (alt.type === p.ifNode || p.elseIfTypes && p.elseIfTypes.includes(alt.type)) {
      measureIf(alt, nesting, true, ctx);
      continue;
    }
    if (p.elseWrapperTypes && p.elseWrapperTypes.includes(alt.type)) {
      let innerIf = null;
      for (let i = 0; i < alt.namedChildCount; i++) {
        const child = alt.namedChild(i);
        if (child && (child.type === p.ifNode || p.elseIfTypes && p.elseIfTypes.includes(child.type))) {
          innerIf = child;
          break;
        }
      }
      if (innerIf) {
        measureIf(innerIf, nesting, true, ctx);
        continue;
      }
      if (bodyIsMeaningful(alt, p)) {
        ctx.cognitive += 1;
        recordOperator(ctx, "else");
      }
      walkMeasuredBody(bodyNode(alt, p.bodyField, p), nesting + 1, ctx);
      continue;
    }
    if (bodyIsMeaningful(alt, p)) {
      ctx.cognitive += 1;
      recordOperator(ctx, "else");
    }
    walkMeasuredBody(alt, nesting + 1, ctx);
  }
}
function measureNode(node, nesting, inLogical, ctx) {
  const p = ctx.profile;
  if (p.functions.includes(node.type))
    return;
  if (p.scopeOnly && p.scopeOnly.includes(node.type))
    return;
  if (node.type === p.ifNode || p.elseIfTypes && p.elseIfTypes.includes(node.type)) {
    measureIf(node, nesting, !!(p.elseIfTypes && p.elseIfTypes.includes(node.type)), ctx);
    return;
  }
  for (const spec of p.loops) {
    if (node.type !== spec.node)
      continue;
    ctx.cognitive += 1 + nesting;
    ctx.cyclomatic += 1;
    recordOperator(ctx, spec.label);
    const loopBody = bodyNode(node, p.loopBodyField, p);
    if (spec.headerFields && spec.headerFields.length > 0) {
      for (const field of spec.headerFields) {
        const header = node.childForFieldName(field);
        if (header)
          measureNode(header, nesting, false, ctx);
      }
    } else {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child && !sameNode(child, loopBody))
          measureNode(child, nesting, false, ctx);
      }
    }
    walkMeasuredBody(loopBody, nesting + 1, ctx);
    return;
  }
  if (p.switchNode && node.type === p.switchNode) {
    ctx.cognitive += 1 + nesting;
    ctx.cyclomatic += 1;
    recordOperator(ctx, "switch");
    const value = p.switchValueField ? node.childForFieldName(p.switchValueField) : null;
    if (value)
      measureNode(value, nesting, false, ctx);
    if (p.switchCaseTypes) {
      const body2 = bodyNode(node, "body", p);
      const container = body2 || node;
      for (let i = 0; i < container.namedChildCount; i++) {
        const child = container.namedChild(i);
        if (!child || !p.switchCaseTypes.includes(child.type))
          continue;
        ctx.cognitive += 1;
        ctx.cyclomatic += 1;
        recordOperator(ctx, "case");
        measureNode(child, nesting + 1, false, ctx);
      }
    }
    return;
  }
  if (p.tryNode && node.type === p.tryNode) {
    recordOperator(ctx, "try");
    let tryBody = p.tryBodyField ? node.childForFieldName(p.tryBodyField) : null;
    if (!tryBody) {
      for (const child of namedChildren(node)) {
        if (p.blockTypes.includes(child.type)) {
          tryBody = child;
          break;
        }
      }
    }
    walkMeasuredBody(tryBody, nesting, ctx);
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (!child)
        continue;
      if (p.catchTypes && p.catchTypes.includes(child.type)) {
        ctx.cognitive += 1 + nesting;
        ctx.cyclomatic += 1;
        recordOperator(ctx, "catch");
        if (p.catchParamField) {
          const param = child.childForFieldName(p.catchParamField);
          if (param)
            measureNode(param, nesting, false, ctx);
        }
        walkMeasuredBody(bodyNode(child, "body", p), nesting + 1, ctx);
      } else if (p.finallyTypes && p.finallyTypes.includes(child.type)) {
        recordOperator(ctx, "finally");
        walkMeasuredBody(bodyNode(child, p.finallyBodyField || "body", p), nesting, ctx);
      }
    }
    return;
  }
  if (p.ternaryNode && node.type === p.ternaryNode) {
    ctx.cognitive += 1 + nesting;
    ctx.cyclomatic += 1;
    recordOperator(ctx, "?:");
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child)
        measureNode(child, nesting + 1, false, ctx);
    }
    return;
  }
  if (isLogicalNode(node, p)) {
    if (!inLogical) {
      const operators = [];
      collectLogicalOperators(node, p, operators);
      let runs = 0;
      let previous = "";
      for (const op of operators) {
        if (op !== previous)
          runs++;
        previous = op;
        recordOperator(ctx, op);
      }
      ctx.cognitive += runs;
      ctx.cyclomatic += operators.length;
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child)
        measureNode(child, nesting, true, ctx);
    }
    return;
  }
  const operator = directOperator(node, p);
  if (operator)
    recordOperator(ctx, operator);
  else if (node.type.indexOf("assignment") !== -1)
    recordOperator(ctx, "=");
  if (p.callNode && node.type === p.callNode)
    recordOperator(ctx, "()");
  if (node.type.indexOf("member_expression") !== -1 || node.type.indexOf("field_expression") !== -1) {
    recordOperator(ctx, ".");
  }
  if (node.type.indexOf("subscript") !== -1 || node.type.indexOf("index_expression") !== -1) {
    recordOperator(ctx, "[]");
  }
  const jump = p.jumps[node.type];
  if (jump) {
    recordOperator(ctx, jump);
    if (jump === "goto")
      ctx.cognitive += 1;
  }
  if (OPERAND_NODE_TYPES.has(node.type))
    recordOperand(ctx, node.text);
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child)
      measureNode(child, nesting, false, ctx);
  }
}
function round2(value) {
  return Math.round(value * 100) / 100;
}
function finalizeHalstead(ctx) {
  const n1 = ctx.operators.size;
  const n2 = ctx.operands.size;
  const N1 = ctx.totalOperators;
  const N2 = ctx.totalOperands;
  const vocabulary = n1 + n2;
  const length = N1 + N2;
  const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  const difficulty = n2 > 0 ? n1 / 2 * (N2 / n2) : 0;
  return {
    distinctOperators: n1,
    distinctOperands: n2,
    totalOperators: N1,
    totalOperands: N2,
    vocabulary,
    length,
    volume: round2(volume),
    difficulty: round2(difficulty),
    effort: round2(volume * difficulty),
    bugs: round2(volume / 3e3)
  };
}
function maintainabilityIndex(halstead, cyclomatic, lines) {
  if (halstead.volume <= 0 || lines <= 0)
    return 100;
  const raw = 171 - 3.42 * Math.log(halstead.volume) - 0.23 * cyclomatic - 16.2 * Math.log(lines);
  return Math.round(Math.max(0, Math.min(100, raw * 100 / 171)) * 10) / 10;
}
function metricsForFunctionNode(node, profile) {
  const ctx = {
    profile,
    cognitive: 0,
    cyclomatic: 1,
    operators: /* @__PURE__ */ new Set(),
    operands: /* @__PURE__ */ new Set(),
    totalOperators: 0,
    totalOperands: 0
  };
  const body2 = bodyNode(node, profile.bodyField, profile);
  if (body2)
    walkMeasuredBody(body2, 0, ctx);
  const halstead = finalizeHalstead(ctx);
  const lines = node.endPosition.row - node.startPosition.row + 1;
  return {
    cognitive: ctx.cognitive,
    cyclomatic: ctx.cyclomatic,
    lines,
    halstead,
    maintainability: maintainabilityIndex(halstead, ctx.cyclomatic, lines)
  };
}
function collectFunctionMetrics(tree, language) {
  const profile = cognitiveProfile(language);
  if (!profile)
    return [];
  const out2 = [];
  const visit = (node) => {
    if (profile.functions.includes(node.type)) {
      out2.push({
        name: functionName(node, profile),
        line: line1(node),
        endLine: node.endPosition.row + 1,
        metrics: metricsForFunctionNode(node, profile)
      });
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i);
      if (child)
        visit(child);
    }
  };
  visit(tree.rootNode);
  return out2;
}
function collapse(text, max = MAX_TEXT) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max - 1) + "\u2026" : flat;
}
function line1(node) {
  return node.startPosition.row + 1;
}
function sameNode(a, b) {
  return !!a && !!b && a.startIndex === b.startIndex && a.endIndex === b.endIndex && a.type === b.type;
}
function statementNodes(node, profile) {
  if (profile.blockTypes.includes(node.type)) {
    return node.namedChildren.filter((c) => c !== null);
  }
  return [node];
}
function bodyNode(node, field, profile) {
  const byField = node.childForFieldName(field);
  if (byField)
    return byField;
  for (let i = node.namedChildCount - 1; i >= 0; i--) {
    const child = node.namedChild(i);
    if (child && profile.blockTypes.includes(child.type))
      return child;
  }
  return null;
}
function alternativeNodes(node, profile) {
  const out2 = [];
  const byField = node.childForFieldName(profile.ifElseField);
  if (byField)
    out2.push(byField);
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (!child || sameNode(child, byField))
      continue;
    if (profile.elseWrapperTypes && profile.elseWrapperTypes.includes(child.type))
      out2.push(child);
    else if (profile.elseIfTypes && profile.elseIfTypes.includes(child.type))
      out2.push(child);
  }
  return out2;
}
function wrapperStatements(wrapper, profile) {
  const out2 = [];
  for (let i = 0; i < wrapper.namedChildCount; i++) {
    const child = wrapper.namedChild(i);
    if (!child)
      continue;
    if (profile.blockTypes.includes(child.type)) {
      for (let j = 0; j < child.namedChildCount; j++) {
        const inner = child.namedChild(j);
        if (inner)
          out2.push(inner);
      }
    } else {
      out2.push(child);
    }
  }
  return out2;
}
function isSkippable(node, profile) {
  if (profile.commentTypes.includes(node.type))
    return true;
  return node.type === "empty_statement";
}
function functionName(node, profile) {
  if (profile.nameField) {
    const name = node.childForFieldName(profile.nameField);
    if (name)
      return collapse(name.text, 60);
  }
  const parent = node.parent;
  if (parent) {
    const bind = parent.childForFieldName("name") || parent.childForFieldName("left");
    if (bind && (bind.type === "identifier" || bind.type === "property_identifier" || bind.type === "member_expression")) {
      return collapse(bind.text, 60);
    }
  }
  let found = null;
  let visited = 0;
  const visit = (n) => {
    if (found || visited > 40)
      return;
    visited++;
    if (n.type === "identifier" || n.type === "field_identifier" || n.type === "property_identifier" || n.type === "simple_identifier") {
      found = n.text;
      return;
    }
    for (let i = 0; i < n.namedChildCount; i++) {
      const child = n.namedChild(i);
      if (child)
        visit(child);
    }
  };
  visit(node);
  return found ? collapse(found, 60) : "(anonymous)";
}

// src/analyzer/path-resolver.ts
var import_fs = require("fs");
var import_path2 = require("path");
function confidenceScore(result) {
  switch (result.method) {
    case "exact":
    case "relative":
    case "alias":
    case "paths":
    case "baseUrl":
      return 1;
    case "extension":
    case "index":
    case "python-src":
      return 0.9;
    case "suffix":
      return 0.8;
    case "basename":
      return 0.6;
    case "ambiguous":
    default:
      return 0.5;
  }
}
var IMPORT_EXTENSIONS = [
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".py",
  ".pyi",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".hxx",
  ".hh",
  ".java",
  ".go",
  ".rs",
  ".kt",
  ".kts",
  ".rb",
  ".swift",
  ".cs",
  ".php",
  ".sh",
  ".bash",
  ".lua",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".vue",
  ".json",
  ".md",
  ".markdown",
  ".txt",
  ".rst"
];
var INDEX_FILES = [
  "index.js",
  "index.jsx",
  "index.ts",
  "index.tsx",
  "__init__.py",
  "mod.rs",
  "index.html"
];
function slashes(value) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/");
}
function normalizeId(value) {
  return slashes((0, import_path2.normalize)(value)).replace(/^\.\//, "").replace(/^\/+/, "");
}
function safeRelative(rootDir, absolutePath) {
  const rel = (0, import_path2.relative)(rootDir, absolutePath);
  return normalizeId(rel || ".");
}
function readJsonc(filePath) {
  try {
    const raw = (0, import_fs.readFileSync)(filePath, "utf-8");
    return JSON.parse(stripJsonc(raw));
  } catch {
    return null;
  }
}
function stripJsonc(input) {
  let out2 = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];
    if (inString) {
      out2 += c;
      if (escaped)
        escaped = false;
      else if (c === "\\")
        escaped = true;
      else if (c === '"')
        inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out2 += c;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < input.length && input[i] !== "\n")
        i++;
      out2 += "\n";
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/"))
        i++;
      i++;
      continue;
    }
    out2 += c;
  }
  return out2.replace(/,(\s*[}\]])/g, "$1");
}
function mergeAliasConfig(target, source) {
  if (!target.baseUrl && source.baseUrl)
    target.baseUrl = source.baseUrl;
  for (const [key, values] of Object.entries(source.paths)) {
    if (!target.paths[key])
      target.paths[key] = values;
  }
  for (const [key, value] of Object.entries(source.aliases)) {
    if (!target.aliases[key])
      target.aliases[key] = value;
  }
  for (const root of source.pythonRoots) {
    if (!target.pythonRoots.includes(root))
      target.pythonRoots.push(root);
  }
}
function configAliases(configPath, rootDir, depth = 0) {
  const result = { baseUrl: "", paths: {}, aliases: {}, pythonRoots: [] };
  if (depth > 5)
    return result;
  const json2 = readJsonc(configPath);
  if (!json2)
    return result;
  const extendsValue = typeof json2.extends === "string" ? json2.extends : "";
  if (extendsValue && (extendsValue.startsWith(".") || (0, import_path2.isAbsolute)(extendsValue))) {
    const parentPath = (0, import_path2.isAbsolute)(extendsValue) ? extendsValue : (0, import_path2.resolve)((0, import_path2.dirname)(configPath), extendsValue.endsWith(".json") ? extendsValue : extendsValue + ".json");
    if ((0, import_fs.existsSync)(parentPath))
      mergeAliasConfig(result, configAliases(parentPath, rootDir, depth + 1));
  }
  const compiler = json2.compilerOptions && typeof json2.compilerOptions === "object" ? json2.compilerOptions : {};
  if (typeof compiler.baseUrl === "string") {
    result.baseUrl = normalizeId(safeRelative(rootDir, (0, import_path2.resolve)((0, import_path2.dirname)(configPath), compiler.baseUrl)));
  }
  if (compiler.paths && typeof compiler.paths === "object") {
    for (const [pattern, values] of Object.entries(compiler.paths)) {
      if (!Array.isArray(values))
        continue;
      const targets = values.filter((v) => typeof v === "string").map(slashes);
      if (targets.length > 0)
        result.paths[pattern] = targets;
    }
  }
  return result;
}
function extractBundlerAliases(rootDir, result) {
  const candidates = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.mts",
    "webpack.config.js",
    "webpack.config.ts",
    "webpack.config.mjs"
  ];
  for (const name of candidates) {
    const configPath = (0, import_path2.join)(rootDir, name);
    if (!(0, import_fs.existsSync)(configPath))
      continue;
    let text = "";
    try {
      text = (0, import_fs.readFileSync)(configPath, "utf-8");
    } catch {
      continue;
    }
    const re = /(['"])([@~#$][\w@/.-]*)\1\s*:\s*(?:path\.)?(?:resolve|join)\(([^)]*)\)/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const key = match[2];
      const quoted = [...match[3].matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2]);
      const target = quoted[quoted.length - 1];
      if (!target)
        continue;
      const absolute = (0, import_path2.isAbsolute)(target) ? target : (0, import_path2.resolve)(rootDir, target);
      result.aliases[key] = normalizeId(safeRelative(rootDir, absolute));
    }
    const simple = /(['"])([@~#$][\w@/.-]*)\1\s*:\s*(['"])([^'"]+)\3/g;
    while ((match = simple.exec(text)) !== null) {
      const key = match[2];
      if (result.aliases[key])
        continue;
      result.aliases[key] = normalizeId(match[4]);
    }
  }
}
function loadImportAliases(rootDir) {
  const result = { baseUrl: "", paths: {}, aliases: {}, pythonRoots: [] };
  for (const name of ["tsconfig.json", "jsconfig.json"]) {
    const configPath = (0, import_path2.join)(rootDir, name);
    if ((0, import_fs.existsSync)(configPath))
      mergeAliasConfig(result, configAliases(configPath, rootDir));
  }
  extractBundlerAliases(rootDir, result);
  if ((0, import_fs.existsSync)((0, import_path2.join)(rootDir, "src")))
    result.pythonRoots.push("src");
  return result;
}
function matchPattern(pattern, target) {
  if (!pattern.includes("*"))
    return pattern === target ? { captured: "" } : null;
  const star = pattern.indexOf("*");
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!target.startsWith(prefix) || !target.endsWith(suffix) || target.length < prefix.length + suffix.length)
    return null;
  return { captured: target.slice(prefix.length, target.length - suffix.length) };
}
function matchPathAliases(target, aliases) {
  const matches = [];
  for (const [pattern, substitutions] of Object.entries(aliases.paths)) {
    const m = matchPattern(pattern, target);
    if (!m)
      continue;
    for (const substitution of substitutions) {
      const candidate = substitution.replace(/\*/g, m.captured);
      matches.push({ length: pattern.length, candidate: normalizeId((0, import_path2.join)(aliases.baseUrl, candidate)), method: "paths" });
    }
  }
  for (const [rawKey, value] of Object.entries(aliases.aliases)) {
    const key = rawKey.replace(/\/$/, "");
    if (target === key || target.startsWith(key + "/")) {
      const rest = target.slice(key.length).replace(/^\//, "");
      matches.push({ length: key.length, candidate: normalizeId((0, import_path2.join)(value, rest)), method: "alias" });
    }
  }
  matches.sort((a, b) => b.length - a.length);
  const seen = /* @__PURE__ */ new Set();
  return matches.filter((m) => {
    if (seen.has(m.candidate))
      return false;
    seen.add(m.candidate);
    return true;
  });
}
function createImportResolver(rootDir, files, aliasesOverride) {
  const aliases = aliasesOverride || loadImportAliases(rootDir);
  const ids = /* @__PURE__ */ new Set();
  const byBase = /* @__PURE__ */ new Map();
  for (const file of files) {
    const id = normalizeId(file);
    ids.add(id);
    const base = (0, import_path2.basename)(id);
    const list = byBase.get(base);
    if (list)
      list.push(id);
    else
      byBase.set(base, [id]);
  }
  function ambiguous(ids2) {
    return { id: ids2[0], confidence: "low", method: "ambiguous" };
  }
  function tryCandidate(candidate, method, confidence) {
    const id = normalizeId(candidate);
    if (!id || id === ".")
      return null;
    if (ids.has(id))
      return { id, confidence, method };
    const withExts = IMPORT_EXTENSIONS.map((ext) => id + ext).filter((p) => ids.has(p));
    if (withExts.length === 1)
      return { id: withExts[0], confidence: "medium", method: "extension" };
    if (withExts.length > 1)
      return ambiguous(withExts);
    const withIndex = INDEX_FILES.map((index) => normalizeId((0, import_path2.join)(id, index))).filter((p) => ids.has(p));
    if (withIndex.length === 1)
      return { id: withIndex[0], confidence: "medium", method: "index" };
    if (withIndex.length > 1)
      return ambiguous(withIndex);
    return null;
  }
  function resolve2(target, sourceId) {
    const cleanTarget = slashes(target.split("?")[0].split("#")[0]).trim();
    const source = normalizeId(sourceId);
    if (!cleanTarget)
      return null;
    const exact = tryCandidate(cleanTarget, "exact", "high");
    if (exact)
      return exact;
    if (cleanTarget.startsWith(".")) {
      const rel = tryCandidate((0, import_path2.join)((0, import_path2.dirname)(source), cleanTarget), "relative", "high");
      if (rel)
        return rel;
    } else if (cleanTarget.startsWith("/")) {
      const rooted = tryCandidate(cleanTarget.replace(/^\/+/, ""), "relative", "high");
      if (rooted)
        return rooted;
    } else {
      const rel = tryCandidate((0, import_path2.join)((0, import_path2.dirname)(source), cleanTarget), "relative", "high");
      if (rel)
        return rel;
    }
    for (const match of matchPathAliases(cleanTarget, aliases)) {
      const aliased = tryCandidate(match.candidate, match.method, "high");
      if (aliased)
        return aliased;
    }
    if (aliases.baseUrl) {
      const based = tryCandidate((0, import_path2.join)(aliases.baseUrl, cleanTarget), "baseUrl", "high");
      if (based)
        return based;
    }
    const dotted = cleanTarget.replace(/\./g, "/");
    if (dotted !== cleanTarget && !cleanTarget.endsWith("/")) {
      for (const root of aliases.pythonRoots.length > 0 ? aliases.pythonRoots : ["src"]) {
        const py = tryCandidate((0, import_path2.join)(root, dotted), "python-src", "medium") || tryCandidate((0, import_path2.join)(root, dotted, "__init__"), "python-src", "medium");
        if (py)
          return py;
      }
      const pyRoot = tryCandidate(dotted, "python-src", "medium");
      if (pyRoot)
        return pyRoot;
    }
    if (cleanTarget.includes("/")) {
      const suffix = "/" + cleanTarget.replace(/^\/+/, "");
      const matches = [];
      for (const id of ids) {
        if (id.endsWith(suffix))
          matches.push(id);
      }
      if (matches.length === 1)
        return { id: matches[0], confidence: "low", method: "suffix" };
      if (matches.length > 1)
        return ambiguous(matches);
    }
    const targetBase = (0, import_path2.basename)(cleanTarget);
    const sameBase = byBase.get(targetBase) || [];
    if (sameBase.length === 1) {
      return { id: sameBase[0], confidence: "low", method: "basename" };
    }
    if (sameBase.length > 1)
      return ambiguous(sameBase);
    for (const ext of IMPORT_EXTENSIONS) {
      const withExt = byBase.get(targetBase + ext) || [];
      if (withExt.length === 1)
        return { id: withExt[0], confidence: "low", method: "basename" };
      if (withExt.length > 1)
        return ambiguous(withExt);
    }
    return null;
  }
  return { rootDir, aliases, resolve: resolve2 };
}

// src/analysis/symbol-cycles.ts
var SEP = "\0";
var MAX_DEFAULT_CYCLES = 200;
var MAX_DEFAULT_LENGTH = 20;
function nodeKey(file, name) {
  return file + SEP + name;
}
function callGroupKey(call) {
  return [call.callerFile, call.callerName, call.callLine, call.calleeName].join(SEP);
}
function edgeKey(callerFile, callerName, calleeFile, calleeName) {
  return nodeKey(callerFile, callerName) + "" + nodeKey(calleeFile, calleeName);
}
function computeSymbolCycles(callSites, options = {}) {
  const maxCycles = Math.max(1, options.maxCycles ?? MAX_DEFAULT_CYCLES);
  const maxLength = Math.max(1, options.maxLength ?? MAX_DEFAULT_LENGTH);
  const groups = /* @__PURE__ */ new Map();
  for (const call of callSites) {
    if (!call || !call.callerFile || !call.callerName || !call.calleeFile || !call.calleeName)
      continue;
    if (call.callerName === "<module>" || call.calleeName === "<module>")
      continue;
    const key = callGroupKey(call);
    const list = groups.get(key);
    if (list)
      list.push(call);
    else
      groups.set(key, [call]);
  }
  const edges = /* @__PURE__ */ new Map();
  const adjacency = /* @__PURE__ */ new Map();
  for (const group of groups.values()) {
    const calleeFiles = new Set(group.map((c) => c.calleeFile));
    const ambiguous = calleeFiles.size > 1;
    for (const call of group) {
      const local = call.callerFile === call.calleeFile;
      const confidence = local ? 1 : ambiguous ? 0.5 : 0.8;
      const callerKey = nodeKey(call.callerFile, call.callerName);
      const calleeKey = nodeKey(call.calleeFile, call.calleeName);
      const key = edgeKey(call.callerFile, call.callerName, call.calleeFile, call.calleeName);
      let edge = edges.get(key);
      if (!edge) {
        edge = {
          callerFile: call.callerFile,
          callerName: call.callerName,
          calleeFile: call.calleeFile,
          calleeName: call.calleeName,
          callLines: [],
          confidence
        };
        edges.set(key, edge);
        let targets = adjacency.get(callerKey);
        if (!targets) {
          targets = /* @__PURE__ */ new Set();
          adjacency.set(callerKey, targets);
        }
        targets.add(calleeKey);
      }
      if (!edge.callLines.includes(call.callLine))
        edge.callLines.push(call.callLine);
      edge.confidence = Math.min(edge.confidence, confidence);
    }
  }
  if (adjacency.size === 0)
    return [];
  const nodes = [...adjacency.keys()].sort();
  for (const node of nodes)
    adjacency.get(node).forEach((t) => {
      if (!adjacency.has(t))
        adjacency.set(t, /* @__PURE__ */ new Set());
    });
  const { componentOf, componentSize } = stronglyConnectedComponents(adjacency);
  const cycleNodes = /* @__PURE__ */ new Set();
  for (const node of adjacency.keys()) {
    const component = componentOf.get(node);
    if (component === void 0)
      continue;
    const selfLoop = adjacency.get(node).has(node);
    if (selfLoop || (componentSize.get(component) ?? 0) > 1)
      cycleNodes.add(node);
  }
  if (cycleNodes.size === 0)
    return [];
  const found = /* @__PURE__ */ new Map();
  for (const start2 of [...cycleNodes].sort()) {
    const component = componentOf.get(start2);
    const visited = /* @__PURE__ */ new Set([start2]);
    dfs(start2, start2, [start2], [], visited, component);
  }
  function dfs(start2, current2, path5, pathEdges, visited, component) {
    if (found.size >= maxCycles)
      return;
    const targets = adjacency.get(current2);
    if (!targets)
      return;
    for (const next of [...targets].sort()) {
      if (componentOf.get(next) !== component)
        continue;
      const edge = edges.get(current2 + "" + next);
      if (!edge)
        continue;
      if (next === start2) {
        const cycle = canonicalize(path5, [...pathEdges, edge]);
        if (!found.has(cycle.key))
          found.set(cycle.key, { nodes: cycle.nodes, edges: cycle.edges });
        continue;
      }
      if (visited.has(next) || path5.length >= maxLength)
        continue;
      visited.add(next);
      path5.push(next);
      pathEdges.push(edge);
      dfs(start2, next, path5, pathEdges, visited, component);
      pathEdges.pop();
      path5.pop();
      visited.delete(next);
    }
  }
  function canonicalize(path5, pathEdges) {
    let best = 0;
    for (let i = 1; i < path5.length; i++) {
      if (path5[i] < path5[best])
        best = i;
    }
    const rotatedNodes = best === 0 ? path5.slice() : path5.slice(best).concat(path5.slice(0, best));
    const rotatedEdges = best === 0 ? pathEdges.slice() : pathEdges.slice(best).concat(pathEdges.slice(0, best));
    return { key: rotatedNodes.join(""), nodes: rotatedNodes, edges: rotatedEdges };
  }
  const cycles = [];
  for (const entry of found.values()) {
    const stepEdges = entry.edges.map((edge) => ({
      callerFile: edge.callerFile,
      callerName: edge.callerName,
      calleeFile: edge.calleeFile,
      calleeName: edge.calleeName,
      callLine: edge.callLines[0],
      confidence: edge.confidence
    }));
    const confidence = stepEdges.reduce((min, edge) => Math.min(min, edge.confidence), 1);
    cycles.push({
      id: 0,
      kind: entry.nodes.length === 1 ? "recursive" : "mutual",
      nodes: entry.nodes.map((key) => {
        const split = key.indexOf(SEP);
        return { file: key.slice(0, split), name: key.slice(split + 1) };
      }),
      edges: stepEdges,
      confidence,
      ambiguous: stepEdges.some((edge) => edge.confidence <= 0.5)
    });
  }
  cycles.sort((a, b) => {
    if (a.nodes.length !== b.nodes.length)
      return a.nodes.length - b.nodes.length;
    if (a.confidence !== b.confidence)
      return a.confidence - b.confidence;
    return cycleKey(a).localeCompare(cycleKey(b));
  });
  for (let i = 0; i < cycles.length; i++)
    cycles[i].id = i;
  return cycles;
  function cycleKey(cycle) {
    return cycle.nodes.map((n) => n.file + SEP + n.name).join("");
  }
}
function stronglyConnectedComponents(adjacency) {
  let index = 0;
  let component = 0;
  const indices = /* @__PURE__ */ new Map();
  const lowlinks = /* @__PURE__ */ new Map();
  const stack = [];
  const onStack = /* @__PURE__ */ new Set();
  const componentOf = /* @__PURE__ */ new Map();
  const componentSize = /* @__PURE__ */ new Map();
  function connect(node) {
    indices.set(node, index);
    lowlinks.set(node, index);
    index++;
    stack.push(node);
    onStack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!indices.has(next)) {
        connect(next);
        lowlinks.set(node, Math.min(lowlinks.get(node), lowlinks.get(next)));
      } else if (onStack.has(next)) {
        lowlinks.set(node, Math.min(lowlinks.get(node), indices.get(next)));
      }
    }
    if (lowlinks.get(node) !== indices.get(node))
      return;
    let member;
    let size = 0;
    do {
      member = stack.pop();
      if (member === void 0)
        break;
      onStack.delete(member);
      componentOf.set(member, component);
      size++;
    } while (member !== node);
    componentSize.set(component, size);
    component++;
  }
  for (const node of adjacency.keys()) {
    if (!indices.has(node))
      connect(node);
  }
  return { componentOf, componentSize };
}

// src/analysis/pagerank.ts
function computePageRank(nodeIds, edges, options = {}) {
  const ids = [...new Set(nodeIds.filter((id) => typeof id === "string" && id.length > 0))];
  const n = ids.length;
  if (n === 0)
    return {};
  const damping = clamp(options.damping ?? 0.85, 0, 1);
  const iterations = Math.max(1, Math.floor(options.iterations ?? 40));
  const tolerance = Math.max(0, options.tolerance ?? 1e-9);
  const outgoing = /* @__PURE__ */ new Map();
  for (const id of ids)
    outgoing.set(id, /* @__PURE__ */ new Set());
  for (const edge of edges) {
    if (!edge || edge.source === edge.target)
      continue;
    const targets = outgoing.get(edge.source);
    if (!targets || !outgoing.has(edge.target))
      continue;
    targets.add(edge.target);
  }
  const base = (1 - damping) / n;
  let rank = new Map(ids.map((id) => [id, 1 / n]));
  for (let iteration = 0; iteration < iterations; iteration++) {
    const next = new Map(ids.map((id) => [id, base]));
    let danglingMass = 0;
    for (const id of ids) {
      const targets = outgoing.get(id);
      const value = rank.get(id) ?? 0;
      if (targets.size === 0) {
        danglingMass += value;
        continue;
      }
      const share = damping * value / targets.size;
      for (const target of targets) {
        next.set(target, (next.get(target) ?? 0) + share);
      }
    }
    if (danglingMass > 0) {
      const share = damping * danglingMass / n;
      for (const id of ids)
        next.set(id, (next.get(id) ?? 0) + share);
    }
    const sum = [...next.values()].reduce((acc, value) => acc + value, 0);
    if (sum > 0) {
      for (const id of ids)
        next.set(id, (next.get(id) ?? 0) / sum);
    }
    let delta = 0;
    for (const id of ids)
      delta += Math.abs((next.get(id) ?? 0) - (rank.get(id) ?? 0));
    rank = next;
    if (delta < tolerance)
      break;
  }
  const result = {};
  for (const id of ids)
    result[id] = rank.get(id) ?? 0;
  return result;
}
function clamp(value, min, max) {
  if (!isFinite(value))
    return min;
  return Math.max(min, Math.min(max, value));
}

// src/analysis/architecture.ts
var DOCUMENTATION_LANGUAGE = "documentation";
var DOC_REFERENCE_EDGE = "doc-reference";
function isArchitectureNode(node) {
  return !!node && node.language !== DOCUMENTATION_LANGUAGE;
}
function isStructuralLinkType(type) {
  return type !== DOC_REFERENCE_EDGE;
}
function isStructuralLink(link, documentationIds) {
  if (!isStructuralLinkType(link.type))
    return false;
  const source = typeof link.source === "string" ? link.source : link.source.id;
  const target = typeof link.target === "string" ? link.target : link.target.id;
  return !documentationIds.has(source) && !documentationIds.has(target);
}
function documentationIdsOf(nodes) {
  return new Set(nodes.filter((node) => !isArchitectureNode(node)).map((node) => node.id));
}

// src/analysis/parse-failures.ts
var MAX_PARSE_FAILURE_SAMPLES = 25;
var MAX_REASON_LENGTH = 200;
function parseFailureReason(err2) {
  let reason = "";
  if (err2 instanceof Error) {
    reason = err2.message || err2.name;
  } else if (typeof err2 === "string") {
    reason = err2;
  } else if (err2 && typeof err2 === "object" && "message" in err2) {
    reason = String(err2.message ?? "");
  }
  reason = reason.replace(/\s+/g, " ").trim();
  if (!reason)
    reason = "unknown parse error";
  if (reason.length > MAX_REASON_LENGTH)
    reason = reason.slice(0, MAX_REASON_LENGTH - 1) + "\u2026";
  return reason;
}
function normalizeFailurePath(path5) {
  let value = String(path5 ?? "").replace(/\\/g, "/").trim();
  while (value.startsWith("./"))
    value = value.slice(2);
  return value;
}
function isBenignSyntaxError(language, errorText, parentType) {
  const text = String(errorText ?? "").replace(/\s+/g, " ").trim();
  if (!text)
    return false;
  if (language === "typescript" || language === "tsx" || language === "javascript") {
    if (/^import\s*\(\s*(['"])[^'"]+\1\s*\)/.test(text))
      return true;
  }
  if (language === "css") {
    if (/^\d+(?:\.\d+)?%(?:\s*,\s*\d+(?:\.\d+)?%)*\s*,?$/.test(text))
      return true;
    if (text === "#" && parentType === "arguments")
      return true;
  }
  return false;
}
function recordParseFailure(index, path5, err2) {
  const key = normalizeFailurePath(path5);
  if (!key)
    return;
  index.set(key, parseFailureReason(err2));
}
function clearParseFailure(index, path5) {
  const key = normalizeFailurePath(path5);
  if (key)
    index.delete(key);
}
function buildParseFailureReport(index) {
  if (index.size === 0)
    return void 0;
  const samples = [...index.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, MAX_PARSE_FAILURE_SAMPLES).map(([path5, reason]) => ({ path: path5, reason }));
  return { total: index.size, samples };
}

// src/analyzer/tree-sitter-loader.ts
var import_path3 = require("path");
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
  const fs3 = require("fs");
  const { resolve: resolve2 } = require("path");
  const candidates = [
    (0, import_path3.join)(__dirname, "tree-sitter-wasms"),
    // bundled (.vsix)
    (0, import_path3.join)(__dirname, "..", "node_modules", "tree-sitter-wasms", "out"),
    // dev from out/
    resolve2("node_modules", "tree-sitter-wasms", "out")
    // dev from project root (vitest)
  ];
  return candidates.find((p) => fs3.existsSync(p)) || candidates[0];
}
async function initTreeSitter() {
  if (initialized) {
    return;
  }
  const fs3 = require("fs");
  const { resolve: resolve2 } = require("path");
  const candidates = [
    (0, import_path3.join)(__dirname, "tree-sitter-wasms", "tree-sitter.wasm"),
    // bundled (.vsix)
    (0, import_path3.join)(__dirname, "..", "node_modules", "web-tree-sitter", "tree-sitter.wasm"),
    // dev from out/
    resolve2("node_modules", "web-tree-sitter", "tree-sitter.wasm")
    // dev from project root (vitest)
  ];
  const wasmFile = candidates.find((p) => fs3.existsSync(p));
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
  const wasmPath = (0, import_path3.join)(wasmDir, file);
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

// src/analyzer/graph-builder.ts
var PARSERS = {
  "c": new TreeSitterCParser(),
  "cpp": new TreeSitterCppParser(),
  "javascript": new TreeSitterJSParser(),
  "typescript": new TreeSitterTSParser(),
  "tsx": new TreeSitterTsxParser(),
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
var LANG_FAMILY = {
  "c": "c",
  "cpp": "c",
  "javascript": "js",
  "typescript": "js",
  "tsx": "js",
  "python": "py",
  "java": "java",
  "go": "go",
  "rust": "rust",
  "kotlin": "kotlin",
  "ruby": "ruby",
  "swift": "swift",
  "csharp": "csharp",
  "php": "php",
  "bash": "bash",
  "lua": "lua"
};
var SYMBOL_LANGUAGES = /* @__PURE__ */ new Set(["c", "cpp", "javascript", "typescript", "tsx", "python", "java", "go", "rust", "kotlin", "ruby", "swift", "csharp", "php", "bash", "lua"]);
var HEADER_EXTS = /* @__PURE__ */ new Set([".h", ".hpp", ".hxx", ".hh", ".d.ts"]);
function getParser(language) {
  return PARSERS[language];
}
function attachFunctionMetrics(symbols, tree, language) {
  const entries = collectFunctionMetrics(tree, language);
  if (entries.length === 0)
    return;
  const byLine = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    byLine.set(entry.line, entry);
    if (!byName.has(entry.name))
      byName.set(entry.name, entry);
  }
  const apply = (sym) => {
    let entry = sym.line ? byLine.get(sym.line) : void 0;
    if (!entry || entry.name !== sym.name) {
      entry = byName.get(sym.name) || entry;
    }
    if (!entry)
      return;
    sym.cognitive = entry.metrics.cognitive;
    sym.cyclomatic = entry.metrics.cyclomatic;
    sym.functionLines = entry.metrics.lines;
    sym.halsteadVolume = entry.metrics.halstead.volume;
    sym.maintainability = entry.metrics.maintainability;
  };
  for (const fn of symbols.functions)
    apply(fn);
  for (const method of symbols.methods || [])
    apply(method);
}
function functionMetricFields(fn) {
  return {
    cognitive: fn.cognitive,
    cyclomatic: fn.cyclomatic,
    functionLines: fn.functionLines,
    halsteadVolume: fn.halsteadVolume,
    maintainability: fn.maintainability
  };
}
function maxCognitive(symbols) {
  if (!symbols)
    return void 0;
  let max;
  for (const fn of [...symbols.functions, ...symbols.methods || []]) {
    if (typeof fn.cognitive !== "number")
      continue;
    if (max === void 0 || fn.cognitive > max)
      max = fn.cognitive;
  }
  return max;
}
function findSyntaxErrors(tree, language) {
  if (!tree.rootNode.hasError())
    return null;
  const anchors = [];
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const visit = (node) => {
    if (seen.has(node.id))
      return;
    seen.add(node.id);
    const isError = node.type === "ERROR";
    if (isError && isBenignSyntaxError(language, node.text, node.parent ? node.parent.type : void 0)) {
      anchors.push(node.startPosition.row + 1);
      return;
    }
    if (!isError && node.isMissing()) {
      const parentType = node.parent ? node.parent.type : "";
      if (parentType === "property_identifier" || parentType === "type_annotation") {
        anchors.push(node.startPosition.row + 1);
        return;
      }
      candidates.push({ line: node.startPosition.row + 1, text: "missing " + node.type });
      return;
    }
    const text = String(node.text || "").trim();
    if (isError && text)
      candidates.push({ line: node.startPosition.row + 1, text });
    for (const child of node.children)
      visit(child);
  };
  visit(tree.rootNode);
  const CASCADE_LINES = 2;
  const bareClosers = /* @__PURE__ */ new Set(["}", ")", "]", ";", ","]);
  const meaningful = candidates.filter((candidate) => !bareClosers.has(candidate.text) || !anchors.some((anchor) => Math.abs(anchor - candidate.line) <= CASCADE_LINES));
  if (meaningful.length === 0)
    return null;
  return { count: meaningful.length, firstLine: meaningful[0].line };
}
async function preParseFiles(files, failures) {
  const trees = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (hasGrammar(file.language)) {
      const key = file.id || file.path;
      try {
        const tree = await parseSource(file.language, file.content);
        if (failures) {
          const syntax = findSyntaxErrors(tree, file.language);
          if (syntax) {
            recordParseFailure(
              failures,
              key,
              "syntax errors (Tree-sitter): " + syntax.count + " error" + (syntax.count === 1 ? "" : "s") + ", first at line " + syntax.firstLine
            );
          } else {
            clearParseFailure(failures, key);
          }
        }
        trees.set(file.id, tree);
      } catch (err2) {
        if (failures)
          recordParseFailure(failures, key, err2);
      }
    }
  }
  return trees;
}
function resolveTarget(target, sourceId, resolver) {
  return resolver.resolve(target, sourceId)?.id ?? null;
}
function projectRootFromFiles(files) {
  for (const file of files) {
    if (!file.fullPath || !file.id)
      continue;
    const suffix = file.id.replace(/\\/g, "/");
    const full = file.fullPath.replace(/\\/g, "/");
    if (full.endsWith(suffix))
      return full.slice(0, full.length - suffix.length).replace(/\/$/, "") || ".";
  }
  return process.cwd();
}
function restoreIncrementalContext(files, graphData) {
  const fileMap = /* @__PURE__ */ new Map();
  for (const file of files)
    fileMap.set(file.id, file);
  const globalFunctionIndex = /* @__PURE__ */ new Map();
  const fileSymbols = /* @__PURE__ */ new Map();
  for (const node of graphData.nodes) {
    if (!SYMBOL_LANGUAGES.has(node.language))
      continue;
    if (!node.symbols)
      continue;
    const ns = node.symbols;
    const symbols = {
      functions: ns.functions.map((f) => ({ name: f.name, type: f.type, returnType: f.returnType, params: f.params, line: f.line, visibility: f.visibility, isStatic: f.isStatic, isAsync: f.isAsync, cognitive: f.cognitive, cyclomatic: f.cyclomatic, functionLines: f.functionLines, halsteadVolume: f.halsteadVolume, maintainability: f.maintainability })),
      methods: (ns.methods || []).map((m) => ({ name: m.name, type: m.type, returnType: m.returnType, params: m.params, line: m.line, visibility: m.visibility, isStatic: m.isStatic, isAsync: m.isAsync, cognitive: m.cognitive, cyclomatic: m.cyclomatic, functionLines: m.functionLines, halsteadVolume: m.halsteadVolume, maintainability: m.maintainability })),
      structs: ns.structs.map((s) => ({ name: s.name, type: s.type, line: s.line })),
      enums: ns.enums.map((e) => ({ name: e.name, type: e.type, line: e.line })),
      macros: (ns.macros || []).map((m) => ({ name: m.name, type: m.type, line: m.line })),
      classes: ns.classes.map((c) => ({ name: c.name, type: c.type, line: c.line })),
      exports: ns.exports.map((e) => ({ name: e.name, type: e.type, line: e.line })),
      interfaces: (ns.interfaces || []).map((i) => ({ name: i.name, type: i.type })),
      traits: (ns.traits || []).map((t) => ({ name: t.name, type: t.type })),
      typeAliases: (ns.typeAliases || []).map((ta) => ({ name: ta.name, type: ta.type })),
      externs: []
    };
    fileSymbols.set(node.id, symbols);
    const family = LANG_FAMILY[node.language] || node.language;
    for (const func2 of symbols.functions) {
      const key = `${family}:${func2.name}`;
      if (!globalFunctionIndex.has(key))
        globalFunctionIndex.set(key, []);
      globalFunctionIndex.get(key).push(node.id);
    }
  }
  const importGraph = /* @__PURE__ */ new Map();
  for (const link of graphData.links) {
    if (link.type === "include" || link.type === "system-include") {
      if (!importGraph.has(link.source))
        importGraph.set(link.source, /* @__PURE__ */ new Set());
      importGraph.get(link.source).add(link.target);
    }
  }
  return {
    fileMap,
    globalFunctionIndex,
    fileSymbols,
    importGraph,
    calledNames: files.some((f) => !!f.content) ? collectCalledNames(files) : void 0,
    hasFileContents: files.some((f) => !!f.content)
  };
}
function rebuildSingleFile(file, ctx, astTree, options = {}) {
  const { fileMap, globalFunctionIndex, fileSymbols: allFileSymbols } = ctx;
  let parseFailure;
  const recordFailure = (err2) => {
    if (!parseFailure)
      parseFailure = parseFailureReason(err2);
  };
  fileMap.set(file.id, file);
  if (ctx.hasFileContents) {
    ctx.calledNames = collectCalledNames([...fileMap.values()]);
  }
  const resolver = createImportResolver(projectRootFromFiles([file, ...fileMap.values()]), fileMap.keys());
  const oldSymbols = allFileSymbols.get(file.id);
  if (oldSymbols) {
    const family = LANG_FAMILY[file.language] || file.language;
    for (const func2 of oldSymbols.functions) {
      const key = `${family}:${func2.name}`;
      const arr = globalFunctionIndex.get(key);
      if (arr) {
        const filtered = arr.filter((id) => id !== file.id);
        if (filtered.length > 0)
          globalFunctionIndex.set(key, filtered);
        else
          globalFunctionIndex.delete(key);
      }
    }
  }
  const parser = getParser(file.language);
  const relations = [];
  if (parser) {
    try {
      const rels = astTree && parser.usesTreeSitter ? parser.parseAST(astTree, file, options) : parser.parse(file, options);
      relations.push(...rels);
    } catch (err2) {
      recordFailure(err2);
    }
  }
  let symbols;
  if (SYMBOL_LANGUAGES.has(file.language) && parser) {
    try {
      symbols = astTree && parser.usesTreeSitter ? parser.extractSymbolsAST(astTree, file) : parser.extractSymbols?.(file);
      if (symbols && astTree)
        attachFunctionMetrics(symbols, astTree, file.language);
    } catch (err2) {
      recordFailure(err2);
      symbols = void 0;
    }
  }
  if (symbols) {
    allFileSymbols.set(file.id, symbols);
    const family = LANG_FAMILY[file.language] || file.language;
    for (const func2 of symbols.functions) {
      const key = `${family}:${func2.name}`;
      if (!globalFunctionIndex.has(key))
        globalFunctionIndex.set(key, []);
      globalFunctionIndex.get(key).push(file.id);
    }
  } else {
    allFileSymbols.delete(file.id);
  }
  const localImportTargets = /* @__PURE__ */ new Set();
  for (const rel of relations) {
    const resolved = resolveTarget(rel.target, rel.source, resolver);
    if (resolved && resolved !== rel.source)
      localImportTargets.add(resolved);
  }
  ctx.importGraph.set(file.id, localImportTargets);
  function isReachableFromFile(target) {
    if (localImportTargets.has(target))
      return true;
    const targetImports = ctx.importGraph.get(target);
    for (const imported of localImportTargets) {
      const imp = fileMap.get(imported);
      if (!imp || !HEADER_EXTS.has(imp.extension))
        continue;
      if (targetImports?.has(imported))
        return true;
      const baseName = imported.replace(/\.[^.]+$/, "");
      if (target.startsWith(baseName + "."))
        return true;
    }
    return false;
  }
  const functionCallLinks = [];
  if (SYMBOL_LANGUAGES.has(file.language) && !HEADER_EXTS.has(file.extension) && parser) {
    let calls = [];
    try {
      if (astTree && parser.usesTreeSitter) {
        const tsParser = parser;
        calls = tsParser.extractCallsFromAST?.(astTree) || [];
      } else {
        const regexParser = parser;
        calls = regexParser.extractCalls?.(file) || [];
      }
    } catch (err2) {
      recordFailure(err2);
    }
    const ownFunctions = new Set(symbols ? symbols.functions.map((f) => f.name) : []);
    const family = LANG_FAMILY[file.language] || file.language;
    const hasHeaders = file.language === "c" || file.language === "cpp";
    for (const callName of calls) {
      if (ownFunctions.has(callName))
        continue;
      const key = `${family}:${callName}`;
      const definedIn = globalFunctionIndex.get(key);
      if (definedIn) {
        const callConfidence = definedIn.length > 1 ? 0.5 : 0.8;
        for (const defFileId of definedIn) {
          if (defFileId === file.id)
            continue;
          if (hasHeaders && !isReachableFromFile(defFileId))
            continue;
          functionCallLinks.push({ source: file.id, target: defFileId, type: "function-call", label: `${callName}()`, confidence: callConfidence });
        }
      }
    }
  }
  const callSites = [];
  if (SYMBOL_LANGUAGES.has(file.language) && !HEADER_EXTS.has(file.extension) && parser && astTree && parser.usesTreeSitter) {
    let sites = [];
    try {
      sites = parser.extractCallSitesAST(astTree, file);
    } catch (err2) {
      recordFailure(err2);
    }
    const family = LANG_FAMILY[file.language] || file.language;
    for (const site of sites) {
      if (site.isLocal) {
        callSites.push({ callerFile: file.id, callerName: site.callerName, calleeFile: file.id, calleeName: site.calleeName, callLine: site.line });
      } else {
        const key = `${family}:${site.calleeName}`;
        const definedIn = globalFunctionIndex.get(key);
        if (definedIn) {
          for (const defFileId of definedIn) {
            if (defFileId !== file.id) {
              callSites.push({ callerFile: file.id, callerName: site.callerName, calleeFile: defFileId, calleeName: site.calleeName, callLine: site.line });
            }
          }
        }
      }
    }
  }
  const heritageLinks = [];
  if (astTree && parser) {
    const symbolFileIndex = /* @__PURE__ */ new Map();
    for (const [fid, syms] of allFileSymbols) {
      for (const cls of syms.classes)
        symbolFileIndex.set(cls.name, fid);
      for (const iface of syms.interfaces || [])
        symbolFileIndex.set(iface.name, fid);
      for (const trait of syms.traits || [])
        symbolFileIndex.set(trait.name, fid);
      for (const struct of syms.structs)
        symbolFileIndex.set(struct.name, fid);
    }
    const heritageRels = (() => {
      try {
        return parser.extractHeritageRelations(astTree, file);
      } catch (err2) {
        recordFailure(err2);
        return [];
      }
    })();
    for (const rel of heritageRels) {
      const targetFileId = symbolFileIndex.get(rel.target);
      if (targetFileId && targetFileId !== file.id) {
        heritageLinks.push({ source: file.id, target: targetFileId, type: rel.type, label: rel.label, confidence: 0.9 });
      }
    }
  }
  const cmplx = computeComplexity(file);
  const outEdges = [];
  for (const rel of relations) {
    const resolution = resolver.resolve(rel.target, rel.source);
    if (resolution && resolution.id !== rel.source) {
      const linkType = rel.type === "system-include" && !options.includeSystemHeaders ? "include" : rel.type;
      outEdges.push({ source: rel.source, target: resolution.id, type: linkType, label: rel.label, confidence: confidenceScore(resolution) });
    }
  }
  outEdges.push(...functionCallLinks);
  outEdges.push(...heritageLinks);
  const linkSet = /* @__PURE__ */ new Set();
  const uniqueEdges = outEdges.filter((e) => {
    const key = `${e.source}|${e.target}|${e.type}`;
    if (linkSet.has(key))
      return false;
    linkSet.add(key);
    return true;
  });
  const node = {
    id: file.id,
    name: file.name,
    path: file.path,
    language: file.language,
    extension: file.extension,
    size: file.size,
    linesOfCode: file.linesOfCode,
    lastModified: file.lastModified || 0,
    group: file.group,
    fanOut: uniqueEdges.length,
    fanIn: 0,
    // Will be recomputed by graphDb.updateFanCounts()
    complexity: cmplx.complexity,
    complexityDetails: cmplx.details
  };
  if (symbols) {
    const cognitive = maxCognitive(symbols);
    if (cognitive !== void 0)
      node.cognitive = cognitive;
    node.symbols = {
      functions: symbols.functions.map((fn) => ({
        name: fn.name,
        returnType: fn.returnType || "",
        params: fn.params || "",
        line: fn.line || 0,
        type: fn.type,
        visibility: fn.visibility,
        isStatic: fn.isStatic,
        isAsync: fn.isAsync,
        ...functionMetricFields(fn)
      })),
      structs: symbols.structs.map((s) => ({ name: s.name, type: s.type, line: s.line || 0 })),
      enums: symbols.enums.map((e) => ({ name: e.name, type: e.type, line: e.line || 0 })),
      macros: symbols.macros.slice(0, 30).map((m) => ({ name: m.name, type: m.type, line: m.line || 0 })),
      classes: symbols.classes.map((c) => ({ name: c.name, type: c.type, line: c.line || 0 })),
      exports: symbols.exports.map((e) => ({ name: e.name, type: e.type, line: e.line || 0 })),
      interfaces: (symbols.interfaces || []).map((i) => ({ name: i.name, type: i.type })),
      traits: (symbols.traits || []).map((t) => ({ name: t.name, type: t.type })),
      typeAliases: (symbols.typeAliases || []).map((ta) => ({ name: ta.name, type: ta.type })),
      methods: (symbols.methods || []).map((m) => ({
        name: m.name,
        returnType: m.returnType || "",
        params: m.params || "",
        line: m.line || 0,
        type: m.type,
        visibility: m.visibility,
        isStatic: m.isStatic,
        isAsync: m.isAsync,
        ...functionMetricFields(m)
      })),
      totalSymbols: symbols.functions.length + symbols.structs.length + symbols.enums.length + symbols.macros.length + symbols.classes.length + symbols.exports.length + (symbols.interfaces || []).length + (symbols.traits || []).length + (symbols.typeAliases || []).length + (symbols.methods || []).length
    };
  }
  if (symbols && ctx.calledNames) {
    const classified = classifyDeadCode(
      file,
      symbols,
      ctx.calledNames,
      [...DEFAULT_DEAD_CODE_RULES, ...options.deadCodeRules || []]
    );
    if (classified.dead.length > 0)
      node.deadExports = classified.dead;
    if (classified.exempted.length > 0)
      node.exemptedExports = classified.exempted;
  }
  return { node, outEdges: uniqueEdges, callSites, ...parseFailure ? { parseFailureReason: parseFailure } : {} };
}

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
async function getGitRoot(cwd) {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
  return stdout.trim();
}
async function getGitHead(cwd) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd });
    return stdout.trim();
  } catch {
    return "";
  }
}
async function getWorkingTreeFiles(cwd) {
  const result = /* @__PURE__ */ new Map();
  try {
    const { stdout } = await execFileAsync("git", [
      "--no-optional-locks",
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all"
    ], { cwd, maxBuffer: MAX_BUFFER });
    const parts = stdout.split("\0");
    for (let i = 0; i < parts.length; i++) {
      const entry = parts[i];
      if (!entry || entry.length < 4)
        continue;
      const xy = entry.slice(0, 2);
      const filePath = entry.slice(3);
      if (!filePath)
        continue;
      if (xy === "??") {
        result.set(filePath, "untracked");
        continue;
      }
      if (xy === "!!")
        continue;
      if (xy[0] === "U" || xy[1] === "U" || xy === "AA" || xy === "DD") {
        result.set(filePath, "conflicted");
        continue;
      }
      let state = "modified";
      if (xy[0] === "A" || xy[1] === "A")
        state = "added";
      else if (xy[0] === "D" || xy[1] === "D")
        state = "deleted";
      else if (xy[0] === "R" || xy[1] === "R" || xy[0] === "C" || xy[1] === "C") {
        state = "renamed";
        i++;
      }
      result.set(filePath, state);
    }
  } catch {
  }
  return result;
}

// src/analyzer/fingerprint.ts
var import_crypto = require("crypto");
var PARSER_VERSION = "2026-10-25.1";
function sha256(value) {
  return (0, import_crypto.createHash)("sha256").update(value).digest("hex");
}
function stableStringify(value) {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value);
  if (Array.isArray(value))
    return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}
function hashAnalysisConfig(config) {
  return sha256(stableStringify(config));
}
function normalizedFiles(files) {
  return files.map((f) => ({ path: f.path, size: f.size, mtimeMs: f.mtimeMs })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
function computeFingerprint(input) {
  const parserVersion = input.parserVersion || PARSER_VERSION;
  const files = normalizedFiles(input.files);
  const hash = sha256(JSON.stringify({
    head: input.head,
    configHash: input.configHash,
    parserVersion,
    files
  }));
  return { hash, head: input.head, configHash: input.configHash, parserVersion, files };
}
function diffFileSignatures(previous, current2) {
  const before = new Map(previous.map((f) => [f.path, f]));
  const after = new Map(current2.map((f) => [f.path, f]));
  const diff = { added: [], modified: [], deleted: [], unchanged: [] };
  for (const [path5, sig] of after) {
    const old = before.get(path5);
    if (!old)
      diff.added.push(path5);
    else if (old.size !== sig.size || old.mtimeMs !== sig.mtimeMs)
      diff.modified.push(path5);
    else
      diff.unchanged.push(path5);
  }
  for (const path5 of before.keys()) {
    if (!after.has(path5))
      diff.deleted.push(path5);
  }
  diff.added.sort();
  diff.modified.sort();
  diff.deleted.sort();
  return diff;
}
var MAX_INCREMENTAL_FILES = 50;
function planAnalysis(previous, current2, options = {}) {
  if (options.force)
    return { mode: "full", reason: "forced refresh" };
  if (!options.hasCachedGraph)
    return { mode: "full", reason: "no cached graph" };
  if (!previous || !current2)
    return { mode: "full", reason: "missing fingerprint" };
  if (previous.hash === current2.hash)
    return { mode: "skip" };
  if (previous.parserVersion !== current2.parserVersion)
    return { mode: "full", reason: "parser version changed" };
  if (previous.configHash !== current2.configHash)
    return { mode: "full", reason: "analysis settings changed" };
  if (previous.files.length === 0)
    return { mode: "full", reason: "empty cached signature list" };
  const diff = diffFileSignatures(previous.files, current2.files);
  const changed = diff.added.length + diff.modified.length + diff.deleted.length;
  if (changed === 0)
    return { mode: "head-only" };
  if (changed <= (options.maxIncrementalFiles ?? MAX_INCREMENTAL_FILES)) {
    return { mode: "incremental", diff };
  }
  return { mode: "full", reason: `${changed} files changed` };
}
function fingerprintMetaEntries(fp) {
  return [
    ["fingerprint", fp.hash],
    ["head", fp.head],
    ["configHash", fp.configHash],
    ["parserVersion", fp.parserVersion],
    ["fileSignatures", JSON.stringify(fp.files)]
  ];
}
function fingerprintFromMeta(meta) {
  const hash = meta.fingerprint;
  const head = meta.head;
  const configHash = meta.configHash;
  const parserVersion = meta.parserVersion;
  if (!hash || head === void 0 || !configHash || !parserVersion)
    return null;
  let files = [];
  try {
    const parsed = JSON.parse(meta.fileSignatures || "[]");
    if (!Array.isArray(parsed))
      return null;
    files = parsed.filter((f) => f && typeof f.path === "string" && typeof f.size === "number" && typeof f.mtimeMs === "number").map((f) => ({ path: f.path, size: f.size, mtimeMs: f.mtimeMs }));
  } catch {
    return null;
  }
  return { hash, head, configHash, parserVersion, files };
}

// src/risk/risk-service.ts
function buildRiskSnapshot(nodes, commits, windowDays, now = Date.now(), centrality = false) {
  const dayMs = 24 * 60 * 60 * 1e3;
  const cutoff = now - windowDays * dayMs;
  const resolvePath = buildRenameResolver(commits);
  const churn = /* @__PURE__ */ new Map();
  for (const commit of commits) {
    let when = new Date(commit.date).getTime();
    if (isNaN(when))
      when = 0;
    const inWindow = when >= cutoff;
    const author = commit.author || "unknown";
    for (const file of commit.files || []) {
      const raw2 = file.path;
      if (!raw2)
        continue;
      const p = resolvePath(raw2);
      let entry = churn.get(p);
      if (!entry) {
        entry = { commits: 0, authors: /* @__PURE__ */ new Set() };
        churn.set(p, entry);
      }
      if (inWindow)
        entry.commits++;
      entry.authors.add(author);
    }
  }
  const churnOf = (node) => {
    const id = node.id;
    const path5 = node.path;
    const a = id ? churn.get(id) : void 0;
    const b = path5 ? churn.get(path5) : void 0;
    return (a ? a.commits : 0) || (b ? b.commits : 0);
  };
  const statsOf = (node) => (node.id ? churn.get(node.id) : void 0) || (node.path ? churn.get(node.path) : void 0);
  const architecturalNodes = nodes.filter((node) => node.language !== "documentation");
  const pct = buildRiskPercentiles(architecturalNodes, churnOf);
  const raw = [];
  for (const n of architecturalNodes) {
    raw.push({ node: n, score: computeRiskScore(n, pct, churnOf(n), { centrality }) });
  }
  const scorePct = percentileLookup(raw.map((r) => r.score));
  const byId = /* @__PURE__ */ new Map();
  const highIds = /* @__PURE__ */ new Set();
  let total = 0;
  for (const r of raw) {
    total += r.score;
    const stats = statsOf(r.node);
    const p = scorePct(r.score);
    const entry = {
      id: r.node.id,
      score: r.score,
      scorePct: p,
      topLabel: topPercentLabel(p),
      bucket: riskBucket(r.score),
      reasons: riskReasons(r.node, pct, {
        windowDays,
        churn: churnOf(r.node),
        authorCount: stats ? stats.authors.size : 0,
        centrality
      }),
      lines: r.node.linesOfCode || 0,
      complexity: r.node.complexity || 0,
      fanIn: r.node.fanIn || 0,
      fanOut: r.node.fanOut || 0,
      churn: churnOf(r.node),
      authorCount: stats ? stats.authors.size : 0
    };
    byId.set(r.node.id, entry);
    if (entry.bucket === "high")
      highIds.add(r.node.id);
  }
  return { windowDays, byId, highIds, avgScore: raw.length ? total / raw.length : 0 };
}
function topRiskHotspots(snapshot, limit) {
  const entries = Array.from(snapshot.byId.values()).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.round(limit)));
  return {
    sort: "risk",
    window_days: snapshot.windowDays,
    total: entries.length,
    hotspots: entries.map((e) => ({
      file: e.id,
      risk_score: Math.round(e.score * 10) / 10,
      bucket: e.bucket,
      top: e.topLabel,
      reasons: e.reasons.map((r) => r.text),
      lines: e.lines,
      complexity: e.complexity,
      fan_in: e.fanIn,
      fan_out: e.fanOut
    }))
  };
}

// src/graph-db.ts
var import_sql = __toESM(require_sql_wasm());
var import_fs2 = require("fs");
var import_path4 = require("path");

// src/analysis/communities.ts
var LOUVAIN_MAX_PASSES = 20;
function communityKey(files) {
  let hash = 2166136261;
  const sorted = files.slice().sort();
  for (const id of sorted) {
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    hash ^= 10;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
function endpoint(value) {
  return typeof value === "string" ? value : value.id;
}
function detectCommunities(nodes, links, options = {}) {
  const docIds = documentationIdsOf(nodes);
  const codeNodes = nodes.filter((node) => isArchitectureNode(node) && node.id).slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (codeNodes.length === 0)
    return [];
  const codeIds = new Set(codeNodes.map((node) => node.id));
  const structuralLinks = links.filter((link) => {
    if (!isStructuralLink(link, docIds))
      return false;
    const source = endpoint(link.source);
    const target = endpoint(link.target);
    return codeIds.has(source) && codeIds.has(target);
  });
  const index = /* @__PURE__ */ new Map();
  codeNodes.forEach((node, i) => index.set(node.id, i));
  const n = codeNodes.length;
  const adjacency = {};
  for (let i = 0; i < n; i++)
    adjacency[i] = {};
  let totalWeight = 0;
  const structuralFanIn = /* @__PURE__ */ new Map();
  for (const link of structuralLinks) {
    const source = endpoint(link.source);
    const target = endpoint(link.target);
    const s = index.get(source);
    const t = index.get(target);
    if (s === void 0 || t === void 0 || s === t)
      continue;
    adjacency[s][t] = (adjacency[s][t] || 0) + 1;
    adjacency[t][s] = (adjacency[t][s] || 0) + 1;
    structuralFanIn.set(target, (structuralFanIn.get(target) || 0) + 1);
    totalWeight += 1;
  }
  const groups = /* @__PURE__ */ new Map();
  if (totalWeight === 0) {
    for (let i = 0; i < n; i++)
      groups.set(i, [i]);
  } else {
    const m2 = totalWeight * 2;
    const degree = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (const weight of Object.values(adjacency[i]))
        d += weight;
      degree[i] = d;
    }
    const community = new Array(n);
    for (let i = 0; i < n; i++)
      community[i] = i;
    let improved = true;
    let passes = 0;
    while (improved && passes < LOUVAIN_MAX_PASSES) {
      improved = false;
      passes++;
      for (let i = 0; i < n; i++) {
        const current2 = community[i];
        const neighbourWeights = /* @__PURE__ */ new Map();
        for (const [neighbour, weight] of Object.entries(adjacency[i])) {
          const label = community[Number(neighbour)];
          neighbourWeights.set(label, (neighbourWeights.get(label) || 0) + weight);
        }
        const communityDegrees = /* @__PURE__ */ new Map();
        for (let j = 0; j < n; j++) {
          if (j === i)
            continue;
          const label = community[j];
          if (neighbourWeights.has(label) || label === current2) {
            communityDegrees.set(label, (communityDegrees.get(label) || 0) + degree[j]);
          }
        }
        const ki = degree[i];
        const wIn = neighbourWeights.get(current2) || 0;
        const sumCi = communityDegrees.get(current2) || 0;
        const removeCost = wIn / totalWeight - ki * sumCi / (m2 * m2) * 2;
        let bestGain = 0;
        let bestCommunity = current2;
        for (const [label, weight] of neighbourWeights) {
          if (label === current2)
            continue;
          const sumCj = communityDegrees.get(label) || 0;
          const gain = weight / totalWeight - ki * sumCj / (m2 * m2) * 2 - removeCost;
          if (gain > bestGain) {
            bestGain = gain;
            bestCommunity = label;
          }
        }
        if (bestCommunity !== current2) {
          community[i] = bestCommunity;
          improved = true;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const label = community[i];
      if (!groups.has(label))
        groups.set(label, []);
      groups.get(label).push(i);
    }
  }
  const members = /* @__PURE__ */ new Map();
  const singletons = [];
  for (const indices of groups.values()) {
    if (indices.length < 2) {
      for (const i of indices)
        singletons.push(codeNodes[i].id);
      continue;
    }
    members.set(
      Math.min(...indices),
      indices.map((i) => codeNodes[i].id).sort()
    );
  }
  const ordered = [...members.entries()].sort((a, b) => a[0] - b[0]).map(([, files]) => files);
  const labels = options.labels || {};
  const result = ordered.map((files, id) => {
    const hub = pickHub(files, structuralFanIn);
    const key = communityKey(files);
    const custom = typeof labels[key] === "string" && labels[key].trim().length > 0;
    return {
      id,
      key,
      label: custom ? labels[key].trim() : hub,
      autoLabel: hub,
      hub,
      files,
      size: files.length,
      custom
    };
  });
  if (singletons.length > 0) {
    const files = singletons.sort();
    const key = communityKey(files);
    const custom = typeof labels[key] === "string" && labels[key].trim().length > 0;
    result.push({
      id: result.length,
      key,
      label: custom ? labels[key].trim() : "Others",
      autoLabel: "Others",
      hub: "",
      files,
      size: files.length,
      custom,
      isOthers: true
    });
  }
  return result;
}
function pickHub(files, fanIn) {
  if (files.length === 0)
    return "";
  let hub = files[0];
  let hubScore = fanIn.get(hub) || 0;
  for (const file of files) {
    const score = fanIn.get(file) || 0;
    if (score > hubScore || score === hubScore && file < hub) {
      hub = file;
      hubScore = score;
    }
  }
  return hub;
}

// src/graph-db.ts
var SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    language      TEXT NOT NULL,
    extension     TEXT NOT NULL,
    group_name    TEXT NOT NULL,
    size          INTEGER NOT NULL,
    lines         INTEGER NOT NULL,
    complexity    INTEGER NOT NULL,
    cognitive     INTEGER,
    pagerank      REAL,
    fan_in        INTEGER NOT NULL DEFAULT 0,
    fan_out       INTEGER NOT NULL DEFAULT 0,
    last_modified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
    source  TEXT NOT NULL,
    target  TEXT NOT NULL,
    type    TEXT NOT NULL,
    label   TEXT NOT NULL DEFAULT '',
    confidence REAL NOT NULL DEFAULT 1.0,
    PRIMARY KEY (source, target, type)
);

CREATE TABLE IF NOT EXISTS symbols (
    node_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,
    return_type TEXT DEFAULT '',
    params      TEXT DEFAULT '',
    line        INTEGER DEFAULT 0,
    is_dead     INTEGER DEFAULT 0,
    visibility  TEXT DEFAULT 'public',
    is_static   INTEGER DEFAULT 0,
    is_async    INTEGER DEFAULT 0,
    cognitive   INTEGER,
    cyclomatic  INTEGER,
    function_lines INTEGER,
    halstead_volume REAL,
    maintainability REAL,
    PRIMARY KEY (node_id, name, kind)
);

CREATE TABLE IF NOT EXISTS cycles (
    cycle_id  INTEGER NOT NULL,
    node_id   TEXT NOT NULL,
    position  INTEGER NOT NULL,
    PRIMARY KEY (cycle_id, position)
);

CREATE TABLE IF NOT EXISTS symbol_cycles (
    cycle_id   INTEGER PRIMARY KEY,
    kind       TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1.0,
    ambiguous  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS symbol_cycle_steps (
    cycle_id    INTEGER NOT NULL,
    position    INTEGER NOT NULL,
    caller_file TEXT NOT NULL,
    caller_name TEXT NOT NULL,
    callee_file TEXT NOT NULL,
    callee_name TEXT NOT NULL,
    call_line   INTEGER NOT NULL,
    confidence  REAL NOT NULL DEFAULT 1.0,
    PRIMARY KEY (cycle_id, position)
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS community_labels (
    key   TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbol_exemptions (
    node_id TEXT NOT NULL,
    name    TEXT NOT NULL,
    kind    TEXT DEFAULT '',
    reason  TEXT NOT NULL,
    PRIMARY KEY (node_id, name, kind)
);

CREATE TABLE IF NOT EXISTS function_calls (
    caller_file  TEXT NOT NULL,
    caller_name  TEXT NOT NULL,
    callee_file  TEXT NOT NULL,
    callee_name  TEXT NOT NULL,
    call_line    INTEGER NOT NULL,
    PRIMARY KEY (caller_file, caller_name, callee_file, callee_name, call_line)
);

CREATE TABLE IF NOT EXISTS cochange_pairs (
    file_a        TEXT NOT NULL,
    file_b        TEXT NOT NULL,
    cochanges     INTEGER NOT NULL,
    a_commits     INTEGER NOT NULL,
    b_commits     INTEGER NOT NULL,
    union_commits INTEGER NOT NULL,
    jaccard       REAL NOT NULL,
    support       REAL NOT NULL,
    linked        INTEGER NOT NULL DEFAULT 0,
    window_days   INTEGER NOT NULL DEFAULT 365,
    PRIMARY KEY (file_a, file_b)
);

CREATE TABLE IF NOT EXISTS saved_queries (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    expr       TEXT NOT NULL,
    mode       TEXT NOT NULL DEFAULT 'highlight',
    created_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_symbols_node ON symbols(node_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_nodes_language ON nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_group ON nodes(group_name);
CREATE INDEX IF NOT EXISTS idx_fcalls_caller ON function_calls(caller_file, caller_name);
CREATE INDEX IF NOT EXISTS idx_fcalls_callee ON function_calls(callee_file, callee_name);
CREATE INDEX IF NOT EXISTS idx_symbol_cycles_caller ON symbol_cycle_steps(caller_file);
CREATE INDEX IF NOT EXISTS idx_cochange_score ON cochange_pairs(jaccard DESC, cochanges DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS doc_chunks USING fts4(
    file_id, section, content, line_start, tokenize=porter
);
`;
function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}
function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}
function extractDocTokens(input) {
  if (!input)
    return [];
  const cleaned = input.replace(/["()\:\*\^\-\+]/g, " ").trim();
  if (!cleaned)
    return [];
  return cleaned.split(/\s+/).filter((t) => t.length > 1);
}
function countOccurrences(haystack, needle) {
  if (!needle)
    return 0;
  let count = 0;
  let i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++;
    i += needle.length;
  }
  return count;
}
var GraphDB = class {
  db = null;
  dbPath = "";
  // ── Lifecycle ──────────────────────────────────────────────
  async open(dbPath) {
    let wasmPath = (0, import_path4.join)(__dirname, "sql-wasm.wasm");
    if (!(0, import_fs2.existsSync)(wasmPath)) {
      wasmPath = (0, import_path4.join)((0, import_path4.dirname)(require.resolve("sql.js")), "sql-wasm.wasm");
    }
    const SQL = await (0, import_sql.default)({
      locateFile: () => wasmPath
    });
    this.dbPath = dbPath;
    if ((0, import_fs2.existsSync)(dbPath)) {
      const fileBuffer = (0, import_fs2.readFileSync)(dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(SCHEMA);
    this.migrateSchema();
  }
  /** Open synchronously from an already-initialized SQL module. For MCP server use. */
  openSync(SQL, dbPath) {
    this.dbPath = dbPath;
    if ((0, import_fs2.existsSync)(dbPath)) {
      const fileBuffer = (0, import_fs2.readFileSync)(dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(SCHEMA);
    this.migrateSchema();
  }
  close() {
    this.db?.close();
    this.db = null;
  }
  get isOpen() {
    return this.db !== null;
  }
  /** Write current DB state to disk. */
  save() {
    if (!this.db || !this.dbPath)
      return;
    const data = this.db.export();
    (0, import_fs2.writeFileSync)(this.dbPath, Buffer.from(data));
  }
  // ── Saved queries (Aura Query Language favorites) ──────────
  listSavedQueries() {
    const db = this.ensureDb();
    return queryAll(
      db,
      "SELECT id, name, expr, mode, created_at FROM saved_queries ORDER BY created_at DESC"
    ).map((r) => ({ id: r.id, name: r.name, expr: r.expr, mode: r.mode, createdAt: r.created_at }));
  }
  addSavedQuery(q) {
    const db = this.ensureDb();
    db.run(
      "INSERT OR REPLACE INTO saved_queries (id, name, expr, mode, created_at) VALUES (?, ?, ?, ?, ?)",
      [q.id, q.name, q.expr, q.mode || "highlight", Date.now()]
    );
    this.save();
  }
  deleteSavedQuery(id) {
    const db = this.ensureDb();
    db.run("DELETE FROM saved_queries WHERE id = ?", [id]);
    this.save();
  }
  // ── Import (full replace after each analysis) ──────────────
  importGraphData(data) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      db.run("DELETE FROM symbols");
      db.run("DELETE FROM edges");
      db.run("DELETE FROM cycles");
      db.run("DELETE FROM symbol_cycle_steps");
      db.run("DELETE FROM symbol_cycles");
      db.run("DELETE FROM symbol_exemptions");
      db.run("DELETE FROM nodes");
      db.run("DELETE FROM meta");
      db.run("DELETE FROM function_calls");
      for (const n of data.nodes) {
        db.run(
          "INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, cognitive, pagerank, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [n.id, n.name, n.language, n.extension, n.group, n.size, n.linesOfCode, n.complexity, n.cognitive ?? null, n.pagerank ?? null, n.fanIn, n.fanOut, n.lastModified]
        );
      }
      for (const e of data.links) {
        const src = typeof e.source === "object" ? e.source.id : e.source;
        const tgt = typeof e.target === "object" ? e.target.id : e.target;
        db.run(
          "INSERT OR IGNORE INTO edges (source, target, type, label, confidence) VALUES (?, ?, ?, ?, ?)",
          [src, tgt, e.type, e.label || "", e.confidence ?? 1]
        );
      }
      const insertSymbol = "INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async, cognitive, cyclomatic, function_lines, halstead_volume, maintainability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      for (const n of data.nodes) {
        if (!n.symbols)
          continue;
        const deadSet = new Set(n.deadExports || []);
        for (const fn of n.symbols.functions) {
          db.run(
            insertSymbol,
            [n.id, fn.name, fn.type || "function", fn.returnType || "", fn.params || "", fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || "public", fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0, fn.cognitive ?? null, fn.cyclomatic ?? null, fn.functionLines ?? null, fn.halsteadVolume ?? null, fn.maintainability ?? null]
          );
        }
        for (const m of n.symbols.methods || []) {
          db.run(
            insertSymbol,
            [n.id, m.name, m.type || "method", m.returnType || "", m.params || "", m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || "public", m.isStatic ? 1 : 0, m.isAsync ? 1 : 0, m.cognitive ?? null, m.cyclomatic ?? null, m.functionLines ?? null, m.halsteadVolume ?? null, m.maintainability ?? null]
          );
        }
        for (const s of n.symbols.structs)
          db.run(insertSymbol, [n.id, s.name, s.type || "struct", "", "", s.line || 0, 0, "public", 0, 0, null, null, null, null, null]);
        for (const e of n.symbols.enums)
          db.run(insertSymbol, [n.id, e.name, e.type || "enum", "", "", e.line || 0, 0, "public", 0, 0, null, null, null, null, null]);
        for (const m of n.symbols.macros)
          db.run(insertSymbol, [n.id, m.name, m.type || "macro", "", "", m.line || 0, 0, "public", 0, 0, null, null, null, null, null]);
        for (const c of n.symbols.classes)
          db.run(insertSymbol, [n.id, c.name, c.type || "class", "", "", c.line || 0, deadSet.has(c.name) ? 1 : 0, "public", 0, 0, null, null, null, null, null]);
        for (const ex of n.symbols.exports)
          db.run(insertSymbol, [n.id, ex.name, ex.type || "export", "", "", ex.line || 0, deadSet.has(ex.name) ? 1 : 0, "public", 0, 0, null, null, null, null, null]);
        for (const i of n.symbols.interfaces || [])
          db.run(insertSymbol, [n.id, i.name, i.type || "interface", "", "", i.line || 0, 0, i.visibility || "public", 0, 0, null, null, null, null, null]);
        for (const t of n.symbols.traits || [])
          db.run(insertSymbol, [n.id, t.name, t.type || "trait", "", "", t.line || 0, 0, t.visibility || "public", 0, 0, null, null, null, null, null]);
        for (const ta of n.symbols.typeAliases || [])
          db.run(insertSymbol, [n.id, ta.name, ta.type || "type_alias", "", "", ta.line || 0, 0, ta.visibility || "public", 0, 0, null, null, null, null, null]);
        for (const ex of n.exemptedExports || []) {
          db.run(
            "INSERT OR IGNORE INTO symbol_exemptions (node_id, name, kind, reason) VALUES (?, ?, ?, ?)",
            [n.id, ex.name, ex.kind || "", ex.reason]
          );
        }
      }
      if (data.meta.cycles) {
        for (let ci = 0; ci < data.meta.cycles.length; ci++) {
          const cycle = data.meta.cycles[ci];
          for (let pos = 0; pos < cycle.length; pos++) {
            db.run("INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)", [ci, cycle[pos], pos]);
          }
        }
      }
      const metaEntries = [
        ["projectName", data.meta.projectName],
        ["analyzedAt", data.meta.analyzedAt],
        ["totalFiles", String(data.meta.totalFiles)],
        ["totalLinks", String(data.meta.totalLinks)],
        ["totalRelationsFound", String(data.meta.totalRelationsFound)],
        ["functionCallLinks", String(data.meta.functionCallLinks)],
        ["unresolvedReferences", String(data.meta.unresolvedReferences)],
        ["deadCodeFiles", String(data.meta.deadCodeFiles)],
        ["deadExportsTotal", String(data.meta.deadExportsTotal)],
        ["deadCodeExemptions", String(data.meta.deadCodeExemptions || 0)],
        ["parseFailures", JSON.stringify(data.meta.parseFailures || null)],
        ["languageStats", JSON.stringify(data.meta.languageStats)],
        ["groups", JSON.stringify(data.meta.groups)]
      ];
      for (const [key, value] of metaEntries) {
        db.run("INSERT INTO meta (key, value) VALUES (?, ?)", [key, value]);
      }
      if (data.functionCalls) {
        const insertCall = "INSERT OR IGNORE INTO function_calls (caller_file, caller_name, callee_file, callee_name, call_line) VALUES (?, ?, ?, ?, ?)";
        for (const fc of data.functionCalls) {
          db.run(insertCall, [fc.callerFile, fc.callerName, fc.calleeFile, fc.calleeName, fc.callLine]);
        }
      }
      this.insertSymbolCycles(data.meta.symbolCycles || []);
      db.run("COMMIT");
    } catch (err2) {
      db.run("ROLLBACK");
      throw err2;
    }
    this.save();
  }
  // ── Granular updates (incremental parsing) ─────────────────
  /** Upsert a single node (INSERT OR REPLACE). */
  upsertNode(node) {
    const db = this.ensureDb();
    db.run(
      `INSERT OR REPLACE INTO nodes (id, name, language, extension, group_name, size, lines, complexity, cognitive, pagerank, fan_in, fan_out, last_modified)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [node.id, node.name, node.language, node.extension, node.group, node.size, node.linesOfCode, node.complexity, node.cognitive ?? null, node.pagerank ?? null, node.fanIn, node.fanOut, node.lastModified]
    );
  }
  /** Delete a node and ALL associated data (edges from/to, symbols, function_calls). */
  deleteNode(nodeId) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      db.run("DELETE FROM edges WHERE source = ? OR target = ?", [nodeId, nodeId]);
      db.run("DELETE FROM symbols WHERE node_id = ?", [nodeId]);
      db.run("DELETE FROM symbol_exemptions WHERE node_id = ?", [nodeId]);
      db.run("DELETE FROM function_calls WHERE caller_file = ? OR callee_file = ?", [nodeId, nodeId]);
      db.run("DELETE FROM symbol_cycle_steps");
      db.run("DELETE FROM symbol_cycles");
      db.run("DELETE FROM doc_chunks WHERE file_id = ?", [nodeId]);
      db.run("DELETE FROM nodes WHERE id = ?", [nodeId]);
      db.run("COMMIT");
    } catch (err2) {
      db.run("ROLLBACK");
      throw err2;
    }
  }
  /**
   * Replace all outgoing edges, symbols, and call sites for a single file.
   * Also upserts the node itself. Does NOT call save() — caller decides when to persist.
   */
  replaceFileData(fileId, node, outEdges, callSites) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      db.run(
        `INSERT OR REPLACE INTO nodes (id, name, language, extension, group_name, size, lines, complexity, cognitive, pagerank, fan_in, fan_out, last_modified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [node.id, node.name, node.language, node.extension, node.group, node.size, node.linesOfCode, node.complexity, node.cognitive ?? null, node.pagerank ?? null, node.fanIn, node.fanOut, node.lastModified]
      );
      db.run("DELETE FROM edges WHERE source = ?", [fileId]);
      for (const e of outEdges) {
        db.run(
          "INSERT OR IGNORE INTO edges (source, target, type, label, confidence) VALUES (?, ?, ?, ?, ?)",
          [e.source, e.target, e.type, e.label || "", e.confidence ?? 1]
        );
      }
      db.run("DELETE FROM symbols WHERE node_id = ?", [fileId]);
      db.run("DELETE FROM symbol_exemptions WHERE node_id = ?", [fileId]);
      if (node.symbols) {
        const deadSet = new Set(node.deadExports || []);
        const ins = "INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async, cognitive, cyclomatic, function_lines, halstead_volume, maintainability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        for (const fn of node.symbols.functions) {
          db.run(ins, [fileId, fn.name, fn.type || "function", fn.returnType || "", fn.params || "", fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || "public", fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0, fn.cognitive ?? null, fn.cyclomatic ?? null, fn.functionLines ?? null, fn.halsteadVolume ?? null, fn.maintainability ?? null]);
        }
        for (const m of node.symbols.methods || []) {
          db.run(ins, [fileId, m.name, m.type || "method", m.returnType || "", m.params || "", m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || "public", m.isStatic ? 1 : 0, m.isAsync ? 1 : 0, m.cognitive ?? null, m.cyclomatic ?? null, m.functionLines ?? null, m.halsteadVolume ?? null, m.maintainability ?? null]);
        }
        for (const s of node.symbols.structs)
          db.run(ins, [fileId, s.name, s.type || "struct", "", "", s.line || 0, 0, "public", 0, 0, null, null, null, null, null]);
        for (const e of node.symbols.enums)
          db.run(ins, [fileId, e.name, e.type || "enum", "", "", e.line || 0, 0, "public", 0, 0, null, null, null, null, null]);
        for (const m of node.symbols.macros)
          db.run(ins, [fileId, m.name, m.type || "macro", "", "", m.line || 0, 0, "public", 0, 0, null, null, null, null, null]);
        for (const c of node.symbols.classes)
          db.run(ins, [fileId, c.name, c.type || "class", "", "", c.line || 0, deadSet.has(c.name) ? 1 : 0, "public", 0, 0, null, null, null, null, null]);
        for (const ex of node.symbols.exports)
          db.run(ins, [fileId, ex.name, ex.type || "export", "", "", ex.line || 0, deadSet.has(ex.name) ? 1 : 0, "public", 0, 0, null, null, null, null, null]);
        for (const i of node.symbols.interfaces || [])
          db.run(ins, [fileId, i.name, i.type || "interface", "", "", i.line || 0, 0, i.visibility || "public", 0, 0, null, null, null, null, null]);
        for (const t of node.symbols.traits || [])
          db.run(ins, [fileId, t.name, t.type || "trait", "", "", t.line || 0, 0, t.visibility || "public", 0, 0, null, null, null, null, null]);
        for (const ta of node.symbols.typeAliases || [])
          db.run(ins, [fileId, ta.name, ta.type || "type_alias", "", "", ta.line || 0, 0, ta.visibility || "public", 0, 0, null, null, null, null, null]);
      }
      for (const ex of node.exemptedExports || []) {
        db.run(
          "INSERT OR IGNORE INTO symbol_exemptions (node_id, name, kind, reason) VALUES (?, ?, ?, ?)",
          [fileId, ex.name, ex.kind || "", ex.reason]
        );
      }
      db.run("DELETE FROM function_calls WHERE caller_file = ?", [fileId]);
      for (const fc of callSites) {
        db.run(
          "INSERT OR IGNORE INTO function_calls (caller_file, caller_name, callee_file, callee_name, call_line) VALUES (?, ?, ?, ?, ?)",
          [fc.callerFile, fc.callerName, fc.calleeFile, fc.calleeName, fc.callLine]
        );
      }
      db.run("COMMIT");
    } catch (err2) {
      db.run("ROLLBACK");
      throw err2;
    }
  }
  /** Replace function-level cycles (V2-03). Does not call save(). */
  replaceSymbolCycles(cycles) {
    this.insertSymbolCycles(cycles);
  }
  insertSymbolCycles(cycles) {
    const db = this.ensureDb();
    db.run("DELETE FROM symbol_cycle_steps");
    db.run("DELETE FROM symbol_cycles");
    for (const cycle of cycles) {
      db.run(
        "INSERT INTO symbol_cycles (cycle_id, kind, confidence, ambiguous) VALUES (?, ?, ?, ?)",
        [cycle.id, cycle.kind, cycle.confidence, cycle.ambiguous ? 1 : 0]
      );
      for (let pos = 0; pos < cycle.edges.length; pos++) {
        const step = cycle.edges[pos];
        db.run(
          "INSERT INTO symbol_cycle_steps (cycle_id, position, caller_file, caller_name, callee_file, callee_name, call_line, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [cycle.id, pos, step.callerFile, step.callerName, step.calleeFile, step.calleeName, step.callLine, step.confidence]
        );
      }
    }
  }
  /** All function-level cycles (V2-03). */
  getSymbolCycles() {
    const db = this.ensureDb();
    const rows = queryAll(
      db,
      "SELECT cycle_id, kind, confidence, ambiguous FROM symbol_cycles ORDER BY cycle_id"
    );
    if (rows.length === 0)
      return [];
    const stepRows = queryAll(
      db,
      "SELECT cycle_id, caller_file, caller_name, callee_file, callee_name, call_line, confidence FROM symbol_cycle_steps ORDER BY cycle_id, position"
    );
    const stepsByCycle = /* @__PURE__ */ new Map();
    for (const step of stepRows) {
      const list = stepsByCycle.get(step.cycle_id);
      const entry = {
        callerFile: step.caller_file,
        callerName: step.caller_name,
        calleeFile: step.callee_file,
        calleeName: step.callee_name,
        callLine: step.call_line,
        confidence: step.confidence
      };
      if (list)
        list.push(entry);
      else
        stepsByCycle.set(step.cycle_id, [entry]);
    }
    return rows.map((row) => {
      const edges = stepsByCycle.get(row.cycle_id) || [];
      return {
        id: row.cycle_id,
        kind: row.kind === "recursive" ? "recursive" : "mutual",
        nodes: edges.map((edge) => ({ file: edge.callerFile, name: edge.callerName })),
        edges,
        confidence: row.confidence,
        ambiguous: !!row.ambiguous
      };
    });
  }
  /** Persist PageRank values after an incremental graph update. Does not save(). */
  updatePageRanks(nodes) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      for (const node of nodes) {
        db.run("UPDATE nodes SET pagerank = ? WHERE id = ?", [node.pagerank ?? 0, node.id]);
      }
      db.run("COMMIT");
    } catch (err2) {
      db.run("ROLLBACK");
      throw err2;
    }
  }
  /** Recompute structural fan_in / fan_out from the edges table for given node IDs (or all nodes). */
  updateFanCounts(nodeIds) {
    const db = this.ensureDb();
    const structuralTarget = "edges.type <> 'doc-reference' AND EXISTS (SELECT 1 FROM nodes t WHERE t.id = edges.target AND t.language <> 'documentation')";
    const structuralSource = "edges.type <> 'doc-reference' AND EXISTS (SELECT 1 FROM nodes s WHERE s.id = edges.source AND s.language <> 'documentation')";
    if (nodeIds && nodeIds.length > 0) {
      for (const id of nodeIds) {
        const isDoc = queryOne(db, "SELECT COUNT(*) AS c FROM nodes WHERE id = ? AND language = 'documentation'", [id]);
        if (isDoc && isDoc.c > 0) {
          db.run("UPDATE nodes SET fan_in = 0, fan_out = 0 WHERE id = ?", [id]);
          continue;
        }
        const fanOut = queryOne(db, `SELECT COUNT(*) AS c FROM edges WHERE edges.source = ? AND ${structuralTarget}`, [id]);
        const fanIn = queryOne(db, `SELECT COUNT(*) AS c FROM edges WHERE edges.target = ? AND ${structuralSource}`, [id]);
        db.run("UPDATE nodes SET fan_in = ?, fan_out = ? WHERE id = ?", [fanIn?.c ?? 0, fanOut?.c ?? 0, id]);
      }
    } else {
      db.run(`
                UPDATE nodes SET
                    fan_out = (SELECT COUNT(*) FROM edges WHERE edges.source = nodes.id AND ${structuralTarget}),
                    fan_in  = (SELECT COUNT(*) FROM edges WHERE edges.target = nodes.id AND ${structuralSource})
                WHERE nodes.language <> 'documentation'
            `);
      db.run("UPDATE nodes SET fan_in = 0, fan_out = 0 WHERE language = 'documentation'");
    }
  }
  // ── Export (reconstruct GraphData from DB) ─────────────────
  /** Reconstruct a full GraphData object from the DB. Returns null if DB is empty. */
  exportGraphData() {
    const db = this.ensureDb();
    const nodes = queryAll(db, "SELECT * FROM nodes ORDER BY id");
    if (nodes.length === 0)
      return null;
    const edges = queryAll(db, "SELECT * FROM edges ORDER BY source, target");
    const allSymbols = queryAll(db, "SELECT * FROM symbols ORDER BY node_id");
    const meta = this.getAllMeta();
    const cycles = this.getCycles();
    const fcalls = queryAll(
      db,
      "SELECT * FROM function_calls ORDER BY caller_file, call_line"
    );
    const symbolCycles = this.getSymbolCycles();
    const exemptions = queryAll(
      db,
      "SELECT node_id, name, kind, reason FROM symbol_exemptions ORDER BY node_id, name"
    );
    const symbolsByNode = /* @__PURE__ */ new Map();
    for (const s of allSymbols) {
      let arr = symbolsByNode.get(s.node_id);
      if (!arr) {
        arr = [];
        symbolsByNode.set(s.node_id, arr);
      }
      arr.push(s);
    }
    const exemptionsByNode = /* @__PURE__ */ new Map();
    for (const ex of exemptions) {
      let arr = exemptionsByNode.get(ex.node_id);
      if (!arr) {
        arr = [];
        exemptionsByNode.set(ex.node_id, arr);
      }
      arr.push({ name: ex.name, kind: ex.kind, reason: ex.reason });
    }
    const graphNodes = nodes.map((n) => {
      const syms = symbolsByNode.get(n.id) || [];
      const deadSymbols = syms.filter((s) => s.is_dead).map((s) => s.name);
      const functions = syms.filter((s) => s.kind === "function").map((s) => ({
        name: s.name,
        returnType: s.return_type,
        params: s.params,
        line: s.line,
        type: s.kind,
        visibility: s.visibility,
        isStatic: !!s.is_static,
        isAsync: !!s.is_async,
        ...s.cognitive === null ? {} : {
          cognitive: s.cognitive,
          cyclomatic: s.cyclomatic ?? void 0,
          functionLines: s.function_lines ?? void 0,
          halsteadVolume: s.halstead_volume ?? void 0,
          maintainability: s.maintainability ?? void 0
        }
      }));
      const methods = syms.filter((s) => s.kind === "method").map((s) => ({
        name: s.name,
        returnType: s.return_type,
        params: s.params,
        line: s.line,
        type: s.kind,
        visibility: s.visibility,
        isStatic: !!s.is_static,
        isAsync: !!s.is_async,
        ...s.cognitive === null ? {} : {
          cognitive: s.cognitive,
          cyclomatic: s.cyclomatic ?? void 0,
          functionLines: s.function_lines ?? void 0,
          halsteadVolume: s.halstead_volume ?? void 0,
          maintainability: s.maintainability ?? void 0
        }
      }));
      const structs = syms.filter((s) => s.kind === "struct").map((s) => ({ name: s.name, type: s.kind, line: s.line }));
      const enums = syms.filter((s) => s.kind === "enum").map((s) => ({ name: s.name, type: s.kind, line: s.line }));
      const macros = syms.filter((s) => s.kind === "macro").map((s) => ({ name: s.name, type: s.kind, line: s.line }));
      const classes = syms.filter((s) => s.kind === "class").map((s) => ({ name: s.name, type: s.kind, line: s.line }));
      const exports2 = syms.filter((s) => s.kind.startsWith("export")).map((s) => ({ name: s.name, type: s.kind, line: s.line }));
      const interfaces = syms.filter((s) => s.kind === "interface").map((s) => ({ name: s.name, type: s.kind }));
      const traits = syms.filter((s) => s.kind === "trait").map((s) => ({ name: s.name, type: s.kind }));
      const typeAliases = syms.filter((s) => s.kind === "type_alias").map((s) => ({ name: s.name, type: s.kind }));
      const node = {
        id: n.id,
        name: n.name,
        path: n.id,
        language: n.language,
        extension: n.extension,
        size: n.size,
        linesOfCode: n.lines,
        lastModified: n.last_modified,
        group: n.group_name,
        fanOut: n.fan_out,
        fanIn: n.fan_in,
        complexity: n.complexity,
        complexityDetails: {}
      };
      if (n.cognitive !== null)
        node.cognitive = n.cognitive;
      if (n.pagerank !== null)
        node.pagerank = n.pagerank;
      if (syms.length > 0) {
        node.symbols = {
          functions,
          methods,
          structs,
          enums,
          macros,
          classes,
          exports: exports2,
          interfaces,
          traits,
          typeAliases,
          totalSymbols: syms.length
        };
      }
      if (deadSymbols.length > 0)
        node.deadExports = deadSymbols;
      const exempted = exemptionsByNode.get(n.id);
      if (exempted && exempted.length > 0)
        node.exemptedExports = exempted;
      return node;
    });
    const nodeMap = new Map(graphNodes.map((n) => [n.id, n]));
    for (let i = 0; i < cycles.length; i++) {
      for (const nodeId of cycles[i]) {
        const node = nodeMap.get(nodeId);
        if (node) {
          if (!node.cycleIds)
            node.cycleIds = [];
          node.cycleIds.push(i);
        }
      }
    }
    const links = edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
      confidence: e.confidence ?? 1
    }));
    const langStats = meta["languageStats"] ? JSON.parse(meta["languageStats"]) : {};
    const groups = meta["groups"] ? JSON.parse(meta["groups"]) : [];
    let parseFailures;
    if (meta["parseFailures"]) {
      try {
        const parsed = JSON.parse(meta["parseFailures"]);
        if (parsed && typeof parsed.total === "number" && Array.isArray(parsed.samples)) {
          parseFailures = parsed;
        }
      } catch {
      }
    }
    return {
      meta: {
        projectName: meta["projectName"] || "",
        analyzedAt: meta["analyzedAt"] || "",
        totalFiles: parseInt(meta["totalFiles"] || "0"),
        totalLinks: parseInt(meta["totalLinks"] || "0"),
        totalRelationsFound: parseInt(meta["totalRelationsFound"] || "0"),
        functionCallLinks: parseInt(meta["functionCallLinks"] || "0"),
        heritageLinks: parseInt(meta["heritageLinks"] || "0"),
        unresolvedReferences: parseInt(meta["unresolvedReferences"] || "0"),
        unresolvedSamples: [],
        deadCodeFiles: parseInt(meta["deadCodeFiles"] || "0"),
        deadExportsTotal: parseInt(meta["deadExportsTotal"] || "0"),
        deadCodeExemptions: parseInt(meta["deadCodeExemptions"] || "0"),
        cycles,
        symbolCycles,
        ...parseFailures ? { parseFailures } : {},
        languageStats: langStats,
        groups
      },
      nodes: graphNodes,
      links,
      functionCalls: fcalls.map((fc) => ({
        callerFile: fc.caller_file,
        callerName: fc.caller_name,
        calleeFile: fc.callee_file,
        calleeName: fc.callee_name,
        callLine: fc.call_line
      }))
    };
  }
  // ── Queries ────────────────────────────────────────────────
  /** Transitive dependencies of a file (what it depends on). */
  getDependencies(fileId, maxDepth = 5) {
    return queryAll(this.ensureDb(), `
            WITH RECURSIVE deps(id, depth) AS (
                SELECT target, 1 FROM edges WHERE source = ?
                UNION
                SELECT e.target, d.depth + 1
                FROM edges e JOIN deps d ON e.source = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `, [fileId, maxDepth]);
  }
  /** Transitive dependents of a file (what depends on it — impact analysis). */
  getDependents(fileId, maxDepth = 5) {
    return queryAll(this.ensureDb(), `
            WITH RECURSIVE deps(id, depth) AS (
                SELECT source, 1 FROM edges WHERE target = ?
                UNION
                SELECT e.source, d.depth + 1
                FROM edges e JOIN deps d ON e.target = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `, [fileId, maxDepth]);
  }
  /** Blast radius — directional dependents with risk level. */
  getBlastRadius(fileId, maxDepth = 5) {
    const deps = this.getDependents(fileId, maxDepth);
    return deps.map((d) => ({
      ...d,
      risk: d.depth === 1 ? "high" : d.depth === 2 ? "medium" : "low"
    }));
  }
  /** Shortest path between two files. Returns null if no path exists. */
  findPath(from, to, maxDepth = 20) {
    const rows = queryAll(this.ensureDb(), `
            WITH RECURSIVE path(id, route, depth) AS (
                SELECT ?, ?, 0
                UNION
                SELECT e.target, p.route || '|' || e.target, p.depth + 1
                FROM edges e JOIN path p ON e.source = p.id
                WHERE p.depth < ? AND INSTR(p.route, e.target) = 0
            )
            SELECT route FROM path WHERE id = ? ORDER BY depth LIMIT 1
        `, [from, from, maxDepth, to]);
    if (rows.length === 0)
      return null;
    return rows[0].route.split("|");
  }
  /** Top N hotspots sorted by impact score (complexity × fan_in). */
  getHotspots(limit = 20, sortBy = "impact") {
    const orderClause = sortBy === "complexity" ? "complexity DESC" : sortBy === "fan_in" ? "fan_in DESC" : sortBy === "lines" ? "lines DESC" : "(complexity * (fan_in + 1)) DESC";
    return queryAll(
      this.ensureDb(),
      `SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes
             WHERE language <> 'documentation'
             ORDER BY ${orderClause} LIMIT ?`,
      [limit]
    );
  }
  /** All dead code (uncalled exports). */
  getDeadCode() {
    return queryAll(
      this.ensureDb(),
      "SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id"
    );
  }
  /** Symbols explicitly exempted by framework/test rules (V2-13). */
  getExemptedCode() {
    return queryAll(
      this.ensureDb(),
      "SELECT node_id AS nodeId, name AS symbol, kind, reason FROM symbol_exemptions ORDER BY node_id, name"
    );
  }
  /** Files that nothing imports (fan_in = 0) — orphan / entry-point files. */
  getOrphanFiles(limit = 100) {
    return queryAll(
      this.ensureDb(),
      "SELECT * FROM nodes WHERE fan_in = 0 AND language <> 'documentation' ORDER BY fan_out, name LIMIT ?",
      [limit]
    );
  }
  /** Replace all persisted co-change pairs (history scan / analysis refresh). */
  replaceCochange(pairs, windowDays) {
    const db = this.ensureDb();
    const days = Number.isFinite(windowDays) ? Math.round(windowDays) : 365;
    db.run("BEGIN TRANSACTION");
    try {
      db.run("DELETE FROM cochange_pairs");
      for (const pair of pairs) {
        const a = pair.a < pair.b ? pair.a : pair.b;
        const b = pair.a < pair.b ? pair.b : pair.a;
        db.run(
          "INSERT OR REPLACE INTO cochange_pairs (file_a, file_b, cochanges, a_commits, b_commits, union_commits, jaccard, support, linked, window_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [a, b, pair.cochanges, pair.aCommits, pair.bCommits, pair.aCommits + pair.bCommits - pair.cochanges, pair.jaccard, pair.support, pair.linked ? 1 : 0, days]
        );
      }
      db.run("COMMIT");
      this.save();
    } catch (err2) {
      try {
        db.run("ROLLBACK");
      } catch {
      }
      throw err2;
    }
  }
  /** Strongest co-change pairs, optionally above a Jaccard threshold. */
  getCochange(limit = 50, minScore = 0) {
    const capped = Math.max(1, Math.min(500, Math.round(limit)));
    const threshold = Number.isFinite(minScore) ? Math.max(0, Math.min(1, minScore)) : 0;
    return queryAll(
      this.ensureDb(),
      "SELECT file_a, file_b, cochanges, a_commits, b_commits, union_commits, jaccard, support, linked, window_days FROM cochange_pairs WHERE jaccard >= ? ORDER BY jaccard DESC, cochanges DESC, file_a, file_b LIMIT ?",
      [threshold, capped]
    );
  }
  /** All cycles. */
  getCycles() {
    const rows = queryAll(
      this.ensureDb(),
      "SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"
    );
    const cycles = [];
    let current2 = [];
    let currentId = -1;
    for (const row of rows) {
      if (row.cycle_id !== currentId) {
        if (current2.length > 0)
          cycles.push(current2);
        current2 = [];
        currentId = row.cycle_id;
      }
      current2.push(row.node_id);
    }
    if (current2.length > 0)
      cycles.push(current2);
    return cycles;
  }
  /** Full detail for a single node. */
  getNodeDetail(fileId) {
    const db = this.ensureDb();
    const node = queryOne(db, "SELECT * FROM nodes WHERE id = ?", [fileId]);
    if (!node)
      return null;
    const symbols = queryAll(db, "SELECT * FROM symbols WHERE node_id = ?", [fileId]);
    const deps = queryAll(db, "SELECT target FROM edges WHERE source = ?", [fileId]);
    const revDeps = queryAll(db, "SELECT source FROM edges WHERE target = ?", [fileId]);
    const edges = queryAll(db, "SELECT * FROM edges WHERE source = ? OR target = ? ORDER BY source, target", [fileId, fileId]);
    return {
      ...node,
      symbols,
      dependencies: deps.map((d) => d.target),
      dependents: revDeps.map((d) => d.source),
      edges
    };
  }
  /** Architecture overview by language. */
  getArchitectureOverview() {
    return queryAll(this.ensureDb(), `
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `);
  }
  /** Search symbols by name (LIKE match). */
  searchSymbols(query, kind) {
    const db = this.ensureDb();
    const sql = "SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync, cognitive, maintainability FROM symbols WHERE name LIKE ?" + (kind ? " AND kind = ?" : "") + " ORDER BY name LIMIT 100";
    const params = kind ? [`%${query}%`, kind] : [`%${query}%`];
    const rows = queryAll(db, sql, params);
    return rows.map((r) => ({ ...r, isStatic: !!r.isStatic, isAsync: !!r.isAsync, visibility: r.visibility || "public" }));
  }
  /** Get heritage edges (extends, implements). */
  getHeritage(fileId) {
    const db = this.ensureDb();
    if (fileId) {
      return queryAll(
        db,
        "SELECT * FROM edges WHERE type IN ('extends', 'implements') AND (source = ? OR target = ?) ORDER BY source, type",
        [fileId, fileId]
      );
    }
    return queryAll(
      db,
      "SELECT * FROM edges WHERE type IN ('extends', 'implements') ORDER BY source, type"
    );
  }
  /** Find functions/methods never called anywhere (not even within their own file). */
  getUnusedFunctions(fileId, includeMethods = true) {
    const db = this.ensureDb();
    const kinds = includeMethods ? "('function', 'method')" : "('function')";
    const fileFilter = fileId ? " AND s.node_id = ?" : "";
    const params = fileId ? [fileId] : [];
    return queryAll(db, `
            SELECT s.node_id AS nodeId, s.name, s.kind, s.line, s.visibility
            FROM symbols s
            WHERE s.kind IN ${kinds}${fileFilter}
              AND NOT EXISTS (
                SELECT 1 FROM function_calls fc
                WHERE fc.callee_name = s.name AND fc.callee_file = s.node_id
              )
            ORDER BY s.node_id, s.line
        `, params);
  }
  /** Get all nodes. */
  getAllNodes() {
    return queryAll(this.ensureDb(), "SELECT * FROM nodes ORDER BY id");
  }
  /** Get all edges. */
  getAllEdges() {
    return queryAll(this.ensureDb(), "SELECT * FROM edges ORDER BY source, target");
  }
  /** Get function-level call sites, optionally filtered by file. */
  getFunctionCalls(fileId) {
    const db = this.ensureDb();
    if (fileId) {
      return queryAll(
        db,
        "SELECT * FROM function_calls WHERE caller_file = ? OR callee_file = ? ORDER BY caller_file, call_line",
        [fileId, fileId]
      );
    }
    return queryAll(db, "SELECT * FROM function_calls ORDER BY caller_file, call_line");
  }
  /**
   * Community detection using the shared deterministic implementation.
   * Documentation nodes and doc-reference edges are excluded.
   * Returns nodeId → communityId mapping (legacy shape used by older callers).
   */
  getCommunities() {
    const result = [];
    for (const community of this.getCommunitySnapshot()) {
      for (const nodeId of community.files) {
        result.push({ nodeId, community: community.id });
      }
    }
    return result;
  }
  /**
   * The single source of truth for Communities: code-only membership, hub-path
   * auto labels and user overrides, in one deterministic snapshot.
   */
  getCommunitySnapshot() {
    const db = this.ensureDb();
    const nodes = queryAll(db, "SELECT id, language, fan_in FROM nodes ORDER BY id");
    const edges = queryAll(
      db,
      "SELECT source, target, type FROM edges ORDER BY source, target, type"
    );
    return detectCommunities(nodes, edges, { labels: this.getCommunityLabels() });
  }
  /** User-provided community labels, keyed by the stable member-set hash. */
  getCommunityLabels() {
    const db = this.ensureDb();
    const rows = queryAll(db, "SELECT key, label FROM community_labels");
    const labels = {};
    for (const row of rows) {
      if (row.key && row.label && row.label.trim())
        labels[row.key] = row.label.trim();
    }
    return labels;
  }
  /** Rename a community; an empty label restores the automatic hub path. */
  setCommunityLabel(key, label) {
    if (!key)
      return;
    const db = this.ensureDb();
    const value = label.trim();
    if (value) {
      db.run("INSERT OR REPLACE INTO community_labels (key, label) VALUES (?, ?)", [key, value]);
    } else {
      db.run("DELETE FROM community_labels WHERE key = ?", [key]);
    }
    this.save();
  }
  /** Get meta value by key. */
  getMeta(key) {
    const row = queryOne(this.ensureDb(), "SELECT value FROM meta WHERE key = ?", [key]);
    return row?.value ?? null;
  }
  /** Set a meta value (caller decides when to save()). */
  setMeta(key, value) {
    this.ensureDb().run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, value]);
  }
  /** Get all meta as a map. */
  getAllMeta() {
    const rows = queryAll(this.ensureDb(), "SELECT key, value FROM meta");
    const map = {};
    for (const r of rows)
      map[r.key] = r.value;
    return map;
  }
  // ── Documentation RAG (FTS5) ───────────────────────────────
  /** Delete all chunks for a single file. */
  deleteDocChunks(fileId) {
    const db = this.ensureDb();
    db.run("DELETE FROM doc_chunks WHERE file_id = ?", [fileId]);
  }
  /** Replace all chunks for a single file (delete + insert). Does not save(). */
  replaceDocChunks(fileId, chunks) {
    const db = this.ensureDb();
    db.run("DELETE FROM doc_chunks WHERE file_id = ?", [fileId]);
    const ins = "INSERT INTO doc_chunks (file_id, section, content, line_start) VALUES (?, ?, ?, ?)";
    for (const c of chunks) {
      db.run(ins, [fileId, c.section, c.content, c.lineStart]);
    }
  }
  /** Bulk-replace ALL doc chunks (used after a full project re-analysis). Does not save(). */
  importDocChunks(chunks) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      db.run("DELETE FROM doc_chunks");
      const ins = "INSERT INTO doc_chunks (file_id, section, content, line_start) VALUES (?, ?, ?, ?)";
      for (const c of chunks) {
        db.run(ins, [c.fileId, c.section, c.content, c.lineStart]);
      }
      db.run("COMMIT");
    } catch (err2) {
      db.run("ROLLBACK");
      throw err2;
    }
  }
  /**
   * Full-text search across documentation chunks using FTS4 MATCH +
   * a simple JS-side keyword frequency ranker (FTS4 has no built-in bm25).
   * @param query — free-text query (will be sanitized into a MATCH expression)
   * @param limit — max results (default 10)
   */
  searchDocs(query, limit = 10) {
    const db = this.ensureDb();
    const tokens = extractDocTokens(query);
    const matchExpr = tokens.map((t) => `"${t}"*`).join(" OR ");
    if (!matchExpr)
      return [];
    const rows = queryAll(
      db,
      `SELECT file_id, section, content, line_start
             FROM doc_chunks WHERE doc_chunks MATCH ?
             LIMIT ?`,
      [matchExpr, Math.max(limit * 5, 50)]
    );
    const scored = rows.map((r) => {
      const sectionLow = (r.section || "").toLowerCase();
      const contentLow = r.content.toLowerCase();
      let score = 0;
      for (const t of tokens) {
        const lt = t.toLowerCase();
        if (!lt)
          continue;
        score += countOccurrences(sectionLow, lt) * 3;
        score += countOccurrences(contentLow, lt);
      }
      return {
        fileId: r.file_id,
        section: r.section,
        content: r.content,
        lineStart: r.line_start,
        score
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
  // ── Private ────────────────────────────────────────────────
  /** Add columns that may be missing in older databases. */
  migrateSchema() {
    const db = this.ensureDb();
    const cols = queryAll(db, "PRAGMA table_info('symbols')").map((c) => c.name);
    const migrations = [
      ["visibility", "ALTER TABLE symbols ADD COLUMN visibility TEXT DEFAULT 'public'"],
      ["is_static", "ALTER TABLE symbols ADD COLUMN is_static INTEGER DEFAULT 0"],
      ["is_async", "ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0"],
      ["cognitive", "ALTER TABLE symbols ADD COLUMN cognitive INTEGER"],
      ["cyclomatic", "ALTER TABLE symbols ADD COLUMN cyclomatic INTEGER"],
      ["function_lines", "ALTER TABLE symbols ADD COLUMN function_lines INTEGER"],
      ["halstead_volume", "ALTER TABLE symbols ADD COLUMN halstead_volume REAL"],
      ["maintainability", "ALTER TABLE symbols ADD COLUMN maintainability REAL"]
    ];
    for (const [col, sql] of migrations) {
      if (!cols.includes(col)) {
        db.run(sql);
      }
    }
    const nodeCols = queryAll(db, "PRAGMA table_info('nodes')").map((c) => c.name);
    if (!nodeCols.includes("cognitive")) {
      db.run("ALTER TABLE nodes ADD COLUMN cognitive INTEGER");
    }
    if (!nodeCols.includes("pagerank")) {
      db.run("ALTER TABLE nodes ADD COLUMN pagerank REAL");
    }
    const edgeCols = queryAll(db, "PRAGMA table_info('edges')").map((c) => c.name);
    if (!edgeCols.includes("confidence")) {
      db.run("ALTER TABLE edges ADD COLUMN confidence REAL NOT NULL DEFAULT 1.0");
    }
    const tables = queryAll(db, "SELECT name FROM sqlite_master WHERE type='table'").map((t) => t.name);
    if (!tables.includes("function_calls")) {
      db.run(`CREATE TABLE function_calls (
                caller_file TEXT NOT NULL, caller_name TEXT NOT NULL,
                callee_file TEXT NOT NULL, callee_name TEXT NOT NULL,
                call_line INTEGER NOT NULL,
                PRIMARY KEY (caller_file, caller_name, callee_file, callee_name, call_line)
            )`);
      db.run("CREATE INDEX IF NOT EXISTS idx_fcalls_caller ON function_calls(caller_file, caller_name)");
      db.run("CREATE INDEX IF NOT EXISTS idx_fcalls_callee ON function_calls(callee_file, callee_name)");
    }
    if (!tables.includes("doc_chunks")) {
      db.run(`CREATE VIRTUAL TABLE doc_chunks USING fts4(
                file_id, section, content, line_start, tokenize=porter
            )`);
    }
  }
  ensureDb() {
    if (!this.db)
      throw new Error("GraphDB is not open");
    return this.db;
  }
};

// src/lm-tools.ts
var vscode4 = __toESM(require("vscode"));

// src/mcp/context.ts
var STOPWORDS = /* @__PURE__ */ new Set([
  "add",
  "the",
  "a",
  "an",
  "to",
  "in",
  "of",
  "for",
  "and",
  "or",
  "with",
  "on",
  "this",
  "that",
  "into",
  "from",
  "using",
  "use",
  "make",
  "new",
  "fix",
  "implement",
  "create",
  "change",
  "update",
  "remove",
  "delete",
  "need",
  "want",
  "should",
  "would",
  "can",
  "code",
  "project",
  "file",
  "files",
  "how",
  "what",
  "where",
  "which",
  "when",
  "why",
  "do",
  "does",
  "is",
  "are",
  "be",
  "by",
  "as",
  "at",
  "it",
  "we",
  "you",
  "i",
  "me"
]);
function tokenizeTask(text) {
  if (!text)
    return [];
  const words = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOPWORDS.has(w));
  return [...new Set(words)];
}
function resolveContext(db, task, limit = 10) {
  const tokens = tokenizeTask(task);
  if (tokens.length === 0) {
    return {
      task,
      files: [],
      note: 'Could not extract meaningful keywords from the task. Try a more specific description (e.g. "add oauth login").'
    };
  }
  const allNodes = db.getAllNodes();
  const totalNodes = Math.max(allNodes.length, 1);
  const accs = /* @__PURE__ */ new Map();
  const acc = (fileId) => {
    let a = accs.get(fileId);
    if (!a) {
      a = { score: 0, symbols: /* @__PURE__ */ new Map(), docHits: [] };
      accs.set(fileId, a);
    }
    return a;
  };
  const df = /* @__PURE__ */ new Map();
  for (const token of tokens) {
    const matched = /* @__PURE__ */ new Set();
    for (const s of db.searchSymbols(token))
      matched.add(s.nodeId);
    for (const n of allNodes) {
      if (n.name.toLowerCase().includes(token) || n.id.toLowerCase().includes(token))
        matched.add(n.id);
    }
    for (const d of db.searchDocs(token, 50))
      matched.add(d.fileId);
    df.set(token, matched.size);
  }
  const idf = (token) => {
    const d = df.get(token) || 0;
    return 1 + Math.log(totalNodes / (1 + d));
  };
  for (const token of tokens) {
    const w = idf(token);
    for (const s of db.searchSymbols(token)) {
      const exact = s.name.toLowerCase() === token;
      const a = acc(s.nodeId);
      a.score += (exact ? 10 : 5) * w;
      if (!a.symbols.has(s.name)) {
        a.symbols.set(s.name, { symbol: s.name, kind: s.kind, line: s.line, visibility: s.visibility });
      }
    }
  }
  for (const token of tokens) {
    const w = idf(token);
    for (const n of allNodes) {
      const base = n.name.toLowerCase();
      const path5 = n.id.toLowerCase();
      if (base === token)
        acc(n.id).score += 8 * w;
      else if (base.includes(token))
        acc(n.id).score += 6 * w;
      else if (path5.includes(token))
        acc(n.id).score += 4 * w;
    }
  }
  for (const token of tokens) {
    const w = idf(token);
    for (const d of db.searchDocs(token, 20)) {
      const a = acc(d.fileId);
      a.score += 3 * w;
      if (a.docHits.length < 5) {
        a.docHits.push({ section: d.section, line: d.lineStart, excerpt: d.content.slice(0, 200) });
      }
    }
  }
  let maxFanIn = 1;
  let maxPageRank = 0;
  let maxLastModified = 1;
  for (const n of allNodes) {
    if (n.fan_in > maxFanIn)
      maxFanIn = n.fan_in;
    if (typeof n.pagerank === "number" && n.pagerank > maxPageRank)
      maxPageRank = n.pagerank;
    if (n.last_modified > maxLastModified)
      maxLastModified = n.last_modified;
  }
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  for (const [id, a] of accs) {
    const n = nodeById.get(id);
    if (!n)
      continue;
    const centrality = maxPageRank > 0 && typeof n.pagerank === "number" ? n.pagerank / maxPageRank : n.fan_in / maxFanIn;
    a.score += 5 * centrality;
    a.score += 2 * (n.last_modified / maxLastModified);
  }
  const ranked = [...accs.entries()].map(([file, a]) => ({ file, a })).sort((x, y) => y.a.score - x.a.score || x.file.localeCompare(y.file)).slice(0, limit);
  const files = ranked.map(({ file, a }) => {
    const detail = db.getNodeDetail(file);
    return {
      file,
      score: Math.round(a.score * 100) / 100,
      metrics: detail ? {
        language: detail.language,
        lines: detail.lines,
        complexity: detail.complexity,
        fan_in: detail.fan_in,
        fan_out: detail.fan_out
      } : void 0,
      anchors: [...a.symbols.values()],
      doc_hits: a.docHits,
      neighborhood: detail ? {
        dependencies: detail.dependencies.slice(0, 12),
        dependents: detail.dependents.slice(0, 12)
      } : void 0
    };
  });
  return {
    task,
    files,
    note: "Deterministic ranking: symbol matches (\xD710 exact / \xD75 substring), filename (\xD78/\xD76/\xD74), docs (\xD73), weighted by token frequency (IDF), plus fan_in and recency. No LLM involved."
  };
}

// src/ai/tools.ts
var AURA_TOOLS = [
  {
    name: "aura_resolve_context",
    description: "Given a natural-language task description, return the most relevant files in the codebase, ranked, with path:line anchors and metrics.",
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: 'Task description, e.g. "add oauth login"' },
        limit: { type: "number", description: "Maximum files to return (default 8)" }
      },
      required: ["task"]
    }
  },
  {
    name: "aura_find_orphan_files",
    description: "Return files that nothing imports (fan_in = 0). These are orphan or entry-point files. Use this to answer questions about orphaned, isolated or unused files.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum files to return (default 100)" }
      }
    }
  },
  {
    name: "aura_find_cycles",
    description: "Return circular dependency cycles: file-level imports and function-level recursion/mutual recursion with call lines.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "aura_find_dead_code",
    description: "Return exported symbols that are never imported or called anywhere (dead code). Framework/test exemptions are returned separately with their reason.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "aura_get_hotspots",
    description: "Return the most at-risk files, ranked by Aura's repository-relative risk score (percentile-based, with written reasons). NOT for line counts \u2014 use aura_get_largest_files for that.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum files (default 20)" },
        sort_by: { type: "string", enum: ["risk", "impact", "complexity", "fan_in", "lines"], description: "Sort criterion (default risk)" },
        window_days: { type: "number", description: "Git history window in days for risk scoring (default 90)" }
      }
    }
  },
  {
    name: "aura_get_largest_files",
    description: "Return the files with the most lines of code, sorted by descending line count, including their complexity. Use this for questions about the largest / biggest files.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum files (default 20)" }
      }
    }
  },
  {
    name: "aura_get_cochange",
    description: "Return the strongest temporal-coupling pairs: files that keep changing in the same commits without a direct dependency. Jaccard score = cochanges / union of commits.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Maximum pairs (default 50)" },
        min_score: { type: "number", description: "Minimum Jaccard score 0\u20131 (default 0)" }
      }
    }
  },
  {
    name: "aura_find_path",
    description: "Find the shortest dependency path between two files.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source file path" },
        to: { type: "string", description: "Target file path" }
      },
      required: ["from", "to"]
    }
  },
  {
    name: "aura_search_symbols",
    description: "Search for functions, classes, interfaces, methods or other symbols by name. Function results include cognitive complexity and maintainability when the language supports it.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search string (substring match)" },
        kind: { type: "string", description: "Optional filter: function, method, class, struct, enum, macro, export, interface, trait, type_alias" }
      },
      required: ["query"]
    }
  },
  {
    name: "aura_search_docs",
    description: "Full-text search across project documentation (Markdown, text, reStructuredText).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language keywords" },
        limit: { type: "number", description: "Maximum chunks (default 10)" }
      },
      required: ["query"]
    }
  },
  {
    name: "aura_get_architecture",
    description: "Return the high-level architecture overview: file count, lines of code and average complexity grouped by language.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "aura_find_unused_functions",
    description: "Return functions and methods that are never called anywhere in the codebase.",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Optional file path to limit the search" },
        include_methods: { type: "boolean", description: "Include class methods (default true)" }
      }
    }
  },
  {
    name: "aura_find_dependents",
    description: 'Return the files that depend on a given file (blast radius / impact analysis). Use this to answer "what depends on X" or "what would be affected if X changes".',
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path relative to the workspace root" },
        depth: { type: "number", description: "Maximum depth (default 5)" }
      },
      required: ["file"]
    }
  },
  {
    name: "aura_find_dependencies",
    description: "Return the transitive dependencies of a file (what it imports/requires).",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "File path relative to the workspace root" },
        depth: { type: "number", description: "Maximum depth (default 5)" }
      },
      required: ["file"]
    }
  },
  {
    name: "aura_find_heritage",
    description: "Return inheritance and implementation relationships (extends/implements edges).",
    inputSchema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Optional file path to filter heritage edges for" }
      }
    }
  },
  {
    name: "aura_generate_documentation",
    description: "Generate a comprehensive documentation payload for the codebase: architecture overview, modules, critical dependencies, hotspots, cycles, dead code and inter-module links.",
    inputSchema: {
      type: "object",
      properties: {
        hotspot_limit: { type: "number", description: "Number of top hotspots to include (default 15)" }
      }
    }
  },
  {
    name: "aura_get_communities",
    description: "Return architectural communities (modules) detected via the shared Louvain snapshot \u2014 groups of code files by dependency coupling. Documentation nodes and doc-reference edges are excluded; labels are full hub paths or user renames.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "aura_get_architecture_violations",
    description: "Evaluate the project layer rules (.aura/arch-rules.json) against the dependency graph. Returns per-layer globs and Ca/Ce/instability, new (non-baselined) deny/slice violations with severity, and aggregated layer cycles. Pass a layer name to restrict everything to that layer. Documentation is excluded.",
    inputSchema: {
      type: "object",
      properties: {
        layer: { type: "string", description: "Optional layer name to restrict violations, metrics and cycles" },
        include_baselined: { type: "boolean", description: "Include violations frozen in the baseline (default false)" },
        limit: { type: "number", description: "Maximum violations to return (default 100)" }
      }
    }
  }
];
function resolveFileArg(db, file) {
  if (!file)
    return null;
  const all = db.getAllNodes();
  if (all.some((n) => n.id === file))
    return file;
  const lower = file.toLowerCase();
  for (const n of all) {
    if (n.name.toLowerCase() === lower)
      return n.id;
  }
  for (const n of all) {
    if (n.id.toLowerCase().endsWith("/" + lower))
      return n.id;
  }
  for (const n of all) {
    if (n.id.toLowerCase().includes(lower))
      return n.id;
  }
  return null;
}
function communityEntries(communities) {
  return communities.map((c) => ({
    community: c.id,
    name: c.label,
    files: c.files,
    size: c.size,
    hub: c.hub,
    auto_name: c.autoLabel,
    custom: !!c.custom,
    others: !!c.isOthers
  }));
}
function runAuraTool(db, name, input, getRiskSnapshot, getArchitecture) {
  switch (name) {
    case "aura_resolve_context":
      return resolveContext(db, input.task, input.limit || 8);
    case "aura_find_orphan_files": {
      const files = db.getOrphanFiles(input.limit || 100);
      return {
        files: files.map((f) => ({ file: f.id, language: f.language, lines: f.lines, fan_in: f.fan_in, fan_out: f.fan_out, complexity: f.complexity })),
        total: files.length
      };
    }
    case "aura_find_cycles": {
      const cycles = db.getCycles();
      const symbolCycles = db.getSymbolCycles();
      return {
        cycles: cycles.map((c) => ({ files: c, length: c.length })),
        total: cycles.length,
        symbol_cycles: symbolCycles.map((c) => ({
          kind: c.kind,
          nodes: c.nodes,
          edges: c.edges,
          confidence: c.confidence,
          ambiguous: c.ambiguous
        })),
        symbol_total: symbolCycles.length
      };
    }
    case "aura_find_dead_code": {
      const dead = db.getDeadCode();
      const exempted = db.getExemptedCode();
      return {
        symbols: dead.map((d) => ({ file: d.nodeId, symbol: d.symbol, kind: d.kind })),
        total: dead.length,
        exempted: exempted.map((e) => ({ file: e.nodeId, symbol: e.symbol, kind: e.kind, reason: e.reason })),
        exempted_total: exempted.length
      };
    }
    case "aura_get_hotspots": {
      const limit = input.limit || 20;
      const sortBy = input.sort_by || "risk";
      if (sortBy !== "risk") {
        const hotspots2 = db.getHotspots(limit, sortBy);
        return {
          sort_by: sortBy,
          hotspots: hotspots2.map((h) => ({ file: h.id, lines: h.lines, complexity: h.complexity, fan_in: h.fan_in, fan_out: h.fan_out, impact_score: h.impact_score })),
          total: hotspots2.length
        };
      }
      const snapshot = getRiskSnapshot?.(input);
      if (snapshot) {
        return topRiskHotspots(snapshot, limit);
      }
      const hotspots = db.getHotspots(limit, "impact");
      return {
        hotspots: hotspots.map((h) => ({ file: h.id, lines: h.lines, complexity: h.complexity, fan_in: h.fan_in, fan_out: h.fan_out, impact_score: h.impact_score })),
        total: hotspots.length
      };
    }
    case "aura_get_largest_files": {
      const files = db.getHotspots(input.limit || 20, "lines");
      return {
        files: files.map((f) => ({ file: f.id, lines: f.lines, complexity: f.complexity, fan_in: f.fan_in, fan_out: f.fan_out })),
        total: files.length
      };
    }
    case "aura_get_cochange": {
      const pairs = db.getCochange(input.limit || 50, input.min_score || 0);
      return {
        pairs: pairs.map((p) => ({
          a: p.file_a,
          b: p.file_b,
          cochanges: p.cochanges,
          jaccard: p.jaccard,
          support: p.support,
          a_commits: p.a_commits,
          b_commits: p.b_commits,
          linked: !!p.linked
        })),
        total: pairs.length,
        window_days: pairs[0]?.window_days ?? 365,
        note: "Temporal coupling without a direct structural edge \u2014 implicit contracts worth reviewing together."
      };
    }
    case "aura_find_path": {
      const from = resolveFileArg(db, input.from);
      const to = resolveFileArg(db, input.to);
      if (!from || !to) {
        return { error: `Could not resolve ${!from ? input.from : input.to}. Ask the user for the exact path.` };
      }
      const path5 = db.findPath(from, to);
      return path5 ? { from: input.from, resolved_from: from, to: input.to, resolved_to: to, path: path5, length: path5.length - 1 } : { from: input.from, resolved_from: from, to: input.to, resolved_to: to, path: null };
    }
    case "aura_search_symbols": {
      const results = db.searchSymbols(input.query, input.kind);
      return {
        results: results.map((r) => ({ file: r.nodeId, symbol: r.name, kind: r.kind, line: r.line, visibility: r.visibility, is_static: r.isStatic, is_async: r.isAsync, cognitive: r.cognitive, maintainability: r.maintainability })),
        total: results.length
      };
    }
    case "aura_search_docs": {
      const results = db.searchDocs(input.query, input.limit || 10);
      return {
        query: input.query,
        results: results.map((r) => ({ file: r.fileId, section: r.section, line: r.lineStart, score: r.score, excerpt: r.content.length > 600 ? r.content.slice(0, 600) + "\u2026" : r.content })),
        total: results.length,
        note: results.length === 0 ? "No documentation matched. The project may not have indexed any Markdown / text / rst files yet." : "Results ranked by keyword-frequency score (higher = better). Section heading matches are weighted 3\xD7 over body matches."
      };
    }
    case "aura_get_architecture": {
      const overview = db.getArchitectureOverview();
      const meta = db.getAllMeta();
      return {
        project: meta.projectName || "unknown",
        analyzed_at: meta.analyzedAt || "unknown",
        total_files: Number(meta.totalFiles) || 0,
        total_links: Number(meta.totalLinks) || 0,
        languages: overview.map((o) => ({ language: o.language, files: o.count, total_loc: o.total_loc, avg_complexity: o.avg_complexity }))
      };
    }
    case "aura_find_unused_functions": {
      const unused = db.getUnusedFunctions(input.file, input.include_methods !== false);
      return {
        functions: unused.map((u) => ({ file: u.nodeId, name: u.name, kind: u.kind, line: u.line, visibility: u.visibility })),
        total: unused.length
      };
    }
    case "aura_find_dependents": {
      const resolved = resolveFileArg(db, input.file);
      if (!resolved) {
        return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
      }
      const blast = db.getBlastRadius(resolved, input.depth || 5);
      return {
        file: input.file,
        resolved_file: resolved,
        dependents: blast.map((b) => ({ file: b.id, depth: b.depth, risk: b.risk })),
        total: blast.length
      };
    }
    case "aura_find_dependencies": {
      const resolved = resolveFileArg(db, input.file);
      if (!resolved) {
        return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
      }
      const deps = db.getDependencies(resolved, input.depth || 5);
      return {
        file: input.file,
        resolved_file: resolved,
        dependencies: deps.map((d) => ({ file: d.id, depth: d.depth })),
        total: deps.length
      };
    }
    case "aura_find_heritage": {
      const resolved = input.file ? resolveFileArg(db, input.file) : void 0;
      if (input.file && !resolved) {
        return { error: `File not found: ${input.file}` };
      }
      const edges = db.getHeritage(resolved || void 0);
      return {
        file: input.file || "all",
        heritage: edges.map((e) => ({ source: e.source, target: e.target, type: e.type, label: e.label })),
        total: edges.length
      };
    }
    case "aura_generate_documentation": {
      const hotspotLimit = input.hotspot_limit || 15;
      const meta = db.getAllMeta();
      const overview = db.getArchitectureOverview();
      const communityData = db.getCommunitySnapshot();
      const modules = communityEntries(communityData).filter((module2) => !module2.others && module2.files.length >= 2).sort((a, b) => b.size - a.size);
      const singletons = communityData.filter((community) => community.isOthers).flatMap((community) => community.files);
      const nodeToModule = {};
      for (const mod of modules) {
        for (const f of mod.files)
          nodeToModule[f] = mod.name;
      }
      const interModuleMap = {};
      for (const e of db.getAllEdges()) {
        const sm = nodeToModule[e.source];
        const tm = nodeToModule[e.target];
        if (sm && tm && sm !== tm) {
          const key = `${sm} \u2192 ${tm}`;
          (interModuleMap[key] ??= []).push(`${e.source} \u2192 ${e.target}`);
        }
      }
      const interModuleLinks = Object.entries(interModuleMap).map(([key, files]) => {
        const [from_module, to_module] = key.split(" \u2192 ");
        return { from_module, to_module, files: files.slice(0, 5) };
      });
      const hotspots = db.getHotspots(hotspotLimit, "impact");
      const cycles = db.getCycles();
      const dead = db.getDeadCode();
      const deadByFile = {};
      for (const d of dead) {
        (deadByFile[d.nodeId] ??= []).push(`${d.symbol} (${d.kind})`);
      }
      const exempted = db.getExemptedCode();
      const criticalDeps = db.getHotspots(10, "fan_in");
      return {
        overview: {
          project: meta.projectName || "unknown",
          analyzed_at: meta.analyzedAt || "unknown",
          total_files: Number(meta.totalFiles) || 0,
          total_links: Number(meta.totalLinks) || 0,
          languages: overview.map((o) => ({ language: o.language, files: o.count, total_loc: o.total_loc, avg_complexity: o.avg_complexity }))
        },
        modules: modules.map((m) => ({ name: m.name, size: m.size, files: m.files })),
        singletons,
        critical_dependencies: criticalDeps.map((h) => ({ file: h.id, fan_in: h.fan_in, fan_out: h.fan_out, complexity: h.complexity, lines: h.lines })),
        hotspots: hotspots.map((h) => ({ file: h.id, lines: h.lines, complexity: h.complexity, fan_in: h.fan_in, impact_score: h.impact_score })),
        cycles: cycles.map((c) => ({ files: c, length: c.length })),
        dead_code: {
          files: Object.entries(deadByFile).map(([file, symbols]) => ({ file, symbols })),
          total_symbols: dead.length,
          total_files: Object.keys(deadByFile).length,
          exempted_total: exempted.length
        },
        inter_module_links: interModuleLinks,
        note: "Use this data to generate comprehensive project documentation. Modules represent dependency-coupled groups detected via Louvain algorithm. Hotspots are files with highest complexity \xD7 fan-in. Critical dependencies are files imported by the most other files."
      };
    }
    case "aura_get_communities": {
      const named = communityEntries(db.getCommunitySnapshot()).sort((a, b) => b.size - a.size);
      return {
        communities: named,
        total: named.length,
        note: "Architectural communities from the shared code-only Louvain snapshot. Labels are full hub paths (or user renames); documentation and doc-reference edges are excluded from membership, fan-in and centrality."
      };
    }
    case "aura_get_architecture_violations": {
      if (!getArchitecture) {
        return { error: "Architecture rules are not available in this context." };
      }
      return getArchitecture(input);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// src/lm-tools.ts
function jsonResult(payload) {
  return new vscode4.LanguageModelToolResult([
    new vscode4.LanguageModelTextPart(JSON.stringify(payload, null, 2))
  ]);
}
function notAnalyzedResult() {
  return jsonResult({
    error: "Aura has not analyzed this workspace yet.",
    hint: 'Run the "Aura: Visualize Codebase" command first, then retry.'
  });
}
function registerAuraLmTools(context, getDb, getRiskSnapshot, getArchitecture) {
  const register = (name, invoke) => {
    context.subscriptions.push(
      vscode4.lm.registerTool(name, {
        invoke: (options) => invoke(options.input)
      })
    );
  };
  const registerShared = (name) => {
    register(name, (input) => {
      const db = getDb();
      if (!db)
        return notAnalyzedResult();
      try {
        return jsonResult(runAuraTool(db, name, input, getRiskSnapshot, getArchitecture));
      } catch (err2) {
        return jsonResult({ error: err2 instanceof Error ? err2.message : String(err2) });
      }
    });
  };
  registerShared("aura_resolve_context");
  registerShared("aura_search_docs");
  registerShared("aura_get_hotspots");
  registerShared("aura_find_path");
  registerShared("aura_search_symbols");
  registerShared("aura_get_architecture_violations");
}

// src/chat/participant.ts
var vscode5 = __toESM(require("vscode"));
var import_fs3 = require("fs");
var import_path6 = require("path");

// src/ai/prompts.ts
var AURA_SYSTEM_PROMPT = "You are Aura, the code architecture assistant of the Aura 3D Visualizer extension. You have access to tools that query the analyzed codebase. ALWAYS call the relevant tool(s) when the question is about the codebase (files, dependencies, orphan files, cycles, dead code, hotspots, symbols, architecture, documentation). After the tool calls, ALWAYS finish with a written markdown answer \u2014 never end on a tool call. Answer ONLY from the tool results \u2014 never guess or invent files. When citing files, use the format `path/to/file.ts:line`. If a tool returns no results, say so honestly instead of guessing.";
function buildAuraSystemPrompt(viewContext) {
  return AURA_SYSTEM_PROMPT + (viewContext ? `

CURRENT AURA VIEW CONTEXT:
${viewContext}` : "");
}

// src/commands/navigation-core.ts
var import_path5 = require("path");
function cleanInput(value) {
  let cleaned = (value || "").trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"') || cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\/g, "/");
}
function toPosix(value) {
  return value.replace(/\\/g, "/");
}
function resolveNavigationPath(input, workspaceRoot2) {
  const cleaned = cleanInput(input);
  if (!cleaned)
    return void 0;
  if ((0, import_path5.isAbsolute)(cleaned)) {
    const absolutePath = (0, import_path5.normalize)(cleaned);
    if (!workspaceRoot2) {
      return { absolutePath, relativePath: toPosix(absolutePath), insideWorkspace: true };
    }
    const rel = (0, import_path5.relative)(workspaceRoot2, absolutePath);
    const relativePath = toPosix(rel);
    return {
      absolutePath,
      relativePath,
      insideWorkspace: relativePath !== ".." && !relativePath.startsWith("../") && !(0, import_path5.isAbsolute)(relativePath)
    };
  }
  if (!workspaceRoot2)
    return void 0;
  const normalized = (0, import_path5.normalize)(cleaned).replace(/^\.\//, "");
  if (normalized === ".." || normalized.startsWith("../")) {
    return {
      absolutePath: (0, import_path5.normalize)((0, import_path5.join)(workspaceRoot2, normalized)),
      relativePath: toPosix(normalized),
      insideWorkspace: false
    };
  }
  return {
    absolutePath: (0, import_path5.normalize)((0, import_path5.join)(workspaceRoot2, normalized)),
    relativePath: toPosix(normalized),
    insideWorkspace: true
  };
}

// src/chat/context.ts
var current;
function setAuraViewContext(ctx) {
  current = ctx;
}
function getAuraViewContext() {
  return current;
}
function describeAuraViewContext(ctx = current) {
  if (!ctx)
    return "";
  const lines = [];
  if (ctx.selection)
    lines.push(`- selected file: ${ctx.selection}`);
  if (ctx.tab)
    lines.push(`- active tab: ${ctx.tab}`);
  if (ctx.heatmap)
    lines.push(`- heatmap: ${ctx.heatmap}`);
  if (ctx.query)
    lines.push(`- active AQL query: ${ctx.query}`);
  if (ctx.commit)
    lines.push(`- timeline commit: ${ctx.commit}`);
  if (ctx.warp)
    lines.push(`- warp: ${ctx.warp}`);
  if (ctx.community) {
    const group = ctx.community;
    const total = group.fileCount ?? group.files.length;
    const id = typeof group.id === "number" ? ` (palette id ${group.id})` : "";
    const auto = group.autoName && group.autoName !== group.name ? `, auto hub path: ${group.autoName}` : "";
    lines.push(`- Communities palette group: "${group.name}"${id} \u2014 ${total} code files${auto}`);
    if (group.hub)
      lines.push(`  hub file: \`${group.hub}\``);
    lines.push("  The palette file list below is the authoritative code-only Louvain membership shared by the webview, @aura and MCP. Documentation is excluded from communities, fan-in and centrality. Its label may be a user rename; do not substitute another community.");
    const listed = group.files.map((file) => `\`${file}\``).join(", ");
    const omitted = group.truncated ? ` \u2026 (+${Math.max(0, total - group.files.length)} not listed)` : "";
    lines.push(`  palette files: ${listed}${omitted}`);
  }
  if (ctx.layer) {
    const layer = ctx.layer;
    const total = layer.fileCount ?? layer.files.length;
    const globs = layer.paths && layer.paths.length > 0 ? `, globs: ${layer.paths.map((path5) => `\`${path5}\``).join(", ")}` : "";
    lines.push(`- Architecture layer: "${layer.name}" \u2014 ${total} code files${globs}`);
    if (typeof layer.ca === "number" || typeof layer.ce === "number") {
      const instability = typeof layer.instability === "number" ? layer.instability.toFixed(2) : "n/a";
      lines.push(`  coupling: Ca ${layer.ca ?? 0} \xB7 Ce ${layer.ce ?? 0} \xB7 instability ${instability}`);
    }
    if (typeof layer.violations === "number") {
      const rules = layer.rules && layer.rules.length > 0 ? ` (rules: ${layer.rules.join(", ")})` : "";
      lines.push(`  violations: ${layer.newViolations ?? 0} new, ${layer.baselined ?? 0} baselined${rules}`);
    }
    lines.push("  Membership is evaluated by Aura from `.aura/arch-rules.json` (first matching glob wins) and is authoritative. Documentation is excluded. Distinguish code fixes from rule changes, and never present a baselined violation as new.");
    if (layer.cycles && layer.cycles.length > 0) {
      lines.push("  layer cycles: " + layer.cycles.map((cycle) => cycle.join(" \u2194 ")).join("; "));
    }
    if (layer.violationSamples && layer.violationSamples.length > 0) {
      lines.push("  violation sample: " + layer.violationSamples.map(
        (sample) => `\`${sample.source}\` \u2192 \`${sample.target}\` (${sample.rule}, ${sample.severity}${sample.baselined ? ", baselined" : ""})`
      ).join("; "));
    }
    const listed = layer.files.map((file) => `\`${file}\``).join(", ");
    const omitted = layer.truncated ? ` \u2026 (+${Math.max(0, total - layer.files.length)} not listed)` : "";
    lines.push(`  layer files: ${listed}${omitted}`);
  }
  if (ctx.filters && Object.keys(ctx.filters).length > 0) {
    lines.push(`- filters: ${JSON.stringify(ctx.filters)}`);
  }
  return lines.join("\n");
}

// src/chat/file-facts.ts
function buildFileFacts(db, fileArg) {
  const resolved = resolveFileArg(db, fileArg);
  if (!resolved)
    return void 0;
  const detail = db.getNodeDetail(resolved);
  if (!detail)
    return void 0;
  const lines = [];
  lines.push(`**\`${detail.id}\`**`);
  lines.push("");
  lines.push(`- ${detail.language || "unknown"} \xB7 ${detail.lines || 0} lines \xB7 complexity ${detail.complexity || 0}`);
  lines.push(`- fan-in ${detail.fan_in || 0} \xB7 fan-out ${detail.fan_out || 0}`);
  const measured = detail.symbols.filter((s) => (s.kind === "function" || s.kind === "method") && typeof s.cognitive === "number");
  if (measured.length > 0) {
    const worst = measured.reduce((a, b) => b.cognitive > a.cognitive ? b : a);
    lines.push(`- highest cognitive complexity: \`${worst.name}\` (${worst.cognitive}${typeof worst.maintainability === "number" ? `, MI ${worst.maintainability}` : ""})`);
  }
  if (detail.dependencies.length > 0) {
    lines.push("", `**Depends on (${detail.dependencies.length})**`);
    for (const dep of detail.dependencies.slice(0, 6))
      lines.push(`- \`${dep}\``);
    if (detail.dependencies.length > 6)
      lines.push(`- \u2026 +${detail.dependencies.length - 6} more`);
  }
  if (detail.dependents.length > 0) {
    lines.push("", `**Used by (${detail.dependents.length})**`);
    for (const dep of detail.dependents.slice(0, 6))
      lines.push(`- \`${dep}\``);
    if (detail.dependents.length > 6)
      lines.push(`- \u2026 +${detail.dependents.length - 6} more`);
  }
  if (detail.symbols.length > 0) {
    lines.push("", `**Symbols (${detail.symbols.length})**`);
    for (const sym of detail.symbols.slice(0, 8)) {
      lines.push(`- \`${sym.name}\` (${sym.kind}${sym.line ? `, line ${sym.line}` : ""})`);
    }
    if (detail.symbols.length > 8)
      lines.push(`- \u2026 +${detail.symbols.length - 8} more`);
  }
  return { file: detail.id, markdown: lines.join("\n") };
}

// src/chat/prompt.ts
function buildUserPrompt(command, prompt, selection) {
  const p = (prompt || "").trim();
  const target = p || (selection || "").trim();
  switch (command) {
    case "explain":
      return target ? `Explain what this file/module does and its role in the architecture: ${target}. Use the Aura tools for facts and cite files.` : "Ask the user which file or module they want explained.";
    case "impact":
      return target ? `Analyze the impact of changing ${target}: dependents, blast radius, risk and cycles. Use the Aura tools.` : "Ask the user which file they want an impact analysis for.";
    case "path":
      if (p)
        return `Find the shortest dependency path. Arguments (from and to): ${p}. Use aura_find_path and explain the path.`;
      return selection ? `Find the shortest dependency path starting from ${selection}. Ask the user for the destination file, then use aura_find_path.` : "Ask the user for two file paths (from and to) to find a dependency path.";
    case "hotspots":
      return `List the most at-risk files${p ? ` (${p})` : ""} with their reasons and propose 3 concrete actions. Use aura_get_hotspots.`;
    case "query":
      return p ? `Translate this natural-language filter into Aura Query Language (AQL). Return only the AQL expression in a fenced code block, then a one-line explanation. Do not list files or propose navigation actions.
Filter: ${p}` : "Ask the user to describe the filter they want in natural language.";
    default:
      return p || "What should I know about this codebase?";
  }
}
var FILE_REF_RE = /([A-Za-z0-9_./-]+\.[A-Za-z][A-Za-z0-9]{0,7})(?::(\d+))?/g;
function extractFileAnchors(text) {
  const out2 = [];
  const index = /* @__PURE__ */ new Map();
  const re = new RegExp(FILE_REF_RE.source, "g");
  let m;
  while ((m = re.exec(text)) !== null) {
    const file = m[1];
    if (!file || file.includes("://"))
      continue;
    const line = m[2] ? parseInt(m[2], 10) : void 0;
    const existing = index.get(file);
    if (existing === void 0) {
      index.set(file, out2.length);
      out2.push({ file, line });
    } else if (out2[existing].line === void 0 && line) {
      out2[existing] = { file, line };
    }
  }
  return out2;
}
function extractAql(text) {
  const fenced = text.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/i);
  const inline = text.match(/`([^`\n]+)`/);
  const candidate = (fenced ? fenced[1] : inline ? inline[1] : "").trim();
  if (!candidate)
    return void 0;
  const line = candidate.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  if (line && /(==|!=|>=|<=|>|<|\bAND\b|\bOR\b)/i.test(line))
    return line;
  return void 0;
}

// src/chat/participant.ts
var AURA_PARTICIPANT_ID = "monticma-aura.aura";
var MAX_ITERATIONS = 8;
function currentSelection() {
  const existing = getAuraViewContext();
  if (existing?.selection)
    return existing.selection;
  const root = vscode5.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const editor = vscode5.window.activeTextEditor;
  if (!root || !editor)
    return void 0;
  const rel = (0, import_path6.relative)(root, editor.document.uri.fsPath);
  return rel.startsWith("..") ? void 0 : rel;
}
function buildViewContext() {
  const existing = getAuraViewContext() ?? {};
  const selection = existing.selection || currentSelection();
  if (selection && selection !== existing.selection) {
    const context = { ...existing, selection };
    setAuraViewContext(context);
    return { context, selection };
  }
  return { context: existing, selection };
}
function registerAuraChatParticipant(context, getDb, getRiskSnapshot, isAuraVisible, getArchitecture) {
  const handler = async (request, _chatContext, stream, token) => {
    const db = getDb();
    if (!db) {
      stream.markdown("Aura has not analyzed this workspace yet. Run **Aura: Visualize Codebase** first, then retry.");
      if (!isAuraVisible?.())
        stream.button({ command: "auraVisualizer.open", title: "Open Aura" });
      return;
    }
    const command = request.command;
    const rawPrompt = (request.prompt || "").trim();
    const { context: viewContext, selection } = buildViewContext();
    if (!rawPrompt && !selection && (command === "explain" || command === "impact")) {
      stream.markdown(`Which file should I ${command === "explain" ? "explain" : "analyze"}? Use \`/${command} src/file.ts\`, open the file in the editor, or select it in Aura.`);
      return;
    }
    if (command === "path" && !rawPrompt && !selection) {
      stream.markdown("Give me two files to connect: `/path src/a.ts src/b.ts`.");
      return;
    }
    const systemPrompt = buildAuraSystemPrompt(describeAuraViewContext(viewContext));
    const userPrompt = buildUserPrompt(command, rawPrompt, selection);
    let explainedFile;
    const promptAnchors = extractFileAnchors(rawPrompt);
    const fileTarget = promptAnchors[0]?.file || selection;
    const wantsFileFacts = command !== "query" && command !== "path" && command !== "hotspots" && !!fileTarget && (promptAnchors.length > 0 || command === "explain" || command === "impact");
    if (wantsFileFacts && fileTarget) {
      const facts = buildFileFacts(db, fileTarget);
      if (facts) {
        explainedFile = facts.file;
        stream.markdown(facts.markdown + "\n\n");
      } else if (promptAnchors.length > 0 || command === "explain" || command === "impact") {
        stream.markdown(`I couldn't find \`${fileTarget}\` in the analyzed graph. Check the path, then run **Aura: Visualize Codebase** again if the file is new.`);
        return;
      }
    }
    const messages = [
      vscode5.LanguageModelChatMessage.User(systemPrompt + "\n\nUSER QUESTION: " + userPrompt)
    ];
    const tools = AURA_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
    let fullText = "";
    let lastText = "";
    try {
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const response = await request.model.sendRequest(messages, { tools }, token);
        const toolCalls = [];
        let iterationText = "";
        for await (const part of response.stream) {
          if (part instanceof vscode5.LanguageModelTextPart) {
            iterationText += part.value;
            fullText += part.value;
            stream.markdown(part.value);
          } else if (part instanceof vscode5.LanguageModelToolCallPart) {
            toolCalls.push(part);
          }
        }
        lastText = iterationText;
        if (token.isCancellationRequested)
          return;
        if (toolCalls.length === 0)
          break;
        messages.push(vscode5.LanguageModelChatMessage.Assistant(toolCalls));
        for (const tc of toolCalls) {
          stream.progress(`Aura \xB7 ${tc.name}`);
          let result;
          try {
            result = runAuraTool(db, tc.name, tc.input, getRiskSnapshot, getArchitecture);
          } catch (err2) {
            result = { error: err2 instanceof Error ? err2.message : String(err2) };
          }
          messages.push(vscode5.LanguageModelChatMessage.User([
            new vscode5.LanguageModelToolResultPart(
              tc.callId,
              [new vscode5.LanguageModelTextPart(JSON.stringify(result))]
            )
          ]));
        }
      }
      if (!lastText.trim()) {
        messages.push(vscode5.LanguageModelChatMessage.User(
          "Now write the final answer for the user in markdown, using the tool results above. Do not call any more tools. Be concrete and cite files."
        ));
        const finalResponse = await request.model.sendRequest(messages, {}, token);
        let finalText = "";
        for await (const part of finalResponse.stream) {
          if (part instanceof vscode5.LanguageModelTextPart) {
            finalText += part.value;
            fullText += part.value;
            stream.markdown(part.value);
          }
        }
        lastText = finalText;
      }
      if (!lastText.trim()) {
        stream.markdown("_Aura queried the graph but returned no written answer. Try rephrasing, or name a specific file._");
      }
      const isQueryCommand = command === "query";
      const workspaceRoot2 = vscode5.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const anchors = isQueryCommand ? [] : extractFileAnchors(fullText);
      if (explainedFile && !anchors.some((a) => a.file === explainedFile)) {
        anchors.unshift({ file: explainedFile });
      }
      const fileRefs = [];
      for (const anchor of anchors) {
        const navigation = resolveNavigationPath(anchor.file, workspaceRoot2);
        if (!navigation || !(0, import_fs3.existsSync)(navigation.absolutePath))
          continue;
        const graphFile = navigation.insideWorkspace ? resolveFileArg(db, navigation.relativePath) ?? void 0 : void 0;
        fileRefs.push({ ...anchor, navigation, graphFile });
      }
      const graphRefs = fileRefs.filter((ref) => !!ref.graphFile);
      for (const ref of fileRefs.slice(0, 20)) {
        const uri = vscode5.Uri.file(ref.navigation.absolutePath);
        if (ref.line && ref.line > 0) {
          stream.reference(new vscode5.Location(uri, new vscode5.Position(ref.line - 1, 0)));
        } else {
          stream.reference(uri);
        }
      }
      for (const ref of graphRefs.slice(0, 3)) {
        stream.button({ command: "auraVisualizer.focusPath", title: `Focus ${ref.graphFile}`, arguments: [ref.graphFile] });
      }
      if (!isQueryCommand && fileRefs[0]) {
        const primary = fileRefs[0];
        const label = primary.line ? `${primary.file}:${primary.line}` : primary.file;
        stream.button({ command: "auraVisualizer.openFileAt", title: `Open ${label}`, arguments: [primary.file, primary.line] });
      }
      if (!isQueryCommand && graphRefs[0]) {
        const blast = graphRefs[0];
        stream.button({ command: "auraVisualizer.blastRadiusPath", title: `Blast radius: ${blast.graphFile}`, arguments: [blast.graphFile] });
      }
      const aql = extractAql(fullText);
      if (aql) {
        stream.button({ command: "auraVisualizer.applyQuery", title: "Apply Aura Query", arguments: [aql] });
      }
      if (!isQueryCommand) {
        stream.button({ command: "auraVisualizer.statusBarRisk", title: "Open Risk" });
        if (!isAuraVisible?.()) {
          stream.button({ command: "auraVisualizer.open", title: "Open Aura" });
        }
      }
    } catch (err2) {
      stream.markdown(`

**Aura error:** ${err2 instanceof Error ? err2.message : String(err2)}`);
    }
  };
  const participant = vscode5.chat.createChatParticipant(AURA_PARTICIPANT_ID, handler);
  participant.iconPath = vscode5.Uri.joinPath(context.extensionUri, "resources", "aura-star-icon.png");
  context.subscriptions.push(participant);
}

// src/commands/navigation.ts
var vscode6 = __toESM(require("vscode"));
var import_fs4 = require("fs");
function workspaceRoot() {
  return vscode6.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
async function openFileAt(filePath, line) {
  if (!filePath)
    return;
  const target = resolveNavigationPath(filePath, workspaceRoot());
  if (!target)
    return;
  if (!(0, import_fs4.existsSync)(target.absolutePath)) {
    void vscode6.window.showWarningMessage(`Aura: file not found \u2014 ${filePath}`);
    return;
  }
  const lineNumber = typeof line === "number" && line > 0 ? line : void 0;
  const selection = lineNumber ? new vscode6.Range(lineNumber - 1, 0, lineNumber - 1, 0) : void 0;
  await vscode6.window.showTextDocument(vscode6.Uri.file(target.absolutePath), {
    preview: true,
    selection
  });
}
function registerNavigationCommands(actions) {
  return [
    vscode6.commands.registerCommand("auraVisualizer.focusPath", async (filePath) => {
      await actions.revealGraph();
      const target = resolveNavigationPath(filePath || "", workspaceRoot());
      if (target?.insideWorkspace)
        actions.focusInGraph(target.relativePath);
    }),
    vscode6.commands.registerCommand("auraVisualizer.openFileAt", (filePath, line) => openFileAt(filePath, line)),
    vscode6.commands.registerCommand("auraVisualizer.blastRadiusPath", async (filePath) => {
      await actions.revealGraph();
      const target = resolveNavigationPath(filePath || "", workspaceRoot());
      if (target?.insideWorkspace)
        actions.blastRadiusInGraph(target.relativePath);
    })
  ];
}

// src/codelens.ts
var vscode7 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));

// src/codelens-core.ts
var NON_LENS_KINDS = /* @__PURE__ */ new Set([
  "import",
  "from-import",
  "export",
  "export-named",
  "export-default",
  "export-all",
  "export-namespace",
  "variable",
  "constant",
  "field",
  "property",
  "decorator",
  "function-call",
  "call",
  "extends",
  "implements",
  "reference"
]);
var MAX_LENSES_PER_FILE = 300;
var LENS_TITLE = "\u27E1 focus \xB7 flow \xB7 impact";
function selectLensSymbols(rows, limit = MAX_LENSES_PER_FILE) {
  if (!rows || !rows.length)
    return [];
  const seen = /* @__PURE__ */ new Set();
  const out2 = [];
  for (const row of rows) {
    if (!row)
      continue;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const kind = typeof row.kind === "string" ? row.kind.trim().toLowerCase() : "";
    const rawLine = typeof row.line === "number" ? row.line : Number(row.line);
    if (!name || !kind || !Number.isFinite(rawLine) || rawLine < 1)
      continue;
    if (NON_LENS_KINDS.has(kind))
      continue;
    const line = Math.floor(rawLine);
    const key = `${line}\0${name}\0${kind}`;
    if (seen.has(key))
      continue;
    seen.add(key);
    out2.push({ name, kind, line });
  }
  out2.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
  return limit > 0 ? out2.slice(0, limit) : out2;
}
function lensLine(symbolLine) {
  if (!Number.isFinite(symbolLine) || symbolLine <= 1)
    return 0;
  return Math.floor(symbolLine) - 1;
}
function symbolKindName(kind) {
  switch (kind) {
    case 5:
      return "class";
    case 6:
      return "method";
    case 10:
      return "enum";
    case 11:
      return "interface";
    case 12:
      return "function";
    case 23:
      return "struct";
    default:
      return null;
  }
}
function documentSymbolAnchors(symbols, limit = MAX_LENSES_PER_FILE) {
  const out2 = [];
  const walk = (list, depth) => {
    if (!list || depth > 1 || out2.length >= limit)
      return;
    for (const symbol of list) {
      if (!symbol || typeof symbol.name !== "string")
        continue;
      const kind = symbolKindName(symbol.kind);
      const line = symbol.range?.start?.line;
      if (kind && typeof line === "number" && Number.isFinite(line)) {
        out2.push({ name: symbol.name, kind, line: Math.floor(line) + 1 });
      }
      if (symbol.children && symbol.children.length)
        walk(symbol.children, depth + 1);
      if (out2.length >= limit)
        return;
    }
  };
  walk(symbols, 0);
  return out2;
}
function lensArguments(fileId, symbol, language) {
  return [fileId, symbol.name, symbol.line, language];
}

// src/codelens.ts
var SYMBOL_COMMANDS = {
  /** Run by the lens itself — opens the action picker. */
  actions: "auraVisualizer.symbolActions",
  focus: "auraVisualizer.focusSymbol",
  flow: "auraVisualizer.showSymbolFlow",
  blast: "auraVisualizer.blastSymbol"
};
function documentNodeId(uri) {
  const folder = vscode7.workspace.workspaceFolders?.[0];
  if (!folder || uri.scheme !== "file")
    return void 0;
  const relativePath = path3.relative(folder.uri.fsPath, uri.fsPath);
  if (!relativePath || relativePath.startsWith("..") || path3.isAbsolute(relativePath))
    return void 0;
  return relativePath.split(path3.sep).join("/");
}
var AuraCodeLensProvider = class {
  constructor(getDb, isEnabled = () => true) {
    this.getDb = getDb;
    this.isEnabled = isEnabled;
  }
  emitter = new vscode7.EventEmitter();
  onDidChangeCodeLenses = this.emitter.event;
  /** Re-request lenses for every open editor (after an analysis or a setting change). */
  refresh() {
    this.emitter.fire();
  }
  dispose() {
    this.emitter.dispose();
  }
  async provideCodeLenses(document2, token) {
    if (token.isCancellationRequested || !this.isEnabled())
      return [];
    const fileId = documentNodeId(document2.uri);
    if (!fileId)
      return [];
    const detail = this.readNodeDetail(fileId);
    if (!detail)
      return [];
    let symbols = selectLensSymbols(detail.symbols);
    if (!symbols.length)
      symbols = await this.documentSymbolFallback(document2);
    if (token.isCancellationRequested || !symbols.length)
      return [];
    const language = typeof detail.language === "string" && detail.language ? detail.language : document2.languageId;
    return symbols.map((symbol) => new vscode7.CodeLens(
      new vscode7.Range(lensLine(symbol.line), 0, lensLine(symbol.line), 0),
      {
        title: LENS_TITLE,
        tooltip: `Aura \u2014 ${symbol.name} (${symbol.kind}): focus in the graph, open its flowchart or its blast radius`,
        command: SYMBOL_COMMANDS.actions,
        arguments: lensArguments(fileId, symbol, language)
      }
    ));
  }
  readNodeDetail(fileId) {
    const db = this.getDb();
    if (!db || !db.isOpen)
      return null;
    try {
      return db.getNodeDetail(fileId);
    } catch {
      return null;
    }
  }
  /** Analyzed file without DB symbols — ask the editor's language service. */
  async documentSymbolFallback(document2) {
    try {
      const raw = await vscode7.commands.executeCommand(
        "vscode.executeDocumentSymbolProvider",
        document2.uri
      );
      return documentSymbolAnchors(raw);
    } catch {
      return [];
    }
  }
};
function registerSymbolCommands(actions) {
  const reveal = async () => {
    try {
      await actions.revealGraph();
    } catch {
    }
  };
  return [
    vscode7.commands.registerCommand(SYMBOL_COMMANDS.focus, async (fileId) => {
      if (!fileId)
        return;
      await reveal();
      actions.focusInGraph(fileId);
    }),
    vscode7.commands.registerCommand(SYMBOL_COMMANDS.blast, async (fileId) => {
      if (!fileId)
        return;
      await reveal();
      actions.blastRadiusInGraph(fileId);
    }),
    vscode7.commands.registerCommand(
      SYMBOL_COMMANDS.flow,
      async (fileId, line, language, name) => {
        if (!fileId || typeof line !== "number" || !(line > 0))
          return;
        await reveal();
        actions.openFlow(fileId, line, language || "", name);
      }
    ),
    // The lens itself: one entry point, three actions.
    vscode7.commands.registerCommand(
      SYMBOL_COMMANDS.actions,
      async (fileId, name, line, language) => {
        if (!fileId)
          return;
        const hasLine = typeof line === "number" && line > 0;
        const picks = [
          {
            label: "\u27E1 Focus in Aura",
            description: "Center the 3D graph on this file",
            command: SYMBOL_COMMANDS.focus,
            args: [fileId]
          }
        ];
        if (hasLine) {
          picks.push({
            label: "\u2442 Show flowchart",
            description: "Control flow of this function, built from the AST",
            command: SYMBOL_COMMANDS.flow,
            args: [fileId, line, language, name]
          });
        }
        picks.push({
          label: "\u{1F4A5} Blast radius",
          description: "Every file impacted by this one, colored by depth",
          command: SYMBOL_COMMANDS.blast,
          args: [fileId]
        });
        const pick = await vscode7.window.showQuickPick(picks, {
          placeHolder: name ? `Aura \u2014 ${name}` : "Aura: symbol actions"
        });
        if (!pick)
          return;
        await vscode7.commands.executeCommand(pick.command, ...pick.args);
      }
    )
  ];
}

// src/commands/ask-aura.ts
var vscode8 = __toESM(require("vscode"));
async function askAura(options) {
  setAuraViewContext(options?.context);
  const prompt = options?.prompt?.trim() || "What should I know about this view?";
  const query = prompt.startsWith("@aura") ? prompt : `@aura ${prompt}`;
  try {
    await vscode8.commands.executeCommand("workbench.action.chat.open", { query });
  } catch {
    void vscode8.window.showInformationMessage("Open VS Code Chat and mention @aura to ask about this codebase.");
  }
}
function registerAskAuraCommands() {
  return [
    vscode8.commands.registerCommand("auraVisualizer.askAura", (options) => askAura(options)),
    vscode8.commands.registerCommand("auraVisualizer.askAuraForTreeItem", (item) => {
      const entry = item?.entry;
      const filePath = entry?.kind === "file" ? entry.node?.path : void 0;
      if (!filePath)
        return;
      return askAura({
        prompt: `Explain ${filePath}: its role, dependencies, dependents, symbols and risk. Use at most 3 Aura tools, then write the answer and cite files.`,
        context: { selection: filePath, tab: "explorer" }
      });
    })
  ];
}

// src/report/arch-report.ts
function fallbackModules(nodes) {
  const groups = /* @__PURE__ */ new Map();
  for (const node of nodes) {
    const group = node.group || node.id.replace(/\/[^/]*$/, "") || "root";
    const files = groups.get(group) || [];
    files.push(node.id);
    groups.set(group, files);
  }
  return Array.from(groups.entries()).map(([name, files], id) => ({ id, name, files, size: files.length })).sort((a, b) => b.size - a.size);
}
function isDocumentationNode(node) {
  return node.language === "documentation" || [".md", ".markdown", ".txt", ".rst"].includes(node.extension);
}
function buildArchReportInput(graph, extras = {}, options = {}) {
  const codeNodes = options.includeDocumentation ? graph.nodes : graph.nodes.filter((node) => !isDocumentationNode(node));
  const codeIds = new Set(codeNodes.map((node) => node.id));
  const codeLinks = graph.links.filter((link) => codeIds.has(link.source) && codeIds.has(link.target));
  const extrasModules = extras.modules?.map((mod) => {
    const files = mod.files.filter((file) => codeIds.has(file));
    return { ...mod, files, size: files.length };
  }).filter((mod) => mod.size > 0);
  const modules = extrasModules && extrasModules.length > 0 ? extrasModules : fallbackModules(codeNodes);
  const extrasHotspots = extras.hotspots?.filter((hotspot) => codeIds.has(hotspot.file));
  const hotspots = extrasHotspots && extrasHotspots.length > 0 ? extrasHotspots : codeNodes.map((n) => ({
    file: n.id,
    lines: n.linesOfCode,
    complexity: n.complexity,
    fanIn: n.fanIn,
    fanOut: n.fanOut,
    impact: n.complexity * (n.fanIn + 1)
  })).sort((a, b) => (b.impact || 0) - (a.impact || 0));
  return {
    projectName: graph.meta.projectName || "unknown",
    analyzedAt: graph.meta.analyzedAt || "unknown",
    nodes: codeNodes.map((n) => ({
      id: n.id,
      name: n.name,
      language: n.language,
      linesOfCode: n.linesOfCode,
      complexity: n.complexity,
      fanIn: n.fanIn,
      fanOut: n.fanOut,
      group: n.group
    })),
    links: codeLinks.map((l) => ({ source: l.source, target: l.target, type: l.type })),
    modules,
    cycles: (extras.cycles || graph.meta.cycles || []).filter((cycle) => cycle.every((file) => codeIds.has(file))),
    deadCode: (extras.deadCode || []).filter((dead) => codeIds.has(dead.file)),
    deadCodeExemptions: graph.meta.deadCodeExemptions,
    hotspots
  };
}
function escapeLabel(value) {
  return value.replace(/\\/g, "/").replace(/"/g, "'").replace(/`/g, "").replace(/\s+/g, " ").trim();
}
function cell(value) {
  return escapeLabel(value).replace(/\|/g, "\\|");
}
function capLines(lines, maxLines) {
  if (lines.length <= maxLines)
    return lines;
  if (maxLines <= 1)
    return [`_Report truncated to ${maxLines} line._`];
  return [...lines.slice(0, maxLines - 1), `_Report truncated to ${maxLines} lines._`];
}
function withAiNarrative(report, narrative) {
  const text = narrative.trim();
  if (!text)
    return report;
  const section = `## AI narrative

_Generated from the deterministic report above by the selected VS Code language model._

${text}

`;
  const marker = "## Overview";
  const index = report.indexOf(marker);
  if (index < 0)
    return report.trimEnd() + "\n\n" + section;
  return report.slice(0, index) + section + report.slice(index);
}
function generateArchReport(input, options = {}) {
  const maxLines = options.maxLines ?? 400;
  const includePaths = options.includePaths !== false;
  const maxModules = options.maxModules ?? 12;
  const maxModuleEdges = options.maxModuleEdges ?? 30;
  const modules = [...input.modules].sort((a, b) => b.size - a.size).slice(0, maxModules);
  const moduleOf = /* @__PURE__ */ new Map();
  modules.forEach((mod, index) => {
    for (const file of mod.files)
      moduleOf.set(file, index);
  });
  const edgeCounts = /* @__PURE__ */ new Map();
  for (const link of input.links) {
    const from = moduleOf.get(link.source);
    const to = moduleOf.get(link.target);
    if (from === void 0 || to === void 0 || from === to)
      continue;
    const key = `${from}->${to}`;
    const existing = edgeCounts.get(key);
    if (existing)
      existing.count++;
    else
      edgeCounts.set(key, { from, to, count: 1 });
  }
  const moduleEdges = Array.from(edgeCounts.values()).sort((a, b) => b.count - a.count || a.from - b.from || a.to - b.to).slice(0, maxModuleEdges);
  const languages2 = /* @__PURE__ */ new Map();
  for (const node of input.nodes)
    languages2.set(node.language || "unknown", (languages2.get(node.language || "unknown") || 0) + 1);
  const languageSummary = Array.from(languages2.entries()).sort((a, b) => b[1] - a[1]).map(([language, count]) => `${language} (${count})`).join(", ");
  const lines = [];
  lines.push(`# Architecture \u2014 ${escapeLabel(input.projectName)}`);
  lines.push("");
  lines.push(`_Generated from the Aura graph analyzed at ${escapeLabel(input.analyzedAt)}._`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(`- **Files:** ${input.nodes.length}`);
  lines.push(`- **Links:** ${input.links.length}`);
  lines.push(`- **Languages:** ${languageSummary || "\u2014"}`);
  lines.push(`- **Modules:** ${input.modules.length}`);
  lines.push(`- **Cycles:** ${input.cycles.length}`);
  lines.push(`- **Dead exports:** ${input.deadCode.length}`);
  if (input.deadCodeExemptions) {
    lines.push(`- **Dead-code exemptions:** ${input.deadCodeExemptions}`);
  }
  lines.push("");
  lines.push("## Modules");
  lines.push("");
  if (modules.length === 0) {
    lines.push("_No modules detected._");
  } else {
    lines.push("```mermaid");
    lines.push("graph TD");
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      lines.push(`  M${i}["${escapeLabel(mod.name)} (${mod.size})"]`);
    }
    for (const edge of moduleEdges) {
      lines.push(`  M${edge.from} -->|${edge.count}| M${edge.to}`);
    }
    lines.push("```");
    if (input.modules.length > modules.length) {
      lines.push("");
      lines.push(`_${input.modules.length - modules.length} smaller module(s) omitted._`);
    }
    lines.push("");
    lines.push("| Module | Files | Example files |");
    lines.push("|---|---:|---|");
    for (const mod of modules) {
      const examples = mod.files.slice(0, 4).map((f) => `\`${cell(f)}\``).join(", ");
      lines.push(`| ${cell(mod.name)} | ${mod.size} | ${examples || "\u2014"} |`);
    }
  }
  lines.push("");
  lines.push("## Top dependencies");
  lines.push("");
  const topDeps = [...input.nodes].sort((a, b) => b.fanIn - a.fanIn || b.fanOut - a.fanOut || a.id.localeCompare(b.id)).slice(0, 10);
  if (topDeps.length === 0) {
    lines.push("_No dependency data._");
  } else {
    lines.push("| File | Fan-in | Fan-out | LOC | Complexity |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const node of topDeps) {
      lines.push(`| \`${cell(node.id)}\` | ${node.fanIn} | ${node.fanOut} | ${node.linesOfCode} | ${node.complexity} |`);
    }
  }
  lines.push("");
  lines.push("## Hotspots");
  lines.push("");
  const hotspots = [...input.hotspots].sort((a, b) => (b.score ?? b.impact ?? 0) - (a.score ?? a.impact ?? 0) || a.file.localeCompare(b.file)).slice(0, 10);
  if (hotspots.length === 0) {
    lines.push("_No hotspot data._");
  } else {
    lines.push("| File | Impact | Complexity | Fan-in | Fan-out |");
    lines.push("|---|---:|---:|---:|---:|");
    for (const h of hotspots) {
      const impact = h.score ?? h.impact ?? 0;
      lines.push(`| \`${cell(h.file)}\` | ${Math.round(impact)} | ${h.complexity ?? "\u2014"} | ${h.fanIn ?? "\u2014"} | ${h.fanOut ?? "\u2014"} |`);
    }
  }
  lines.push("");
  lines.push("## Cycles");
  lines.push("");
  if (input.cycles.length === 0) {
    lines.push("_No circular dependencies._");
  } else {
    const seen = /* @__PURE__ */ new Set();
    for (const cycle of input.cycles) {
      const key = cycle.join(" -> ");
      if (seen.has(key))
        continue;
      seen.add(key);
      lines.push(`- ${cycle.map((f) => `\`${cell(f)}\``).join(" \u2192 ")}`);
    }
  }
  lines.push("");
  lines.push("## Dead exports");
  lines.push("");
  if (input.deadCode.length === 0) {
    lines.push("_No dead exports._");
  } else {
    const byFile = /* @__PURE__ */ new Map();
    for (const dead of input.deadCode) {
      const symbols = byFile.get(dead.file) || [];
      symbols.push(`${dead.symbol} (${dead.kind})`);
      byFile.set(dead.file, symbols);
    }
    for (const [file, symbols] of Array.from(byFile.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 15)) {
      lines.push(`- \`${cell(file)}\` \u2014 ${symbols.slice(0, 8).join(", ")}`);
    }
  }
  const capped = capLines(lines, maxLines);
  if (!includePaths) {
    return capped.map((line) => line.replace(/`([^`]+\/[^`]+)`/g, "`\u2026`")).join("\n") + "\n";
  }
  return capped.join("\n") + "\n";
}

// src/report/ai-summary.ts
var vscode9 = __toESM(require("vscode"));
async function generateArchitectureNarrative(report, token) {
  let model;
  try {
    const models = await vscode9.lm.selectChatModels({});
    if (models.length === 0)
      return void 0;
    model = models[0];
  } catch {
    return void 0;
  }
  const prompt = "You are a software architecture analyst. Using ONLY the report below, write a concise architecture narrative in 4\u20136 short paragraphs. Explain: (1) what the system appears to do, (2) the main modules and their responsibilities, (3) the dependency flow between modules, (4) the main risks, cycles or dead exports, and (5) the 3 most useful next actions. Do not invent files or facts. If information is missing, say so explicitly. Use markdown, no top-level title.\n\nARCHITECTURE REPORT:\n" + report;
  const source = token ? void 0 : new vscode9.CancellationTokenSource();
  try {
    const response = await model.sendRequest(
      [vscode9.LanguageModelChatMessage.User(prompt)],
      {},
      token || source.token
    );
    let text = "";
    for await (const part of response.stream) {
      if (part instanceof vscode9.LanguageModelTextPart)
        text += part.value;
    }
    const trimmed = text.trim();
    return trimmed || void 0;
  } catch {
    return void 0;
  } finally {
    source?.dispose();
  }
}

// src/report/metrics-export.ts
var BASE_COLUMNS = [
  { key: "file", label: "file", value: (r) => r.file },
  { key: "name", label: "name", value: (r) => r.name },
  { key: "language", label: "language", value: (r) => r.language },
  { key: "group", label: "group", value: (r) => r.group },
  { key: "lines", label: "lines", value: (r) => r.lines },
  { key: "complexity", label: "complexity", value: (r) => r.complexity },
  { key: "fanIn", label: "fan_in", value: (r) => r.fanIn },
  { key: "fanOut", label: "fan_out", value: (r) => r.fanOut },
  { key: "churn", label: "churn", value: (r) => r.churn },
  { key: "authors", label: "authors", value: (r) => r.authors },
  { key: "riskScore", label: "risk_score", value: (r) => r.riskScore === null ? null : Math.round(r.riskScore * 10) / 10 },
  { key: "riskBucket", label: "risk_bucket", value: (r) => r.riskBucket }
];
var OPTIONAL_COLUMNS = [
  { key: "tested", label: "tested", value: (r) => r.tested === void 0 ? null : r.tested },
  { key: "cold", label: "cold", value: (r) => r.cold === void 0 ? null : r.cold },
  { key: "duplication", label: "duplication", value: (r) => r.duplication ?? null },
  { key: "cognitive", label: "cognitive", value: (r) => r.cognitive ?? null }
];
function columnsFor(rows) {
  const optional = OPTIONAL_COLUMNS.filter((col) => rows.some((row) => {
    if (col.key === "tested")
      return row.tested !== void 0;
    if (col.key === "cold")
      return row.cold !== void 0;
    if (col.key === "duplication")
      return row.duplication !== void 0;
    return row.cognitive !== void 0;
  }));
  return [...BASE_COLUMNS, ...optional];
}
function csvCell(value) {
  const text = value === null || value === void 0 ? "" : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
function metricsToCsv(rows) {
  const columns = columnsFor(rows);
  const lines = [columns.map((col) => col.label).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvCell(col.value(row))).join(","));
  }
  return lines.join("\n") + "\n";
}
function metricsToJson(rows, options = {}) {
  const columns = columnsFor(rows);
  const payload = {
    version: options.version ?? 1,
    generatedAt: options.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    columns: columns.map((col) => col.label),
    rows: rows.map((row) => {
      const out2 = {};
      for (const col of columns)
        out2[col.key] = col.value(row);
      return out2;
    })
  };
  return JSON.stringify(payload, null, 2) + "\n";
}

// src/export/ai-export.ts
var AI_EXPORT_SECTIONS = [
  "modules",
  "contracts",
  "hotspots",
  "cycles",
  "deadCode"
];
var DEFAULT_CHARS_PER_TOKEN = 4;
function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
function isPublicSymbol(symbol) {
  return symbol.visibility === "public";
}
function collectContracts(graph, includedIds) {
  const contracts = /* @__PURE__ */ new Map();
  const add = (node, symbol, kind) => {
    if (!symbol.name)
      return;
    const key = `${node.id}|${symbol.name}`;
    if (contracts.has(key))
      return;
    contracts.set(key, {
      file: node.id,
      symbol: symbol.name,
      kind: symbol.type || kind,
      line: symbol.line,
      fanIn: node.fanIn || 0
    });
  };
  for (const node of graph.nodes) {
    if (!includedIds.has(node.id) || !node.symbols)
      continue;
    const syms = node.symbols;
    const list = (value) => value || [];
    for (const symbol of list(syms.interfaces))
      add(node, symbol, "interface");
    for (const symbol of list(syms.traits))
      add(node, symbol, "trait");
    for (const symbol of list(syms.classes))
      add(node, symbol, "class");
    for (const symbol of list(syms.typeAliases))
      add(node, symbol, "type_alias");
    for (const symbol of list(syms.exports))
      add(node, symbol, "export");
    for (const symbol of list(syms.functions)) {
      if (isPublicSymbol(symbol))
        add(node, symbol, "function");
    }
    for (const symbol of list(syms.methods)) {
      if (isPublicSymbol(symbol))
        add(node, symbol, "method");
    }
    const isHeader = /\.(h|hh|hpp|hxx)$/i.test(node.extension || "");
    if (isHeader) {
      for (const symbol of list(syms.functions))
        add(node, symbol, "function");
      for (const symbol of list(syms.structs))
        add(node, symbol, "struct");
      for (const symbol of list(syms.enums))
        add(node, symbol, "enum");
      for (const symbol of list(syms.macros))
        add(node, symbol, "macro");
    }
    if (node.language === "python" || node.language === "ruby") {
      for (const symbol of list(syms.functions)) {
        if (!symbol.name.startsWith("_"))
          add(node, symbol, "function");
      }
    }
  }
  return Array.from(contracts.values()).sort((a, b) => b.fanIn - a.fanIn || a.file.localeCompare(b.file) || a.symbol.localeCompare(b.symbol) || a.kind.localeCompare(b.kind));
}
function buildAiExportInput(graph, extras = {}) {
  const report = buildArchReportInput(graph, extras);
  const includedIds = new Set(report.nodes.map((node) => node.id));
  return {
    ...report,
    contracts: collectContracts(graph, includedIds)
  };
}
function moduleDependencies(input) {
  const moduleOf = /* @__PURE__ */ new Map();
  input.modules.forEach((mod, index) => {
    for (const file of mod.files)
      moduleOf.set(file, index);
  });
  const counts = /* @__PURE__ */ new Map();
  for (const link of input.links) {
    const from = moduleOf.get(link.source);
    const to = moduleOf.get(link.target);
    if (from === void 0 || to === void 0 || from === to)
      continue;
    const key = `${from}->${to}`;
    const existing = counts.get(key);
    if (existing)
      existing.count++;
    else
      counts.set(key, { from, to, count: 1 });
  }
  return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.from - b.from || a.to - b.to);
}
function normalizedSections(options) {
  if (options.sections === void 0)
    return [...AI_EXPORT_SECTIONS];
  const requested = new Set(options.sections);
  return AI_EXPORT_SECTIONS.filter((section) => requested.has(section));
}
function budgetChars(options) {
  const budget = options.tokenBudget;
  if (typeof budget !== "number" || !isFinite(budget) || budget <= 0)
    return void 0;
  const charsPerToken = typeof options.charsPerToken === "number" && options.charsPerToken > 0 ? options.charsPerToken : DEFAULT_CHARS_PER_TOKEN;
  return Math.max(1, Math.floor(budget * charsPerToken));
}
function sortedUniqueCycles(input) {
  const seen = /* @__PURE__ */ new Set();
  const cycles = [];
  for (const cycle of input.cycles) {
    const key = cycle.join(" -> ");
    if (seen.has(key))
      continue;
    seen.add(key);
    cycles.push(cycle);
  }
  return cycles;
}
function groupedDeadCode(input) {
  const byFile = /* @__PURE__ */ new Map();
  for (const dead of input.deadCode) {
    const symbols = byFile.get(dead.file) || [];
    symbols.push(dead);
    byFile.set(dead.file, symbols);
  }
  return Array.from(byFile.entries()).map(([file, symbols]) => ({ file, symbols })).sort((a, b) => b.symbols.length - a.symbols.length || a.file.localeCompare(b.file));
}
function hotspotScore(hotspot) {
  return hotspot.score ?? hotspot.impact ?? 0;
}
function hotspotReason(hotspot) {
  return (hotspot.reasons || []).slice(0, 3).join("; ").replace(/\r?\n/g, " ");
}
function truncateMarkdown(text, maxChars, tokenBudget) {
  if (text.length <= maxChars)
    return text;
  const reserve = 160;
  let head = text.slice(0, Math.max(0, maxChars - reserve));
  let cut = head.lastIndexOf("\n");
  if (cut <= 0)
    cut = head.length;
  let omittedLines = text.slice(cut).split("\n").length - 1;
  let note = `

_\u2026 ${omittedLines} line(s) omitted to fit ~${tokenBudget} tokens._
`;
  while (cut + note.length > maxChars && cut > 0) {
    cut = Math.max(0, Math.min(cut - 1, maxChars - note.length - 1));
    cut = text.lastIndexOf("\n", cut);
    if (cut <= 0)
      cut = 0;
    omittedLines = text.slice(cut).split("\n").length - 1;
    note = `

_\u2026 ${omittedLines} line(s) omitted to fit ~${tokenBudget} tokens._
`;
  }
  const output = text.slice(0, cut) + note;
  return output.length <= maxChars ? output : output.slice(0, maxChars);
}
function markdown(input, sections, budget) {
  const lines = [];
  const deps = moduleDependencies(input);
  const hotspots = [...input.hotspots].sort((a, b) => hotspotScore(b) - hotspotScore(a) || a.file.localeCompare(b.file));
  const cycles = sortedUniqueCycles(input);
  const deadFiles = groupedDeadCode(input);
  const languageCounts = /* @__PURE__ */ new Map();
  for (const node of input.nodes) {
    languageCounts.set(node.language || "unknown", (languageCounts.get(node.language || "unknown") || 0) + 1);
  }
  const languages2 = Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([language, count]) => `${language} (${count})`).join(", ");
  lines.push(`# AI context \u2014 ${input.projectName}`);
  lines.push("");
  lines.push(`_Generated from the Aura graph analyzed at ${input.analyzedAt}._`);
  lines.push("");
  lines.push("## Overview");
  lines.push("");
  lines.push(`- **Files:** ${input.nodes.length}`);
  lines.push(`- **Links:** ${input.links.length}`);
  lines.push(`- **Modules:** ${input.modules.length}`);
  lines.push(`- **Cycles:** ${cycles.length}`);
  lines.push(`- **Dead exports:** ${input.deadCode.length}`);
  lines.push(`- **Languages:** ${languages2 || "\u2014"}`);
  lines.push("");
  if (sections.has("modules")) {
    lines.push("## Modules");
    lines.push("");
    const modulesByIndex = input.modules;
    const modules = [...input.modules].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
    if (modules.length === 0) {
      lines.push("_No modules detected._");
    } else {
      lines.push("| Module | Files | Key files |");
      lines.push("|---|---:|---|");
      for (const mod of modules) {
        const keyFiles = mod.files.slice(0, 4).map((file) => `\`${escapeCell(file)}\``).join(", ");
        lines.push(`| ${escapeCell(mod.name)} | ${mod.size} | ${keyFiles || "\u2014"} |`);
      }
      lines.push("");
      lines.push("**Module dependencies**");
      lines.push("");
      if (deps.length === 0) {
        lines.push("_No inter-module dependencies._");
      } else {
        for (const dep of deps) {
          const from = modulesByIndex[dep.from]?.name ?? `M${dep.from}`;
          const to = modulesByIndex[dep.to]?.name ?? `M${dep.to}`;
          lines.push(`- \`${escapeCell(from)}\` \u2192 \`${escapeCell(to)}\` (${dep.count})`);
        }
      }
    }
    lines.push("");
  }
  if (sections.has("contracts")) {
    lines.push("## Contracts (public surface)");
    lines.push("");
    const byFile = /* @__PURE__ */ new Map();
    for (const contract of input.contracts) {
      const list = byFile.get(contract.file) || [];
      list.push(contract);
      byFile.set(contract.file, list);
    }
    const rows = Array.from(byFile.entries()).sort((a, b) => (b[1][0]?.fanIn ?? 0) - (a[1][0]?.fanIn ?? 0) || a[0].localeCompare(b[0]));
    if (rows.length === 0) {
      lines.push("_No public contracts detected._");
    } else {
      lines.push("| File | Fan-in | Public surface |");
      lines.push("|---|---:|---|");
      for (const [file, symbols] of rows) {
        const shown = symbols.slice(0, 10).map((s) => `\`${escapeCell(s.symbol)}\` (${escapeCell(s.kind)})`).join(", ");
        const rest = symbols.length > 10 ? ` +${symbols.length - 10} more` : "";
        lines.push(`| \`${escapeCell(file)}\` | ${symbols[0]?.fanIn ?? 0} | ${shown}${rest} |`);
      }
    }
    lines.push("");
  }
  if (sections.has("hotspots")) {
    lines.push("## Hotspots");
    lines.push("");
    if (hotspots.length === 0) {
      lines.push("_No hotspot data._");
    } else {
      lines.push("| File | Score | Complexity | Fan-in | Fan-out | Why |");
      lines.push("|---|---:|---:|---:|---:|---|");
      for (const hotspot of hotspots.slice(0, 20)) {
        lines.push(`| \`${escapeCell(hotspot.file)}\` | ${Math.round(hotspotScore(hotspot))} | ${hotspot.complexity ?? "\u2014"} | ${hotspot.fanIn ?? "\u2014"} | ${hotspot.fanOut ?? "\u2014"} | ${escapeCell(hotspotReason(hotspot)) || "\u2014"} |`);
      }
    }
    lines.push("");
  }
  if (sections.has("cycles")) {
    lines.push("## Cycles");
    lines.push("");
    if (cycles.length === 0) {
      lines.push("_No circular dependencies._");
    } else {
      for (const cycle of cycles) {
        lines.push(`- ${cycle.map((file) => `\`${escapeCell(file)}\``).join(" \u2192 ")}`);
      }
    }
    lines.push("");
  }
  if (sections.has("deadCode")) {
    lines.push("## Dead exports");
    lines.push("");
    if (deadFiles.length === 0) {
      lines.push("_No dead exports._");
    } else {
      for (const group of deadFiles.slice(0, 30)) {
        const symbols = group.symbols.slice(0, 10).map((s) => `${s.symbol} (${s.kind})`).join(", ");
        const rest = group.symbols.length > 10 ? ` +${group.symbols.length - 10} more` : "";
        lines.push(`- \`${escapeCell(group.file)}\` \u2014 ${escapeCell(symbols)}${rest}`);
      }
    }
    lines.push("");
  }
  if (sections.size > 0) {
    lines.push("## Usage notes");
    lines.push("");
    lines.push("- High fan-in files are critical hubs; change them carefully.");
    lines.push("- Module dependencies summarize the architecture; use the MCP tools for exact paths or impact analysis.");
    lines.push("- Empty sections are explicit, not missing data.");
    lines.push("");
  }
  const text = lines.join("\n");
  return budget ? truncateMarkdown(text, budget.chars, budget.tokens) : text;
}
function json(input, sections, generatedAt, budget) {
  const moduleDeps = moduleDependencies(input);
  const moduleIndexByRef = new Map(input.modules.map((mod, index) => [mod, index]));
  const depByModule = /* @__PURE__ */ new Map();
  for (const dep of moduleDeps) {
    const target = input.modules[dep.to]?.name ?? `M${dep.to}`;
    const list = depByModule.get(dep.from) || [];
    list.push({ module: target, count: dep.count });
    depByModule.set(dep.from, list);
  }
  const payload = {
    version: 1,
    generatedAt,
    project: {
      name: input.projectName,
      analyzedAt: input.analyzedAt
    },
    overview: {
      files: input.nodes.length,
      links: input.links.length,
      modules: input.modules.length,
      cycles: input.cycles.length,
      deadExports: input.deadCode.length,
      languages: (() => {
        const counts = /* @__PURE__ */ new Map();
        for (const node of input.nodes)
          counts.set(node.language || "unknown", (counts.get(node.language || "unknown") || 0) + 1);
        return Object.fromEntries(Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
      })()
    }
  };
  if (sections.has("modules")) {
    payload.modules = [...input.modules].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name)).map((mod) => ({
      name: mod.name,
      fileCount: mod.size,
      files: mod.files.slice(0, 10),
      filesTruncated: mod.size > 10,
      dependsOn: (depByModule.get(moduleIndexByRef.get(mod) ?? -1) || []).sort((a, b) => b.count - a.count || a.module.localeCompare(b.module))
    }));
  }
  if (sections.has("contracts")) {
    payload.contracts = input.contracts.map((contract) => ({
      file: contract.file,
      symbol: contract.symbol,
      kind: contract.kind,
      line: contract.line,
      fanIn: contract.fanIn
    }));
  }
  if (sections.has("hotspots")) {
    payload.hotspots = [...input.hotspots].sort((a, b) => hotspotScore(b) - hotspotScore(a) || a.file.localeCompare(b.file)).map((hotspot) => ({
      file: hotspot.file,
      score: Math.round(hotspotScore(hotspot)),
      complexity: hotspot.complexity,
      fanIn: hotspot.fanIn,
      fanOut: hotspot.fanOut,
      lines: hotspot.lines,
      reasons: hotspot.reasons || []
    }));
  }
  if (sections.has("cycles")) {
    payload.cycles = sortedUniqueCycles(input);
  }
  if (sections.has("deadCode")) {
    payload.deadCode = [...input.deadCode].sort((a, b) => a.file.localeCompare(b.file) || a.symbol.localeCompare(b.symbol) || a.kind.localeCompare(b.kind));
  }
  if (!budget)
    return JSON.stringify(payload, null, 2) + "\n";
  const sectionKeys = ["modules", "contracts", "hotspots", "cycles", "deadCode"].filter((key) => Array.isArray(payload[key]));
  const omittedItems = {};
  const omittedSections = [];
  const refreshTruncation = () => {
    if (Object.keys(omittedItems).length === 0 && omittedSections.length === 0)
      return;
    payload.truncation = {
      tokenBudget: budget.tokens,
      omittedItems,
      omittedSections
    };
  };
  while (JSON.stringify(payload, null, 2).length + 1 > budget.chars) {
    let largest;
    for (const key of sectionKeys) {
      const arr = payload[key];
      if (!Array.isArray(arr) || arr.length <= 1)
        continue;
      if (!largest || arr.length > payload[largest].length)
        largest = key;
    }
    if (largest) {
      payload[largest].pop();
      omittedItems[largest] = (omittedItems[largest] || 0) + 1;
      refreshTruncation();
      continue;
    }
    const removable = [...sectionKeys].reverse().find((key) => {
      const arr = payload[key];
      return Array.isArray(arr) && arr.length > 0;
    });
    if (removable) {
      delete payload[removable];
      omittedSections.push(removable);
      refreshTruncation();
      continue;
    }
    const minimal = { version: 1, generatedAt, truncated: true, tokenBudget: budget.tokens };
    const text = JSON.stringify(minimal, null, 2) + "\n";
    return text.length <= budget.chars ? text : '{"version":1,"truncated":true}';
  }
  return JSON.stringify(payload, null, 2) + "\n";
}
function generateAiExport(input, options = {}) {
  const sections = new Set(normalizedSections(options));
  const chars = budgetChars(options);
  const budget = chars ? { chars, tokens: Math.floor(chars / Math.max(1, options.charsPerToken || DEFAULT_CHARS_PER_TOKEN)) } : void 0;
  const generatedAt = options.generatedAt ?? input.analyzedAt ?? "unknown";
  return options.format === "json" ? json(input, sections, generatedAt, budget) : markdown(input, sections, budget);
}

// src/analyzer/parsers/doc-parser.ts
var HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/;
var RST_UNDERLINE_RE = /^(=+|-+|~+)\s*$/;
function chunkDocument(content, fileId, maxChars = 1500) {
  const lines = content.split("\n");
  const chunks = [];
  let currentSection = fileId.split("/").pop() || fileId;
  let buffer2 = [];
  let bufferStart = 1;
  const flush = (endLine) => {
    const text = buffer2.join("\n").trim();
    if (text.length === 0)
      return;
    const pieces = splitByParagraph(text, maxChars);
    let offset = 0;
    for (const piece of pieces) {
      chunks.push({
        fileId,
        section: currentSection,
        content: piece,
        lineStart: bufferStart + offset
      });
      offset += piece.split("\n").length;
    }
    buffer2 = [];
    bufferStart = endLine + 1;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mdMatch = line.match(HEADING_RE);
    const rstUnderline = i + 1 < lines.length && lines[i + 1].match(RST_UNDERLINE_RE);
    if (mdMatch) {
      flush(i);
      currentSection = mdMatch[2];
      bufferStart = i + 1;
      continue;
    }
    if (rstUnderline && line.trim().length > 0) {
      flush(i - 1);
      currentSection = line.trim();
      bufferStart = i + 1;
      i++;
      continue;
    }
    buffer2.push(line);
  }
  flush(lines.length);
  return chunks;
}
function splitByParagraph(text, maxChars) {
  if (text.length <= maxChars)
    return [text];
  const paragraphs = text.split(/\n\s*\n/);
  const out2 = [];
  let current2 = "";
  for (const p of paragraphs) {
    if (current2.length + p.length + 2 > maxChars && current2.length > 0) {
      out2.push(current2.trim());
      current2 = "";
    }
    current2 += (current2 ? "\n\n" : "") + p;
    while (current2.length > maxChars * 1.5) {
      out2.push(current2.slice(0, maxChars));
      current2 = current2.slice(maxChars);
    }
  }
  if (current2.trim().length > 0)
    out2.push(current2.trim());
  return out2;
}

// src/analysis/cochange.ts
function pairKey(a, b) {
  return a < b ? a + "\0" + b : b + "\0" + a;
}
function commitTime(commit) {
  if (typeof commit.date === "number" && isFinite(commit.date))
    return commit.date;
  if (typeof commit.date === "string") {
    const parsed = Date.parse(commit.date);
    return isFinite(parsed) ? parsed : void 0;
  }
  return void 0;
}
function computeCochange(commits, options = {}) {
  const windowDays = typeof options.windowDays === "number" && options.windowDays > 0 ? options.windowDays : 365;
  const now = typeof options.now === "number" && isFinite(options.now) ? options.now : Date.now();
  const minCochanges = Math.max(0, options.minCochanges ?? 2);
  const minJaccard = Math.min(1, Math.max(0, options.minJaccard ?? 0.2));
  const maxFilesPerCommit = Math.max(2, options.maxFilesPerCommit ?? 50);
  const maxPairs = Math.max(0, options.maxPairs ?? 200);
  const excludeLinked = options.excludeLinked !== false;
  const linked = /* @__PURE__ */ new Set();
  for (const pair of options.linkedPairs || [])
    linked.add(pairKey(pair[0], pair[1]));
  const allowed = options.allowedPaths ? new Set(options.allowedPaths) : void 0;
  const cutoff = now - windowDays * 24 * 60 * 60 * 1e3;
  const resolvePath = buildRenameResolver(commits);
  const pairCounts = /* @__PURE__ */ new Map();
  const fileCounts = /* @__PURE__ */ new Map();
  let commitsConsidered = 0;
  let totalCommitsInWindow = 0;
  for (const commit of commits) {
    const when = commitTime(commit);
    if (when === void 0 || when < cutoff || when > now)
      continue;
    const files = /* @__PURE__ */ new Set();
    for (const file of commit.files || []) {
      if (!file.path || file.status === "D")
        continue;
      const resolved = resolvePath(file.status === "R" && file.oldPath ? file.oldPath : file.path);
      if (!resolved)
        continue;
      if (allowed && !allowed.has(resolved))
        continue;
      files.add(resolved);
    }
    if (files.size === 0)
      continue;
    totalCommitsInWindow++;
    const list = Array.from(files).sort();
    for (const file of list)
      fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
    if (files.size < 2 || files.size > maxFilesPerCommit)
      continue;
    commitsConsidered++;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const key = pairKey(a, b);
        if (excludeLinked && linked.has(key))
          continue;
        const entry = pairCounts.get(key);
        if (entry)
          entry.cochanges++;
        else
          pairCounts.set(key, { a, b, cochanges: 1 });
      }
    }
  }
  const pairs = [];
  for (const entry of pairCounts.values()) {
    if (entry.cochanges < minCochanges)
      continue;
    const aCommits = fileCounts.get(entry.a) || 0;
    const bCommits = fileCounts.get(entry.b) || 0;
    const union = aCommits + bCommits - entry.cochanges;
    if (union <= 0)
      continue;
    const jaccard = entry.cochanges / union;
    if (jaccard < minJaccard)
      continue;
    pairs.push({
      a: entry.a,
      b: entry.b,
      cochanges: entry.cochanges,
      aCommits,
      bCommits,
      jaccard,
      support: commitsConsidered > 0 ? entry.cochanges / commitsConsidered : 0,
      linked: linked.has(pairKey(entry.a, entry.b))
    });
  }
  pairs.sort((left, right) => right.jaccard - left.jaccard || right.cochanges - left.cochanges || left.a.localeCompare(right.a) || left.b.localeCompare(right.b));
  return {
    pairs: pairs.slice(0, maxPairs),
    windowDays,
    commitsConsidered,
    totalCommitsInWindow,
    maxJaccard: pairs.length > 0 ? pairs[0].jaccard : 0
  };
}

// src/arch/arch-tool.ts
function buildArchitectureToolPayload(evaluation, input = {}) {
  if (!evaluation || !evaluation.configured) {
    return {
      configured: false,
      hint: "No .aura/arch-rules.json in this workspace. Create it in the Aura Architecture tab or add layers/deny rules manually."
    };
  }
  const layer = typeof input.layer === "string" ? input.layer.trim() : "";
  if (layer && !evaluation.layers.some((stat2) => stat2.name === layer)) {
    return {
      configured: true,
      error: 'Unknown layer "' + layer + '".',
      available_layers: evaluation.layers.map((stat2) => stat2.name)
    };
  }
  const includeBaselined = input.include_baselined === true;
  const limit = typeof input.limit === "number" && input.limit > 0 ? Math.round(input.limit) : 100;
  const source = includeBaselined ? evaluation.violations : evaluation.newViolations;
  const involvesLayer = (violation) => !layer || violation.sourceLayer === layer || violation.targetLayer === layer || violation.sourceGroup === layer || violation.targetGroup === layer;
  const list = source.filter(involvesLayer);
  return {
    configured: true,
    ...layer ? { layer } : {},
    counts: evaluation.counts,
    rules: evaluation.rules,
    layers: layer ? evaluation.layers.filter((stat2) => stat2.name === layer) : evaluation.layers,
    cycles: layer ? evaluation.layerCycles.filter((cycle) => cycle.layers.includes(layer)) : evaluation.layerCycles,
    ...layer ? {} : {
      unlayered_files: evaluation.unlayeredFiles.slice(0, 50),
      unlayered_total: evaluation.unlayeredTotal
    },
    violations: list.slice(0, limit).map((violation) => ({
      rule: violation.ruleId,
      kind: violation.kind,
      severity: violation.severity,
      source: violation.source,
      target: violation.target,
      types: violation.linkTypes,
      from: violation.sourceGroup,
      to: violation.targetGroup,
      from_layer: violation.sourceLayer,
      to_layer: violation.targetLayer,
      baselined: violation.baselined
    })),
    violations_total: list.length,
    truncated: list.length > limit
  };
}

// src/extension.ts
var webviewProvider;
var cachedGraphData;
var codeLensProvider;
var cachedFiles = [];
var historyWorker;
var commitIndex;
var cachedDeltas = [];
var fileWatcher;
var riskStatusBarItem;
var riskSnapshot;
var riskSnapshotDirty = true;
var archStatusBarItem;
var archRules;
var archBaseline = { version: 1, entries: [] };
var archEvaluation;
var archRulesError;
var workingTreeFiles = /* @__PURE__ */ new Map();
var workingTreeTimer;
var startupWorkingTreeTimer;
var gitRepoRoot;
var statusBarItem;
var refreshTimeout;
var treeProvider;
var isAnalyzing = false;
var graphDb;
var incrementalCtx;
var parseFailureIndex = /* @__PURE__ */ new Map();
function refreshParseFailureMeta(data = cachedGraphData) {
  if (!data)
    return;
  const report = buildParseFailureReport(parseFailureIndex);
  if (report)
    data.meta.parseFailures = report;
  else
    delete data.meta.parseFailures;
}
function seedParseFailureIndex(data) {
  parseFailureIndex = new Map((data?.meta.parseFailures?.samples || []).map((sample) => [sample.path, sample.reason]));
}
function applyParseFailure(path5, reason) {
  const before = parseFailureIndex.get(path5);
  if (reason)
    parseFailureIndex.set(path5, reason);
  else
    parseFailureIndex.delete(path5);
  if ((before || reason) && cachedGraphData) {
    refreshParseFailureMeta(cachedGraphData);
  }
}
function architectureToolPayload(input = {}) {
  if (!cachedGraphData) {
    return { error: 'Aura has not analyzed this workspace yet. Run the "Aura: Visualize Codebase" command first, then retry.' };
  }
  if (!archRules) {
    if (archRulesError)
      return { configured: false, error: archRulesError };
    return buildArchitectureToolPayload(void 0, input);
  }
  const evaluation = evaluateArchitecture(cachedGraphData, archRules, { baseline: archBaseline });
  return buildArchitectureToolPayload(evaluation, input);
}
function recomputePageRank(data) {
  const before = new Map(data.nodes.map((node) => [node.id, node.pagerank]));
  const docIds = documentationIdsOf(data.nodes);
  const structuralNodes = data.nodes.filter((node) => !docIds.has(node.id));
  const structuralLinks = data.links.filter((link) => isStructuralLink(link, docIds));
  const scores = computePageRank(structuralNodes.map((node) => node.id), structuralLinks);
  const changed = [];
  for (const node of data.nodes) {
    node.pagerank = scores[node.id] ?? 0;
    if (before.get(node.id) !== node.pagerank)
      changed.push(node);
  }
  return changed;
}
function archRulesFilePath(rootPath) {
  return path4.join(rootPath, ARCH_RULES_FILE);
}
function archBaselineFilePath(rootPath) {
  return path4.join(rootPath, ARCH_BASELINE_FILE);
}
function loadArchConfiguration(rootPath) {
  archRules = void 0;
  archRulesError = void 0;
  archBaseline = { version: 1, entries: [] };
  const rulesFile = archRulesFilePath(rootPath);
  if ((0, import_fs5.existsSync)(rulesFile)) {
    try {
      archRules = parseArchRules((0, import_fs5.readFileSync)(rulesFile, "utf-8"));
    } catch (err2) {
      archRulesError = err2 instanceof Error ? err2.message : String(err2);
      console.warn("[aura] Invalid .aura/arch-rules.json:", err2);
    }
  }
  const baselineFile = archBaselineFilePath(rootPath);
  if ((0, import_fs5.existsSync)(baselineFile)) {
    try {
      archBaseline = parseArchBaseline((0, import_fs5.readFileSync)(baselineFile, "utf-8"));
    } catch (err2) {
      console.warn("[aura] Invalid .aura/arch-baseline.json \u2014 ignored:", err2);
    }
  }
}
function applyArchitectureToGraph(data) {
  if (!archRules) {
    const empty = evaluateArchitecture({ nodes: [], links: [] }, EMPTY_ARCH_RULES);
    applyArchitecture(data.nodes, data.links, empty, EMPTY_ARCH_RULES);
    delete data.meta.arch;
    archEvaluation = void 0;
  } else {
    archEvaluation = evaluateArchitecture(data, archRules, { baseline: archBaseline });
    applyArchitecture(data.nodes, data.links, archEvaluation, archRules);
    data.meta.arch = archEvaluation;
  }
  if (archRulesError)
    data.meta.archError = archRulesError;
  else
    delete data.meta.archError;
  return archEvaluation;
}
function topLevelSourceFolders(rootPath) {
  const skip = /* @__PURE__ */ new Set([
    "node_modules",
    ".git",
    ".aura",
    ".vscode",
    ".github",
    "out",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    "docs",
    "doc",
    "test",
    "tests",
    "resources"
  ]);
  const srcPath = path4.join(rootPath, "src");
  for (const base of [srcPath, rootPath]) {
    try {
      const folders = (0, import_fs5.readdirSync)(base, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !skip.has(entry.name)).map((entry) => entry.name).sort();
      if (folders.length > 0)
        return folders;
    } catch {
    }
  }
  return [];
}
function reloadArchitecture() {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws)
    return;
  loadArchConfiguration(ws.uri.fsPath);
  if (cachedGraphData) {
    applyArchitectureToGraph(cachedGraphData);
    webviewProvider?.sendArchUpdate(cachedGraphData);
    treeProvider?.update(cachedGraphData);
    codeLensProvider?.refresh();
  }
  updateStatusBar();
}
async function createOrOpenArchRules() {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws) {
    void vscode10.window.showWarningMessage("Aura: open a workspace folder first.");
    return;
  }
  const file = archRulesFilePath(ws.uri.fsPath);
  try {
    if (!(0, import_fs5.existsSync)(file)) {
      await fs2.mkdir(path4.dirname(file), { recursive: true });
      await fs2.writeFile(file, buildArchRulesTemplate(topLevelSourceFolders(ws.uri.fsPath)), "utf-8");
    }
    const doc = await vscode10.workspace.openTextDocument(file);
    await vscode10.window.showTextDocument(doc);
  } catch (err2) {
    void vscode10.window.showErrorMessage(
      "Aura: could not create architecture rules \u2014 " + (err2 instanceof Error ? err2.message : String(err2))
    );
  }
}
async function baselineArchitecture() {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws)
    return;
  if (!cachedGraphData || !archRules) {
    void vscode10.window.showWarningMessage("Aura: create .aura/arch-rules.json before baselining violations.");
    return;
  }
  applyArchitectureToGraph(cachedGraphData);
  if (!archEvaluation)
    return;
  const baseline = buildArchBaseline(archEvaluation);
  try {
    await fs2.mkdir(path4.dirname(archBaselineFilePath(ws.uri.fsPath)), { recursive: true });
    await fs2.writeFile(archBaselineFilePath(ws.uri.fsPath), serializeArchBaseline(baseline), "utf-8");
    reloadArchitecture();
    void vscode10.window.showInformationMessage(
      `Aura: ${baseline.entries.length} architecture violation${baseline.entries.length === 1 ? "" : "s"} baselined \u2014 only new ones will alert.`
    );
  } catch (err2) {
    void vscode10.window.showErrorMessage(
      "Aura: could not write the architecture baseline \u2014 " + (err2 instanceof Error ? err2.message : String(err2))
    );
  }
}
async function resetArchitectureBaseline() {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws)
    return;
  const file = archBaselineFilePath(ws.uri.fsPath);
  try {
    if ((0, import_fs5.existsSync)(file))
      await fs2.unlink(file);
    reloadArchitecture();
    void vscode10.window.showInformationMessage("Aura: architecture baseline cleared.");
  } catch (err2) {
    void vscode10.window.showErrorMessage(
      "Aura: could not delete the baseline \u2014 " + (err2 instanceof Error ? err2.message : String(err2))
    );
  }
}
function recomputeDeadCodeMeta(data) {
  data.meta.deadCodeFiles = data.nodes.filter((n) => n.deadExports && n.deadExports.length > 0).length;
  data.meta.deadExportsTotal = data.nodes.reduce((sum, n) => sum + (n.deadExports ? n.deadExports.length : 0), 0);
  data.meta.deadCodeExemptions = data.nodes.reduce((sum, n) => sum + (n.exemptedExports ? n.exemptedExports.length : 0), 0);
  if (graphDb) {
    try {
      graphDb.setMeta("deadCodeFiles", String(data.meta.deadCodeFiles));
      graphDb.setMeta("deadExportsTotal", String(data.meta.deadExportsTotal));
      graphDb.setMeta("deadCodeExemptions", String(data.meta.deadCodeExemptions));
      graphDb.save();
    } catch (err2) {
      console.warn("[aura] dead-code meta update failed:", err2);
    }
  }
}
function activate(context) {
  treeProvider = new AuraTreeProvider();
  const treeView = vscode10.window.createTreeView("auraVisualizer.statsView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  statusBarItem = vscode10.window.createStatusBarItem(vscode10.StatusBarAlignment.Left, 50);
  statusBarItem.command = "auraVisualizer.open";
  statusBarItem.text = "$(eye) Aura";
  statusBarItem.tooltip = "Open Aura 3D Visualizer";
  context.subscriptions.push(statusBarItem);
  riskStatusBarItem = vscode10.window.createStatusBarItem(vscode10.StatusBarAlignment.Right, 50);
  riskStatusBarItem.command = "auraVisualizer.open";
  riskStatusBarItem.tooltip = "Aura risk map";
  context.subscriptions.push(riskStatusBarItem);
  archStatusBarItem = vscode10.window.createStatusBarItem(vscode10.StatusBarAlignment.Right, 49);
  archStatusBarItem.command = "auraVisualizer.statusBarArch";
  archStatusBarItem.tooltip = "Aura architecture rules";
  context.subscriptions.push(archStatusBarItem);
  registerAuraLmTools(context, () => graphDb, () => ensureRiskSnapshot(), architectureToolPayload);
  registerAuraChatParticipant(context, () => graphDb, () => ensureRiskSnapshot(), () => webviewProvider?.isOpen ?? false, architectureToolPayload);
  context.subscriptions.push(
    vscode10.commands.registerCommand("auraVisualizer.open", () => openVisualizer(context)),
    vscode10.commands.registerCommand("auraVisualizer.refresh", () => refreshAnalysis(context, true)),
    vscode10.commands.registerCommand("auraVisualizer.focusFile", () => focusCurrentFile()),
    vscode10.commands.registerCommand("auraVisualizer.openFileFromTree", (relativePath) => {
      const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
      if (!workspaceFolder2)
        return;
      const fullPath = path4.join(workspaceFolder2.uri.fsPath, relativePath);
      vscode10.window.showTextDocument(vscode10.Uri.file(fullPath), { preview: true });
    }),
    vscode10.commands.registerCommand("auraVisualizer.exportGraph", () => exportGraph()),
    vscode10.commands.registerCommand("auraVisualizer.exportImage", () => exportGraphImage(context)),
    vscode10.commands.registerCommand("auraVisualizer.exportArchReport", () => exportArchReport()),
    vscode10.commands.registerCommand("auraVisualizer.exportArchReportAI", () => exportArchReport(true)),
    vscode10.commands.registerCommand("auraVisualizer.exportMetrics", () => exportMetrics()),
    vscode10.commands.registerCommand("auraVisualizer.blastRadius", () => blastRadiusCurrentFile(context)),
    vscode10.commands.registerCommand("auraVisualizer.statusBarRisk", (nodeId) => focusRiskFromStatusBar(context, nodeId)),
    vscode10.commands.registerCommand("auraVisualizer.statusBarArch", (nodeId) => focusArchFromStatusBar(context, nodeId)),
    vscode10.commands.registerCommand("auraVisualizer.archRules", () => createOrOpenArchRules()),
    vscode10.commands.registerCommand("auraVisualizer.deadCodeRules", () => createOrOpenDeadCodeRules()),
    vscode10.commands.registerCommand("auraVisualizer.reloadArchRules", () => reloadArchitecture()),
    vscode10.commands.registerCommand("auraVisualizer.baselineArch", () => baselineArchitecture()),
    vscode10.commands.registerCommand("auraVisualizer.resetArchBaseline", () => resetArchitectureBaseline()),
    vscode10.commands.registerCommand("auraVisualizer.applyQuery", async (expr, mode = "filter") => {
      if (!expr)
        return;
      await openVisualizer(context);
      webviewProvider?.applyQueryFromHost(expr, mode);
    })
  );
  context.subscriptions.push(...registerNavigationCommands({
    revealGraph: () => openVisualizer(context),
    focusInGraph: (relativePath) => webviewProvider?.focusNode(relativePath, true),
    blastRadiusInGraph: (relativePath) => webviewProvider?.sendBlastRadius(relativePath)
  }));
  codeLensProvider = new AuraCodeLensProvider(
    () => graphDb,
    () => vscode10.workspace.getConfiguration("auraVisualizer").get("codeLens", true)
  );
  context.subscriptions.push(
    codeLensProvider,
    vscode10.languages.registerCodeLensProvider({ scheme: "file" }, codeLensProvider),
    ...registerSymbolCommands({
      revealGraph: () => openVisualizer(context),
      focusInGraph: (relativePath) => webviewProvider?.focusNode(relativePath, true),
      blastRadiusInGraph: (relativePath) => webviewProvider?.sendBlastRadius(relativePath),
      openFlow: (relativePath, line, language, name) => webviewProvider?.openFlow(relativePath, line, language, name)
    })
  );
  context.subscriptions.push(...registerAskAuraCommands());
  setupFileWatcher(context);
  setupArchitectureWatcher(context);
  setupGitStateWatcher(context);
  context.subscriptions.push(
    vscode10.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("auraVisualizer") && webviewProvider) {
        webviewProvider.sendSettings({});
      }
      if (e.affectsConfiguration("auraVisualizer.riskWindow")) {
        invalidateRisk();
      }
      if (e.affectsConfiguration("auraVisualizer.codeLens")) {
        codeLensProvider?.refresh();
      }
      if (e.affectsConfiguration("auraVisualizer.excludePaths")) {
        void refreshAnalysis(context, true);
      }
    })
  );
  context.subscriptions.push(
    vscode10.workspace.onDidSaveTextDocument(() => {
      scheduleWorkingTreeRefresh();
    })
  );
  context.subscriptions.push(
    vscode10.window.onDidChangeActiveTextEditor((editor) => {
      updateRiskStatusBar();
      updateArchStatusBar();
      if (!editor || !webviewProvider?.isVisible)
        return;
      if (editor.document.uri.scheme !== "file")
        return;
      const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
      if (!workspaceFolder2)
        return;
      const relativePath = path4.relative(workspaceFolder2.uri.fsPath, editor.document.uri.fsPath).split(path4.sep).join("/");
      if (!relativePath || relativePath === ".." || relativePath.startsWith("../") || path4.isAbsolute(relativePath))
        return;
      if (cachedGraphData && !cachedGraphData.nodes.some((node) => node.id.replace(/\\/g, "/") === relativePath))
        return;
      webviewProvider.followEditorFile(relativePath);
    })
  );
  context.subscriptions.push(
    vscode10.window.onDidChangeActiveColorTheme((theme) => {
      webviewProvider?.sendTheme(theme.kind);
    })
  );
  vscode10.window.registerWebviewPanelSerializer(WebviewProvider.viewType, {
    async deserializeWebviewPanel(panel) {
      if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
        registerOpenFileHandler();
      }
      webviewProvider.restore(panel);
      if (cachedGraphData) {
        webviewProvider.sendGraphData(cachedGraphData);
        if (commitIndex) {
          webviewProvider.sendHistoryIndex(commitIndex);
          for (const delta of cachedDeltas) {
            webviewProvider.sendHistoryDelta(delta);
          }
        }
      }
    }
  });
  if (vscode10.workspace.workspaceFolders?.length) {
    loadFromDbThenRefresh(context);
  }
  startupWorkingTreeTimer = setTimeout(() => {
    startupWorkingTreeTimer = void 0;
    void refreshWorkingTree();
  }, 2500);
}
async function loadFromDbThenRefresh(context) {
  const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
  if (!workspaceFolder2) {
    refreshAnalysis(context);
    return;
  }
  const rootPath = workspaceFolder2.uri.fsPath;
  const dbPath = path4.join(rootPath, ".aura", "graph.db");
  loadArchConfiguration(rootPath);
  if ((0, import_fs5.existsSync)(dbPath)) {
    try {
      if (!graphDb) {
        graphDb = new GraphDB();
        await graphDb.open(dbPath);
      }
      graphDb.updateFanCounts();
      const cached = graphDb.exportGraphData();
      if (cached && cached.nodes.length > 0) {
        cachedGraphData = cached;
        seedParseFailureIndex(cachedGraphData);
        applyArchitectureToGraph(cachedGraphData);
        const rankChanges = recomputePageRank(cachedGraphData);
        if (rankChanges.length > 0) {
          graphDb.updatePageRanks(cachedGraphData.nodes);
        }
        graphDb.save();
        if (webviewProvider) {
          webviewProvider.sendGraphData(cachedGraphData);
        }
        treeProvider?.update(cachedGraphData);
        updateStatusBar();
        console.log(`[aura] Loaded ${cached.nodes.length} files from cache in DB`);
      }
    } catch (err2) {
      console.error("[aura] Failed to load from DB cache:", err2);
    }
  }
  const historyDir = path4.join(rootPath, ".aura", "history");
  const indexPath = path4.join(historyDir, "index.json");
  if ((0, import_fs5.existsSync)(indexPath)) {
    try {
      const idx = JSON.parse((0, import_fs5.readFileSync)(indexPath, "utf-8"));
      commitIndex = idx;
      invalidateRisk();
      if (webviewProvider) {
        webviewProvider.sendHistoryIndex(commitIndex);
      }
      for (const commit of idx.commits) {
        const deltaPath = path4.join(historyDir, `${commit.hash}.json`);
        if (!(0, import_fs5.existsSync)(deltaPath)) {
          continue;
        }
        try {
          const delta = JSON.parse((0, import_fs5.readFileSync)(deltaPath, "utf-8"));
          cachedDeltas.push(delta);
          if (webviewProvider) {
            webviewProvider.sendHistoryDelta(delta);
          }
        } catch {
        }
      }
      console.log(`[aura] Loaded ${cachedDeltas.length} cached history deltas`);
    } catch (err2) {
      console.error("[aura] Failed to load cached history:", err2);
    }
  }
  refreshAnalysis(context);
}
function registerOpenFileHandler() {
  if (!webviewProvider)
    return;
  webviewProvider.onOpenFile(async ({ path: filePath, line }) => {
    const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
    if (!workspaceFolder2)
      return;
    const fullPath = path4.join(workspaceFolder2.uri.fsPath, filePath);
    const uri = vscode10.Uri.file(fullPath);
    try {
      const doc = await vscode10.workspace.openTextDocument(uri);
      const editor = await vscode10.window.showTextDocument(doc, {
        viewColumn: vscode10.ViewColumn.Beside,
        preserveFocus: false
      });
      if (line && line > 0) {
        const position = new vscode10.Position(line - 1, 0);
        editor.selection = new vscode10.Selection(position, position);
        editor.revealRange(
          new vscode10.Range(position, position),
          vscode10.TextEditorRevealType.InCenter
        );
      }
    } catch {
    }
  });
}
async function openVisualizer(context) {
  const wasOpen = webviewProvider?.isOpen ?? false;
  if (!webviewProvider) {
    webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
    registerOpenFileHandler();
  }
  webviewProvider.show();
  if (wasOpen)
    return;
  if (cachedGraphData) {
    webviewProvider.sendGraphData(cachedGraphData);
    if (commitIndex) {
      webviewProvider.sendHistoryIndex(commitIndex);
      for (const delta of cachedDeltas) {
        webviewProvider.sendHistoryDelta(delta);
      }
    }
  } else {
    await refreshAnalysis(context);
  }
}
async function createOrOpenDeadCodeRules() {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws) {
    void vscode10.window.showWarningMessage("Aura: open a workspace folder first.");
    return;
  }
  const file = path4.join(ws.uri.fsPath, ".aura", "dead-code.json");
  try {
    if (!(0, import_fs5.existsSync)(file)) {
      await fs2.mkdir(path4.dirname(file), { recursive: true });
      await fs2.writeFile(file, '{\n  "version": 1,\n  "rules": []\n}\n', "utf-8");
    }
    const doc = await vscode10.workspace.openTextDocument(file);
    await vscode10.window.showTextDocument(doc);
  } catch (err2) {
    void vscode10.window.showErrorMessage(
      "Aura: could not create dead-code rules \u2014 " + (err2 instanceof Error ? err2.message : String(err2))
    );
  }
}
function loadDeadCodeRules(rootPath) {
  const file = path4.join(rootPath, ".aura", "dead-code.json");
  try {
    return parseDeadCodeRules((0, import_fs5.readFileSync)(file, "utf-8"));
  } catch (err2) {
    console.warn("[aura] Invalid .aura/dead-code.json \u2014 using default exemptions:", err2);
    return [];
  }
}
async function currentAnalysisFingerprint(rootPath, excludePaths, projectName) {
  const signatures = await scanFileSignatures(rootPath, { skipDirs: new Set(excludePaths) });
  const head = await getGitHead(rootPath);
  const configHash = hashAnalysisConfig({
    excludePaths: [...excludePaths].sort(),
    projectName,
    deadCodeRules: (() => {
      try {
        return (0, import_fs5.readFileSync)(path4.join(rootPath, ".aura", "dead-code.json"), "utf-8");
      } catch {
        return "";
      }
    })()
  });
  return computeFingerprint({ head, configHash, files: signatures });
}
function filesFromGraphData(data, rootPath) {
  return data.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    path: node.path || node.id,
    fullPath: path4.join(rootPath, node.id),
    language: node.language,
    extension: node.extension,
    size: node.size,
    linesOfCode: node.linesOfCode,
    lastModified: node.lastModified,
    group: node.group,
    content: ""
  }));
}
function hydrateCachedGraphState(rootPath) {
  if (!cachedGraphData)
    return;
  loadArchConfiguration(rootPath);
  applyArchitectureToGraph(cachedGraphData);
  if (cachedFiles.length === 0) {
    cachedFiles = filesFromGraphData(cachedGraphData, rootPath);
  }
  if (cachedFiles.length > 0) {
    incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData);
  }
}
function persistFingerprint(fp) {
  if (!graphDb)
    return;
  try {
    for (const [key, value] of fingerprintMetaEntries(fp))
      graphDb.setMeta(key, value);
    graphDb.save();
  } catch (err2) {
    console.error("[aura] Fingerprint persistence failed:", err2);
  }
}
async function refreshAnalysis(context, force = false) {
  if (isAnalyzing)
    return;
  isAnalyzing = true;
  const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
  if (!workspaceFolder2) {
    isAnalyzing = false;
    vscode10.window.showWarningMessage("Aura: No workspace folder open.");
    return;
  }
  const rootPath = workspaceFolder2.uri.fsPath;
  const dbPath = path4.join(rootPath, ".aura", "graph.db");
  const config = vscode10.workspace.getConfiguration("auraVisualizer");
  const excludePaths = config.get("excludePaths", [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "__pycache__"
  ]);
  if (!graphDb) {
    try {
      graphDb = new GraphDB();
      await fs2.mkdir(path4.join(rootPath, ".aura"), { recursive: true });
      await graphDb.open(dbPath);
    } catch (err2) {
      graphDb = void 0;
      console.error("[aura] GraphDB open failed:", err2);
    }
  }
  let currentFingerprint;
  try {
    currentFingerprint = await currentAnalysisFingerprint(rootPath, excludePaths, workspaceFolder2.name);
  } catch (err2) {
    console.error("[aura] Fingerprint computation failed:", err2);
  }
  const hadCachedGraphAtStart = !!cachedGraphData;
  const finishCacheRefresh = () => {
    if (!hadCachedGraphAtStart && cachedGraphData) {
      webviewProvider?.sendGraphData(cachedGraphData);
    } else {
      webviewProvider?.sendRefreshComplete();
    }
  };
  try {
    if (currentFingerprint && graphDb) {
      if (!cachedGraphData) {
        cachedGraphData = graphDb.exportGraphData() ?? void 0;
        seedParseFailureIndex(cachedGraphData);
      }
      const previous = fingerprintFromMeta(graphDb.getAllMeta());
      const plan = planAnalysis(previous, currentFingerprint, {
        force,
        hasCachedGraph: !!cachedGraphData
      });
      if (plan.mode === "skip") {
        hydrateCachedGraphState(rootPath);
        finishCacheRefresh();
        updateStatusBar();
        console.log(`[aura] Fingerprint unchanged (${currentFingerprint.files.length} files) \u2014 analysis skipped`);
        void startHistoryScan(context, rootPath, excludePaths);
        isAnalyzing = false;
        return;
      }
      if (plan.mode === "head-only") {
        persistFingerprint(currentFingerprint);
        hydrateCachedGraphState(rootPath);
        finishCacheRefresh();
        updateStatusBar();
        console.log(`[aura] Fingerprint refreshed (HEAD only, ${currentFingerprint.files.length} files) \u2014 analysis skipped`);
        void startHistoryScan(context, rootPath, excludePaths);
        isAnalyzing = false;
        return;
      }
      if (plan.mode === "incremental") {
        hydrateCachedGraphState(rootPath);
        for (const deleted of plan.diff.deleted) {
          await incrementalUpdate(vscode10.Uri.file(path4.join(rootPath, deleted)), true);
        }
        for (const file of [...plan.diff.added, ...plan.diff.modified]) {
          await incrementalUpdate(vscode10.Uri.file(path4.join(rootPath, file)), false);
        }
        persistFingerprint(currentFingerprint);
        finishCacheRefresh();
        updateStatusBar();
        console.log(`[aura] Incremental analysis: ${plan.diff.added.length + plan.diff.modified.length + plan.diff.deleted.length} file(s) changed (${plan.diff.added.length} added, ${plan.diff.modified.length} modified, ${plan.diff.deleted.length} deleted)`);
        void startHistoryScan(context, rootPath, excludePaths);
        isAnalyzing = false;
        return;
      }
      console.log(`[aura] Full analysis (${plan.reason})`);
    }
  } catch (cacheErr) {
    console.error("[aura] Fingerprint cache path failed, falling back to a full scan:", cacheErr);
  }
  if (statusBarItem) {
    statusBarItem.text = "$(loading~spin) Aura: Analyzing...";
    statusBarItem.show();
  }
  try {
    const result = await vscode10.window.withProgress(
      {
        location: vscode10.ProgressLocation.Window,
        title: "Aura: Analyzing codebase..."
      },
      () => runAnalysisInWorker(context.extensionUri, rootPath, excludePaths, workspaceFolder2.name, loadDeadCodeRules(rootPath))
    );
    const oldGraphData = cachedGraphData;
    cachedGraphData = result.graphData;
    cachedFiles = result.files;
    parseFailureIndex = new Map((result.parseFailures || []).map((failure) => [failure.path, failure.reason]));
    refreshParseFailureMeta(cachedGraphData);
    loadArchConfiguration(rootPath);
    applyArchitectureToGraph(cachedGraphData);
    incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData);
    try {
      if (!graphDb) {
        graphDb = new GraphDB();
        const dbDir = path4.join(rootPath, ".aura");
        await fs2.mkdir(dbDir, { recursive: true });
        await graphDb.open(path4.join(dbDir, "graph.db"));
      }
      graphDb.importGraphData(cachedGraphData);
      graphDb.importDocChunks(result.docChunks);
      if (currentFingerprint)
        persistFingerprint(currentFingerprint);
    } catch (dbErr) {
      console.error("[aura] GraphDB import error:", dbErr);
    }
    if (webviewProvider) {
      if (oldGraphData && oldGraphData.nodes.length > 0) {
        const delta = computeGraphDelta(oldGraphData, cachedGraphData, "", false);
        const oldCallCount = oldGraphData.functionCalls?.length || 0;
        const newCallCount = cachedGraphData.functionCalls?.length || 0;
        const hasChanges = delta.changedNodes.length > 0 || delta.removedNodeIds.length > 0 || delta.addedLinks.length > 0 || delta.removedLinks.length > 0 || oldCallCount !== newCallCount;
        if (hasChanges) {
          webviewProvider.sendGraphDelta(delta);
        } else {
          webviewProvider.sendRefreshComplete();
        }
      } else {
        webviewProvider.sendGraphData(cachedGraphData);
      }
    }
    treeProvider?.update(cachedGraphData);
    codeLensProvider?.refresh();
    updateStatusBar();
    void notifyScanComplete(context);
    try {
      refreshCochangeFromHistory();
      await registerMcpServer(context, rootPath);
    } catch (dbErr) {
      console.error("[aura] GraphDB post-import error:", dbErr);
    }
    startHistoryScan(context, rootPath, excludePaths);
  } catch (err2) {
    const message = err2 instanceof Error ? err2.message : String(err2);
    vscode10.window.showErrorMessage(`Aura: Analysis failed \u2014 ${message}`);
    updateStatusBar();
  } finally {
    isAnalyzing = false;
  }
}
async function registerMcpServer(context, rootPath) {
  const vscodeDir = path4.join(rootPath, ".vscode");
  const mcpPath = path4.join(vscodeDir, "mcp.json");
  const mcpServerPath = path4.join(context.extensionUri.fsPath, "out", "mcp-server.js");
  const dbPath = path4.join(rootPath, ".aura", "graph.db");
  let config = {};
  try {
    const existing = await fs2.readFile(mcpPath, "utf-8");
    config = JSON.parse(existing);
  } catch {
  }
  if (config.servers && config.servers["aura"]) {
    return;
  }
  config.servers = config.servers || {};
  config.servers["aura"] = {
    command: "node",
    args: [mcpServerPath],
    env: {
      AURA_DB_PATH: dbPath
    }
  };
  await fs2.mkdir(vscodeDir, { recursive: true });
  await fs2.writeFile(mcpPath, JSON.stringify(config, null, 4) + "\n", "utf-8");
  console.log("[aura] MCP server registered in .vscode/mcp.json");
}
function runAnalysisInWorker(extensionUri, rootPath, excludePaths, projectName, deadCodeRules) {
  return new Promise((resolve2, reject) => {
    const workerPath = path4.join(extensionUri.fsPath, "out", "analyzer-worker.js");
    const worker = new import_worker_threads2.Worker(workerPath, {
      // Don't inherit the debugger's --inspect flag: worker_threads copy
      // process.execArgv by default, so under the VS Code extension debugger
      // they try to attach to the inspector and hang the extension host.
      execArgv: [],
      workerData: {
        rootPath,
        skipDirs: excludePaths,
        projectName,
        deadCodeRules
      }
    });
    worker.on("message", (msg) => {
      if (msg.progress) {
        webviewProvider?.sendProgress(msg.progress.phase, msg.progress.message);
        return;
      }
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve2({ graphData: msg.graphData, files: msg.files, docChunks: msg.docChunks || [], parseFailures: msg.parseFailures || [] });
      }
      worker.terminate();
    });
    worker.on("error", (err2) => {
      reject(err2);
      worker.terminate();
    });
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
async function incrementalUpdate(fileUri, deleted) {
  const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
  if (!workspaceFolder2 || cachedFiles.length === 0)
    return;
  const rootPath = workspaceFolder2.uri.fsPath;
  const relativePath = path4.relative(rootPath, fileUri.fsPath);
  if (relativePath.startsWith(".."))
    return;
  if (deleted) {
    cachedFiles = cachedFiles.filter((f) => f.id !== relativePath);
    if (incrementalCtx) {
      incrementalCtx.fileMap.delete(relativePath);
      incrementalCtx.fileSymbols.delete(relativePath);
    }
    applyParseFailure(relativePath, void 0);
    if (graphDb) {
      graphDb.deleteNode(relativePath);
      if (cachedGraphData)
        graphDb.setMeta("parseFailures", JSON.stringify(cachedGraphData.meta.parseFailures || null));
      graphDb.save();
    }
    if (cachedGraphData) {
      const removedLinks = cachedGraphData.links.filter((l) => l.source === relativePath || l.target === relativePath).map((l) => ({ source: l.source, target: l.target, type: l.type }));
      cachedGraphData.nodes = cachedGraphData.nodes.filter((n) => n.id !== relativePath);
      cachedGraphData.links = cachedGraphData.links.filter((l) => l.source !== relativePath && l.target !== relativePath);
      cachedGraphData.functionCalls = (cachedGraphData.functionCalls || []).filter(
        (fc) => fc.callerFile !== relativePath && fc.calleeFile !== relativePath
      );
      const rankChanges = recomputePageRank(cachedGraphData);
      cachedGraphData.meta.symbolCycles = computeSymbolCycles(cachedGraphData.functionCalls);
      if (graphDb) {
        graphDb.updatePageRanks(cachedGraphData.nodes);
        graphDb.replaceSymbolCycles(cachedGraphData.meta.symbolCycles);
        graphDb.save();
      }
      cachedGraphData.meta.totalFiles = cachedGraphData.nodes.length;
      cachedGraphData.meta.totalLinks = cachedGraphData.links.length;
      recomputeDeadCodeMeta(cachedGraphData);
      applyArchitectureToGraph(cachedGraphData);
      if (webviewProvider?.isVisible) {
        const delta2 = {
          changedNodes: rankChanges,
          removedNodeIds: [relativePath],
          addedLinks: [],
          removedLinks,
          meta: cachedGraphData.meta,
          functionCalls: cachedGraphData.functionCalls || []
        };
        webviewProvider.sendGraphDelta(delta2);
      }
    }
    if (cachedGraphData) {
      treeProvider?.update(cachedGraphData);
      codeLensProvider?.refresh();
    }
    updateStatusBar();
    return;
  }
  const newInfo = await scanSingleFile(fileUri.fsPath, rootPath);
  if (!newInfo)
    return;
  const idx = cachedFiles.findIndex((f) => f.id === relativePath);
  if (idx >= 0)
    cachedFiles[idx] = newInfo;
  else
    cachedFiles.push(newInfo);
  if (newInfo.language === "documentation") {
    if (graphDb) {
      const docNode = {
        id: newInfo.id,
        name: newInfo.name,
        path: newInfo.path,
        language: newInfo.language,
        extension: newInfo.extension,
        group: newInfo.id.split("/").slice(0, -1).join("/") || newInfo.name,
        size: newInfo.size,
        linesOfCode: newInfo.content.split("\n").length,
        complexity: 1,
        complexityDetails: {},
        fanIn: 0,
        fanOut: 0,
        lastModified: newInfo.lastModified
      };
      graphDb.upsertNode(docNode);
      try {
        const chunks = chunkDocument(newInfo.content, newInfo.id);
        graphDb.replaceDocChunks(newInfo.id, chunks);
      } catch {
      }
      graphDb.save();
    }
    updateStatusBar();
    return;
  }
  if (!incrementalCtx) {
    incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData);
  }
  const fileFailures = /* @__PURE__ */ new Map();
  const trees = await preParseFiles([newInfo], fileFailures);
  const tree = trees.get(newInfo.id);
  const oldOutEdges = cachedGraphData ? cachedGraphData.links.filter((l) => l.source === newInfo.id) : [];
  const oldTargets = oldOutEdges.map((e) => e.target);
  const result = rebuildSingleFile(newInfo, incrementalCtx, tree, {
    deadCodeRules: loadDeadCodeRules(rootPath)
  });
  applyParseFailure(newInfo.id, fileFailures.get(newInfo.id) || result.parseFailureReason);
  if (!incrementalCtx.hasFileContents && cachedGraphData) {
    const previousNode = cachedGraphData.nodes.find((n) => n.id === newInfo.id);
    if (previousNode) {
      if (previousNode.deadExports)
        result.node.deadExports = previousNode.deadExports;
      if (previousNode.exemptedExports)
        result.node.exemptedExports = previousNode.exemptedExports;
    }
  }
  const newTargets = result.outEdges.map((e) => e.target);
  const affectedIds = [.../* @__PURE__ */ new Set([newInfo.id, ...oldTargets, ...newTargets])];
  if (graphDb) {
    graphDb.replaceFileData(newInfo.id, result.node, result.outEdges, result.callSites);
    graphDb.updateFanCounts(affectedIds);
    if (cachedGraphData)
      graphDb.setMeta("parseFailures", JSON.stringify(cachedGraphData.meta.parseFailures || null));
    graphDb.save();
  }
  const delta = {
    changedNodes: [result.node],
    removedNodeIds: [],
    addedLinks: [],
    removedLinks: [],
    meta: cachedGraphData?.meta ?? {},
    functionCalls: cachedGraphData?.functionCalls ?? []
  };
  const oldLinkKeys = new Set(oldOutEdges.map((l) => `${l.source}|${l.target}|${l.type}`));
  const newLinkKeys = new Set(result.outEdges.map((e) => `${e.source}|${e.target}|${e.type}`));
  for (const e of result.outEdges) {
    if (!oldLinkKeys.has(`${e.source}|${e.target}|${e.type}`)) {
      delta.addedLinks.push(e);
    }
  }
  for (const l of oldOutEdges) {
    if (!newLinkKeys.has(`${l.source}|${l.target}|${l.type}`)) {
      delta.removedLinks.push({ source: l.source, target: l.target, type: l.type });
    }
  }
  if (cachedGraphData) {
    const nodeIdx = cachedGraphData.nodes.findIndex((n) => n.id === newInfo.id);
    if (nodeIdx >= 0)
      cachedGraphData.nodes[nodeIdx] = result.node;
    else
      cachedGraphData.nodes.push(result.node);
    cachedGraphData.links = cachedGraphData.links.filter((l) => l.source !== newInfo.id);
    cachedGraphData.links.push(...result.outEdges);
    const rankChanges = recomputePageRank(cachedGraphData);
    const existingCalls = cachedGraphData.functionCalls || [];
    cachedGraphData.functionCalls = existingCalls.filter((fc) => fc.callerFile !== newInfo.id).concat(result.callSites);
    cachedGraphData.meta.symbolCycles = computeSymbolCycles(cachedGraphData.functionCalls);
    if (graphDb) {
      graphDb.updatePageRanks(cachedGraphData.nodes);
      graphDb.replaceSymbolCycles(cachedGraphData.meta.symbolCycles);
      graphDb.save();
    }
    if (graphDb) {
      for (const id of affectedIds) {
        const dbNode = graphDb.getNodeDetail(id);
        const cachedNode = cachedGraphData.nodes.find((n) => n.id === id);
        if (dbNode && cachedNode) {
          if (cachedNode.fanIn !== dbNode.fan_in || cachedNode.fanOut !== dbNode.fan_out) {
            cachedNode.fanIn = dbNode.fan_in;
            cachedNode.fanOut = dbNode.fan_out;
            if (id !== newInfo.id) {
              delta.changedNodes.push(cachedNode);
            }
          }
        }
      }
    }
    cachedGraphData.meta.totalFiles = cachedGraphData.nodes.length;
    cachedGraphData.meta.totalLinks = cachedGraphData.links.length;
    recomputeDeadCodeMeta(cachedGraphData);
    applyArchitectureToGraph(cachedGraphData);
    delta.meta = cachedGraphData.meta;
    delta.functionCalls = cachedGraphData.functionCalls || [];
    for (const node of rankChanges) {
      if (node.id !== result.node.id && delta.changedNodes.indexOf(node) === -1) {
        delta.changedNodes.push(node);
      }
    }
  }
  if (webviewProvider?.isVisible) {
    webviewProvider.sendGraphDelta(delta);
  }
  if (cachedGraphData) {
    treeProvider?.update(cachedGraphData);
    codeLensProvider?.refresh();
  }
  updateStatusBar();
}
function computeGraphDelta(oldGraph, newGraph, changedFileId, deleted) {
  const delta = {
    changedNodes: [],
    removedNodeIds: [],
    addedLinks: [],
    removedLinks: [],
    meta: newGraph.meta,
    functionCalls: newGraph.functionCalls || []
  };
  if (deleted) {
    delta.removedNodeIds.push(changedFileId);
  }
  const oldNodeMap = new Map(oldGraph.nodes.map((n) => [n.id, n]));
  const newNodeMap = new Map(newGraph.nodes.map((n) => [n.id, n]));
  for (const node of newGraph.nodes) {
    const oldNode = oldNodeMap.get(node.id);
    if (!oldNode || node.fanIn !== oldNode.fanIn || node.fanOut !== oldNode.fanOut || node.complexity !== oldNode.complexity || node.linesOfCode !== oldNode.linesOfCode || node.size !== oldNode.size) {
      delta.changedNodes.push(node);
    }
  }
  for (const node of oldGraph.nodes) {
    if (!newNodeMap.has(node.id)) {
      if (!delta.removedNodeIds.includes(node.id)) {
        delta.removedNodeIds.push(node.id);
      }
    }
  }
  const linkKey = (l) => `${typeof l.source === "object" ? l.source.id : l.source}|${typeof l.target === "object" ? l.target.id : l.target}|${l.type}`;
  const oldLinkSet = new Set(oldGraph.links.map(linkKey));
  const newLinkSet = new Set(newGraph.links.map(linkKey));
  for (const link of newGraph.links) {
    if (!oldLinkSet.has(linkKey(link))) {
      delta.addedLinks.push(link);
    }
  }
  for (const link of oldGraph.links) {
    if (!newLinkSet.has(linkKey(link))) {
      delta.removedLinks.push({
        source: typeof link.source === "object" ? link.source.id : link.source,
        target: typeof link.target === "object" ? link.target.id : link.target,
        type: link.type
      });
    }
  }
  return delta;
}
function updateStatusBar() {
  invalidateRisk();
  updateArchStatusBar();
  if (!statusBarItem)
    return;
  if (!cachedGraphData || cachedGraphData.nodes.length === 0) {
    statusBarItem.text = "$(eye) Aura";
    statusBarItem.hide();
    return;
  }
  const { totalFiles, totalLinks } = cachedGraphData.meta;
  statusBarItem.text = `$(eye) Aura: ${totalFiles} files, ${totalLinks} links`;
  statusBarItem.tooltip = `Aura \u2014 ${totalFiles} files, ${totalLinks} dependencies
Click to open 3D visualizer`;
  statusBarItem.show();
}
async function notifyScanComplete(context) {
  const config = vscode10.workspace.getConfiguration("auraVisualizer");
  if (!config.get("notifyOnScan", true))
    return;
  if (!cachedGraphData || cachedGraphData.nodes.length === 0)
    return;
  const meta = cachedGraphData.meta;
  const snapshot = ensureRiskSnapshot();
  const hotspots = snapshot ? snapshot.highIds.size : 0;
  const cycles = meta.cycles?.length ?? 0;
  const deadExports = meta.deadExportsTotal ?? 0;
  const exemptions = meta.deadCodeExemptions ?? 0;
  const exemptText = exemptions > 0 ? ` \xB7 ${exemptions} exempted` : "";
  const archViolations = meta.arch?.counts.newTotal ?? 0;
  const archText = meta.arch?.configured ? ` \xB7 ${archViolations} arch violation${archViolations === 1 ? "" : "s"}` : "";
  const message = `Aura: ${meta.totalFiles} files \xB7 ${cycles} cycles \xB7 ${deadExports} dead exports${exemptText} \xB7 ${hotspots} hotspots${archText}`;
  const choices = meta.arch?.configured ? ["View Risk", "View Architecture"] : ["View Risk"];
  const choice = await vscode10.window.showInformationMessage(message, ...choices);
  if (choice === "View Architecture") {
    await focusArchFromStatusBar(context);
    return;
  }
  if (choice !== "View Risk")
    return;
  const top = snapshot ? Array.from(snapshot.byId.values()).sort((a, b) => b.score - a.score)[0] : void 0;
  await focusRiskFromStatusBar(context, top?.id);
}
function invalidateRisk() {
  riskSnapshotDirty = true;
  updateRiskStatusBar();
}
function refreshCochangeFromHistory() {
  if (!commitIndex || !cachedGraphData)
    return;
  const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
  if (!workspaceFolder2)
    return;
  try {
    const linkedPairs = [];
    for (const link of cachedGraphData.links) {
      const source = typeof link.source === "object" ? link.source.id : link.source;
      const target = typeof link.target === "object" ? link.target.id : link.target;
      if (source && target)
        linkedPairs.push([source, target]);
    }
    const result = computeCochange(commitIndex.commits, {
      windowDays: 365,
      minCochanges: 2,
      minJaccard: 0.2,
      maxFilesPerCommit: 50,
      maxPairs: 500,
      linkedPairs,
      allowedPaths: cachedGraphData.nodes.map((node) => node.id)
    });
    if (graphDb)
      graphDb.replaceCochange(result.pairs, result.windowDays);
    const payload = {
      windowDays: result.windowDays,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      commitsConsidered: result.commitsConsidered,
      totalCommitsInWindow: result.totalCommitsInWindow,
      maxJaccard: result.maxJaccard,
      pairs: result.pairs
    };
    const historyDir = path4.join(workspaceFolder2.uri.fsPath, ".aura", "history");
    void fs2.mkdir(historyDir, { recursive: true }).then(() => fs2.writeFile(path4.join(historyDir, "cochange.json"), JSON.stringify(payload, null, 2), "utf-8")).catch((err2) => console.warn("[aura] cochange snapshot write failed:", err2));
  } catch (err2) {
    console.warn("[aura] cochange computation failed:", err2);
  }
}
function ensureRiskSnapshot() {
  if (!cachedGraphData || cachedGraphData.nodes.length === 0)
    return void 0;
  if (!riskSnapshotDirty && riskSnapshot)
    return riskSnapshot;
  const days = normalizeRiskWindow(
    vscode10.workspace.getConfiguration("auraVisualizer").get("riskWindow", 90)
  );
  riskSnapshot = buildRiskSnapshot(
    cachedGraphData.nodes.filter((node) => node.language !== "documentation"),
    commitIndex?.commits ?? [],
    days,
    Date.now(),
    vscode10.workspace.getConfiguration("auraVisualizer").get("riskCentrality", false) === true
  );
  riskSnapshotDirty = false;
  return riskSnapshot;
}
function updateRiskStatusBar() {
  if (!riskStatusBarItem)
    return;
  const snapshot = ensureRiskSnapshot();
  if (!snapshot || snapshot.byId.size === 0) {
    riskStatusBarItem.hide();
    return;
  }
  const hotspots = dirtyHotspotIds(snapshot);
  if (hotspots.length > 0) {
    riskStatusBarItem.text = `$(warning) ${hotspots.length} hotspot${hotspots.length > 1 ? "s" : ""} in your changes`;
    const md = new vscode10.MarkdownString();
    md.appendMarkdown(`**${hotspots.length} high-risk file${hotspots.length > 1 ? "s" : ""} in your current changes**

`);
    const shown = hotspots.slice(0, 5);
    for (const h of shown) {
      const entry2 = snapshot.byId.get(h);
      md.appendMarkdown(`- \`${h}\`${entry2 ? ` \u2014 risk ${Math.round(entry2.score)}/100` : ""}
`);
    }
    if (hotspots.length > shown.length) {
      md.appendMarkdown(`
\u2026 and ${hotspots.length - shown.length} more`);
    }
    riskStatusBarItem.tooltip = md;
    riskStatusBarItem.backgroundColor = new vscode10.ThemeColor("statusBarItem.warningBackground");
    riskStatusBarItem.command = { command: "auraVisualizer.statusBarRisk", title: "Reveal in Risk tab", arguments: [hotspots[0]] };
    riskStatusBarItem.show();
    return;
  }
  riskStatusBarItem.backgroundColor = void 0;
  const ws = vscode10.workspace.workspaceFolders?.[0];
  const editor = vscode10.window.activeTextEditor;
  if (!ws || !editor) {
    riskStatusBarItem.hide();
    return;
  }
  const rel = path4.relative(ws.uri.fsPath, editor.document.uri.fsPath);
  if (rel.startsWith("..") || path4.isAbsolute(rel)) {
    riskStatusBarItem.hide();
    return;
  }
  const relNorm = rel.split(path4.sep).join("/");
  const entry = snapshot.byId.get(relNorm) || snapshot.byId.get(rel);
  if (!entry) {
    riskStatusBarItem.hide();
    return;
  }
  riskStatusBarItem.text = `$(shield) Risk ${Math.round(entry.score)}${entry.topLabel ? " \xB7 " + entry.topLabel : ""}`;
  riskStatusBarItem.tooltip = buildRiskTooltip(entry, relNorm);
  riskStatusBarItem.command = { command: "auraVisualizer.statusBarRisk", title: "Reveal in Risk tab", arguments: [entry.id] };
  riskStatusBarItem.show();
}
function buildRiskTooltip(entry, relPath) {
  const md = new vscode10.MarkdownString();
  md.appendMarkdown(`**Risk ${Math.round(entry.score)}/100**`);
  if (entry.topLabel)
    md.appendMarkdown(` \u2014 ${entry.topLabel} of this repository`);
  md.appendMarkdown("\n\n");
  for (const r of entry.reasons.slice(0, 5)) {
    md.appendMarkdown(`- ${r.text}
`);
  }
  md.appendMarkdown(`
\`${relPath}\` \u2014 click to reveal in the Risk tab`);
  return md;
}
function updateArchStatusBar() {
  if (!archStatusBarItem)
    return;
  const ws = vscode10.workspace.workspaceFolders?.[0];
  const editor = vscode10.window.activeTextEditor;
  if (!ws || !editor || !cachedGraphData || !archRules || editor.document.uri.scheme !== "file") {
    archStatusBarItem.hide();
    return;
  }
  const rel = path4.relative(ws.uri.fsPath, editor.document.uri.fsPath);
  if (rel.startsWith("..") || path4.isAbsolute(rel)) {
    archStatusBarItem.hide();
    return;
  }
  const relNorm = rel.split(path4.sep).join("/");
  const node = cachedGraphData.nodes.find((n) => (n.path || n.id).replace(/\\/g, "/") === relNorm);
  if (!node || node.language === "documentation") {
    archStatusBarItem.hide();
    return;
  }
  const violations = archEvaluation ? archEvaluation.violations.filter((v) => !v.baselined && v.source === relNorm) : [];
  const baselined = archEvaluation ? archEvaluation.violations.filter((v) => v.baselined && v.source === relNorm).length : 0;
  if (!node.layer && violations.length === 0) {
    if (archRules.strict) {
      archStatusBarItem.text = "$(symbol-structure) unlayered";
      archStatusBarItem.tooltip = "Strict mode: this file matches no layer in .aura/arch-rules.json.";
      archStatusBarItem.backgroundColor = new vscode10.ThemeColor("statusBarItem.warningBackground");
      archStatusBarItem.command = {
        command: "auraVisualizer.statusBarArch",
        title: "Reveal in Architecture tab",
        arguments: [relNorm]
      };
      archStatusBarItem.show();
      return;
    }
    archStatusBarItem.hide();
    return;
  }
  const errors = violations.filter((v) => v.severity === "error").length;
  if (violations.length > 0) {
    archStatusBarItem.text = `$(symbol-structure) ${violations.length} arch violation${violations.length === 1 ? "" : "s"}`;
  } else {
    archStatusBarItem.text = `$(symbol-structure) ${node.layer}`;
  }
  const md = new vscode10.MarkdownString();
  md.appendMarkdown(`**Layer: ${node.layer || "unlayered"}**

`);
  if (violations.length > 0) {
    for (const violation of violations.slice(0, 6)) {
      md.appendMarkdown(`- \`${violation.ruleId}\`: ${violation.sourceGroup || "?"} \u2192 ${violation.targetGroup || "?"} \`${violation.linkTypes.join(", ")}\`
`);
      md.appendMarkdown(`  ${violation.target}
`);
    }
    if (violations.length > 6)
      md.appendMarkdown(`
\u2026 and ${violations.length - 6} more`);
  } else {
    md.appendMarkdown("No violation where this file is the source.\n");
  }
  if (baselined > 0) {
    md.appendMarkdown(`
${baselined} baselined violation${baselined === 1 ? "" : "s"} (not alerting).`);
  }
  md.appendMarkdown("\n\nClick to reveal in the Architecture tab.");
  archStatusBarItem.tooltip = md;
  archStatusBarItem.backgroundColor = errors > 0 ? new vscode10.ThemeColor("statusBarItem.errorBackground") : violations.length > 0 ? new vscode10.ThemeColor("statusBarItem.warningBackground") : void 0;
  archStatusBarItem.command = {
    command: "auraVisualizer.statusBarArch",
    title: "Reveal in Architecture tab",
    arguments: [relNorm]
  };
  archStatusBarItem.show();
}
function toWorkspaceRelative(repoRelative) {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws || !gitRepoRoot)
    return void 0;
  const rel = path4.relative(ws.uri.fsPath, path4.join(gitRepoRoot, repoRelative));
  if (rel.startsWith("..") || path4.isAbsolute(rel))
    return void 0;
  return rel.split(path4.sep).join("/");
}
function dirtyHotspotIds(snapshot) {
  if (workingTreeFiles.size === 0)
    return [];
  const ids = [];
  for (const repoRel of workingTreeFiles.keys()) {
    const wsRel = toWorkspaceRelative(repoRel);
    if (wsRel && snapshot.highIds.has(wsRel))
      ids.push(wsRel);
  }
  ids.sort((a, b) => (snapshot.byId.get(b)?.score ?? 0) - (snapshot.byId.get(a)?.score ?? 0));
  return ids;
}
function buildWorkingTreePayload() {
  const files = {};
  for (const [repoRel, state] of workingTreeFiles) {
    const wsRel = toWorkspaceRelative(repoRel);
    if (wsRel)
      files[wsRel] = state;
  }
  return files;
}
var lastWorkingTreeJson;
function pushWorkingTreeToWebview() {
  const payload = buildWorkingTreePayload();
  const json2 = JSON.stringify(payload);
  if (json2 === lastWorkingTreeJson)
    return;
  lastWorkingTreeJson = json2;
  webviewProvider?.sendWorkingTree(payload);
}
function hostDataAccessors() {
  return {
    riskSnapshot: () => ensureRiskSnapshot(),
    workingTree: () => buildWorkingTreePayload()
  };
}
async function refreshWorkingTree() {
  const ws = vscode10.workspace.workspaceFolders?.[0];
  if (!ws) {
    workingTreeFiles = /* @__PURE__ */ new Map();
    pushWorkingTreeToWebview();
    updateRiskStatusBar();
    return;
  }
  try {
    if (gitRepoRoot === void 0) {
      try {
        gitRepoRoot = await getGitRoot(ws.uri.fsPath);
      } catch {
        gitRepoRoot = "";
      }
    }
    workingTreeFiles = gitRepoRoot ? await getWorkingTreeFiles(ws.uri.fsPath) : /* @__PURE__ */ new Map();
  } catch {
    workingTreeFiles = /* @__PURE__ */ new Map();
  }
  pushWorkingTreeToWebview();
  updateRiskStatusBar();
}
function scheduleWorkingTreeRefresh() {
  if (workingTreeTimer)
    clearTimeout(workingTreeTimer);
  workingTreeTimer = setTimeout(() => {
    void refreshWorkingTree();
  }, 300);
}
async function focusRiskFromStatusBar(context, nodeId) {
  const wasOpen = webviewProvider?.isOpen ?? false;
  if (!webviewProvider) {
    webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
    registerOpenFileHandler();
  }
  webviewProvider.show();
  if (!wasOpen && cachedGraphData) {
    webviewProvider.sendGraphData(cachedGraphData);
    if (commitIndex) {
      webviewProvider.sendHistoryIndex(commitIndex);
      for (const delta of cachedDeltas) {
        webviewProvider.sendHistoryDelta(delta);
      }
    }
  }
  if (nodeId) {
    webviewProvider.focusRiskFile(nodeId);
  } else {
    webviewProvider.showRiskTab();
  }
}
async function focusArchFromStatusBar(context, nodeId) {
  const wasOpen = webviewProvider?.isOpen ?? false;
  if (!webviewProvider) {
    webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
    registerOpenFileHandler();
  }
  webviewProvider.show();
  if (!wasOpen && cachedGraphData) {
    webviewProvider.sendGraphData(cachedGraphData);
    if (commitIndex) {
      webviewProvider.sendHistoryIndex(commitIndex);
      for (const delta of cachedDeltas) {
        webviewProvider.sendHistoryDelta(delta);
      }
    }
  }
  if (nodeId) {
    webviewProvider.focusArchFile(nodeId);
  } else {
    webviewProvider.showArchTab();
  }
}
async function startHistoryScan(context, rootPath, excludePaths) {
  const isGit = await isGitRepo(rootPath);
  if (!isGit)
    return;
  if (historyWorker) {
    historyWorker.terminate();
    historyWorker = void 0;
  }
  cachedDeltas = [];
  const historyDir = path4.join(rootPath, ".aura", "history");
  const workerPath = path4.join(context.extensionUri.fsPath, "out", "history-worker.js");
  historyWorker = new import_worker_threads2.Worker(workerPath, {
    execArgv: [],
    workerData: {
      rootPath,
      skipDirs: excludePaths,
      historyDir
    }
  });
  historyWorker.on("message", (msg) => {
    switch (msg.type) {
      case "index":
        commitIndex = msg.payload;
        invalidateRisk();
        refreshCochangeFromHistory();
        if (webviewProvider) {
          webviewProvider.sendHistoryIndex(commitIndex);
        }
        break;
      case "progress": {
        const progress = msg.payload;
        if (webviewProvider) {
          webviewProvider.sendHistoryProgress(progress.scanned, progress.total);
        }
        break;
      }
      case "delta": {
        const delta = msg.payload;
        cachedDeltas.push(delta);
        if (webviewProvider) {
          webviewProvider.sendHistoryDelta(delta);
        }
        break;
      }
      case "done":
        break;
      case "error":
        break;
    }
  });
  historyWorker.on("error", () => {
  });
  historyWorker.on("exit", () => {
    historyWorker = void 0;
  });
}
function focusCurrentFile() {
  const editor = vscode10.window.activeTextEditor;
  if (!editor || !webviewProvider?.isVisible)
    return;
  const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
  if (!workspaceFolder2)
    return;
  const relativePath = path4.relative(workspaceFolder2.uri.fsPath, editor.document.uri.fsPath);
  if (!relativePath.startsWith("..")) {
    webviewProvider.focusNode(relativePath, true);
  }
}
async function blastRadiusCurrentFile(context) {
  const editor = vscode10.window.activeTextEditor;
  const workspaceFolder2 = vscode10.workspace.workspaceFolders?.[0];
  if (!editor || !workspaceFolder2)
    return;
  const relativePath = path4.relative(workspaceFolder2.uri.fsPath, editor.document.uri.fsPath);
  if (relativePath.startsWith(".."))
    return;
  if (!webviewProvider) {
    webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
    registerOpenFileHandler();
  }
  webviewProvider.show();
  if (cachedGraphData) {
    webviewProvider.sendGraphData(cachedGraphData);
    if (commitIndex) {
      webviewProvider.sendHistoryIndex(commitIndex);
      for (const delta of cachedDeltas) {
        webviewProvider.sendHistoryDelta(delta);
      }
    }
  }
  webviewProvider.sendBlastRadius(relativePath);
}
async function exportMetrics() {
  if (!cachedGraphData) {
    vscode10.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");
    return;
  }
  const snapshot = ensureRiskSnapshot();
  const rows = cachedGraphData.nodes.map((node) => {
    const risk = snapshot?.byId.get(node.id);
    return {
      file: node.id,
      name: node.name,
      language: node.language,
      group: node.group,
      lines: node.linesOfCode,
      complexity: node.complexity,
      cognitive: node.cognitive,
      fanIn: node.fanIn,
      fanOut: node.fanOut,
      churn: risk?.churn ?? 0,
      authors: risk?.authorCount ?? 0,
      riskScore: risk?.score ?? null,
      riskBucket: risk?.bucket ?? null
    };
  });
  const format = await vscode10.window.showQuickPick(
    [
      { label: "CSV", description: "Spreadsheet-friendly, stable columns", value: "csv" },
      { label: "JSON", description: "Versioned envelope with rows and columns", value: "json" }
    ],
    { placeHolder: "Aura: metrics export format" }
  );
  if (!format)
    return;
  if (format.value === "csv") {
    await saveOrCopyText("Metrics CSV", metricsToCsv(rows), "metrics.csv", { CSV: ["csv"] });
  } else {
    await saveOrCopyText("Metrics JSON", metricsToJson(rows), "metrics.json", { JSON: ["json"] });
  }
}
async function exportArchReport(includeAiNarrative = false) {
  if (!cachedGraphData) {
    vscode10.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");
    return;
  }
  const report = generateArchReport(buildArchReportInput(cachedGraphData, archReportExtras()), {
    maxLines: 400,
    includePaths: true
  });
  const narrative = includeAiNarrative ? await vscode10.window.withProgress(
    {
      location: vscode10.ProgressLocation.Notification,
      title: "Aura: generating AI architecture narrative\u2026",
      cancellable: true
    },
    (_progress, token) => generateArchitectureNarrative(report, token)
  ) : void 0;
  if (includeAiNarrative && !narrative) {
    void vscode10.window.showWarningMessage("Aura: AI narrative unavailable \u2014 exporting the deterministic report only.");
  }
  const finalReport = narrative ? withAiNarrative(report, narrative) : report;
  if (includeAiNarrative) {
    await saveText("Architecture report", finalReport, {
      fileName: "architecture.md",
      askLocation: true,
      filters: { Markdown: ["md"] }
    });
  } else {
    await saveOrCopyText("Architecture report", finalReport, "architecture.md", { Markdown: ["md"] });
  }
}
function archReportExtras() {
  if (!graphDb)
    return {};
  try {
    const groups = /* @__PURE__ */ new Map();
    for (const community of graphDb.getCommunities()) {
      const files = groups.get(community.community) || [];
      files.push(community.nodeId);
      groups.set(community.community, files);
    }
    const modules = Array.from(groups.entries()).map(([id, files]) => ({
      id,
      name: files.reduce((best, file) => {
        const name = file.replace(/.*\//, "");
        return name.length < best.length ? name : best;
      }, files[0] || "?").replace(/\.[^.]+$/, ""),
      files,
      size: files.length
    })).sort((a, b) => b.size - a.size);
    return {
      modules,
      cycles: graphDb.getCycles(),
      deadCode: graphDb.getDeadCode().map((d) => ({ file: d.nodeId, symbol: d.symbol, kind: d.kind })),
      hotspots: graphDb.getHotspots(20, "impact").map((h) => ({
        file: h.id,
        lines: h.lines,
        complexity: h.complexity,
        fanIn: h.fan_in,
        fanOut: h.fan_out,
        impact: h.impact_score
      }))
    };
  } catch (err2) {
    console.warn("[aura] architecture report data unavailable:", err2);
    return {};
  }
}
async function exportGraphImage(context) {
  if (!cachedGraphData) {
    vscode10.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");
    return;
  }
  if (!webviewProvider)
    await openVisualizer(context);
  if (!webviewProvider)
    return;
  const resolution = await vscode10.window.showQuickPick(
    [
      { label: "PNG \xD72", description: "Recommended \u2014 sharp and reasonably small", value: 2 },
      { label: "PNG \xD74", description: "Maximum detail \u2014 larger file", value: 4 },
      { label: "PNG \xD71", description: "Screen resolution", value: 1 }
    ],
    { placeHolder: "Aura: PNG resolution" }
  );
  if (!resolution)
    return;
  const background = await vscode10.window.showQuickPick(
    [
      { label: "Current background", value: "current" },
      { label: "Transparent background", value: "transparent" }
    ],
    { placeHolder: "Aura: PNG background" }
  );
  if (!background)
    return;
  const watermark = await vscode10.window.showQuickPick(
    [
      { label: "No watermark", value: false },
      { label: "Aura watermark", value: true }
    ],
    { placeHolder: "Aura: watermark" }
  );
  if (!watermark)
    return;
  webviewProvider.captureGraphImage({
    scale: resolution.value,
    background: background.value,
    watermark: watermark.value
  });
}
async function exportGraph() {
  if (!cachedGraphData) {
    vscode10.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");
    return;
  }
  const format = await vscode10.window.showQuickPick(
    [
      { label: "Markdown", description: "Readable architecture briefing for a chat prompt", value: "markdown" },
      { label: "JSON", description: "Structured sections for tools and agents", value: "json" }
    ],
    { placeHolder: "Aura: AI context format" }
  );
  if (!format)
    return;
  const sectionChoices = [
    { id: "modules", label: "Modules", description: "Modules, key files and inter-module dependencies", picked: true },
    { id: "contracts", label: "Contracts", description: "Public symbols, exported APIs and header declarations", picked: true },
    { id: "hotspots", label: "Hotspots", description: "Highest-impact files with metrics and reasons", picked: true },
    { id: "cycles", label: "Cycles", description: "Circular dependencies", picked: true },
    { id: "deadCode", label: "Dead code", description: "Unused exports and symbols", picked: true }
  ];
  const selected = await vscode10.window.showQuickPick(sectionChoices, {
    canPickMany: true,
    placeHolder: "Aura: sections to include in the AI context"
  });
  if (!selected || selected.length === 0) {
    vscode10.window.showWarningMessage("Aura: Select at least one section to export.");
    return;
  }
  const budget = await vscode10.window.showQuickPick(
    [
      { label: "4,000 tokens", description: "Recommended \u2014 enough context for most prompts", value: 4e3 },
      { label: "2,000 tokens", description: "Compact \u2014 quick architecture summary", value: 2e3 },
      { label: "8,000 tokens", description: "Detailed \u2014 more modules, contracts and hotspots", value: 8e3 },
      { label: "16,000 tokens", description: "Large context window", value: 16e3 },
      { label: "No limit", description: "Everything (may exceed a model context window)", value: 0 }
    ],
    { placeHolder: "Aura: token budget" }
  );
  if (!budget)
    return;
  const input = buildAiExportInput(cachedGraphData, archReportExtras());
  const content = generateAiExport(input, {
    format: format.value,
    sections: selected.map((item) => item.id),
    tokenBudget: budget.value,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const isMarkdown = format.value === "markdown";
  await saveOrCopyText(
    isMarkdown ? "AI context (Markdown)" : "AI context (JSON)",
    content,
    isMarkdown ? "ai-context.md" : "ai-context.json",
    isMarkdown ? { Markdown: ["md"] } : { JSON: ["json"] }
  );
}
function setupFileWatcher(context) {
  const config = vscode10.workspace.getConfiguration("auraVisualizer");
  const autoRefresh = config.get("autoRefresh", true);
  if (!autoRefresh)
    return;
  fileWatcher = vscode10.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");
  let pendingUpdates = /* @__PURE__ */ new Map();
  const flushUpdates = () => {
    if (refreshTimeout)
      clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(async () => {
      const updates = new Map(pendingUpdates);
      pendingUpdates.clear();
      if (cachedFiles.length === 0) {
        if (webviewProvider?.isVisible) {
          refreshAnalysis(context);
        } else {
          cachedGraphData = void 0;
        }
        return;
      }
      for (const [, update] of updates) {
        await incrementalUpdate(update.uri, update.deleted);
      }
    }, 500);
  };
  fileWatcher.onDidChange((uri) => {
    pendingUpdates.set(uri.fsPath, { uri, deleted: false });
    flushUpdates();
  });
  fileWatcher.onDidCreate((uri) => {
    pendingUpdates.set(uri.fsPath, { uri, deleted: false });
    flushUpdates();
  });
  fileWatcher.onDidDelete((uri) => {
    pendingUpdates.set(uri.fsPath, { uri, deleted: true });
    flushUpdates();
  });
  context.subscriptions.push(fileWatcher);
}
function setupArchitectureWatcher(context) {
  let timer;
  const schedule = () => {
    if (timer)
      clearTimeout(timer);
    timer = setTimeout(() => {
      timer = void 0;
      reloadArchitecture();
    }, 250);
  };
  for (const glob of ["**/.aura/arch-rules.json", "**/.aura/arch-baseline.json"]) {
    const watcher = vscode10.workspace.createFileSystemWatcher(glob);
    watcher.onDidChange(schedule);
    watcher.onDidCreate(schedule);
    watcher.onDidDelete(schedule);
    context.subscriptions.push(watcher);
  }
  context.subscriptions.push({ dispose: () => {
    if (timer)
      clearTimeout(timer);
  } });
}
function setupGitStateWatcher(context) {
  const gitWatcher = vscode10.workspace.createFileSystemWatcher("**/.git/**");
  const schedule = () => scheduleWorkingTreeRefresh();
  gitWatcher.onDidChange(schedule);
  gitWatcher.onDidCreate(schedule);
  gitWatcher.onDidDelete(schedule);
  context.subscriptions.push(gitWatcher);
}
function deactivate() {
  webviewProvider?.dispose();
  fileWatcher?.dispose();
  codeLensProvider?.dispose();
  codeLensProvider = void 0;
  if (refreshTimeout)
    clearTimeout(refreshTimeout);
  if (workingTreeTimer)
    clearTimeout(workingTreeTimer);
  if (startupWorkingTreeTimer)
    clearTimeout(startupWorkingTreeTimer);
  if (historyWorker) {
    historyWorker.terminate();
    historyWorker = void 0;
  }
  if (graphDb) {
    graphDb.close();
    graphDb = void 0;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
