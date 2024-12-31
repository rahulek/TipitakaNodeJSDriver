import { getDriver } from '../neo4j/neo4j.js';
import DBServiceDriverError from '../errors/db-service-error.js';
import { closeDriver, initDriver } from '../neo4j/neo4j.js';

export class Neo4JDBService {
  constructor(uri, username, password) {
    this.uri = uri;
    this.username = username;
    this.password = password;

    this.driver = initDriver(this.uri, this.username, this.password, {
      maxConnectionLifetime: 10 * 60 * 1000, // 10 minutes
      maxConnectionPoolSize: 300,
    });
  }

  async cleanUp() {
    await closeDriver();
  }

  async basicNikayaSetup() {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    console.log(`BasicNikayaSetup Start...`);

    try {
      await driver.executeQuery(
        `
        MERGE (tipitaka :TIPITAKA {name: $name, attribution: $attribution})
        MERGE (vinaya :PITAKA {name: $vinaya})
        MERGE (sutta :PITAKA {name: $sutta})
        MERGE (abhidhamma :PITAKA {name: $abhidhamma})
        MERGE (tipitaka)-[:HAS_PITAKA]->(vinaya)
        MERGE (tipitaka)-[:HAS_PITAKA]->(sutta)
        MERGE (tipitaka)-[:HAS_PITAKA]->(abhidhamma)
        `,
        {
          name: 'Tipitaka',
          attribution: 'http://www.tipitaka.org',
          vinaya: 'Vinaya',
          sutta: 'Sutta',
          abhidhamma: 'Abhidhamma',
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }

    console.log(`BasicNikayaSetup End...`);
  }

  async handleNewBook(info) {
    if (!(info && info.data)) {
      throw new DBServiceDriverError(
        'Parameter error: book info object is not valid '
      );
    }

    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
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

      await driver.executeQuery(
        `
        MATCH (p :PITAKA {name: $pitakaName})
        MERGE (n :NIKAYA {name: $nikayaName})
        MERGE (p)-[:CONTAINS]->(n)
        MERGE (book :BOOK {name: $bookName, id: $bookId})
        MERGE (n)-[:HAS_BOOK]->(book)
    `,
        {
          pitakaName: bookNode.pitakaName,
          nikayaName: bookNode.belongsTo,
          bookName: bookNode.name,
          bookId: bookNode.id,
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(`New Book Entry: ${e.message}`);
    } finally {
    }
  }

  async handleNewNikayaEntry(info) {
    if (!(info && info.data)) {
      throw new DBServiceDriverError(
        'Parameter error: book info object is not valid '
      );
    }

    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      let nikayaEntryNode = {};

      nikayaEntryNode.bookId = info.data.id.toUpperCase().split('_')[0];
      nikayaEntryNode.subtype = info.data.subtype;
      nikayaEntryNode.id = info.data.id.toUpperCase();

      console.log(`Nikaya Entry Node: ${JSON.stringify(nikayaEntryNode)}`);

      await driver.executeQuery(
        `
        MATCH (book :BOOK {id: $bookId})
        MERGE (book)-[:NIKAYA_ENTRY]->(ne :NIKAYAENTRY {id: $nikayaEntryId, type: $nikayaEntryType})
    `,
        {
          bookId: nikayaEntryNode.bookId,
          nikayaEntryId: nikayaEntryNode.id,
          nikayaEntryType: nikayaEntryNode.subtype,
        }
      );

      console.log(`Nikaya Entry Node RETURN: ${nikayaEntryNode.id}`);
      return nikayaEntryNode.id;
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleSetNikayaEntryTitle(forEntryId, title) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(
        `Nikaya Entry Title Setting Node: For ${forEntryId} to ${title}`
      );

      await driver.executeQuery(
        `
          MATCH (ne :NIKAYAENTRY {id: $nikayaEntryId})
          SET ne.name = $nikayaEntryName
      `,
        {
          nikayaEntryId: forEntryId,
          nikayaEntryName: title,
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleNewSuttaVaggaSection(forEntryId, sectionId, title) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(
        `Sutta Section : For ${forEntryId} to ${title} with ID :${sectionId}`
      );

      await driver.executeQuery(
        `MATCH (ne :NIKAYAENTRY {id: $nikayaEntryId})
          MERGE (ne)-[:HAS_SUBSECTION]->(subSutta :SUBSECTION {name: $subSectionName, id: $subSectionId})
          RETURN ne, subSutta
      `,
        {
          nikayaEntryId: forEntryId,
          subSectionName: title,
          subSectionId: sectionId,
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleNewPara(lastNikayaEntryId, nodeId, paraText) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(
        `New para : For ${lastNikayaEntryId} with nodeId ${nodeId} to ${paraText.substring(
          0,
          10
        )}`
      );

      await driver.executeQuery(
        `
          MATCH (ne :SUBSECTION {id: $lastNikayaEntryId})
          MERGE (ne)-[:HAS_PARA]->(para :PARA {id: $paraId, text: $paraText})
          RETURN ne, para
      `,
        {
          lastNikayaEntryId: lastNikayaEntryId,
          paraId: nodeId,
          paraText: paraText.trim(),
        }
      );

      //Split the lines of 'unicode -' OR 'unicode |'
      const lines = paraText.split(/\u2013|\u0964/);
      console.log(`*** LINES ***`);
      lines.forEach(async (line) => {
        console.log(line);
        if (line.length !== 0) {
          await driver.executeQuery(
            `
              MATCH (p :PARA {id: $paraId})
              MERGE (l :LINE {text: $lineText})
              MERGE (p)-[:HAS_LINE]->(l)
              RETURN l
          `,
            {
              paraId: nodeId,
              lineText: line.trim(),
            }
          );
        }
      });
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleNewSubPara(nodeId, subParaId, subParaText) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(
        `New Subpara : For ${nodeId} with id ${subParaId} to ${subParaText.substring(
          0,
          20
        )}`
      );

      await driver.executeQuery(
        `
          MATCH (para :PARA {id: $nodeId})
          MERGE (subPara :SUBPARA {id: $subParaId, text: $subParaText})
          MERGE (para)-[:HAS_SUBPARA]->(subPara)
          RETURN para, subPara
      `,
        {
          nodeId: nodeId,
          subParaId: subParaId,
          subParaText: subParaText,
        }
      );

      //Split the lines of 'unicode -' OR 'unicode |'
      const lines = subParaText.split(/\u2013|\u0964/);
      console.log(`*** SUBPARA LINES ***`);
      lines.forEach(async (line) => {
        console.log(line);
        if (line.length !== 0) {
          await driver.executeQuery(
            `
              MATCH (sp :SUBPARA {id: $subParaId})
              MERGE (l :LINE {text: $lineText})
              MERGE (sp)-[:HAS_LINE]->(l)
              RETURN l
          `,
            {
              subParaId: subParaId,
              lineText: line,
            }
          );
        }
      });
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleNewGatha(nodeId, subParaId, gathaText) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(
        `New Section Ending Gatha : For ${nodeId} with id ${subParaId} to ${gathaText.substring(
          0,
          20
        )}`
      );

      await driver.executeQuery(
        `
          MATCH (para :PARA {id: $nodeId})
          MERGE (subPara :SUBPARA {id: $subParaId, text: $gathaText, type: $subParaType})
          MERGE (para)-[:HAS_SUBPARA]->(subPara)
          RETURN para, subPara
      `,
        {
          nodeId: nodeId,
          subParaId: subParaId,
          gathaText: gathaText,
          subParaType: 'GATHA',
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleBookEndingGatha(neId, subParaId, gathaText, gathaType) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(
        `Book Ending Gatha : Type: ${gathaType} For book ${neId}, id ${subParaId} to ${gathaText.substring(
          0,
          20
        )}`
      );

      // await driver.executeQuery(
      //   `
      //     MATCH (ne :NIKAYAENTRY {id: $neId})
      //     MERGE (subPara :SUBPARA {id: $subParaId, text: $gathaText, type: $gathaType})
      //     MERGE (ne)-[:HAS_SUBPARA]->(subPara)
      //     RETURN ne, subPara
      // `,
      //   {
      //     neId: neId,
      //     subParaId: subParaId,
      //     gathaText: gathaText,
      //     gathaType: gathaType,
      //   }
      // );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleNETrailer(neId, neTrailerText) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(`New Section Trailer : For ${neId} to ${neTrailerText}`);

      await driver.executeQuery(
        `
          MATCH (ne :NIKAYAENTRY {id: $neId})
          MERGE (t :TRAILER {text: $neTrailerText})
          MERGE (ne)-[:HAS_TRAILER]->(t)
          RETURN t
      `,
        {
          neId: neId,
          neTrailerText: neTrailerText,
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async handleBookTrailer(bookId, bookTrailerText) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      console.log(`Book Trailer : For ${bookId} to ${bookTrailerText}`);

      await driver.executeQuery(
        `
          MATCH (b :BOOK {id: $bookId})
          MERGE (t :TRAILER {text: $bookTrailerText})
          MERGE (b)-[:HAS_TRAILER]->(t)
          RETURN t
      `,
        {
          bookId: bookId,
          bookTrailerText: bookTrailerText,
        }
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async pruneDB() {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      await driver.executeQuery(
        `
          MATCH (n) DETACH DELETE n
      `
      );
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }
}
