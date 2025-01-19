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
  constructor(filename, dbService, metaDataCallback) {
    this.filename = filename;
    this.dbService = dbService;
    this.metaDataCallback = metaDataCallback;
    this.readCallback = this.readFileCallback.bind(this);
    this.parserCallback = this.parserDataCallback.bind(this);
  }

  async parserDataCallback(error, result) {
    if (error) {
      throw new Error(`XML Parse Error: ${error}`);
      exit(-1);
    }
    let tei = result[`TEI.2`];
    let textSections = tei.text;
    textSections &&
      textSections.forEach(async (ts) => {
        let body = ts && ts.body;
        body.forEach((tsb) => {
          //Process all top-level Ps
          // console.log(`---------- TOP HEADERS -----------`);
          tsb &&
            tsb.p &&
            tsb.p.forEach(async (p) => {
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
              this.metaDataCallback && (await this.metaDataCallback(info));
            });

          //Process all Divs
          // console.log(`---------- TEXT ------------`);
          tsb &&
            tsb.div &&
            tsb.div.forEach(async (d) => {
              await this.processDiv(d);
            });
        });
      });
  }

  async readFileCallback(err, data) {
    const xmlParser = new xml2js.Parser();

    if (err) {
      console.log(`File read error: ${err}`);
      throw new XMLFileReadError(`File: ${this.filename} could not be read..`);
    }

    console.log(`Start Parsing and populating the Graph`);

    this.dbService && (await this.dbService.basicNikayaSetup());
    xmlParser &&
      xmlParser.parseString(data, async (err, result) => {
        await this.parserCallback(err, result);
      });

    return 0;
  }

  processXML() {
    console.log(`Processing: ${this.filename}`);
    return fs.readFile(
      this.filename,
      'utf8',
      async (err, data) => {
        await this.readCallback(err, data);
      } /*this.readCallback*/
    );
  }

  async processDiv(div) {
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

    divHead &&
      divHead.forEach(async (divHeader) => {
        if (divHeader['$']['rend']) {
          if (divHeader['$']['rend'] == 'chapter') {
            // console.log(`<METADATA> SUB-BOOK TITLE: ${divHeader['_']}`);
          }
        }
        // console.log(`${divHeader['_']}`);

        const info = {
          type: METADATA_SUB_SECTION_TITLE,
          data: {
            title: divHeader['_'],
          },
        };
        this.metaDataCallback && (await this.metaDataCallback(info));
      });

    if (div['$']['id'] && div['$']['type']) {
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
      this.metaDataCallback && (await this.metaDataCallback(info));
    }

    divDiv &&
      divDiv.forEach((divDivEntry) => {
        this.processDiv(divDivEntry);
      });

    divP &&
      divP.forEach(async (divPEntry) => {
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
            this.metaDataCallback && (await this.metaDataCallback(info));
          }

          if (divPEntry['$']['rend'] === 'title') {
            // console.log(`<METADATA> SUB-BOOK VAGGA: ${divPEntry['_']}`);
            const info = {
              type: METADATA_SUB_SECTION_TYPE_VAGGA,
              data: {
                title: divPEntry['_'],
              },
            };
            this.metaDataCallback && (await this.metaDataCallback(info));
          } else if (divPEntry['$']['rend'] === 'subhead') {
            // console.log(`<METADATA> SUB-BOOK SUTTA: ${divPEntry['_']}`);
            const info = {
              type: METADATA_SUB_SECTION_TYPE_SUTTA,
              data: {
                title: divPEntry['_'],
              },
            };
            this.metaDataCallback && (await this.metaDataCallback(info));
          }
        }

        divPEntry.hi &&
          divPEntry.hi.forEach((hl) => {
            // hl['_'] && console.log(`<METADATA> Highlight Text: ${hl['_']}`);
          });

        if (divPEntry['_']) {
          let info = {};
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
          this.metaDataCallback && (await this.metaDataCallback(info));
        }
        // console.log('~ * ~ * ~ * ~ * ~ *');
      });

    divTrailer &&
      divTrailer.forEach(async (divTrailerEntry) => {
        // console.log(`<METADATA> Trailer Text: ${divTrailerEntry['_']}`);
        const info = {
          type: METADATA_TRAILER,
          data: {
            text: divTrailerEntry['_'],
          },
        };
        this.metaDataCallback && (await this.metaDataCallback(info));
      });

    return;
  }
}
