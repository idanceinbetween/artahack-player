const { compile } = require('nexe')

compile({
  input: './index.js',
  target: ['win32-x86-10.13.0'],
  output: './bundles/EmotibitCsvGenerator',
  logLevel: 'verbose'

}).then(() => {
  console.log('success')
})