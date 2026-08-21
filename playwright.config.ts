import { defineConfig, devices } from '@playwright/test';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3333/api/v1';
const ehCI = Boolean(process.env.CI);

/**
 * Testes de tela ponta a ponta: navegador de verdade, contra a web, a API e o banco de verdade.
 *
 * **Só Chromium.** Os três navegadores triplicam o download e o tempo de cada execução, e o
 * que estamos protegendo aqui são fluxos de formulário e de sessão — não recursos onde os
 * motores divergem. Firefox e WebKit entram quando houver diferença de comportamento que
 * justifique, não por completude.
 *
 * Pré-requisito: `pnpm build`. O script `test:e2e` já faz isso, e o turbo aproveita o cache.
 */
export default defineConfig({
  testDir: './e2e',
  // Um teste que trava não pode segurar o CI até o limite do runner.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Teste que só passa quando repetido está escondendo um defeito de concorrência.
  forbidOnly: ehCI,
  retries: 0,
  workers: ehCI ? 1 : undefined,

  reporter: ehCI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: WEB,
    // Rastro só do que falhou: guardar tudo enche o artefato do CI sem ninguém olhar.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'pnpm --filter @gestao/api start',
      // Espera o health check, não a porta: a porta abre antes de o banco estar conectado, e
      // o primeiro teste falharia por corrida contra o boot.
      url: `${API}/health`,
      reuseExistingServer: !ehCI,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @gestao/web start',
      url: WEB,
      reuseExistingServer: !ehCI,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
