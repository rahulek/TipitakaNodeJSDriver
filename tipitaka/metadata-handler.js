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

import { asyncLocalStorage } from '../index.js';

export class MetaDataHandler {
  constructor(dbService) {
    this.dbService = dbService;
  }

  async metaDataCallback(info) {
    if (!info) {
      return;
    }

    try {
      const state = asyncLocalStorage.getStore();

      switch (info.type) {
        case METADATA_TOPHEADER_NIKAYA:
          console.log(`Top Header Nikaya: ${info.data.text}`);
          break;
        case METADATA_TOPHEADER_TEXT:
          console.log(`Top Header Text: ${info.data}`);
          break;
        case METADATA_BOOK:
          console.log(`Book: ${info.data.title} - ${info.data.id}`);
          if (state) {
            state.setBookName(info.data.title);
            state.setBookId(info.data.id);
          }
          this.dbService && (await this.dbService.handleNewBook(info));
          break;
        case METADATA_NIKAYA:
          console.log(`Nikaya Type: ${info.data.subtype} - ${info.data.id}`);

          if (this.dbService) {
            const neID = await this.dbService.handleNewNikayaEntry(info);
            if (state) {
              state.setNikayaEntryId(neID);
              state.setSuttaVaggaNumber(1);
            }
          }
          break;
        case METADATA_SUB_SECTION_TITLE:
          console.log(`Nikaya Entry Title: ${info.data.title}`);
          if (this.dbService && state) {
            await this.dbService.handleSetNikayaEntryTitle(
              state.getNikayaEntryId(),
              info.data.title
            );
          }
          break;
        case METADATA_SUB_SECTION_TYPE_SUTTA:
          console.log(`Sub Section Type: Sutta: ${info.data.title}`);
          if (this.dbService && state) {
            const neID = state.getNikayaEntryId();
            const svNumber = state.getSuttaVaggaNumber();
            state.setSuttaVaggaNumber(svNumber + 1);
            await this.dbService.handleNewSuttaVaggaSection(
              neID,
              `${neID}_${svNumber}`,
              info.data.title
            );
          }
          break;
        case METADATA_SUB_SECTION_TYPE_VAGGA:
          console.log(`Sub Section Type: Vagga: ${info.data.title}`);
          if (this.dbService && state) {
            const neID = state.getNikayaEntryId();
            const svNumber = state.getSuttaVaggaNumber();
            state.setSuttaVaggaNumber(svNumber + 1);
            await this.dbService.handleNewSuttaVaggaSection(
              neId,
              `${neID}_${svNumber}`,
              info.data.title
            );
          }
          break;
        case METADATA_GATHA:
          console.log(`Gatha Type: ${info.data.subtype}`);
          console.log(`Gatha Text: ${info.data.text}`);

          if (info.data.subtype === 'gatha1') {
            //Start accumulating
            state && state.setGathaText(info.data.text);
          } else if (info.data.subtype === 'gathalast') {
            //Append
            const gathaText = state.getGathaText();
            const newGathaText = `${gathaText}\n${info.data.text}`;
            state.setGathaText(newGathaText);

            //Write to the DB
            if (state && this.dbService) {
              const paraId = state.getParaId();
              const subParaId = state.getSubParaId();
              const subParaNodeId = `${paraId}_${subParaId}`;
              state.setSubParaId(subParaId + 1);
              const gathaText = state.getGathaText();
              await this.dbService.handleNewGatha(
                paraId,
                subParaNodeId,
                gathaText
              );
            }
          } else {
            if (state) {
              const gathaText = state.getGathaText();
              const newGathaText = `${gathaText}\n${info.data.text}`;
              state.setGathaText(newGathaText);
            }
          }
          break;
        case METADATA_PALI_TEXT_PARA:
          console.log(`Pali Text ID: ${info.data.id}`);
          console.log(`Pali Text: ${info.data.text}`);
          console.log('~ * ~ * ~ * ~ * ~ *');
          if (info.data.id === undefined) {
            if (this.dbService && state) {
              const paraId = state.getParaId();
              const subParaId = state.getSubParaId();
              const subParaNodeId = `${paraId}_${subParaId}`;
              state.setSubParaId(subParaId + 1);
              await this.dbService.handleNewSubPara(
                paraId,
                subParaNodeId,
                info.data.text
              );
            }
          } else {
            if (this.dbService && state) {
              const neID = state.getNikayaEntryId();
              const svNumber = state.getSuttaVaggaNumber();
              const nodeId = `${neID}_${svNumber}_${info.data.id}`;
              state.setParaId(nodeId);
              state.setSubParaId(1);
              await this.dbService.handleNewPara(
                `${neID}_${svNumber}`,
                nodeId,
                info.data.text
              );
            }
          }
          break;
        case METADATA_TRAILER:
          console.log(`Trailer: ${info.data.text}`);
          if (this.dbService && state) {
            const neId = state.getNikayaEntryId();
            await this.dbService.handleNETrailer(neId, info.data.text);
          }
          break;
        default:
          break;
      }
    } catch (e) {
      console.error(e.message);
    }

    const state = asyncLocalStorage.getStore();
    console.log(`MetaDataCB: State: ${JSON.stringify(state, null, 1)}`);
  }
}
