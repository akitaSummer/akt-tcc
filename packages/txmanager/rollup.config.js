const rollupTypes = require('rollup-plugin-typescript2');
const { terser } = require('rollup-plugin-terser');
const RollupPluginNodeResolve = require('@rollup/plugin-node-resolve');
const RollupPluginCommonjs = require('@rollup/plugin-commonjs');
const nodePolyfill = require('rollup-plugin-polyfill-node');
module.exports = (config) => {
  config.plugins.unshift(
    rollupTypes({
      tsconfig: 'tsconfig.json',
    })
  );

  return config;
};
