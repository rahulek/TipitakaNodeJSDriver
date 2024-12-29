import { getDriver } from '../neo4j/neo4j.js';
import DBServiceDriverError from '../errors/db-service-error.js';
import { toNativeTypes } from '../neo4j/neo4j-utils.js';

export async function basicNikayaSetup() {
  const driver = getDriver();

  if (!driver) {
    throw new DBServiceDriverError('Neo4J Driver is not available.');
  }

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
}

export async function handleNewBook(info) {
  if (!(info && info.data)) {
    throw new DBServiceDriverError(
      'Parameter error: book info object is not valid '
    );
  }

  const driver = getDriver();

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

export async function handleNewNikayaEntry(info) {
  if (!(info && info.data)) {
    throw new DBServiceDriverError(
      'Parameter error: book info object is not valid '
    );
  }

  const driver = getDriver();

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

export async function handleSetNikayaEntryTitle(forEntryId, title) {
  const driver = getDriver();

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

export async function handleNewSuttaVaggaSection(forEntryId, title) {
  const driver = getDriver();

  if (!driver) {
    throw new DBServiceDriverError('Neo4J Driver is not available.');
  }

  try {
    console.log(`Sutta Section : For ${forEntryId} to ${title}`);

    await driver.executeQuery(
      `MATCH (ne :NIKAYAENTRY {id: $nikayaEntryId})
        MERGE (ne)-[:HAS_SUBSECTION]->(subSutta :SUBSECTION {name: $subSectionName})
        RETURN ne, subSutta
    `,
      {
        nikayaEntryId: forEntryId,
        subSectionName: title,
      }
    );
  } catch (e) {
    throw new DBServiceDriverError(e.message);
  } finally {
  }
}

export async function handleNewPara(lastNikayaEntryId, nodeId, paraText) {
  const driver = getDriver();

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
        MATCH (ne :NIKAYAENTRY {id: $lastNikayaEntryId})
        MERGE (ne)-[:HAS_PARA]->(para :PARA {id: $paraId, text: $paraText})
        RETURN ne, para
    `,
      {
        lastNikayaEntryId: lastNikayaEntryId,
        paraId: nodeId,
        paraText: paraText,
      }
    );
  } catch (e) {
    throw new DBServiceDriverError(e.message);
  } finally {
  }
}

export async function handleNewSubPara(nodeId, subParaId, subParaText) {
  const driver = getDriver();

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
  } catch (e) {
    throw new DBServiceDriverError(e.message);
  } finally {
  }
}

export async function handleNewSectionEndingGatha(
  nodeId,
  subParaId,
  gathaText,
  gathaType
) {
  const driver = getDriver();

  if (!driver) {
    throw new DBServiceDriverError('Neo4J Driver is not available.');
  }

  try {
    console.log(
      `New Section Ending Gatha : Type: ${gathaType} For ${nodeId} with id ${subParaId} to ${gathaText.substring(
        0,
        20
      )}`
    );

    await driver.executeQuery(
      `
        MATCH (para :PARA {id: $nodeId})
        MERGE (subPara :SUBPARA {id: $subParaId, text: $gathaText, type: $gathaType})
        MERGE (para)-[:HAS_SUBPARA]->(subPara)
        RETURN para, subPara
    `,
      {
        nodeId: nodeId,
        subParaId: subParaId,
        gathaText: gathaText,
        gathaType: gathaType,
      }
    );
  } catch (e) {
    throw new DBServiceDriverError(e.message);
  } finally {
  }
}

export async function handleNETrailer(neId, neTrailerText) {
  const driver = getDriver();

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

export async function handleBookTrailer(bookId, bookTrailerText) {
  const driver = getDriver();

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

export async function pruneDB() {
  const driver = getDriver();

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
