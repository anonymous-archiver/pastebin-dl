require('yargs')
  .commandDir('./src/commands')
  .demandCommand()
  .help()
  .argv