import { SetMetadata } from '@nestjs/common';

export const STEP_UP_ACTION_KEY = 'auth:step-up-action';

export const RequireStepUp = (action: string): MethodDecorator & ClassDecorator =>
  SetMetadata(STEP_UP_ACTION_KEY, action);
