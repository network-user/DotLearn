export class ClinicError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ClinicError';
    this.code = code;
  }
}
