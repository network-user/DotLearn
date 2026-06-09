import { Injectable } from '@nestjs/common';

@Injectable()
export class SessionEpochService {
  private readonly epochs = new Map<string, number>();

  current(subject: string): number {
    return this.epochs.get(subject) ?? 0;
  }

  bump(subject: string): number {
    const next = this.current(subject) + 1;
    this.epochs.set(subject, next);
    return next;
  }
}
