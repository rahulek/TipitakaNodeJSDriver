import whyIsNodeRunning from 'why-is-node-running';
import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from './constants.js';
import { MetaDataHandler } from './tipitaka/metadata-handler.js';
import { Neo4JDBService } from './tipitaka/db-service.js';
import { TipitakaParser } from './parser/xml-parser-utils.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TipitakaState } from './tipitaka/state.js';
export const asyncLocalStorage = new AsyncLocalStorage();

async function main() {
  //Command Line Handling
  if (process.argv.length !== 2) {
    console.error(`USAGE: npm run doit xmlfile=<Tipitaka XML File>`);
    process.exit(-1);
  }

  const dbService = new Neo4JDBService(
    NEO4J_URI,
    NEO4J_USERNAME,
    NEO4J_PASSWORD
  );
  const metaHandler = new MetaDataHandler();

  // Close the connection when the app stops
  // process.on('exit', async (code) => {
  //   dbService && dbService.cleanUp();
  // });
  // process.on('SIGINT', async () => {
  //   dbService && dbService.cleanUp();
  //   process.exit();
  // });

  let xmlFileToProcess = undefined;
  if (process.env.npm_config_prune) {
    //console.log(`Pruning the DB....`);
  } else if (process.env.npm_config_xmlfile) {
    xmlFileToProcess = process.env.npm_config_xmlfile;
    console.log(`File passed in : ${xmlFileToProcess}`);
  } else {
    console.log(`Nothing to do`);
    process.exit();
  }

  if (process.env.npm_config_prune) {
    console.log(`~~~*** CAUTION: Pruning the DB Now....*** ~~~~`);
    dbService && (await dbService.pruneDB());
    dbService && (await dbService.cleanUp());
    console.log(`Pruning Done`);
    return;
  }

  try {
    asyncLocalStorage.run(new TipitakaState(), async () => {
      console.log(`Started with XML Processing`);
      const parser = new TipitakaParser(
        xmlFileToProcess,
        dbService,
        metaHandler.metaDataCallback
      );

      parser && parser.processXML();
      console.log(`XML File processed`);
    });
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

const iff = async () => {
  await main();
  whyIsNodeRunning();
};

await iff();
