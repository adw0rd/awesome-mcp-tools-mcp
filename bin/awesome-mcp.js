#!/usr/bin/env node

import process from 'node:process'
import { run } from '../lib.js'

run(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err.message || String(err))
    process.exit(1)
  })
