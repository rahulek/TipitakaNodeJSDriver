import xml2js from 'xml2js';
import XMLFileReadError from '../errors/xml-file-read-error.js';
import fs from 'node:fs';
import {
  handleNewBook,
  handleNewNikayaEntry,
  handleSetNikayaEntryTitle,
  handleNewSuttaVaggaSection,
  handleNewPara,
  handleNewSubPara,
  handleNewSectionEndingGatha,
  handleNETrailer,
  handleBookTrailer,
} from '../tipitaka/db-service.js';

import { asyncLocalStorage } from '../index.js';

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
} from '../constants.js';

//Tiptaka XML File structure
//<TEI.2>
// --  <front>
// --  <back>
// --  <body>
// ------- <p>
// ------- <div>
// ------------- <head>
// ------------- <div>       { e.g anguttar's pannasaka }
// ------------------ <p>
// ------------------ <head>
// ------------------ <trailer>
// ------------------- <div>  { used for Anguttara's vagga }
//----------------------- <p>
//----------------------- <head>
// ------------- <p>
// ------------- <trailer>
// </TEI.2>

export async function processTipitakaXML(filename) {
  var parser = new xml2js.Parser();
  console.log(`Processing: ${filename}`);
  return await fs.readFile(filename, 'utf8', function (err, data) {
    if (err) {
      console.log(`File read error: ${err}`);
      throw new XMLFileReadError(`File: ${filename} could not be read..`);
    }

    parser.parseString(data, async function (err, result) {
      if (err) {
        console.error(`XML Parse Error: ${err}`);
        exit(-1);
      } else {
        //JSON Processing
        let tei = result[`TEI.2`];
        let textSections = tei.text;
        textSections &&
          textSections.forEach(async (ts) => {
            let body = ts && ts.body;
            body &&
              body.forEach(async (tsb) => {
                //Process all top-level Ps
                console.log(`---------- TOP HEADERS -----------`);
                tsb.p &&
                  tsb.p.forEach(async (p) => {
                    if (p['$']['rend']) {
                      if (p['$']['rend'] == 'nikaya') {
                        //console.log(`<METADATA> Nikaya: ${p['_']}`);
                        const info = {
                          type: METADATA_TOPHEADER_NIKAYA,
                          data: p['_'],
                        };

                        await metaDataCallback(info);
                      }
                    }
                    //console.log(p['_']);
                    const info = {
                      type: METADATA_TOPHEADER_TEXT,
                      data: p['_'],
                    };
                    await metaDataCallback(info);
                  });

                //Process all Divs
                console.log(`---------- TEXT ------------`);
                tsb &&
                  tsb.div &&
                  tsb.div.forEach(async (tsbDiv) => {
                    let tsbDiv$ = tsbDiv.$;
                    let tsbDivHead = tsbDiv.head;
                    let tsbDivDivs = tsbDiv.div;
                    let tsbDivPs = tsbDiv.p;
                    let tsbDivTrailer = tsbDiv.trailer;

                    if (tsbDiv$.type === 'book') {
                      if (tsbDivHead && tsbDiv$) {
                        // console.log(
                        //   `---- <METADATA> Book: ${tsbDivHead[0]['_']} with id = ${tsbDiv$.id} ----`
                        // );
                        const info = {
                          type: METADATA_BOOK,
                          data: {
                            title: tsbDivHead[0]['_'],
                            id: tsbDiv$.id,
                          },
                        };
                        await metaDataCallback(info);
                      }
                    }

                    //Text--Body--Div-Head
                    tsbDivHead &&
                      tsbDivHead.forEach((tsbDivHeader) => {
                        //TODO: Check if this really can be commented
                        //console.log(`${tsbDivHeader['_']}`);
                      });
                    //Text--Body--Div--Div
                    tsbDivDivs &&
                      tsbDivDivs.forEach(async (tsbDivDivEntry) => {
                        //ID and Nikaya
                        if (
                          tsbDivDivEntry['$']['id'] &&
                          tsbDivDivEntry['$']['type']
                        ) {
                          // console.log(
                          //   `<METADATA> Nikaya: ${tsbDivDivEntry['$']['type']}, id: ${tsbDivDivEntry['$']['id']}`
                          // );
                          const info = {
                            type: METADATA_NIKAYA,
                            data: {
                              subtype: tsbDivDivEntry['$']['type'],
                              id: tsbDivDivEntry['$']['id'],
                            },
                          };
                          await metaDataCallback(info);
                        }
                        //TS-Body-Div-Div-head
                        let tsbDivDivHead = tsbDivDivEntry.head;
                        tsbDivDivHead &&
                          tsbDivDivHead.forEach(async (tsbDivDivHeadEntry) => {
                            if (tsbDivDivHeadEntry['$']['rend']) {
                              if (
                                tsbDivDivHeadEntry['$']['rend'] == 'chapter'
                              ) {
                                // console.log(
                                //   `<METADATA> SUB-BOOK TITLE: ${tsbDivDivHeadEntry['_']}`
                                // );
                                const info = {
                                  type: METADATA_SUB_SECTION_TITLE,
                                  data: {
                                    title: tsbDivDivHeadEntry['_'],
                                  },
                                };
                                await metaDataCallback(info);
                              }
                            }
                            //TODO: Check if this really can be commented
                            //console.log(tsbDivDivHeadEntry['_']);
                          });
                        //TS-Body-Div-Div-p
                        let tsbDivDivPs = tsbDivDivEntry.p;
                        tsbDivDivPs &&
                          tsbDivDivPs.forEach(async (tsbDivDivPEntry) => {
                            //Is this a new sub-book
                            if (tsbDivDivPEntry['$']['rend']) {
                              let info = {};
                              info.data = { title: tsbDivDivPEntry['_'] };
                              if (tsbDivDivPEntry['$']['rend'] === 'title') {
                                // console.log(
                                //   `<METADATA> SUB-BOOK VAGGA: ${tsbDivDivPEntry['_']}`
                                // );
                                info.type = METADATA_SUB_SECTION_TYPE_VAGGA;
                              } else if (
                                tsbDivDivPEntry['$']['rend'] === 'subhead'
                              ) {
                                // console.log(
                                //   `<METADATA> SUB-BOOK SUTTA: ${tsbDivDivPEntry['_']}`
                                // );
                                info.type = METADATA_SUB_SECTION_TYPE_SUTTA;
                              }
                              await metaDataCallback(info);
                            }
                            //Any gatha?
                            if (tsbDivDivPEntry['$']['rend']) {
                              if (
                                tsbDivDivPEntry['$']['rend'].startsWith('gatha')
                              ) {
                                // console.log(
                                //   `<METADATA> SUB-BOOK END GATHA: ${tsbDivDivPEntry['$']['rend']}`
                                // );
                                const info = {
                                  type: METADATA_SUB_SECTION_END_GATHA,
                                  data: {
                                    subtype: tsbDivDivPEntry['$']['rend'],
                                    text:
                                      tsbDivDivPEntry['_'] &&
                                      tsbDivDivPEntry['_'],
                                  },
                                };
                                await metaDataCallback(info);
                              }
                            }
                            let highlights = tsbDivDivPEntry.hi;
                            if (highlights) {
                              highlights.forEach((hl) => {
                                hl['_'] &&
                                  console.log(
                                    `<METADATA> Highlight Text: ${hl['_']}`
                                  );
                              });
                            }

                            let paraInfo = {
                              type: METADATA_PALI_TEXT_PARA,
                              data: {},
                            };

                            if (
                              tsbDivDivPEntry['$']['rend'] &&
                              tsbDivDivPEntry['$']['n']
                            ) {
                              // console.log(
                              //   `<METADATA> BODYTEXT with id: ${tsbDivDivPEntry['$']['n']}`
                              // );
                              paraInfo.data.id = tsbDivDivPEntry['$']['n'];
                            }
                            if (tsbDivDivPEntry['_']) {
                              //console.log(tsbDivDivPEntry['_']);
                              paraInfo.data.text = tsbDivDivPEntry['_'];
                            }
                            await metaDataCallback(paraInfo);
                            //console.log('~ * ~ * ~ * ~ * ~ *');
                          });
                        //TS-Body-Div-Div-trailer
                        let tsbDivDivTrailers = tsbDivDivEntry.trailer;
                        tsbDivDivTrailers &&
                          tsbDivDivTrailers.forEach(
                            async (tsbDivDivTrailerEntry) => {
                              //console.log(tsbDivDivTrailerEntry['_']);
                              const info = {
                                type: METADATA_TRAILER,
                                data: {
                                  text: tsbDivDivTrailerEntry['_'],
                                },
                              };
                              await metaDataCallback(info);
                            }
                          );
                      });
                    //Text--Body--Div--p
                    tsbDivPs &&
                      tsbDivPs.forEach(async (tsbDivPEntry) => {
                        if (tsbDivPEntry['$']['rend']) {
                          if (tsbDivPEntry['$']['rend'].startsWith('gatha')) {
                            // console.log(
                            //   `<METADATA> BOOK-END GATHA: ${tsbDivPEntry['$']['rend']}`
                            // );
                            const info = {
                              type: METADATA_BOOK_END_GATHA,
                              data: {
                                subtype: tsbDivPEntry['$']['rend'],
                                text: tsbDivPEntry['_'] && tsbDivPEntry['_'],
                              },
                            };
                            await metaDataCallback(info);
                          }
                        }
                        //TODO: See if this is really ok to be commented
                        //console.log(tsbDivPEntry['_']);
                      });
                    //Text--Body--Div--Trailer
                    tsbDivTrailer &&
                      tsbDivTrailer.forEach(async (tsbDivTrailerEntry) => {
                        //console.log(tsbDivTrailerEntry['_']);
                        const info = {
                          type: METADATA_OUTER_TRAILER,
                          data: {
                            text: tsbDivTrailerEntry['_'],
                          },
                        };
                        await metaDataCallback(info);
                      });
                  });
              });
          });
      }
    });

    return 0;
  });
}

async function metaDataCallback(info) {
  if (!info) {
    return;
  }

  try {
    switch (info.type) {
      case METADATA_TOPHEADER_NIKAYA:
        console.log(`Top Header Nikaya: ${info.data}`);
        break;
      case METADATA_TOPHEADER_TEXT:
        console.log(`Top Header Text: ${info.data}`);
        break;
      case METADATA_BOOK:
        console.log(`Book: ${info.data.title} - ${info.data.id}`);
        asyncLocalStorage.getStore().bookId = info.data.id.toUpperCase();
        await handleNewBook(info);
        break;
      case METADATA_NIKAYA:
        console.log(`Nikaya Type: ${info.data.subtype} - ${info.data.id}`);
        let lastNikayaEntryId = await handleNewNikayaEntry(info);
        const store = asyncLocalStorage.getStore();
        store.lastNikayaEntryId = lastNikayaEntryId;
        console.log(`Last NE ID set to ${store['lastNikayaEntryId']}`);
        break;
      case METADATA_SUB_SECTION_TITLE:
        console.log(`Nikaya Entry Title: ${info.data.title}`);
        console.log(
          `Last NE ID passing in ${
            asyncLocalStorage.getStore().lastNikayaEntryId
          }`
        );
        await handleSetNikayaEntryTitle(
          asyncLocalStorage.getStore().lastNikayaEntryId,
          info.data.title
        );
        break;
      case METADATA_SUB_SECTION_TYPE_SUTTA:
        console.log(`Sub Section Type: Sutta: ${info.data.title}`);
        console.log(
          `Last NE ID passing in ${
            asyncLocalStorage.getStore().lastNikayaEntryId
          }`
        );
        await handleNewSuttaVaggaSection(
          asyncLocalStorage.getStore().lastNikayaEntryId,
          info.data.title
        );
        break;
      case METADATA_SUB_SECTION_TYPE_VAGGA:
        console.log(`Sub Section Type: Vagga: ${info.data.title}`);
        console.log(
          `Last NE ID passing in ${
            asyncLocalStorage.getStore().lastNikayaEntryId
          }`
        );

        await handleNewSuttaVaggaSection(
          asyncLocalStorage.getStore().lastNikayaEntryId,
          info.data.title
        );
        break;
      case METADATA_SUB_SECTION_END_GATHA:
        console.log(`Sub Section Ending Gatha: ${info.data.subtype}`);
        console.log(`Sub Section Ending Gatha Text: ${info.data.text}`);

        if (info.data.subtype === 'gatha1') {
          //Start accumulating
          asyncLocalStorage.getStore().sseGathaText = info.data.text;
        } else if (info.data.subtype === 'gathalast') {
          const currentText = asyncLocalStorage.getStore().sseGathaText;
          asyncLocalStorage.getStore().sseGathaText = `${currentText}\n${info.data.text}`;
          //Write to the DB
          console.log(
            `** SUBSECTION WHOLE GATHA TEXT: ${
              asyncLocalStorage.getStore().sseGathaText
            }`
          );
          const lastNodeId = asyncLocalStorage.getStore().lastNodeId;
          const subParaNumber = asyncLocalStorage.getStore().subParaNumber;
          const subParaId = `${lastNodeId}_${
            asyncLocalStorage.getStore().subParaNumber
          }`;
          asyncLocalStorage.getStore().subParaNumber = subParaNumber + 1;
          await handleNewSectionEndingGatha(
            lastNodeId,
            subParaId,
            asyncLocalStorage.getStore().sseGathaText,
            'SSE_GATHA' //Subsection Ending Gatha
          );
        } else {
          //append to the text
          const currentText = asyncLocalStorage.getStore().sseGathaText;
          asyncLocalStorage.getStore().sseGathaText = `${currentText}\n${info.data.text}`;
        }
        break;
      case METADATA_PALI_TEXT_PARA:
        console.log(`Pali Text ID: ${info.data.id}`);
        console.log(`Pali Text: ${info.data.text}`);
        console.log('~ * ~ * ~ * ~ * ~ *');
        if (info.data.id === undefined) {
          //TO DO
          console.log(
            `NO_ID Para: LastNodeID is ${
              asyncLocalStorage.getStore().lastNodeId
            }`
          );
          const lastNodeId = asyncLocalStorage.getStore().lastNodeId;
          const subParaNumber = asyncLocalStorage.getStore().subParaNumber;
          const subParaId = `${lastNodeId}_${
            asyncLocalStorage.getStore().subParaNumber
          }`;
          asyncLocalStorage.getStore().subParaNumber = subParaNumber + 1;
          await handleNewSubPara(lastNodeId, subParaId, info.data.text);
        } else {
          const lastNikayaEntryId =
            asyncLocalStorage.getStore().lastNikayaEntryId;
          const nodeId = `${lastNikayaEntryId}_${info.data.id}`;
          asyncLocalStorage.getStore().lastNodeId = nodeId;
          asyncLocalStorage.getStore().subParaNumber = 1;
          console.log(
            `LastNodeID set to ${asyncLocalStorage.getStore().lastNodeId}`
          );
          await handleNewPara(lastNikayaEntryId, nodeId, info.data.text);
        }
        break;
      case METADATA_TRAILER:
        console.log(`Trailer: ${info.data.text}`);
        const neId = asyncLocalStorage.getStore().lastNikayaEntryId;
        await handleNETrailer(neId, info.data.text);
        break;
      case METADATA_BOOK_END_GATHA:
        console.log(`Book End Gatha: ${info.data.subtype}`);
        console.log(`Book End Gatha Text: ${info.data.text}`);

        if (info.data.subtype === 'gatha1') {
          //Start accumulating
          asyncLocalStorage.getStore().bookEndGathaText = info.data.text;
        } else if (info.data.subtype === 'gathalast') {
          const currentText = asyncLocalStorage.getStore().bookEndGathaText;
          asyncLocalStorage.getStore().bookEndGathaText = `${currentText}\n${info.data.text}`;
          //Write to the DB
          console.log(
            `** WHOLE GATHA TEXT: ${
              asyncLocalStorage.getStore().bookEndGathaText
            }`
          );
        } else {
          //append to the text
          const currentText = asyncLocalStorage.getStore().bookEndGathaText;
          asyncLocalStorage.getStore().bookEndGathaText = `${currentText}\n${info.data.text}`;
        }
        break;
      case METADATA_OUTER_TRAILER:
        console.log(`Outer Trailer Text: ${info.data.text}`);
        const bookId = asyncLocalStorage.getStore().bookId;
        await handleBookTrailer(bookId, info.data.text);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error(e.message);
  }
}
