export class TipitakaState {
  constructor() {
    this.bookName = '';
    this.bookId = '';
    this.nikayaEntryId = '';
    this.suttaVaggaNumber = 0;
    this.paraId = '';
    this.subParaId = 1;
    this.gathaText = '';
    this.nextLineId = 0;
  }

  getBookId() {
    return this.bookId;
  }

  setBookId(bookId) {
    this.bookId = bookId;
  }

  getBookName() {
    return this.bookName;
  }

  setBookName(bookName) {
    this.bookName = bookName;
  }

  getNikayaEntryId() {
    return this.nikayaEntryId;
  }

  setNikayaEntryId(neId) {
    this.nikayaEntryId = neId;
  }

  getSuttaVaggaNumber() {
    return this.suttaVaggaNumber;
  }

  setSuttaVaggaNumber(svNumber) {
    this.suttaVaggaNumber = svNumber;
  }

  getParaId() {
    return this.paraId;
  }

  setParaId(paraId) {
    this.paraId = paraId;
  }

  getSubParaId() {
    return this.subParaId;
  }

  setSubParaId(subParaId) {
    this.subParaId = subParaId;
  }

  getGathaText() {
    return this.gathaText;
  }

  setGathaText(gathaText) {
    this.gathaText = gathaText;
  }

  getNextLineId() {
    return this.nextLineId;
  }

  setNextLineId(lineId) {
    this.nextLineId = lineId;
  }
}
