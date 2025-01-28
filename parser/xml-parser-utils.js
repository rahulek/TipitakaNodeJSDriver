import xml2js from 'xml2js';
import XMLFileReadError from '../errors/xml-file-read-error.js';
import fs from 'node:fs';
import {
  METADATA_TOPHEADER_NIKAYA,
  METADATA_TOPHEADER_TEXT,
  METADATA_BOOK,
  METADATA_NIKAYA,
  METADATA_SUB_SECTION_TITLE,
  METADATA_SUB_SECTION_TYPE_SUTTA,
  METADATA_SUB_SECTION_TYPE_VAGGA,
  METADATA_PALI_TEXT_PARA,
  METADATA_TRAILER,
  METADATA_GATHA,
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

export class TipitakaParser {
  constructor(filename, dbService, metaDataCallback, logger) {
    this.filename = filename;
    this.dbService = dbService;
    this.metaDataCallback = metaDataCallback;
    this.readCallback = this.readFileCallback.bind(this);
    this.parserCallback = this.parserDataCallback.bind(this);
    this.logger = logger;
  }

  parserDataCallback(error, result) {
    if (error) {
      throw new Error(`XML Parse Error: ${error}`);
      exit(-1);
    }
    let tei = result[`TEI.2`];
    let textSections = tei.text;
    textSections &&
      textSections.forEach((ts) => {
        let body = ts && ts.body;
        body.forEach((tsb) => {
          //Process all top-level Ps
          // console.log(`---------- TOP HEADERS -----------`);
          tsb &&
            tsb.p &&
            tsb.p.forEach((p) => {
              let info = {};
              if (p['$']['rend']) {
                if (p['$']['rend'] == 'nikaya') {
                  // console.log(`<METADATA> Nikaya: ${p['_']}`);
                  info = {
                    type: METADATA_TOPHEADER_NIKAYA,
                    data: {
                      text: p['_'],
                    },
                  };
                }
              }
              // console.log(p['_']);
              info = {
                type: METADATA_TOPHEADER_TEXT,
                data: {
                  text: p['_'],
                },
              };
              this.metaDataCallback && this.metaDataCallback(info);
            });

          //Process all Divs
          // console.log(`---------- TEXT ------------`);
          tsb &&
            tsb.div &&
            tsb.div.forEach((d) => {
              this.processDiv(d);
            });
        });
      });
    return 'PARSER_DONE';
  }

  readFileCallback(err, data) {
    const xmlParser = new xml2js.Parser();

    if (err) {
      this.logger.error(`File read error: ${err}`);
      throw new XMLFileReadError(`File: ${this.filename} could not be read..`);
    }

    this.logger.info(`Start Parsing and populating the Graph`);

    this.dbService && this.dbService.basicNikayaSetup();
    if (xmlParser) {
      xmlParser.parseString(data, this.parserCallback);
    }

    return 'PARSER_DONE';
  }

  processXML(logger) {
    this.logger.info(`Processing: ${this.filename}`);
    const data = fs.readFileSync(this.filename, {
      encoding: 'utf8',
      flag: 'r',
    });

    if (data) {
      return this.readCallback(null, data);
    }
  }

  processDiv(div) {
    if (!div) {
      return;
    }

    const div$ = div.$;
    const divHead = div.head;
    const divDiv = div.div;
    const divP = div.p;
    const divTrailer = div.trailer;

    if (div$ && div$.type === 'book') {
      if (divHead && divHead[0]) {
        // console.log(
        //   `---- <METADATA> Book: ${divHead[0]['_']} with id = ${div$.id} ----`
        // );
        const info = {
          type: METADATA_BOOK,
          data: {
            id: div$.id,
            title: divHead[0]['_'],
          },
        };
        this.metaDataCallback && this.metaDataCallback(info);
      }
    }

    if (div['$']['id'] && div['$']['type'] && div['$']['type'] !== 'book') {
      // console.log(
      //   `<METADATA> Text Type: ${div['$']['type']}, id: ${div['$']['id']}`
      // );
      const info = {
        type: METADATA_NIKAYA,
        data: {
          subtype: div['$']['type'],
          id: div['$']['id'],
        },
      };
      this.metaDataCallback && this.metaDataCallback(info);
    }

    divHead &&
      divHead.forEach((divHeader) => {
        if (divHeader['$']['rend']) {
          if (divHeader['$']['rend'] === 'chapter') {
            // console.log(`<METADATA> SUB-BOOK TITLE: ${divHeader['_']}`);
          }
        }

        const info = {
          type: METADATA_SUB_SECTION_TITLE,
          data: {
            title: divHeader['_'],
          },
        };
        this.metaDataCallback && this.metaDataCallback(info);
      });

    divDiv &&
      divDiv.forEach((divDivEntry) => {
        this.processDiv(divDivEntry);
      });

    divP &&
      divP.forEach((divPEntry) => {
        if (divPEntry['$']['rend']) {
          if (divPEntry['$']['rend'].startsWith('gatha')) {
            // console.log(`<METADATA> GATHA: ${divPEntry['$']['rend']}`);
            const info = {
              type: METADATA_GATHA,
              data: {
                subtype: divPEntry['$']['rend'],
                text: divPEntry['_'],
              },
            };
            this.metaDataCallback && this.metaDataCallback(info);
          }

          if (divPEntry['$']['rend'] === 'title') {
            // console.log(`<METADATA> SUB-BOOK VAGGA: ${divPEntry['_']}`);
            const info = {
              type: METADATA_SUB_SECTION_TYPE_VAGGA,
              data: {
                title: divPEntry['_'],
              },
            };
            this.metaDataCallback && this.metaDataCallback(info);
          } else if (divPEntry['$']['rend'] === 'subhead') {
            // console.log(`<METADATA> SUB-BOOK SUTTA: ${divPEntry['_']}`);
            const info = {
              type: METADATA_SUB_SECTION_TYPE_SUTTA,
              data: {
                title: divPEntry['_'],
              },
            };
            this.metaDataCallback && this.metaDataCallback(info);
          }
        }

        divPEntry.hi &&
          divPEntry.hi.forEach((hl) => {
            // hl['_'] && console.log(`<METADATA> Highlight Text: ${hl['_']}`);
          });

        if (divPEntry['_']) {
          let info = {};
          if (divPEntry['$']['rend'] === 'subhead') {
            //Ignore
          } else {
            if (divPEntry['$']['n']) {
              // console.log(`<METADATA> Para Text: ${divPEntry['_']}`);
              info = {
                type: METADATA_PALI_TEXT_PARA,
                data: {
                  id: divPEntry['$']['n'],
                  text: divPEntry['_'],
                },
              };
            } else {
              // console.log(`<METADATA> Sub Para Text: ${divPEntry['_']}`);
              info = {
                type: METADATA_PALI_TEXT_PARA,
                data: {
                  id: undefined,
                  text: divPEntry['_'],
                },
              };
            }
            this.metaDataCallback && this.metaDataCallback(info);
          }
        }
        // console.log('~ * ~ * ~ * ~ * ~ *');
      });

    divTrailer &&
      divTrailer.forEach((divTrailerEntry) => {
        // console.log(`<METADATA> Trailer Text: ${divTrailerEntry['_']}`);
        const info = {
          type: METADATA_TRAILER,
          data: {
            text: divTrailerEntry['_'],
          },
        };
        this.metaDataCallback && this.metaDataCallback(info);
      });

    return;
  }
}
