import DBServiceDriverError from '../errors/db-service-error.js';
import { closeDriver, initDriver } from '../neo4j/neo4j.js';

export class Neo4JDBService {
  constructor(driver, logger) {
    this.driver = driver;
    this.logger = logger;

    // console.log(`Driver : ${JSON.stringify(this.driver)}`);
    // this.logger.info(`Connected to : ${this.uri}`);
    // this.logger.info(`driver: ${JSON.stringify(this.driver)}`);
  }

  cleanUp() {
    (async (d) => {
      await closeDriver(d);
    })(this.driver);
  }

  // async executeWriteTx(query, params) {
  //   const driver = this.driver;

  //   if (!driver) {
  //     throw new DBServiceDriverError('Neo4J Driver is not available.');
  //   }

  //   try {
  //     return await driver.executeQuery(query, params);
  //   } catch (e) {
  //     throw new DBServiceDriverError(e.message);
  //   } finally {
  //   }
  // }

  executeWriteTx(query, params) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    const dbWriteFn = async (driver, query, params) => {
      let session;

      try {
        session = driver.session();
        let tx = await session.beginTransaction();
        try {
          const res = await tx.run(query, params);
          await tx.commit();
          this.logger.debug(
            `RESULT1: ${JSON.stringify(res.summary.query.text)}`
          );
          this.logger.debug(
            `RESULT2: ${JSON.stringify(res.summary.query.parameters)}`
          );
          this.logger.debug(
            `RESULT3: ${JSON.stringify(res.summary.counters._stats)}`
          );
          return res;
        } catch (e) {
          this.logger.debug(`Rolling back the TX`);
          console.log(e);
          this.logger.debug(`${JSON.stringify(e)}`);
          await tx.rollback();
        } finally {
          await session.close();
        }
      } catch (e) {
        throw new DBServiceDriverError(e.message);
      } finally {
        await session.close();
      }
    };

    return (async (fn, d, q, p) => {
      const res = await fn(d, q, p);
      return res;
    })(dbWriteFn, this.driver, query, params);
  }

  basicNikayaSetup() {
    this.logger.debug(`BasicNikayaSetup Start...`);

    const query = `
    MERGE (tipitaka :TIPITAKA {name: $name, attribution: $attribution})
          MERGE (vinaya :PITAKA {name: $vinaya})
          MERGE (sutta :PITAKA {name: $sutta})
          MERGE (abhidhamma :PITAKA {name: $abhidhamma})
          MERGE (tipitaka)-[:HAS_PITAKA]->(vinaya)
          MERGE (tipitaka)-[:HAS_PITAKA]->(sutta)
          MERGE (tipitaka)-[:HAS_PITAKA]->(abhidhamma)
          RETURN tipitaka, vinaya, sutta, abhidhamma
    `;
    const params = {
      name: 'Tipitaka',
      attribution: 'http://www.tipitaka.org',
      vinaya: 'Vinaya',
      sutta: 'Sutta',
      abhidhamma: 'Abhidhamma',
    };
    return this.executeWriteTx(query, params);
  }

  handleNewBook(info) {
    if (!(info && info.data)) {
      throw new DBServiceDriverError(
        'Parameter error: book info object is not valid '
      );
    }

    let bookNode = {};
    const bookTitle = info.data.title ? info.data.title : undefined;
    if (!bookTitle) {
      throw new DBServiceDriverError('Book has no title');
    }

    //Digha Nikaya
    if (info.data.id.toUpperCase().startsWith('DN')) {
      bookNode.pitakaName = 'Sutta';
      bookNode.belongsTo = 'Digha Nikaya';
      bookNode.name = bookTitle;
      bookNode.id = info.data.id.toUpperCase();
    }
    //TODO: Add More for other Books

    const query = `
        MATCH (p :PITAKA {name: $pitakaName})
        MERGE (n :NIKAYA {name: $nikayaName})
        MERGE (p)-[:CONTAINS]->(n)
        MERGE (book :BOOK {name: $bookName, id: $bookId})
        MERGE (n)-[:HAS_BOOK]->(book)`;

    const params = {
      pitakaName: bookNode.pitakaName,
      nikayaName: bookNode.belongsTo,
      bookName: bookNode.name,
      bookId: bookNode.id,
    };
    return this.executeWriteTx(query, params);
  }

  handleNewNikayaEntry(info) {
    if (!(info && info.data)) {
      throw new DBServiceDriverError(
        'Parameter error: book info object is not valid '
      );
    }

    let nikayaEntryNode = {};

    nikayaEntryNode.bookId = info.data.id.toUpperCase().split('_')[0];
    nikayaEntryNode.subtype = info.data.subtype;
    nikayaEntryNode.id = info.data.id.toUpperCase();

    this.logger.debug(`Nikaya Entry Node: ${JSON.stringify(nikayaEntryNode)}`);

    const query = `
        MATCH (book :BOOK {id: $bookId})
        MERGE (book)-[:NIKAYA_ENTRY]->(ne :NIKAYAENTRY {id: $nikayaEntryId, type: $nikayaEntryType})
    `;
    const params = {
      bookId: nikayaEntryNode.bookId,
      nikayaEntryId: nikayaEntryNode.id,
      nikayaEntryType: nikayaEntryNode.subtype,
    };

    this.executeWriteTx(query, params);

    this.logger.debug(`Nikaya Entry Node RETURN: ${nikayaEntryNode.id}`);
    return nikayaEntryNode.id;
  }

  handleSetNikayaEntryTitle(forEntryId, title) {
    this.logger.debug(
      `Nikaya Entry Title Setting Node: For ${forEntryId} to ${title}`
    );

    const query = `
          MATCH (ne :NIKAYAENTRY {id: $nikayaEntryId})
          SET ne.name = $nikayaEntryName
      `;

    const params = {
      nikayaEntryId: forEntryId,
      nikayaEntryName: title,
    };
    return this.executeWriteTx(query, params);
  }

  handleNewSuttaVaggaSection(forEntryId, sectionId, title) {
    this.logger.debug(
      `Sutta Section : For ${forEntryId} to ${title} with ID :${sectionId}`
    );

    const query = `MATCH (ne :NIKAYAENTRY {id: $nikayaEntryId})
          MERGE (ne)-[:HAS_SUBSECTION]->(subSutta :SUBSECTION {name: $subSectionName, id: $subSectionId})
          RETURN ne, subSutta
      `;
    const params = {
      nikayaEntryId: forEntryId,
      subSectionName: title,
      subSectionId: sectionId,
    };
    return this.executeWriteTx(query, params);
  }

  handleNewPara(lastNikayaEntryId, nodeId, paraText) {
    this.logger.debug(
      `New para : For ${lastNikayaEntryId} with nodeId ${nodeId} to ${paraText.substring(
        0,
        10
      )}`
    );

    const query1 = `
          MATCH (ne :SUBSECTION {id: $lastNikayaEntryId})
          MERGE (ne)-[:HAS_PARA]->(para :PARA {id: $paraId, text: $paraText})
          RETURN ne, para
      `;
    const params1 = {
      lastNikayaEntryId: lastNikayaEntryId,
      paraId: nodeId,
      paraText: paraText.trim(),
    };
    this.executeWriteTx(query1, params1);

    //Split the lines of 'unicode -' OR 'unicode |'
    const lines = paraText.split(/\u2013|\u0964/);
    this.logger.debug(`*** LINES ***`);
    let lineId = 1;
    lines.forEach((line) => {
      this.logger.debug(line);
      if (line.length !== 0) {
        const query2 = `
              MATCH (p :PARA {id: $paraId})
              MERGE (l :LINE {text: $lineText, id: $lineId})
              MERGE (p)-[:HAS_LINE]->(l)
              RETURN l
          `;
        const params2 = {
          paraId: nodeId,
          lineText: line.trim(),
          lineId: `${nodeId}_${lineId}`,
        };
        this.executeWriteTx(query2, params2);
        lineId++;
      }
    });
  }

  handleNewSubPara(nodeId, subParaId, subParaText) {
    this.logger.debug(
      `New Subpara : For ${nodeId} with id ${subParaId} to ${subParaText.substring(
        0,
        20
      )}`
    );

    const query1 = `
          MATCH (para :PARA {id: $nodeId})
          MERGE (subPara :SUBPARA {id: $subParaId, text: $subParaText})
          MERGE (para)-[:HAS_SUBPARA]->(subPara)
          RETURN para, subPara
      `;
    const params1 = {
      nodeId: nodeId,
      subParaId: subParaId,
      subParaText: subParaText.trim(),
    };

    this.executeWriteTx(query1, params1);

    //Split the lines of 'unicode -' OR 'unicode |'
    const lines = subParaText.split(/\u2013|\u0964/);
    this.logger.debug(`*** SUBPARA LINES ***`);
    let lineId = 1;
    lines.forEach((line) => {
      this.logger.debug(line);
      if (line.length !== 0) {
        const query2 = `
              MATCH (sp :SUBPARA {id: $subParaId})
              MERGE (l :LINE {text: $lineText, id: $lineId})
              MERGE (sp)-[:HAS_LINE]->(l)
              RETURN l
          `;
        const param2 = {
          subParaId: subParaId,
          lineText: line.trim(),
          lineId: `${subParaId}_${lineId}`,
        };
        this.executeWriteTx(query2, param2);
        lineId++;
      }
    });
  }

  handleNewGatha(nodeId, subParaId, gathaText) {
    this.logger.debug(
      `New Section Ending Gatha : For ${nodeId} with id ${subParaId} to ${gathaText.substring(
        0,
        20
      )}`
    );

    const query = `
          MATCH (para :PARA {id: $nodeId})
          MERGE (subPara :SUBPARA {id: $subParaId, text: $gathaText, type: $subParaType})
          MERGE (para)-[:HAS_SUBPARA]->(subPara)
          RETURN para, subPara`;

    const params = {
      nodeId: nodeId,
      subParaId: subParaId,
      gathaText: gathaText,
      subParaType: 'GATHA',
    };

    return this.executeWriteTx(query, params);
  }

  handleBookEndingGatha(neId, subParaId, gathaText, gathaType) {
    this.logger.debug(
      `Book Ending Gatha : Type: ${gathaType} For book ${neId}, id ${subParaId} to ${gathaText.substring(
        0,
        20
      )}`
    );
  }

  handleNETrailer(neId, neTrailerText) {
    this.logger.debug(`New Section Trailer : For ${neId} to ${neTrailerText}`);

    const query = `
          MATCH (ne :NIKAYAENTRY {id: $neId})
          MERGE (t :TRAILER {text: $neTrailerText})
          MERGE (ne)-[:HAS_TRAILER]->(t)
          RETURN t
      `;
    const params = {
      neId: neId,
      neTrailerText: neTrailerText,
    };
    return this.executeWriteTx(query, params);
  }

  handleBookTrailer(bookId, bookTrailerText) {
    this.logger.debug(`Book Trailer : For ${bookId} to ${bookTrailerText}`);

    const query = `
          MATCH (b :BOOK {id: $bookId})
          MERGE (t :TRAILER {text: $bookTrailerText})
          MERGE (b)-[:HAS_TRAILER]->(t)
          RETURN t
      `;
    const params = {
      bookId: bookId,
      bookTrailerText: bookTrailerText,
    };
    return this.executeWriteTx(query, params);
  }

  pruneDB() {
    const query = `
          MATCH (n) DETACH DELETE n
      `;
    return this.executeWriteTx(query, null);
  }
}
