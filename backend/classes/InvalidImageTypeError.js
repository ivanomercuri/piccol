class InvalidImageTypeError extends Error {
  constructor(message = 'Solo file JPG o PNG sono ammessi') {
    super(message);
    this.name = 'InvalidImageTypeError';
    this.field = 'image'; // opzionale
  }
}

module.exports = InvalidImageTypeError;
