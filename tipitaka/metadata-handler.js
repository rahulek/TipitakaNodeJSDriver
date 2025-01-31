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
  constructor(dbService, logger) {
    this.dbService = dbService;
    this.logger = logger;
  }

  metaDataCallback(info) {
    if (!info) {
      return;
    }

    try {
      const state = asyncLocalStorage.getStore();

      switch (info.type) {
        case METADATA_TOPHEADER_NIKAYA:
          this.logger.debug(`Top Header Nikaya: ${info.data.text}`);
          break;
        case METADATA_TOPHEADER_TEXT:
          this.logger.debug(`Top Header Text: ${JSON.stringify(info.data)}`);
          break;
        case METADATA_BOOK:
          this.logger.debug(`Book: ${info.data.title} - ${info.data.id}`);
          this.dbService && this.dbService.handleNewBook(info);
          if (state) {
            state.setBookName(info.data.title);
            state.setBookId(info.data.id);
          }
          break;
        case METADATA_NIKAYA:
          this.logger.debug(
            `Nikaya Type: ${info.data.subtype} - ${info.data.id}`
          );

          if (info.data.subtype === 'book') {
            if (state) {
              this.logger.debug(
                `NIKAYA BOOK: ${state.getBookId().toUpperCase()}`
              );
              state.setNikayaEntryId(state.getBookId().toUpperCase());
              state.setSuttaVaggaNumber(1);
            }
            return;
          }

          if (this.dbService) {
            const neID = this.dbService.handleNewNikayaEntry(info);
            if (state) {
              state.setNikayaEntryId(neID);
              state.setSuttaVaggaNumber(1);
            }
          }
          break;
        case METADATA_SUB_SECTION_TITLE:
          this.logger.debug(`Nikaya Entry Title: ${info.data.title}`);
          if (this.dbService && state) {
            this.dbService.handleSetNikayaEntryTitle(
              state.getNikayaEntryId(),
              info.data.title
            );
          }
          break;
        case METADATA_SUB_SECTION_TYPE_SUTTA:
          this.logger.debug(`Sub Section Type: Sutta: ${info.data.title}`);
          if (this.dbService && state) {
            const neID = state.getNikayaEntryId();
            const svNumber = state.getSuttaVaggaNumber();
            this.dbService.handleNewSuttaVaggaSection(
              neID,
              `${neID}_${svNumber}`,
              info.data.title
            );
            state.setSuttaVaggaNumber(svNumber + 1);
          }
          break;
        case METADATA_SUB_SECTION_TYPE_VAGGA:
          this.logger.debug(`Sub Section Type: Vagga: ${info.data.title}`);
          if (this.dbService && state) {
            const neID = state.getNikayaEntryId();
            const svNumber = state.getSuttaVaggaNumber();
            this.dbService.handleNewSuttaVaggaSection(
              neId,
              `${neID}_${svNumber}`,
              info.data.title
            );

            state.setSuttaVaggaNumber(svNumber + 1);
          }
          break;
        case METADATA_GATHA:
          this.logger.debug(`Gatha Type: ${info.data.subtype}`);
          this.logger.debug(`Gatha Text: ${info.data.text}`);

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
              const gathaText = state.getGathaText();
              state.setSubParaId(subParaId + 1);
              this.dbService.handleNewGatha(paraId, subParaNodeId, gathaText);
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
          this.logger.debug(`Pali Text ID: ${info.data.id}`);
          this.logger.debug(`Pali Text: ${info.data.text}`);
          this.logger.debug('~ * ~ * ~ * ~ * ~ *');
          if (info.data.id === undefined) {
            if (this.dbService && state) {
              const paraId = state.getParaId();
              const subParaId = state.getSubParaId();
              const subParaNodeId = `${paraId}_${subParaId}`;
              state.setSubParaId(subParaId + 1);
              const nextLineId = state.getNextLineId();
              const newNextLineId = this.dbService.handleNewSubPara(
                paraId,
                subParaNodeId,
                nextLineId,
                info.data.text
              );
              state.setNextLineId(newNextLineId);
            }
          } else {
            if (this.dbService && state) {
              const neID = state.getNikayaEntryId();
              let svNumber = state.getSuttaVaggaNumber();
              svNumber--;
              const nodeId = `${neID}_${svNumber}_${info.data.id}`;
              state.setParaId(nodeId);
              state.setSubParaId(1);
              const nextLineId = this.dbService.handleNewPara(
                `${neID}_${svNumber}`,
                nodeId,
                info.data.text
              );
              state.setNextLineId(nextLineId);
            }
          }
          break;
        case METADATA_TRAILER:
          this.logger.debug(`Trailer: ${info.data.text}`);
          if (this.dbService && state) {
            const neId = state.getNikayaEntryId();
            this.dbService.handleNETrailer(neId, info.data.text);
          }
          break;
        default:
          break;
      }
    } catch (e) {
      this.logger.error(e.message);
    }

    // const state = asyncLocalStorage.getStore();
    // this.logger.debug(`MetaDataCB: State: ${JSON.stringify(state, null, 1)}`);
  }
}
