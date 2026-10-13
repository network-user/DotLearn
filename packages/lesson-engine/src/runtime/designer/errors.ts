export class DesignerCommandError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DesignerCommandError';
    this.code = code;
  }
}
