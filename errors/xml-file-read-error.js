export default class XMLFileReadError extends Error {
  constructor(message) {
    super(message);
    this.code = 'XMLReadError';
  }
}
