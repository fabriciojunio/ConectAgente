import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * O bloqueio de captura de tela é uma linha no layout raiz. Se alguém apagar
 * a linha, o app continua funcionando igual e nenhum outro teste quebra; o
 * prontuário só volta a aparecer em print e na lista de apps recentes.
 */
describe('proteção de tela', () => {
  const layout = readFileSync(join(__dirname, '..', '_layout.tsx'), 'utf8');

  it('o layout raiz liga o bloqueio de captura para o app inteiro', () => {
    expect(layout).toMatch(/import \{ usePreventScreenCapture \} from 'expo-screen-capture'/);
    expect(layout).toMatch(/export default function RootLayout\(\) \{\s*(\/\/.*\s*)*usePreventScreenCapture\(\);/);
  });
});
