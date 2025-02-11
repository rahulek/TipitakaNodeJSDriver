import whyIsNodeRunning from 'why-is-node-running';
import { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } from './constants.js';
import { MetaDataHandler } from './tipitaka/metadata-handler.js';
import { Neo4JDBService } from './tipitaka/db-service.js';
import { TipitakaParser } from './parser/xml-parser-utils.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TipitakaState } from './tipitaka/state.js';
export const asyncLocalStorage = new AsyncLocalStorage();
import neo4j from 'neo4j-driver';

import * as winston from 'winston';

function main(logger) {
  //Command Line Handling
  if (process.argv.length !== 2) {
    logger.error(`USAGE: npm run doit xmlfile=<Tipitaka XML File>`);
    return;
  }

  (async () => {
    let driver;

    try {
      driver = neo4j.driver(
        NEO4J_URI,
        neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
      );
      await driver.getServerInfo();
      console.log('Connection established');
    } catch (e) {
      console.log(`Connection error: ${err}, cause: ${err.cause}`);
      await driver.close();
    }

    const dbService = new Neo4JDBService(driver, logger);
    const metaHandler = new MetaDataHandler(logger);

    let xmlFileToProcess = undefined;
    if (process.env.npm_config_prune) {
      //console.log(`Pruning the DB....`);
    } else if (process.env.npm_config_xmlfile) {
      xmlFileToProcess = process.env.npm_config_xmlfile;
      logger.info(`File passed in : ${xmlFileToProcess}`);
    } else {
      logger.info(`Nothing to do`);
      return;
    }

    if (process.env.npm_config_prune) {
      logger.warn(`~~~*** CAUTION: Pruning the DB Now....*** ~~~~`);
      dbService && dbService.pruneDB();
      dbService && dbService.updateDB();
      //dbService && dbService.cleanUp();
      logger.info(`Pruning Done`);
    } else {
      const ret = await asyncLocalStorage.run(new TipitakaState(), () => {
        logger.info(`Started with XML Processing`);
        const parser = new TipitakaParser(
          xmlFileToProcess,
          dbService,
          metaHandler.metaDataCallback,
          logger
        );

        if (parser) {
          const ret = parser.processXML();
          console.log(`Parser ret = ${ret}`);
        }
        logger.info(`XML File processed`);
        return 'WOW';
      });
      console.log(`${ret}`);
      console.log(JSON.stringify(dbService.cyphers));
      //dbService && dbService.updateDB();
      //dbService && dbService.cleanUp();
    }
  })();
}

const logger = winston.createLogger({
  level: 'silly',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.File({ filename: 'app.log' })],
});
main(logger);
//whyIsNodeRunning();
