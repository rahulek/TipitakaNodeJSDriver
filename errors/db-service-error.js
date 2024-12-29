export default class DBServiceDriverError extends Error {
  constructor(message) {
    super(message);
    this.code = 'DBServiceDriverError';
  }
}
