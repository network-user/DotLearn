export class NeuralVizConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NeuralVizConfigError';
  }
}
