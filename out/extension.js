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
var vscode3 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs/promises"));
var import_worker_threads = require("worker_threads");

// src/webview/WebviewProvider.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var WebviewProvider = class _WebviewProvider {
  static viewType = "auraVisualizer.graphView";
  panel;
  extensionUri;
  workspaceState;
  disposables = [];
  onOpenFileEmitter = new vscode.EventEmitter();
  onOpenFile = this.onOpenFileEmitter.event;
  onDisposeEmitter = new vscode.EventEmitter();
  onDidDispose = this.onDisposeEmitter.event;
  pendingData;
  pendingHistoryIndex;
  pendingDeltas = [];
  webviewReady = false;
  static VIEW_STATE_KEY = "aura.viewState";
  constructor(extensionUri, workspaceState) {
    this.extensionUri = extensionUri;
    this.workspaceState = workspaceState;
  }
  show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return this.panel;
    }
    this.panel = vscode.window.createWebviewPanel(
      _WebviewProvider.viewType,
      "Aura \u2014 3D Visualizer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "out", "webview")
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
        vscode.Uri.joinPath(this.extensionUri, "out", "webview")
      ]
    };
    this.initPanel();
  }
  initPanel() {
    if (!this.panel)
      return;
    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, "resources", "aura-star-icon.png");
    this.panel.webview.html = this.getHtmlContent(this.panel.webview);
    this.setupMessageHandler();
    this.panel.onDidDispose(() => {
      this.panel = void 0;
      this.webviewReady = false;
      this.pendingDeltas = [];
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
            if (this.pendingData) {
              this.panel?.webview.postMessage({ type: "graphData", payload: this.pendingData });
            }
            if (this.pendingHistoryIndex) {
              this.panel?.webview.postMessage({ type: "historyIndex", payload: this.pendingHistoryIndex });
            }
            for (const delta of this.pendingDeltas) {
              this.panel?.webview.postMessage({ type: "historyDelta", payload: delta });
            }
            break;
          case "openFile":
            if (message.payload) {
              this.onOpenFileEmitter.fire({
                path: message.payload.path,
                line: message.payload.line
              });
            }
            break;
          case "requestRefresh":
            vscode.commands.executeCommand("auraVisualizer.refresh");
            break;
          case "requestExport":
            vscode.commands.executeCommand("auraVisualizer.exportGraph");
            break;
          case "saveViewState":
            if (message.payload) {
              this.workspaceState.update(_WebviewProvider.VIEW_STATE_KEY, message.payload);
            }
            break;
          case "requestViewState":
            this.sendSavedViewState();
            break;
        }
      },
      null,
      this.disposables
    );
  }
  sendGraphData(data) {
    this.pendingData = data;
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "graphData", payload: data });
    }
  }
  sendSavedViewState() {
    const state = this.workspaceState.get(_WebviewProvider.VIEW_STATE_KEY);
    if (state) {
      this.panel?.webview.postMessage({ type: "restoreViewState", payload: state });
    }
  }
  sendGraphDelta(delta) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "updateGraph", payload: delta });
    }
  }
  sendProgress(phase, message) {
    this.panel?.webview.postMessage({ type: "progress", payload: { phase, message } });
  }
  focusNode(nodeId) {
    this.panel?.webview.postMessage({ type: "focusNode", payload: { nodeId } });
  }
  sendBlastRadius(nodeId) {
    this.panel?.webview.postMessage({ type: "blastRadius", payload: { nodeId } });
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
  dispose() {
    this.panel?.dispose();
  }
  getHtmlContent(webview) {
    const webviewPath = path.join("out", "webview");
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "css", "style.css")
    );
    const appUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "js", "app.js")
    );
    const configUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "js", "graph-config.js")
    );
    const forceGraphUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "lib", "3d-force-graph.min.js")
    );
    const threeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "lib", "three.global.js")
    );
    const nonce = getNonce();
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
                </div>
                <button id="btn-export" class="top-btn" title="Export graph for AI">\u{1F4E4} Export</button>
                <button id="btn-refresh" class="top-btn" title="Refresh analysis">\u{1F504} Refresh</button>
            </div>
        </header>

        <!-- Middle Row: Explorer + Graph + Detail -->
        <div id="middle-row">
            <!-- Explorer Panel -->
            <aside id="explorer-panel" class="collapsed">
                <div class="explorer-header"><h3>Files</h3></div>
                <div id="explorer-tree" class="explorer-tree"></div>
            </aside>

            <!-- 3D Graph Container -->
            <div id="graph-container">
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
        <div class="panel-section">
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
                <div class="panel-metric">
                    <span class="metric-label">Symbols</span>
                    <span class="metric-value" id="panel-symbols-count">\u2014</span>
                </div>
            </div>
        </div>
        <div class="panel-section" id="symbols-section" style="display:none">
            <h3>Symbols <span id="symbols-total" class="count-badge">0</span></h3>
            <div id="symbols-list" class="symbols-list"></div>
        </div>
        <div class="panel-section">
            <h3>Dependencies <span id="deps-count" class="count-badge">0</span></h3>
            <ul id="panel-deps" class="panel-list"></ul>
        </div>
        <div class="panel-section">
            <h3>Dependents <span id="dependents-count" class="count-badge">0</span></h3>
            <ul id="panel-dependents" class="panel-list"></ul>
        </div>
    </aside>
    </div><!-- /middle-row -->

    <!-- Timeline Bar (Time Travel) -->
    <div id="timeline-bar" class="hidden">
        <button id="timeline-prev" class="timeline-btn" title="Previous commit (\u2190)">\u25C0</button>
        <button id="timeline-next" class="timeline-btn" title="Next commit (\u2192)">\u25B6</button>
        <button id="timeline-impact" class="timeline-btn impact-btn" title="Show impact cascade (I)">\u{1F4A5}</button>
        <input type="range" id="timeline-slider" min="0" max="0" value="0" step="1">
        <div id="timeline-info">
            <span id="timeline-hash">\u2014</span>
            <span id="timeline-message">\u2014</span>
            <span id="timeline-date">\u2014</span>
        </div>
        <div id="timeline-progress" class="hidden">
            <span id="timeline-progress-text">\u23F3 0/0</span>
        </div>
    </div>

    <!-- Bottom Filter Bar -->
    <footer id="filter-bar">
        <div class="filter-group" id="language-filters">
            <button class="filter-btn active" data-lang="c-source" data-color="#4fc3f7">
                <span class="filter-dot" style="background:#4fc3f7"></span> .c
            </button>
            <button class="filter-btn active" data-lang="c-header" data-color="#81d4fa">
                <span class="filter-dot" style="background:#81d4fa"></span> .h
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
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <button class="filter-btn" id="btn-dag-mode" title="Hierarchical mode">\u229E DAG</button>
            <button class="filter-btn" id="btn-highlight-orphans" title="Orphan nodes">\u25CE Orphans</button>
            <button class="filter-btn" id="btn-dead-code" title="Dead code detection">\u2620\uFE0F Dead</button>
            <button class="filter-btn" id="btn-cycles" title="Circular dependencies">\u{1F504} Cycles</button>
            <button class="filter-btn" id="btn-group-dirs" title="Group by directory">\u{1F4C1} Groups</button>
            <button class="filter-btn" id="btn-path-mode" title="Find path between 2 nodes">\u{1F517} Path</button>
            <button class="filter-btn" id="btn-labels" title="Show file names">\u{1F3F7}\uFE0F Names</button>
            <button class="filter-btn" id="btn-recenter" title="Recenter view">\u{1F3AF} Center</button>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <select id="heatmap-select" class="filter-select" title="Coloring mode">
                <option value="off">\u{1F3A8} By language</option>
                <option value="complexity">\u{1F525} Complexity</option>
                <option value="fanIn">\u{1F4E5} Fan-in</option>
                <option value="fanOut">\u{1F4E4} Fan-out</option>
                <option value="loc">\u{1F4CF} Lines of code</option>
                <option value="lastModified">\u{1F4C6} Last update</option>
                <option value="community">\u{1F9E9} Communities</option>
            </select>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <label class="filter-label">
                Node size
                <input type="range" id="node-size-slider" min="1" max="10" value="4" step="0.5">
            </label>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <label class="filter-label">
                Spread
                <input type="range" id="spread-slider" min="1" max="5" value="1" step="0.5">
            </label>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
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

    <!-- Community Palette (overlay) -->
    <div id="community-palette" class="hidden">
        <div class="community-palette-header">
            <span>\u{1F9E9} Communities</span>
            <div class="community-palette-actions">
                <button id="community-select-all" title="Select all">All</button>
                <button id="community-select-none" title="Unselect all">None</button>
                <button id="community-palette-close" title="Close">\u2715</button>
            </div>
        </div>
        <div id="community-list"></div>
    </div>

    <!-- Tooltip (overlay, outside grid) -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">\u2014</div>
        <div class="tooltip-meta" id="tooltip-meta">\u2014</div>
    </div>

    <!-- Libraries: THREE must load before 3d-force-graph (it checks window.THREE) -->
    <script nonce="${nonce}" src="${threeUri}"></script>
    <script nonce="${nonce}" src="${forceGraphUri}"></script>
    <!-- App Logic -->
    <script nonce="${nonce}" src="${configUri}"></script>
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
var vscode2 = __toESM(require("vscode"));
var AuraTreeItem = class extends vscode2.TreeItem {
  constructor(entry, collapsible) {
    const label = entry.kind === "file" ? entry.node.name : entry.kind === "stat" ? `${entry.label}: ${entry.value}` : entry.label;
    super(label, collapsible);
    this.entry = entry;
    if (entry.kind === "header") {
      this.iconPath = new vscode2.ThemeIcon(entry.icon);
    } else if (entry.kind === "stat") {
      this.iconPath = new vscode2.ThemeIcon(entry.icon);
    } else if (entry.kind === "file") {
      this.description = entry.metric;
      this.iconPath = new vscode2.ThemeIcon("file");
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
  _onDidChangeTreeData = new vscode2.EventEmitter();
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
        vscode2.TreeItemCollapsibleState.None
      )];
    }
    if (!element) {
      return [
        new AuraTreeItem({ kind: "header", label: "Stats", icon: "graph" }, vscode2.TreeItemCollapsibleState.Expanded),
        new AuraTreeItem({ kind: "header", label: "Most Complex", icon: "flame" }, vscode2.TreeItemCollapsibleState.Collapsed),
        new AuraTreeItem({ kind: "header", label: "Largest Files", icon: "file-binary" }, vscode2.TreeItemCollapsibleState.Collapsed),
        new AuraTreeItem({ kind: "header", label: "Orphan Files", icon: "warning" }, vscode2.TreeItemCollapsibleState.Collapsed)
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
          vscode2.TreeItemCollapsibleState.None
        ));
      }
      case "Largest Files": {
        return [...d.nodes].sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 10).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: `${n.linesOfCode} lines` },
          vscode2.TreeItemCollapsibleState.None
        ));
      }
      case "Orphan Files": {
        return d.nodes.filter((n) => n.fanIn === 0 && n.fanOut === 0).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: n.language },
          vscode2.TreeItemCollapsibleState.None
        ));
      }
      default:
        return [];
    }
  }
  stat(label, value, icon) {
    return new AuraTreeItem(
      { kind: "stat", label, value, icon },
      vscode2.TreeItemCollapsibleState.None
    );
  }
};

// src/analyzer/scanner.ts
var import_promises = require("fs/promises");
var import_path = require("path");
var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".c", ".h", ".js", ".ts", ".py", ".css", ".html", ".htm", ".java", ".go", ".rs"]);
var LANGUAGE_MAP = {
  ".c": "c",
  ".h": "c",
  ".js": "javascript",
  ".ts": "typescript",
  ".py": "python",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
  ".java": "java",
  ".go": "go",
  ".rs": "rust"
};
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

// src/analyzer/graph-builder.ts
var import_path3 = require("path");

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
        } else if (pathNode.type === "system_lib_string" && includeSystem) {
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
        symbols.structs.push({ name: typeId.text, type: "typedef-struct" });
      } else {
        this.extractStruct(structSpec, symbols, "struct");
      }
      return;
    }
    const enumSpec = this.findDescendant(node, "enum_specifier");
    if (enumSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.enums.push({ name: typeId.text, type: "enum" });
      } else {
        this.extractEnum(enumSpec, symbols);
      }
    }
  }
  extractStruct(node, symbols, kind) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.structs.push({ name: nameNode.text, type: kind });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.enums.push({ name: nameNode.text, type: "enum" });
    }
  }
  extractMacro(node, symbols, isFunctionLike) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.macros.push({
        name: nameNode.text,
        type: isFunctionLike ? "function-macro" : "constant-macro"
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
            symbols.exports.push({ name: nameNode.text, type: "export-named" });
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
          symbols.exports.push({ name: child.text, type: "export-default" });
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
          symbols.exports.push({ name, type: "export-interface" });
          this.extractInterface(child, symbols);
        }
        return;
      }
      if (child.type === "type_alias_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-type-alias" });
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
              symbols.exports.push({ name: nameNode.text, type: "export-type" });
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
          symbols.exports.push({ name, type: "export-all" });
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
      symbols.exports.push({ name, type: "export-function" });
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
      symbols.exports.push({ name, type: "export-method" });
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
        symbols.exports.push({ name, type: "export-struct" });
      }
    } else if (defNode.type === "interface_type") {
      symbols.interfaces.push({ name, type: "interface", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-interface" });
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
      symbols.exports.push({ name, type: "export-function" });
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
      symbols.exports.push({ name, type: "export-struct" });
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
      symbols.exports.push({ name, type: "export-enum" });
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
      symbols.exports.push({ name, type: "export-trait" });
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

// src/analyzer/parsers/html-parser.ts
var SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
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
      new RegExp(SCRIPT_SRC_RE.source, "gi"),
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
var CSS_IMPORT_RE = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g;
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
      new RegExp(CSS_IMPORT_RE.source, "g"),
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
    case "javascript":
    case "typescript":
      return computeCJSComplexity(content);
    case "css":
      return computeCSSComplexity(content);
    case "html":
      return computeHTMLComplexity(content);
    default:
      return { complexity: 1, details: {} };
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

// src/analyzer/tree-sitter-loader.ts
var import_path2 = require("path");
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
  "css": "tree-sitter-css.wasm",
  "html": "tree-sitter-html.wasm"
};
var initialized = false;
var loadedLanguages = /* @__PURE__ */ new Map();
function getWasmDir() {
  const fs3 = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path2.join)(__dirname, "tree-sitter-wasms"),
    // bundled (.vsix)
    (0, import_path2.join)(__dirname, "..", "node_modules", "tree-sitter-wasms", "out"),
    // dev from out/
    resolve("node_modules", "tree-sitter-wasms", "out")
    // dev from project root (vitest)
  ];
  return candidates.find((p) => fs3.existsSync(p)) || candidates[0];
}
async function initTreeSitter() {
  if (initialized) {
    return;
  }
  const fs3 = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path2.join)(__dirname, "tree-sitter-wasms", "tree-sitter.wasm"),
    // bundled (.vsix)
    (0, import_path2.join)(__dirname, "..", "node_modules", "web-tree-sitter", "tree-sitter.wasm"),
    // dev from out/
    resolve("node_modules", "web-tree-sitter", "tree-sitter.wasm")
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
  const wasmPath = (0, import_path2.join)(wasmDir, file);
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
async function parseSource(languageId, source) {
  const parser = await createParser(languageId);
  const tree = parser.parse(source);
  if (!tree) {
    throw new Error(`Tree-sitter failed to parse source for language: ${languageId}`);
  }
  return tree;
}
function hasGrammar(languageId) {
  return languageId in GRAMMAR_FILES;
}

// src/analyzer/graph-builder.ts
var PARSERS = {
  "c": new TreeSitterCParser(),
  "javascript": new TreeSitterJSParser(),
  "typescript": new TreeSitterTSParser(),
  "python": new TreeSitterPyParser(),
  "java": new TreeSitterJavaParser(),
  "go": new TreeSitterGoParser(),
  "rust": new TreeSitterRustParser(),
  "html": new HTMLParser(),
  "css": new CSSParser()
};
function getParser(language) {
  return PARSERS[language];
}
async function preParseFiles(files) {
  const trees = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (hasGrammar(file.language)) {
      try {
        const tree = await parseSource(file.language, file.content);
        trees.set(file.id, tree);
      } catch {
      }
    }
  }
  return trees;
}
function resolveTarget(target, sourceId, fileMap) {
  if (fileMap.has(target))
    return target;
  const sourceDir = (0, import_path3.dirname)(sourceId);
  const relativePath = (0, import_path3.normalize)((0, import_path3.join)(sourceDir, target));
  if (fileMap.has(relativePath))
    return relativePath;
  const extensions = [".js", ".ts", ".py", ".c", ".h", ".css", ".html"];
  for (const ext of extensions) {
    if (fileMap.has(relativePath + ext))
      return relativePath + ext;
    if (fileMap.has(target + ext))
      return target + ext;
  }
  const indexPath = (0, import_path3.join)(relativePath, "index.js");
  if (fileMap.has(indexPath))
    return indexPath;
  const targetBasename = (0, import_path3.basename)(target);
  for (const [id, file] of fileMap) {
    if (file.name === targetBasename)
      return id;
  }
  for (const ext of extensions) {
    const nameWithExt = targetBasename + ext;
    for (const [id, file] of fileMap) {
      if (file.name === nameWithExt)
        return id;
    }
  }
  return null;
}
function findCycles(links) {
  const adj = /* @__PURE__ */ new Map();
  for (const link of links) {
    if (!adj.has(link.source))
      adj.set(link.source, []);
    adj.get(link.source).push(link.target);
  }
  const cycles = [];
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const stack = [];
  function dfs(node) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);
    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (inStack.has(next)) {
        const cycleStart = stack.indexOf(next);
        if (cycleStart >= 0) {
          const cycle = stack.slice(cycleStart);
          if (cycle.length >= 2) {
            cycles.push(cycle);
          }
        }
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    inStack.delete(node);
  }
  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cycle of cycles) {
    const sorted = [...cycle].sort();
    const key = sorted.join("|");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  }
  return unique;
}
function buildGraph(files, projectName = "Project", options = {}, astTrees) {
  const fileMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    fileMap.set(file.id, file);
  }
  const allRelations = [];
  for (const file of files) {
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (parser) {
      const relations = tree && parser.usesTreeSitter ? parser.parseAST(tree, file, options) : parser.parse(file, options);
      allRelations.push(...relations);
    }
  }
  const fileSymbols = /* @__PURE__ */ new Map();
  const LANG_FAMILY = {
    "c": "c",
    "javascript": "js",
    "typescript": "js",
    "python": "py",
    "java": "java",
    "go": "go",
    "rust": "rust"
  };
  const globalFunctionIndex = /* @__PURE__ */ new Map();
  const SYMBOL_LANGUAGES = /* @__PURE__ */ new Set(["c", "javascript", "typescript", "python", "java", "go", "rust"]);
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!parser)
      continue;
    const symbols = tree && parser.usesTreeSitter ? parser.extractSymbolsAST(tree, file) : parser.extractSymbols?.(file);
    if (!symbols)
      continue;
    fileSymbols.set(file.id, symbols);
    const family = LANG_FAMILY[file.language] || file.language;
    for (const func2 of symbols.functions) {
      const key = `${family}:${func2.name}`;
      if (!globalFunctionIndex.has(key)) {
        globalFunctionIndex.set(key, []);
      }
      globalFunctionIndex.get(key).push(file.id);
    }
  }
  const functionCallLinks = [];
  const HEADER_EXTS = /* @__PURE__ */ new Set([".h", ".hpp", ".d.ts"]);
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    if (HEADER_EXTS.has(file.extension))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!parser)
      continue;
    let calls;
    if (tree && parser.usesTreeSitter) {
      const tsParser = parser;
      calls = tsParser.extractCallsFromAST?.(tree) || [];
    } else {
      const regexParser = parser;
      calls = regexParser.extractCalls?.(file) || [];
    }
    const ownSymbols = fileSymbols.get(file.id);
    const ownFunctions = new Set(
      ownSymbols ? ownSymbols.functions.map((f) => f.name) : []
    );
    const family = LANG_FAMILY[file.language] || file.language;
    for (const callName of calls) {
      if (ownFunctions.has(callName))
        continue;
      const key = `${family}:${callName}`;
      const definedIn = globalFunctionIndex.get(key);
      if (definedIn) {
        for (const defFileId of definedIn) {
          if (defFileId !== file.id) {
            functionCallLinks.push({
              source: file.id,
              target: defFileId,
              type: "function-call",
              label: `${callName}()`
            });
          }
        }
      }
    }
  }
  const allCallSites = [];
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    if (HEADER_EXTS.has(file.extension))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!tree || !parser?.usesTreeSitter)
      continue;
    const sites = parser.extractCallSitesAST(tree, file);
    const family = LANG_FAMILY[file.language] || file.language;
    for (const site of sites) {
      if (site.isLocal) {
        allCallSites.push({
          callerFile: file.id,
          callerName: site.callerName,
          calleeFile: file.id,
          calleeName: site.calleeName,
          callLine: site.line
        });
      } else {
        const key = `${family}:${site.calleeName}`;
        const definedIn = globalFunctionIndex.get(key);
        if (definedIn) {
          for (const defFileId of definedIn) {
            if (defFileId !== file.id) {
              allCallSites.push({
                callerFile: file.id,
                callerName: site.callerName,
                calleeFile: defFileId,
                calleeName: site.calleeName,
                callLine: site.line
              });
            }
          }
        }
      }
    }
  }
  const heritageLinks = [];
  const symbolFileIndex = /* @__PURE__ */ new Map();
  for (const [fileId, symbols] of fileSymbols) {
    for (const cls of symbols.classes) {
      symbolFileIndex.set(cls.name, fileId);
    }
    for (const iface of symbols.interfaces || []) {
      symbolFileIndex.set(iface.name, fileId);
    }
    for (const trait of symbols.traits || []) {
      symbolFileIndex.set(trait.name, fileId);
    }
    for (const struct of symbols.structs) {
      symbolFileIndex.set(struct.name, fileId);
    }
  }
  for (const file of files) {
    const tree = astTrees?.get(file.id);
    if (!tree)
      continue;
    const parser = getParser(file.language);
    if (!parser)
      continue;
    const heritageRels = parser.extractHeritageRelations(tree, file);
    for (const rel of heritageRels) {
      const targetFileId = symbolFileIndex.get(rel.target);
      if (targetFileId && targetFileId !== file.id) {
        heritageLinks.push({
          source: file.id,
          target: targetFileId,
          type: rel.type,
          label: rel.label
        });
      }
    }
  }
  const complexityMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    const result = computeComplexity(file);
    complexityMap.set(file.id, result);
  }
  const links = [];
  const unresolvedCount = { count: 0, targets: [] };
  for (const relation of allRelations) {
    const resolvedTarget = resolveTarget(relation.target, relation.source, fileMap);
    if (resolvedTarget) {
      if (resolvedTarget !== relation.source) {
        links.push({
          source: relation.source,
          target: resolvedTarget,
          type: relation.type,
          label: relation.label
        });
      }
    } else {
      unresolvedCount.count++;
      if (unresolvedCount.targets.length < 20) {
        unresolvedCount.targets.push({ from: relation.source, ref: relation.target });
      }
    }
  }
  links.push(...functionCallLinks);
  links.push(...heritageLinks);
  const linkSet = /* @__PURE__ */ new Set();
  const uniqueLinks = links.filter((link) => {
    const key = `${link.source}|${link.target}|${link.type}`;
    if (linkSet.has(key))
      return false;
    linkSet.add(key);
    return true;
  });
  const fanOut = /* @__PURE__ */ new Map();
  const fanIn = /* @__PURE__ */ new Map();
  for (const link of uniqueLinks) {
    fanOut.set(link.source, (fanOut.get(link.source) || 0) + 1);
    fanIn.set(link.target, (fanIn.get(link.target) || 0) + 1);
  }
  const allCalledNames = /* @__PURE__ */ new Set();
  const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
  for (const file of files) {
    let m;
    const re = new RegExp(CALL_SCAN_RE.source, "gm");
    while ((m = re.exec(file.content)) !== null) {
      allCalledNames.add(m[1]);
    }
  }
  const deadExportsMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    const symbols = fileSymbols.get(file.id);
    if (!symbols)
      continue;
    const dead = [];
    for (const func2 of symbols.functions) {
      if (func2.name === "main")
        continue;
      if (func2.type === "dunder")
        continue;
      if (!allCalledNames.has(func2.name)) {
        dead.push(func2.name);
      }
    }
    for (const cls of symbols.classes) {
      if (!allCalledNames.has(cls.name)) {
        dead.push(cls.name);
      }
    }
    for (const exp of symbols.exports) {
      if (!allCalledNames.has(exp.name) && !dead.includes(exp.name)) {
        dead.push(exp.name);
      }
    }
    if (dead.length > 0) {
      deadExportsMap.set(file.id, dead);
    }
  }
  const nodes = files.map((f) => {
    const symbols = fileSymbols.get(f.id);
    const cmplx = complexityMap.get(f.id) || { complexity: 1, details: {} };
    const node = {
      id: f.id,
      name: f.name,
      path: f.path,
      language: f.language,
      extension: f.extension,
      size: f.size,
      linesOfCode: f.linesOfCode,
      lastModified: f.lastModified || 0,
      group: f.group,
      fanOut: fanOut.get(f.id) || 0,
      fanIn: fanIn.get(f.id) || 0,
      complexity: cmplx.complexity,
      complexityDetails: cmplx.details
    };
    if (symbols) {
      node.symbols = {
        functions: symbols.functions.map((fn) => ({
          name: fn.name,
          returnType: fn.returnType || "",
          params: fn.params || "",
          line: fn.line || 0,
          type: fn.type,
          visibility: fn.visibility,
          isStatic: fn.isStatic,
          isAsync: fn.isAsync
        })),
        structs: symbols.structs.map((s) => ({ name: s.name, type: s.type })),
        enums: symbols.enums.map((e) => ({ name: e.name, type: e.type })),
        macros: symbols.macros.slice(0, 30),
        classes: symbols.classes.map((c) => ({ name: c.name, type: c.type })),
        exports: symbols.exports.map((e) => ({ name: e.name, type: e.type })),
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
          isAsync: m.isAsync
        })),
        totalSymbols: symbols.functions.length + symbols.structs.length + symbols.enums.length + symbols.macros.length + symbols.classes.length + symbols.exports.length + (symbols.interfaces || []).length + (symbols.traits || []).length + (symbols.typeAliases || []).length + (symbols.methods || []).length
      };
    }
    const dead = deadExportsMap.get(f.id);
    if (dead && dead.length > 0) {
      node.deadExports = dead;
    }
    return node;
  });
  const langStats = {};
  for (const node of nodes) {
    if (!langStats[node.language]) {
      langStats[node.language] = { count: 0, totalLOC: 0, avgComplexity: 0 };
    }
    langStats[node.language].count++;
    langStats[node.language].totalLOC += node.linesOfCode;
    langStats[node.language].avgComplexity += node.complexity;
  }
  for (const lang in langStats) {
    langStats[lang].avgComplexity = Math.round(
      langStats[lang].avgComplexity / langStats[lang].count * 10
    ) / 10;
  }
  const groupSet = new Set(nodes.map((n) => n.group));
  const funcCallCount = uniqueLinks.filter((l) => l.type === "function-call").length;
  const heritageCount = uniqueLinks.filter((l) => l.type === "extends" || l.type === "implements").length;
  const deadCodeFiles = nodes.filter((n) => n.deadExports && n.deadExports.length > 0).length;
  const deadExportsTotal = nodes.reduce((sum, n) => sum + (n.deadExports ? n.deadExports.length : 0), 0);
  const cycles = findCycles(uniqueLinks);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
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
  return {
    meta: {
      projectName,
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalFiles: nodes.length,
      totalLinks: uniqueLinks.length,
      totalRelationsFound: allRelations.length,
      functionCallLinks: funcCallCount,
      heritageLinks: heritageCount,
      unresolvedReferences: unresolvedCount.count,
      unresolvedSamples: unresolvedCount.targets,
      deadCodeFiles,
      deadExportsTotal,
      cycles,
      languageStats: langStats,
      groups: [...groupSet].sort()
    },
    nodes,
    links: uniqueLinks,
    functionCalls: allCallSites
  };
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

// src/graph-db.ts
var import_sql = __toESM(require_sql_wasm());
var import_fs = require("fs");
var import_path4 = require("path");
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
    fan_in        INTEGER NOT NULL DEFAULT 0,
    fan_out       INTEGER NOT NULL DEFAULT 0,
    last_modified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
    source  TEXT NOT NULL,
    target  TEXT NOT NULL,
    type    TEXT NOT NULL,
    label   TEXT NOT NULL DEFAULT '',
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
    PRIMARY KEY (node_id, name, kind)
);

CREATE TABLE IF NOT EXISTS cycles (
    cycle_id  INTEGER NOT NULL,
    node_id   TEXT NOT NULL,
    position  INTEGER NOT NULL,
    PRIMARY KEY (cycle_id, position)
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS function_calls (
    caller_file  TEXT NOT NULL,
    caller_name  TEXT NOT NULL,
    callee_file  TEXT NOT NULL,
    callee_name  TEXT NOT NULL,
    call_line    INTEGER NOT NULL,
    PRIMARY KEY (caller_file, caller_name, callee_file, callee_name, call_line)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_symbols_node ON symbols(node_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_nodes_language ON nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_group ON nodes(group_name);
CREATE INDEX IF NOT EXISTS idx_fcalls_caller ON function_calls(caller_file, caller_name);
CREATE INDEX IF NOT EXISTS idx_fcalls_callee ON function_calls(callee_file, callee_name);
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
var GraphDB = class {
  db = null;
  dbPath = "";
  // ── Lifecycle ──────────────────────────────────────────────
  async open(dbPath) {
    let wasmPath = (0, import_path4.join)(__dirname, "sql-wasm.wasm");
    if (!(0, import_fs.existsSync)(wasmPath)) {
      wasmPath = (0, import_path4.join)((0, import_path4.dirname)(require.resolve("sql.js")), "sql-wasm.wasm");
    }
    const SQL = await (0, import_sql.default)({
      locateFile: () => wasmPath
    });
    this.dbPath = dbPath;
    if ((0, import_fs.existsSync)(dbPath)) {
      const fileBuffer = (0, import_fs.readFileSync)(dbPath);
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
    if ((0, import_fs.existsSync)(dbPath)) {
      const fileBuffer = (0, import_fs.readFileSync)(dbPath);
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
    (0, import_fs.writeFileSync)(this.dbPath, Buffer.from(data));
  }
  // ── Import (full replace after each analysis) ──────────────
  importGraphData(data) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      db.run("DELETE FROM symbols");
      db.run("DELETE FROM edges");
      db.run("DELETE FROM cycles");
      db.run("DELETE FROM nodes");
      db.run("DELETE FROM meta");
      db.run("DELETE FROM function_calls");
      for (const n of data.nodes) {
        db.run(
          "INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [n.id, n.name, n.language, n.extension, n.group, n.size, n.linesOfCode, n.complexity, n.fanIn, n.fanOut, n.lastModified]
        );
      }
      for (const e of data.links) {
        const src = typeof e.source === "object" ? e.source.id : e.source;
        const tgt = typeof e.target === "object" ? e.target.id : e.target;
        db.run(
          "INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)",
          [src, tgt, e.type, e.label || ""]
        );
      }
      const insertSymbol = "INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      for (const n of data.nodes) {
        if (!n.symbols)
          continue;
        const deadSet = new Set(n.deadExports || []);
        for (const fn of n.symbols.functions) {
          db.run(
            insertSymbol,
            [n.id, fn.name, fn.type || "function", fn.returnType || "", fn.params || "", fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || "public", fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0]
          );
        }
        for (const m of n.symbols.methods || []) {
          db.run(
            insertSymbol,
            [n.id, m.name, m.type || "method", m.returnType || "", m.params || "", m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || "public", m.isStatic ? 1 : 0, m.isAsync ? 1 : 0]
          );
        }
        for (const s of n.symbols.structs)
          db.run(insertSymbol, [n.id, s.name, s.type || "struct", "", "", 0, 0, "public", 0, 0]);
        for (const e of n.symbols.enums)
          db.run(insertSymbol, [n.id, e.name, e.type || "enum", "", "", 0, 0, "public", 0, 0]);
        for (const m of n.symbols.macros)
          db.run(insertSymbol, [n.id, m.name, m.type || "macro", "", "", 0, 0, "public", 0, 0]);
        for (const c of n.symbols.classes)
          db.run(insertSymbol, [n.id, c.name, c.type || "class", "", "", 0, deadSet.has(c.name) ? 1 : 0, "public", 0, 0]);
        for (const ex of n.symbols.exports)
          db.run(insertSymbol, [n.id, ex.name, ex.type || "export", "", "", 0, deadSet.has(ex.name) ? 1 : 0, "public", 0, 0]);
        for (const i of n.symbols.interfaces || [])
          db.run(insertSymbol, [n.id, i.name, i.type || "interface", "", "", i.line || 0, 0, i.visibility || "public", 0, 0]);
        for (const t of n.symbols.traits || [])
          db.run(insertSymbol, [n.id, t.name, t.type || "trait", "", "", t.line || 0, 0, t.visibility || "public", 0, 0]);
        for (const ta of n.symbols.typeAliases || [])
          db.run(insertSymbol, [n.id, ta.name, ta.type || "type_alias", "", "", ta.line || 0, 0, ta.visibility || "public", 0, 0]);
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
      db.run("COMMIT");
    } catch (err2) {
      db.run("ROLLBACK");
      throw err2;
    }
    this.save();
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
      `SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${orderClause} LIMIT ?`,
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
  /** All cycles. */
  getCycles() {
    const rows = queryAll(
      this.ensureDb(),
      "SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"
    );
    const cycles = [];
    let current = [];
    let currentId = -1;
    for (const row of rows) {
      if (row.cycle_id !== currentId) {
        if (current.length > 0)
          cycles.push(current);
        current = [];
        currentId = row.cycle_id;
      }
      current.push(row.node_id);
    }
    if (current.length > 0)
      cycles.push(current);
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
    return {
      ...node,
      symbols,
      dependencies: deps.map((d) => d.target),
      dependents: revDeps.map((d) => d.source)
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
    const sql = "SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync FROM symbols WHERE name LIKE ?" + (kind ? " AND kind = ?" : "") + " ORDER BY name LIMIT 100";
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
   * Community detection using Louvain algorithm.
   * Returns nodeId → communityId mapping.
   */
  getCommunities() {
    const db = this.ensureDb();
    const nodes = queryAll(db, "SELECT id FROM nodes");
    const edges = queryAll(db, "SELECT source, target FROM edges");
    if (nodes.length === 0)
      return [];
    const nodeIndex = /* @__PURE__ */ new Map();
    nodes.forEach((n2, i) => nodeIndex.set(n2.id, i));
    const n = nodes.length;
    const adj = Array.from({ length: n }, () => /* @__PURE__ */ new Map());
    let totalWeight = 0;
    for (const e of edges) {
      const si = nodeIndex.get(e.source);
      const ti = nodeIndex.get(e.target);
      if (si === void 0 || ti === void 0 || si === ti)
        continue;
      adj[si].set(ti, (adj[si].get(ti) || 0) + 1);
      adj[ti].set(si, (adj[ti].get(si) || 0) + 1);
      totalWeight += 1;
    }
    if (totalWeight === 0) {
      return nodes.map((nd, i) => ({ nodeId: nd.id, community: i }));
    }
    const m2 = totalWeight * 2;
    const deg = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (const w of adj[i].values())
        d += w;
      deg[i] = d;
    }
    const community = new Int32Array(n);
    for (let i = 0; i < n; i++)
      community[i] = i;
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 20) {
      improved = false;
      iterations++;
      for (let i = 0; i < n; i++) {
        const ci = community[i];
        const commWeights = /* @__PURE__ */ new Map();
        for (const [j, w] of adj[i]) {
          const cj = community[j];
          commWeights.set(cj, (commWeights.get(cj) || 0) + w);
        }
        const commDeg = /* @__PURE__ */ new Map();
        for (let j = 0; j < n; j++) {
          if (j === i)
            continue;
          const cj = community[j];
          if (commWeights.has(cj) || cj === ci) {
            commDeg.set(cj, (commDeg.get(cj) || 0) + deg[j]);
          }
        }
        const ki = deg[i];
        const wIn = commWeights.get(ci) || 0;
        const sumCi = commDeg.get(ci) || 0;
        const removeCost = wIn / totalWeight - ki * sumCi / (m2 * m2) * 2;
        let bestGain = 0;
        let bestComm = ci;
        for (const [cj, wj] of commWeights) {
          if (cj === ci)
            continue;
          const sumCj = commDeg.get(cj) || 0;
          const gain = wj / totalWeight - ki * sumCj / (m2 * m2) * 2 - removeCost;
          if (gain > bestGain) {
            bestGain = gain;
            bestComm = cj;
          }
        }
        if (bestComm !== ci) {
          community[i] = bestComm;
          improved = true;
        }
      }
    }
    const idMap = /* @__PURE__ */ new Map();
    let nextId = 0;
    const result = [];
    for (let i = 0; i < n; i++) {
      let cid = community[i];
      if (!idMap.has(cid))
        idMap.set(cid, nextId++);
      result.push({ nodeId: nodes[i].id, community: idMap.get(cid) });
    }
    return result;
  }
  /** Get meta value by key. */
  getMeta(key) {
    const row = queryOne(this.ensureDb(), "SELECT value FROM meta WHERE key = ?", [key]);
    return row?.value ?? null;
  }
  /** Get all meta as a map. */
  getAllMeta() {
    const rows = queryAll(this.ensureDb(), "SELECT key, value FROM meta");
    const map = {};
    for (const r of rows)
      map[r.key] = r.value;
    return map;
  }
  // ── Private ────────────────────────────────────────────────
  /** Add columns that may be missing in older databases. */
  migrateSchema() {
    const db = this.ensureDb();
    const cols = queryAll(db, "PRAGMA table_info('symbols')").map((c) => c.name);
    const migrations = [
      ["visibility", "ALTER TABLE symbols ADD COLUMN visibility TEXT DEFAULT 'public'"],
      ["is_static", "ALTER TABLE symbols ADD COLUMN is_static INTEGER DEFAULT 0"],
      ["is_async", "ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0"]
    ];
    for (const [col, sql] of migrations) {
      if (!cols.includes(col)) {
        db.run(sql);
      }
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
  }
  ensureDb() {
    if (!this.db)
      throw new Error("GraphDB is not open");
    return this.db;
  }
};

// src/extension.ts
var webviewProvider;
var cachedGraphData;
var cachedFiles = [];
var historyWorker;
var commitIndex;
var cachedDeltas = [];
var fileWatcher;
var statusBarItem;
var refreshTimeout;
var treeProvider;
var isAnalyzing = false;
var graphDb;
function activate(context) {
  treeProvider = new AuraTreeProvider();
  const treeView = vscode3.window.createTreeView("auraVisualizer.statsView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  statusBarItem = vscode3.window.createStatusBarItem(vscode3.StatusBarAlignment.Left, 50);
  statusBarItem.command = "auraVisualizer.open";
  statusBarItem.text = "$(eye) Aura";
  statusBarItem.tooltip = "Open Aura 3D Visualizer";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    vscode3.commands.registerCommand("auraVisualizer.open", () => openVisualizer(context)),
    vscode3.commands.registerCommand("auraVisualizer.refresh", () => refreshAnalysis(context)),
    vscode3.commands.registerCommand("auraVisualizer.focusFile", () => focusCurrentFile()),
    vscode3.commands.registerCommand("auraVisualizer.openFileFromTree", (relativePath) => {
      const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
      if (!workspaceFolder)
        return;
      const fullPath = path2.join(workspaceFolder.uri.fsPath, relativePath);
      vscode3.window.showTextDocument(vscode3.Uri.file(fullPath), { preview: true });
    }),
    vscode3.commands.registerCommand("auraVisualizer.exportGraph", () => exportGraph()),
    vscode3.commands.registerCommand("auraVisualizer.blastRadius", () => blastRadiusCurrentFile(context))
  );
  setupFileWatcher(context);
  context.subscriptions.push(
    vscode3.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && webviewProvider?.isVisible) {
        const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const relativePath = path2.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
          if (!relativePath.startsWith("..")) {
            webviewProvider.focusNode(relativePath);
          }
        }
      }
    })
  );
  context.subscriptions.push(
    vscode3.window.onDidChangeActiveColorTheme((theme) => {
      webviewProvider?.sendTheme(theme.kind);
    })
  );
  vscode3.window.registerWebviewPanelSerializer(WebviewProvider.viewType, {
    async deserializeWebviewPanel(panel) {
      if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
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
  if (vscode3.workspace.workspaceFolders?.length) {
    refreshAnalysis(context);
  }
}
function registerOpenFileHandler() {
  if (!webviewProvider)
    return;
  webviewProvider.onOpenFile(async ({ path: filePath, line }) => {
    const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
    if (!workspaceFolder)
      return;
    const fullPath = path2.join(workspaceFolder.uri.fsPath, filePath);
    const uri = vscode3.Uri.file(fullPath);
    try {
      const doc = await vscode3.workspace.openTextDocument(uri);
      const editor = await vscode3.window.showTextDocument(doc, {
        viewColumn: vscode3.ViewColumn.Beside,
        preserveFocus: false
      });
      if (line && line > 0) {
        const position = new vscode3.Position(line - 1, 0);
        editor.selection = new vscode3.Selection(position, position);
        editor.revealRange(
          new vscode3.Range(position, position),
          vscode3.TextEditorRevealType.InCenter
        );
      }
    } catch {
    }
  });
}
async function openVisualizer(context) {
  if (!webviewProvider) {
    webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
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
  } else {
    await refreshAnalysis(context);
  }
}
async function refreshAnalysis(context) {
  if (isAnalyzing)
    return;
  isAnalyzing = true;
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    isAnalyzing = false;
    vscode3.window.showWarningMessage("Aura: No workspace folder open.");
    return;
  }
  const rootPath = workspaceFolder.uri.fsPath;
  const config = vscode3.workspace.getConfiguration("auraVisualizer");
  const excludePaths = config.get("excludePaths", [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "__pycache__"
  ]);
  if (statusBarItem) {
    statusBarItem.text = "$(loading~spin) Aura: Analyzing...";
  }
  try {
    const result = await vscode3.window.withProgress(
      {
        location: vscode3.ProgressLocation.Window,
        title: "Aura: Analyzing codebase..."
      },
      () => runAnalysisInWorker(context.extensionUri, rootPath, excludePaths, workspaceFolder.name)
    );
    cachedGraphData = result.graphData;
    cachedFiles = result.files;
    if (webviewProvider) {
      webviewProvider.sendGraphData(cachedGraphData);
    }
    treeProvider?.update(cachedGraphData);
    updateStatusBar();
    try {
      if (!graphDb) {
        graphDb = new GraphDB();
        const dbDir = path2.join(rootPath, ".aura");
        await fs2.mkdir(dbDir, { recursive: true });
        await graphDb.open(path2.join(dbDir, "graph.db"));
      }
      graphDb.importGraphData(cachedGraphData);
      await registerMcpServer(context, rootPath);
    } catch (dbErr) {
      console.error("[aura] GraphDB import error:", dbErr);
    }
    startHistoryScan(context, rootPath, excludePaths);
  } catch (err2) {
    const message = err2 instanceof Error ? err2.message : String(err2);
    vscode3.window.showErrorMessage(`Aura: Analysis failed \u2014 ${message}`);
    if (statusBarItem) {
      statusBarItem.text = "$(eye) Aura";
    }
  } finally {
    isAnalyzing = false;
  }
}
async function registerMcpServer(context, rootPath) {
  const vscodeDir = path2.join(rootPath, ".vscode");
  const mcpPath = path2.join(vscodeDir, "mcp.json");
  const mcpServerPath = path2.join(context.extensionUri.fsPath, "out", "mcp-server.js");
  const dbPath = path2.join(rootPath, ".aura", "graph.db");
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
function runAnalysisInWorker(extensionUri, rootPath, excludePaths, projectName) {
  return new Promise((resolve, reject) => {
    const workerPath = path2.join(extensionUri.fsPath, "out", "analyzer-worker.js");
    const worker = new import_worker_threads.Worker(workerPath, {
      workerData: {
        rootPath,
        skipDirs: excludePaths,
        projectName
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
        resolve({ graphData: msg.graphData, files: msg.files });
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
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder || cachedFiles.length === 0)
    return;
  const rootPath = workspaceFolder.uri.fsPath;
  const relativePath = path2.relative(rootPath, fileUri.fsPath);
  if (relativePath.startsWith(".."))
    return;
  if (deleted) {
    cachedFiles = cachedFiles.filter((f) => f.id !== relativePath);
  } else {
    const newInfo = await scanSingleFile(fileUri.fsPath, rootPath);
    if (!newInfo)
      return;
    const idx = cachedFiles.findIndex((f) => f.id === relativePath);
    if (idx >= 0) {
      cachedFiles[idx] = newInfo;
    } else {
      cachedFiles.push(newInfo);
    }
  }
  const oldGraphData = cachedGraphData;
  const projectName = workspaceFolder.name;
  const astTrees = await preParseFiles(cachedFiles);
  cachedGraphData = buildGraph(cachedFiles, projectName, {}, astTrees);
  if (webviewProvider?.isVisible && cachedGraphData) {
    if (oldGraphData) {
      const delta = computeGraphDelta(oldGraphData, cachedGraphData, relativePath, deleted);
      webviewProvider.sendGraphDelta(delta);
    } else {
      webviewProvider.sendGraphData(cachedGraphData);
    }
  }
  treeProvider?.update(cachedGraphData);
  updateStatusBar();
}
function computeGraphDelta(oldGraph, newGraph, changedFileId, deleted) {
  const delta = {
    changedNodes: [],
    removedNodeIds: [],
    addedLinks: [],
    removedLinks: [],
    meta: newGraph.meta
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
  if (!statusBarItem || !cachedGraphData)
    return;
  const { totalFiles, totalLinks } = cachedGraphData.meta;
  statusBarItem.text = `$(eye) Aura: ${totalFiles} files, ${totalLinks} links`;
  statusBarItem.tooltip = `Aura \u2014 ${totalFiles} files, ${totalLinks} dependencies
Click to open 3D visualizer`;
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
  const historyDir = path2.join(rootPath, ".aura", "history");
  const workerPath = path2.join(context.extensionUri.fsPath, "out", "history-worker.js");
  historyWorker = new import_worker_threads.Worker(workerPath, {
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
  const editor = vscode3.window.activeTextEditor;
  if (!editor || !webviewProvider?.isVisible)
    return;
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder)
    return;
  const relativePath = path2.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
  if (!relativePath.startsWith("..")) {
    webviewProvider.focusNode(relativePath);
  }
}
async function blastRadiusCurrentFile(context) {
  const editor = vscode3.window.activeTextEditor;
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!editor || !workspaceFolder)
    return;
  const relativePath = path2.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
  if (relativePath.startsWith(".."))
    return;
  if (!webviewProvider) {
    webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
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
  setTimeout(() => webviewProvider?.sendBlastRadius(relativePath), 300);
}
async function exportGraph() {
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode3.window.showWarningMessage("Aura: No workspace folder open.");
    return;
  }
  if (!cachedGraphData) {
    vscode3.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");
    return;
  }
  const auraDir = path2.join(workspaceFolder.uri.fsPath, ".aura");
  await fs2.mkdir(auraDir, { recursive: true });
  const graph = cachedGraphData;
  const graphJson = {
    meta: graph.meta,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      path: n.path,
      language: n.language,
      extension: n.extension,
      size: n.size,
      linesOfCode: n.linesOfCode,
      group: n.group,
      fanIn: n.fanIn,
      fanOut: n.fanOut,
      complexity: n.complexity
    })),
    links: graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      type: l.type,
      label: l.label
    }))
  };
  await fs2.writeFile(
    path2.join(auraDir, "graph.json"),
    JSON.stringify(graphJson, null, 2),
    "utf-8"
  );
  const summary = generateSummary(graph);
  await fs2.writeFile(path2.join(auraDir, "summary.md"), summary, "utf-8");
  vscode3.window.showInformationMessage(
    `Aura: Exported to .aura/ \u2014 graph.json + summary.md`,
    "Open summary"
  ).then((choice) => {
    if (choice === "Open summary") {
      vscode3.window.showTextDocument(
        vscode3.Uri.file(path2.join(auraDir, "summary.md")),
        { preview: true }
      );
    }
  });
}
function generateSummary(graph) {
  const { meta, nodes, links } = graph;
  const lines = [];
  lines.push(`# Aura Graph \u2014 ${meta.projectName}`);
  lines.push(`> Auto-generated by Aura Visualizer on ${meta.analyzedAt}`);
  lines.push(`> This file describes the codebase architecture for AI-assisted development.`);
  lines.push("");
  lines.push("## Overview");
  lines.push(`- **${meta.totalFiles}** files, **${meta.totalLinks}** dependencies`);
  const langs = Object.entries(meta.languageStats).sort((a, b) => b[1].count - a[1].count).map(([lang, s]) => `${lang} (${s.count} files, ${s.totalLOC} LOC)`);
  lines.push(`- Languages: ${langs.join(", ")}`);
  if (meta.unresolvedReferences > 0) {
    lines.push(`- Unresolved references: ${meta.unresolvedReferences}`);
  }
  lines.push("");
  if (meta.groups.length > 0) {
    lines.push("## Directory Structure");
    for (const g of meta.groups) {
      const groupFiles = nodes.filter((n) => n.group === g);
      const totalLOC = groupFiles.reduce((s, n) => s + n.linesOfCode, 0);
      lines.push(`- \`${g}/\` \u2014 ${groupFiles.length} files, ${totalLOC} LOC`);
    }
    lines.push("");
  }
  const highFanIn = [...nodes].sort((a, b) => b.fanIn - a.fanIn).slice(0, 15).filter((n) => n.fanIn > 0);
  if (highFanIn.length > 0) {
    lines.push("## Hotspots (most depended-on files)");
    lines.push("| File | Fan-in | Fan-out | Complexity | LOC |");
    lines.push("|------|--------|---------|------------|-----|");
    for (const n of highFanIn) {
      lines.push(`| \`${n.id}\` | ${n.fanIn} | ${n.fanOut} | ${n.complexity} | ${n.linesOfCode} |`);
    }
    lines.push("");
  }
  const complex = [...nodes].sort((a, b) => b.complexity - a.complexity).slice(0, 10).filter((n) => n.complexity > 1);
  if (complex.length > 0) {
    lines.push("## Most Complex Files");
    lines.push("| File | Complexity | LOC | Fan-in | Fan-out |");
    lines.push("|------|------------|-----|--------|---------|");
    for (const n of complex) {
      lines.push(`| \`${n.id}\` | ${n.complexity} | ${n.linesOfCode} | ${n.fanIn} | ${n.fanOut} |`);
    }
    lines.push("");
  }
  const largest = [...nodes].sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 10);
  if (largest.length > 0) {
    lines.push("## Largest Files");
    lines.push("| File | LOC | Complexity | Language |");
    lines.push("|------|-----|------------|----------|");
    for (const n of largest) {
      lines.push(`| \`${n.id}\` | ${n.linesOfCode} | ${n.complexity} | ${n.language} |`);
    }
    lines.push("");
  }
  const orphans = nodes.filter((n) => n.fanIn === 0 && n.fanOut === 0);
  if (orphans.length > 0) {
    lines.push("## Orphan Files (no dependencies)");
    for (const n of orphans) {
      lines.push(`- \`${n.id}\` (${n.language}, ${n.linesOfCode} LOC)`);
    }
    lines.push("");
  }
  const circularPairs = [];
  const linkSet = new Set(links.map((l) => `${l.source}\u2192${l.target}`));
  for (const l of links) {
    const reverse = `${l.target}\u2192${l.source}`;
    if (linkSet.has(reverse) && l.source < l.target) {
      circularPairs.push(`\`${l.source}\` \u2194 \`${l.target}\``);
    }
  }
  if (circularPairs.length > 0) {
    lines.push("## Circular Dependencies");
    for (const pair of circularPairs) {
      lines.push(`- ${pair}`);
    }
    lines.push("");
  }
  const typeCounts = {};
  for (const l of links) {
    typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
  }
  if (Object.keys(typeCounts).length > 0) {
    lines.push("## Dependency Types");
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${type}**: ${count}`);
    }
    lines.push("");
  }
  lines.push("## Usage Notes for AI Agents");
  lines.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents.");
  lines.push("- Check circular dependencies before refactoring \u2014 break cycles where possible.");
  lines.push("- Orphan files may be dead code candidates for cleanup.");
  lines.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file).");
  lines.push("- High complexity files (>15) are prime candidates for decomposition.");
  lines.push("");
  return lines.join("\n");
}
function setupFileWatcher(context) {
  const config = vscode3.workspace.getConfiguration("auraVisualizer");
  const autoRefresh = config.get("autoRefresh", true);
  if (!autoRefresh)
    return;
  fileWatcher = vscode3.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");
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
function deactivate() {
  webviewProvider?.dispose();
  fileWatcher?.dispose();
  if (refreshTimeout)
    clearTimeout(refreshTimeout);
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
