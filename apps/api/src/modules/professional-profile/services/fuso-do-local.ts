/**
 * O mapa de UF para fuso **mora em `@gestao/types`**, e não aqui.
 *
 * Foi movido no Epic 6.1, quando a tela de perfil precisou dizer qual fuso gravou: manter a
 * tabela só no servidor obrigaria a web a adivinhar ou a perguntar, e a segunda cópia divergiria
 * no primeiro ajuste. Este arquivo continua existindo porque sete lugares importam daqui, e
 * porque é onde alguém procura.
 *
 * **A terceira cópia é deliberada e fica onde está:** a migration `1788374400000` tem o mapa
 * escrito em SQL, congelado no tempo dela. Migration não importa código de aplicação — o código
 * muda, e a migration já rodou.
 */
export { FUSOS_DO_BRASIL, FUSO_POR_UF, fusoConhecido, fusoDaUf, nomeDoFuso } from '@gestao/types';
