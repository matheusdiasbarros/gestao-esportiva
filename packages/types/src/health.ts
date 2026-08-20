export type DependencyStatus = 'up' | 'down';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  /** Momento da verificação, em ISO 8601 UTC. */
  checkedAt: string;
  /** Versão da API que respondeu. */
  version: string;
  dependencies: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}
