import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from './constants.js';
import {
  METADATA_TOPHEADER_NIKAYA,
  METADATA_TOPHEADER_TEXT,
  METADATA_BOOK,
  METADATA_NIKAYA,
  METADATA_SUB_SECTION_TITLE,
  METADATA_SUB_SECTION_TYPE_SUTTA,
  METADATA_SUB_SECTION_TYPE_VAGGA,
  METADATA_SUB_SECTION_END_GATHA,
  METADATA_PALI_TEXT_PARA,
  METADATA_TRAILER,
  METADATA_BOOK_END_GATHA,
  METADATA_OUTER_TRAILER,
} from './constants.js';
import { closeDriver, initDriver } from './neo4j/neo4j.js';
import { basicNikayaSetup, pruneDB } from './tipitaka/db-service.js';
import { processTipitakaXML } from './parser/xml-parser-utils.js';
import { AsyncLocalStorage } from 'node:async_hooks';
export const asyncLocalStorage = new AsyncLocalStorage();

async function main() {
  //Command Line Handling
  if (process.argv.length !== 2) {
    console.error(`USAGE: npm run doit xmlfile=<Tipitaka XML File>`);
    process.exit(-1);
  }

  let xmlFileToProcess = undefined;
  if (process.env.npm_config_prune) {
    console.log(`Pruning the DB....`);
  } else if (process.env.npm_config_xmlfile) {
    xmlFileToProcess = process.env.npm_config_xmlfile;
    console.log(`File passed in : ${xmlFileToProcess}`);
  } else {
    console.log(`Nothing to do`);
    process.exit();
  }

  // Close the connection when the app stops
  process.on('exit', async (code) => {
    await closeDriver();
  });
  process.on('SIGINT', async () => {
    await closeDriver();
  });

  try {
    await asyncLocalStorage.run({}, async () => {
      initDriver(NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD, {
        maxConnectionLifetime: 10 * 60 * 1000, // 10 minutes
        maxConnectionPoolSize: 300,
        // logging: {
        //   level: 'debug',
        //   logger: (level, message) =>
        //     console.log('+++' + level + ' ' + message),
        // },
      });
      if (process.env.npm_config_prune) {
        console.log(`~~~*** CAUTION: Pruning the DB Now....*** ~~~~`);
        pruneDB();
        return;
      }
      await basicNikayaSetup();
      await processTipitakaXML(xmlFileToProcess);
    });

    console.log(`XML File processed`);
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

(async () => {
  await main();
})();
