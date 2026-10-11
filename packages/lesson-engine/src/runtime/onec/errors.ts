export class OnecCommandError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OnecCommandError';
    this.code = code;
  }
}
