export class GitTerminalSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitTerminalSetupError';
  }
}
