import { Throttle } from '@nestjs/throttler';

export { Throttle } from '@nestjs/throttler';

export const AuthThrottle = (): MethodDecorator & ClassDecorator =>
  Throttle({ auth: { limit: 5, ttl: 60000 } });
