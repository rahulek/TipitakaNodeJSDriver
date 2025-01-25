import { parseString } from 'xml2js';
import DBServiceDriverError from '../errors/db-service-error.js';
import { closeDriver, initDriver } from '../neo4j/neo4j.js';

export class Neo4JDBService {
  constructor(uri, username, password) {
    this.uri = uri;
    this.username = username;
    this.password = password;

    this.driver = initDriver(this.uri, this.username, this.password, {
      // maxConnectionLifetime: 10 * 60 * 1000, // 10 minutes
      // maxConnectionPoolSize: 300,
      //encrypted: process.env.NEO4J_ENCRYPTION || 'ENCRYPTION_ON',
      //trust: 'TRUST_ALL_CERTIFICATES',
    });
    console.log(`Connected to : ${this.uri}`);
    console.log(`driver: ${JSON.stringify(this.driver)}`);
  }

  async cleanUp() {
    await closeDriver(this.driver);
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

  async executeWriteTx(query, params) {
    const driver = this.driver;

    if (!driver) {
      throw new DBServiceDriverError('Neo4J Driver is not available.');
    }

    try {
      const session = driver.session();
      let tx = await session.beginTransaction();
      try {
        const res = await tx.run(query, params);
        await tx.commit();
        console.log(`RESULT1: ${JSON.stringify(res.summary.query.text)}`);
        console.log(`RESULT2: ${JSON.stringify(res.summary.query.parameters)}`);
        console.log(`RESULT3: ${JSON.stringify(res.summary.counters._stats)}`);
        return res;
      } catch (e) {
        console.log(`Rolling back the TX`);
        await tx.rollback();
      } finally {
        await session.close();
      }
    } catch (e) {
      throw new DBServiceDriverError(e.message);
    } finally {
    }
  }

  async basicNikayaSetup() {
    console.log(`BasicNikayaSetup Start...`);

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
    const result = await this.executeWriteTx(query, params);

    console.log(`BasicNikayaSetup End...`);
    return result;
  }

  async handleNewBook(info) {
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
    const result = await this.executeWriteTx(query, params);
  }

  async handleNewNikayaEntry(info) {
    if (!(info && info.data)) {
      throw new DBServiceDriverError(
        'Parameter error: book info object is not valid '
      );
    }

    let nikayaEntryNode = {};

    nikayaEntryNode.bookId = info.data.id.toUpperCase().split('_')[0];
    nikayaEntryNode.subtype = info.data.subtype;
    nikayaEntryNode.id = info.data.id.toUpperCase();

    console.log(`Nikaya Entry Node: ${JSON.stringify(nikayaEntryNode)}`);

    const query = `
        MATCH (book :BOOK {id: $bookId})
        MERGE (book)-[:NIKAYA_ENTRY]->(ne :NIKAYAENTRY {id: $nikayaEntryId, type: $nikayaEntryType})
    `;
    const params = {
      bookId: nikayaEntryNode.bookId,
      nikayaEntryId: nikayaEntryNode.id,
      nikayaEntryType: nikayaEntryNode.subtype,
    };

    const result = await this.executeWriteTx(query, params);

    console.log(`Nikaya Entry Node RETURN: ${nikayaEntryNode.id}`);
    return nikayaEntryNode.id;
  }

  async handleSetNikayaEntryTitle(forEntryId, title) {
    console.log(
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
    const result = await this.executeWriteTx(query, params);
  }

  async handleNewSuttaVaggaSection(forEntryId, sectionId, title) {
    console.log(
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
    const result = await this.executeWriteTx(query, params);
  }

  async handleNewPara(lastNikayaEntryId, nodeId, paraText) {
    console.log(
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
    const result1 = await this.executeWriteTx(query1, params1);

    //Split the lines of 'unicode -' OR 'unicode |'
    const lines = paraText.split(/\u2013|\u0964/);
    console.log(`*** LINES ***`);
    lines.forEach(async (line) => {
      console.log(line);
      if (line.length !== 0) {
        const query2 = `
              MATCH (p :PARA {id: $paraId})
              MERGE (l :LINE {text: $lineText})
              MERGE (p)-[:HAS_LINE]->(l)
              RETURN l
          `;
        const params2 = {
          paraId: nodeId,
          lineText: line.trim(),
        };
        await this.executeWriteTx(query2, params2);
      }
    });
  }

  async handleNewSubPara(nodeId, subParaId, subParaText) {
    console.log(
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
      subParaText: subParaText,
    };

    const result = await this.executeWriteTx(query1, params1);

    //Split the lines of 'unicode -' OR 'unicode |'
    const lines = subParaText.split(/\u2013|\u0964/);
    console.log(`*** SUBPARA LINES ***`);
    lines.forEach(async (line) => {
      console.log(line);
      if (line.length !== 0) {
        const query2 = `
              MATCH (sp :SUBPARA {id: $subParaId})
              MERGE (l :LINE {text: $lineText})
              MERGE (sp)-[:HAS_LINE]->(l)
              RETURN l
          `;
        const param2 = {
          subParaId: subParaId,
          lineText: line,
        };
        await this.executeWriteTx(query2, param2);
      }
    });
  }

  async handleNewGatha(nodeId, subParaId, gathaText) {
    console.log(
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

    const result = await this.executeWriteTx(query, params);
  }

  async handleBookEndingGatha(neId, subParaId, gathaText, gathaType) {
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
  }

  async handleNETrailer(neId, neTrailerText) {
    console.log(`New Section Trailer : For ${neId} to ${neTrailerText}`);

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
    const result = this.executeWriteTx(query, params);
  }

  async handleBookTrailer(bookId, bookTrailerText) {
    console.log(`Book Trailer : For ${bookId} to ${bookTrailerText}`);

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
    const result = await this.executeWriteTx(query, params);
  }

  async pruneDB() {
    const query = `
          MATCH (n) DETACH DELETE n
      `;
    const result = await this.executeWriteTx(query, null);
  }
}
