class InvalidImageTypeError extends Error {
  field: string;

  constructor(message = 'Solo file JPG o PNG sono ammessi') {
    super(message);

    this.name = 'InvalidImageTypeError';

    this.field = 'image';
  }
}

module.exports = InvalidImageTypeError;