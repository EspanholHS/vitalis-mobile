const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveHubTestImport(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    request = path.join(process.cwd(), request.slice(2));
  }
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (error) {
    if (typeof request === 'string' && (request.startsWith('.') || path.isAbsolute(request))) {
      return originalResolveFilename.call(this, `${request}.ts`, parent, isMain, options);
    }
    throw error;
  }
};

require(path.join(process.cwd(), 'tests', 'hub-engine.test.ts'));
require(path.join(process.cwd(), 'tests', 'schedule-activation.test.ts'));
