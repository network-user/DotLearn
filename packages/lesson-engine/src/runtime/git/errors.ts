export class GitError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'GitError';
  }
}
