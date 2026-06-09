export class ContractValidationError extends Error {
  constructor(
    public readonly resource: string,
    public readonly path: string,
    public readonly issues: readonly { path: ReadonlyArray<string | number>; message: string }[],
  ) {
    super(`Validation failed for ${resource} at ${path}: ${issues.length} issue(s)`);
    this.name = 'ContractValidationError';
  }
}

export class TopicReferenceError extends Error {
  constructor(
    public readonly slug: string,
    public readonly missingReference: string,
  ) {
    super(`Topic "${slug}" references missing resource: ${missingReference}`);
    this.name = 'TopicReferenceError';
  }
}
